// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {invalidateOrderCache} from './privacy-cache';
import {randomUUID} from 'node:crypto';
import {tx,type SQL} from './database';
import {readModule,writeModule} from './modules';
import {audit,rateLimit,type Principal} from './security';
import {fail,seal,digest,unseal} from './crypto';
import {readRawState,writeRawState} from './repository';
import {workspacePolicy} from './workspace-policy';
import {mayApproveRetention} from './software-elevation';
import {queuePrivateFiles,cleanPrivacyFiles} from './privacy-files';
import {writeDeletionJournal,deletionContext,restoreDeletionJournal} from './privacy-guard';
import {retentionWindow,EMPTY_RETENTION,anonymizeOrder,type RetentionState,type ExtensionRequest} from '@/lib/retention';
import type {DeletionMarker} from './privacy-guard';
import {timeZoneOf} from '@/lib/settings';
import type {FinanceState} from '@/lib/team-finance';
import {EMPTY_FINANCE} from '@/lib/team-finance';
const current=()=>new Date().toISOString();
export async function retentionView(sql:SQL,p:Principal,now=Date.now()){
 const policy=(await workspacePolicy(sql,p)).data,state=await readModule<RetentionState>(sql,p,'retention',EMPTY_RETENTION),source=await readRawState(sql,p),canApprove=await mayApproveRetention(sql,p),manager=p.role==='owner'||p.role==='admin'||canApprove;
 const orderMap=new Map(source.data.orders.map(o=>[o.id,o])),allowed=(id:string)=>manager||orderMap.get(id)?.signatureMemberId===p.id;
 const items=source.data.orders.filter(o=>allowed(o.id)).flatMap(o=>{const window=retentionWindow(o,policy,state.data.extensions[o.id],now,timeZoneOf(source.data.settings));if(!window?.overdue)return [];const snooze=state.data.snoozes[p.id+':'+o.id];return [{orderId:o.id,orderNo:o.orderNo,customerName:o.customerName,...window,notice:window.remind&&(!snooze||Date.parse(snooze)<=now),snoozedUntil:snooze&&Date.parse(snooze)>now?snooze:undefined}];});
 const files=await sql.all<{order_id:string;total:number;external:number}>( "SELECT order_id,COUNT(*) AS total,SUM(CASE WHEN state='external' THEN 1 ELSE 0 END) AS external FROM privacy_files WHERE workspace_id=? AND state<>'acknowledged' GROUP BY order_id",[p.workspaceId]);
 return {revision:state.revision,canApprove,owner:p.role==='owner',policy:{retentionMonths:policy.retentionMonths,graceMonths:policy.graceMonths,retentionStart:policy.retentionStart,autoDelete:policy.autoDelete},items,requests:state.data.requests.filter(r=>manager||r.userId===p.id),pendingFiles:files.filter(r=>allowed(r.order_id)).map(r=>({orderId:r.order_id,count:Number(r.total),externalCount:Number(r.external)}))};
}
export async function retentionAPI(p:Principal,method:string,body:Record<string,unknown>={}){
 if(p.apiKeyId)fail('隐私保留操作需要登录会话',403);if(method==='GET')return tx(sql=>retentionView(sql,p));await rateLimit('retention:'+p.id,30,60);
 const action=String(body.action??''),orderId=String(body.orderId??'');
 if(action==='external-complete'){if(p.role!=='owner'||body.confirm!==true)fail('外部副本处理确认需要超级管理员',403);return tx(async sql=>{const rows=await sql.all<{id:string}>("SELECT id FROM privacy_files WHERE workspace_id=? AND order_id=? AND state='external'",[p.workspaceId,orderId]);for(const row of rows)await sql.run('UPDATE privacy_files SET state=?,body=?,updated_at=? WHERE id=?',['acknowledged',seal({base:'',relative:'',external:true},'privacy-file:'+row.id),current(),row.id]);const result=rows.length;await audit(sql,p,'privacy.external.complete',orderId);return {...await retentionView(sql,p),acknowledged:result};});}
 if(action==='purge'){if(p.role!=='owner'||body.confirm!==true)fail('清理需要超级管理员确认',403);await beginCleanup(p,orderId,false);return tx(sql=>retentionView(sql,p));}
 return tx(async sql=>{
  const state=await readModule<RetentionState>(sql,p,'retention',EMPTY_RETENTION);if(body.revision!==state.revision)fail('保留记录已变化，请刷新后核对',409);
  const source=await readRawState(sql,p),order=source.data.orders.find(o=>o.id===orderId);if(!order||order.anonymizedAt)fail('订单不存在或已清理',404);
  if(action==='snooze'){const hours=Number(body.hours??24);if(!Number.isInteger(hours)||hours<1||hours>168)fail('稍后提醒须为1–168小时');state.data.snoozes[p.id+':'+orderId]=new Date(Date.now()+hours*3600000).toISOString();}
  else if(action==='request'){const until=String(body.until??''),reason=String(body.reason??'').trim();if(!reason||reason.length>300||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(until)||!Number.isFinite(Date.parse(until))||new Date(until).toISOString()!==until.replace(/Z$/,until.includes('.')?'Z':'.000Z'))fail('请填写延期原因与有效的新期限');const policy=(await workspacePolicy(sql,p)).data,window=retentionWindow(order,policy,state.data.extensions[orderId]);if(!window||Date.parse(until)<=Math.max(Date.now(),Date.parse(window.due))||Date.parse(until)>Date.now()+10*366*86400000)fail('新期限须晚于当前保留期限，且不超过十年');if(state.data.requests.some(r=>r.orderId===orderId&&r.userId===p.id&&r.status==='pending'))fail('已有待审批申请',409);if(state.data.requests.length>=5000)fail('延期申请记录已满，请联系管理员归档');const record:ExtensionRequest={id:randomUUID(),orderId,userId:p.id,until,reason,at:current(),status:'pending'};state.data.requests.push(record);}
  else if(action==='approve'||action==='reject'){if(!await mayApproveRetention(sql,p))fail('需要超级管理员或有效延期审批提权',403);const record=state.data.requests.find(r=>r.id===body.requestId&&r.orderId===orderId&&r.status==='pending');if(!record)fail('申请不存在或已经处理',409);if(action==='approve'){const policy=(await workspacePolicy(sql,p)).data,window=retentionWindow(order,policy,state.data.extensions[orderId]);if(!window||Date.parse(record.until)<=Math.max(Date.now(),Date.parse(window.due)))fail('申请期限已经过期，请重新申请',409);state.data.extensions[orderId]=record.until;}record.status=action==='approve'?'approved':'rejected';record.decidedAt=current();record.decidedBy=p.id;}
  else fail('未知保留操作');state.revision++;await writeModule(sql,p,'retention',state);await audit(sql,p,'retention.'+action,orderId);return retentionView(sql,p);
 });
}
export async function beginCleanup(p:Pick<Principal,'workspaceId'|'id'>,orderId:string,automatic=true,now=Date.now()){
 return tx(async sql=>{
  const actor=p as Principal;await restoreDeletionJournal(sql,p.workspaceId);const source=await readRawState(sql,actor),order=source.data.orders.find(o=>o.id===orderId);if(!order)fail('订单不存在',404);
  const marker=await sql.one<{body:string}>('SELECT body FROM privacy_deletions WHERE workspace_id=? AND order_id=?',[p.workspaceId,orderId]);
  const policy=(await workspacePolicy(sql,actor)).data,state=await readModule<RetentionState>(sql,p,'retention',EMPTY_RETENTION),window=retentionWindow(order,policy,state.data.extensions[orderId],now,timeZoneOf(source.data.settings));
  if(!marker&&automatic&&!window?.autoDue)fail('订单尚未到自动清理期限',409);if(!marker&&!automatic&&!window?.overdue)fail('尚未进入待清理阶段',409);
  const previous=marker?unseal<DeletionMarker>(marker.body,deletionContext(p.workspaceId,orderId)):null;const at=previous?.at??new Date(now).toISOString(),archiveNo=previous?.archiveNo??'ARC-'+digest(p.workspaceId+'\0'+orderId).slice(0,10),entry:DeletionMarker={orderId,at,archiveNo,archive:anonymizeOrder(previous?.archive??order,at,archiveNo)};
  // Journal is durable before the irreversible action; a transaction retry may only repeat redaction.
  const count=await queuePrivateFiles(sql,p.workspaceId,orderId);if(marker&&previous?.archive&&!count)return {already:true};await writeDeletionJournal(p.workspaceId,entry);
  await sql.run('INSERT INTO privacy_deletions(workspace_id,order_id,body,created_at) VALUES(?,?,?,?) ON CONFLICT(workspace_id,order_id) DO UPDATE SET body=excluded.body',[p.workspaceId,orderId,seal(entry,deletionContext(p.workspaceId,orderId)),at]);
  source.data.orders=source.data.orders.map(o=>o.id===orderId?anonymizeOrder(o,at,archiveNo):o);source.data.preOrders=source.data.preOrders.filter(o=>o.orderId!==orderId);source.data.postOrders=source.data.postOrders.filter(o=>o.orderId!==orderId);source.data.logs=[];
  const finance=await readModule<FinanceState>(sql,p,'finance',EMPTY_FINANCE);for(const e of finance.data.entries)if(e.orderId===orderId){e.note='';e.orderNo=archiveNo;}finance.revision++;await writeModule(sql,p,'finance',finance);
  state.data.requests=state.data.requests.filter(r=>r.orderId!==orderId);delete state.data.extensions[orderId];for(const key of Object.keys(state.data.snoozes))if(key.endsWith(':'+orderId))delete state.data.snoozes[key];state.revision++;await writeModule(sql,p,'retention',state);
  await invalidateOrderCache(sql,p.workspaceId,orderId);
  await sql.run('DELETE FROM conversations WHERE workspace_id=?',[p.workspaceId]);await sql.run('DELETE FROM state_history WHERE workspace_id=?',[p.workspaceId]);
  await sql.run('DELETE FROM studio_modules WHERE workspace_id=? AND name LIKE ?',[p.workspaceId,'cli-pending:%']);
  await writeRawState(sql,actor,{revision:source.revision+1,data:source.data});await audit(sql,p,'privacy.cleanup',orderId);return {queuedFiles:count};
 });
}
let started=false,busy=false,timer:ReturnType<typeof setTimeout>|undefined;
const cursors=new Map<string,string>();
export function startRetention(){if(started)return;started=true;schedule(1000);}
function schedule(delay=60000){timer=setTimeout(()=>void sweep(),delay);timer.unref();}
/** Bounded pass; CLI policy gates new automatic deletions, never cleanup already authorized. */
export async function runRetentionSweep(now=Date.now()){
 const workspaces=await tx(sql=>sql.all<{id:string}>('SELECT id FROM workspaces'));
 for(const workspace of workspaces){
  const p={workspaceId:workspace.id,id:'privacy-scheduler'};
  await tx(sql=>restoreDeletionJournal(sql,workspace.id));
  const cursor=cursors.get(workspace.id)??'';
  const marked=await tx(sql=>sql.all<{order_id:string}>('SELECT order_id FROM privacy_deletions WHERE workspace_id=? AND order_id>? ORDER BY order_id LIMIT 20',[workspace.id,cursor]));
  cursors.set(workspace.id,marked.length===20?marked[marked.length-1].order_id:'');
  for(const row of marked)await beginCleanup(p,row.order_id).catch(e=>report(e));
  const due=await tx(async sql=>{const source=await readRawState(sql,p as Principal),state=await readModule<RetentionState>(sql,p,'retention',EMPTY_RETENTION),policy=(await workspacePolicy(sql,p as Principal)).data;return source.data.orders.filter(o=>retentionWindow(o,policy,state.data.extensions[o.id],now,timeZoneOf(source.data.settings))?.autoDue).slice(0,5).map(o=>o.id);});
  for(const id of due)await beginCleanup(p,id,true,now).catch(e=>report(e));
 }
 await cleanPrivacyFiles();
}
function report(e:unknown){if((e as {status?:number})?.status!==409)console.error('[Privacy cleanup]',e instanceof Error?e.message:'Failed');}
async function sweep(){if(busy)return;busy=true;try{await runRetentionSweep();}catch(e){console.error('[Privacy scheduler]',e instanceof Error?e.message:'Failed');}finally{busy=false;schedule();}}
