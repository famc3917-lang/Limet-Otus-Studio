// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {restoreDeletionJournal,applyDeletionMarkers} from './privacy-guard';
import {bindOrderMembers,memberDirectory} from './member-profiles';
import {capturePaymentChanges} from './team-finance';
import {tx,type SQL} from './database';
import {fail,seal,unseal} from './crypto';
import {audit,requireScope,type Principal} from './security';
import {validateData,deriveStage,workOrderFlow} from '@/lib/data-integrity';
import {executeBusiness,COMMAND_SCHEMAS} from '@/lib/business';
import {getExtensionCommand,type StudioCommand} from '@/lib/extensions';
import type {AppData,Order} from '@/lib/types';
import {mergeChanges} from '@/lib/merge-state';
import {buildSeedData} from '@/lib/seed';
import {readModule} from './modules';
import {EMPTY_FINANCE,type FinanceState} from '@/lib/team-finance';
import {rejectContactFields} from '@/lib/public-data-guard';
export interface Snapshot {revision:number;data:AppData}
const context=(p:Principal)=>'state:'+p.workspaceId;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export const aiOrder=(o:Order)=>({id:o.id,orderNo:o.orderNo,customerName:o.customerName,shootTime:o.shootTime,location:o.location,photographer:o.photographer,stage:o.stage,preOrderId:o.preOrderId,postOrderId:o.postOrderId,returnTime:o.returnTime,returnCount:o.returnCount});
export function visibleData(p:Principal,source:AppData){const data=structuredClone(source);if(!p.scopes.includes('contacts:read'))for(const o of data.orders){o.note='';o.paymentProofs={};if(o.refund)delete o.refund;}if(!p.scopes.includes('finance:read'))for(const o of data.orders){o.totalPrice=undefined;o.paymentStage=undefined;o.paymentMethods={};o.paymentProofs={};o.refund=undefined;}if(!p.scopes.includes('finance:read'))for(const pre of data.preOrders){pre.expense=undefined;pre.expenseNote='';}if(!p.scopes.includes('audit:read'))data.logs=[];return data;}
async function read(sql:SQL,p:Principal):Promise<Snapshot>{await restoreDeletionJournal(sql,p.workspaceId);const row=await sql.one<{revision:number;body:string}>('SELECT revision,body FROM business_state WHERE workspace_id=?',[p.workspaceId]);const result=row?{revision:row.revision,data:unseal<AppData>(row.body,context(p))}:{revision:0,data:buildSeedData()};const before=JSON.stringify(result.data);await applyDeletionMarkers(sql,p.workspaceId,result.data);if(row&&before!==JSON.stringify(result.data)){await sql.run('DELETE FROM state_history WHERE workspace_id=?',[p.workspaceId]);result.revision++;await write(sql,p,result);}return result;}
async function write(sql:SQL,p:Principal,snapshot:Snapshot){await applyDeletionMarkers(sql,p.workspaceId,snapshot.data);validateData(snapshot.data);const body=seal(snapshot.data,context(p));await sql.run('INSERT INTO business_state(workspace_id,revision,body) VALUES(?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET revision=excluded.revision,body=excluded.body',[p.workspaceId,snapshot.revision,body]);await sql.run('INSERT INTO state_history(workspace_id,revision,body) VALUES(?,?,?)',[p.workspaceId,snapshot.revision,body]);await sql.run('DELETE FROM state_history WHERE workspace_id=? AND revision<?',[p.workspaceId,snapshot.revision-30]);}
const financial=['totalPrice','paymentStage','paymentMethods','paymentProofs','refund','extras','extraQty'] as const;
function restoreProtectedData(p:Principal,current:AppData,proposed:AppData){
 const result=structuredClone(proposed),visible=visibleData(p,current);
 for(const row of result.orders){
  const original=current.orders.find(o=>o.id===row.id),shown=visible.orders.find(o=>o.id===row.id);
  const hidden:Array<keyof Order>=[];
  if(!p.scopes.includes('contacts:read'))hidden.push('note','paymentProofs','refund');
  if(!p.scopes.includes('finance:read'))hidden.push('totalPrice','paymentStage','paymentMethods','paymentProofs','refund');
  for(const field of new Set(hidden)){
   const expected=shown?.[field]??(field==='note'?'':['paymentProofs','paymentMethods'].includes(field)?{}:undefined);
   if(!same(row[field],expected))fail('不能修改未获授权的资料',403);
   if(original)Object.assign(row,{[field]:original[field]});
  }
 }
 if(!p.scopes.includes('finance:read'))for(const row of result.preOrders){const original=current.preOrders.find(r=>r.id===row.id);if(row.expense!==undefined||row.expenseNote)fail('不能修改未获授权的支出',403);if(original){row.expense=original.expense;row.expenseNote=original.expenseNote;}}
 return result;
}
export function validatePermissions(p:Principal,current:AppData,next:AppData){
 const originals=new Map(current.orders.map(o=>[o.id,o]));for(const o of next.orders){const old=originals.get(o.id);if(!old){requireScope(p,'orders:write');if(o.paymentStage||o.refund)requireScope(p,'finance:write');continue;}for(const k of ['id','orderNo','serial','serialMonth','createdAt'] as const)if(!same(old[k],o[k]))fail('已有订单的永久编号与录入时间不能改写',403);if(!same(old.paymentPlan,o.paymentPlan)||!same(old.refundRules,o.refundRules))fail('订单创建后不能修改分期与退款规则',403);if(!same(old,o))requireScope(p,'orders:write');
 const pre=next.preOrders.find(v=>v.orderId===o.id),post=next.postOrders.find(v=>v.orderId===o.id),beforePre=current.preOrders.find(v=>v.orderId===o.id),beforePost=current.postOrders.find(v=>v.orderId===o.id);
 const taskChanged=pre?.status!==beforePre?.status||post?.status!==beforePost?.status;
 if(taskChanged&&old.deliveredAt)fail('已交付订单不能通过工单重置进度',409);
 const deliveredNow=!old.deliveredAt&&!!o.deliveredAt&&post?.status==='completed'&&o.stage==='done'&&o.flow==='delivered'&&o.doneAt===o.deliveredAt&&Number.isFinite(Date.parse(o.deliveredAt))&&Math.abs(Date.now()-Date.parse(o.deliveredAt))<300000;
 if(!deliveredNow&&(!same(o.deliveredAt,old.deliveredAt)||!same(o.doneAt,old.doneAt))||!same(o.anonymizedAt,old.anonymizedAt))fail('交付和清理时间通过对应业务流程更新',403);
 const expectedStage=deliveredNow?'done':taskChanged?deriveStage(pre,post,old):old.stage,expectedFlow=deliveredNow?'delivered':taskChanged?workOrderFlow(pre,post,old):old.flow;
 if(o.stage!==expectedStage||o.flow!==expectedFlow)fail('订单进度必须经过后期与交付流程',409);
 if(financial.some(k=>!same(old[k],o[k])))requireScope(p,'finance:write');}
 if(current.orders.some(o=>!next.orders.some(n=>n.id===o.id)))requireScope(p,'orders:delete');
 for(const key of ['preOrders','postOrders'] as const)if(!same(current[key],next[key])){requireScope(p,'workflow:write');for(const old of current[key]){const changed=next[key].find(n=>n.id===old.id);if(changed)for(const k of ['id','orderId','createdAt'] as const)if(old[k]!==changed[k])fail('工单关联关系不能改写',403);}}
 for(const key of ['customerTypes','packageTiers','shootStyles','equipments','extraItems','retiredExtraIds','settings','printDocuments'] as const)if(!same(current[key],next[key]))requireScope(p,'settings:write');
}
export async function getState(p:Principal,knownRevision?:number){requireScope(p,'business:read');if(p.apiKeyId&&!p.scopes.includes('contacts:read'))fail('全量同步接口需要 contacts:read；安全订单查询请使用 /commands',403);return tx(async sql=>{const snapshot=await read(sql,p);if(knownRevision===snapshot.revision)return {revision:knownRevision,unchanged:true};return {...snapshot,data:visibleData(p,snapshot.data)};});}
export async function saveState(p:Principal,data:AppData,revision:number){requireScope(p,'orders:write');if(p.apiKeyId)fail('API 集成通过命令接口写入，不允许替换全量业务数据',403);rejectContactFields(data);validateData(data);return tx(async sql=>{const current=await read(sql,p);let proposed=structuredClone(data);await applyDeletionMarkers(sql,p.workspaceId,proposed);
 if(current.revision===0){requireScope(p,'settings:write');}
 if(current.revision!==revision){const old=await sql.one<{body:string}>('SELECT body FROM state_history WHERE workspace_id=? AND revision=?',[p.workspaceId,revision]);if(!old)fail('基础版本已过期，请读取最新数据',409);const conflicts:string[]=[];proposed=mergeChanges(visibleData(p,unseal<AppData>(old!.body,context(p))),visibleData(p,current.data),data,'',conflicts) as AppData;if(conflicts.length)throw Object.assign(new Error('数据冲突，请先导出本窗口修改，再重新读取。'),{status:409,conflicts});}
 proposed=restoreProtectedData(p,current.data,proposed);if((current.data.settings?.currency??'CNY')!==(proposed.settings?.currency??'CNY')){const ledger=await readModule<FinanceState>(sql,p,'finance',EMPTY_FINANCE);if(current.data.orders.length||ledger.data.entries.length||proposed.packageTiers.some(v=>v.price)||proposed.extraItems?.some(v=>v.price))fail('已有金额不能通过切换币种重标；请在无订单、无流水且价格清零的工作室设定币种',409);}if(!p.scopes.includes('audit:read'))proposed.logs=[...(current.data.logs??[]),...(proposed.logs??[])].slice(-500);validatePermissions(p,current.data,proposed);const next={revision:current.revision+1,data:proposed};await capturePaymentChanges(sql,p,current.data,next.data);await bindOrderMembers(sql,p,current.data,next.data);await write(sql,p,next);await audit(sql,p,'state.update',String(next.revision));return {...next,data:visibleData(p,next.data)};});}
export async function command(p:Principal,c:StudioCommand,revision?:number,sqlArg?:SQL,ai=false){const known=COMMAND_SCHEMAS[c.type]??getExtensionCommand(c.type);if(!known)fail('未注册的命令',404);requireScope(p,c.type==='studio.configure'?'settings:write':c.type.startsWith('orders.')&&known.write?'orders:write':c.type.endsWith('.status')?'workflow:write':COMMAND_SCHEMAS[c.type]?'business:read':'extensions:execute');if(ai&&!COMMAND_SCHEMAS[c.type])fail('AI 不允许调用扩展命令',403);
 const execute=async(sql:SQL)=>{rejectContactFields(c.payload);const current=await read(sql,p);if(known.write&&current.revision!==revision)fail('写入命令需要最新 revision',409);if(ai){const allowed=Object.keys((COMMAND_SCHEMAS[c.type].parameters.properties??{}) as object).filter(k=>k!=='note');if(Object.keys(c.payload).some(k=>!allowed.includes(k)))fail('AI 命令包含禁止访问的客户资料字段',403);}
 if(c.type==='orders.update'&&current.data.orders.find(o=>o.id===c.payload.id)?.anonymizedAt)fail('已清理订单只保留财务记录',409);
 let output;try{output=executeBusiness(current.data,c);}catch(e){fail((e as Error).message);}
 if(c.type==='studio.catalog')output!.result={...(output!.result as Record<string,unknown>),members:await memberDirectory(sql,p)};
 if(known.write){await bindOrderMembers(sql,p,current.data,output!.data);await capturePaymentChanges(sql,p,current.data,output!.data);validatePermissions(p,current.data,output!.data);await write(sql,p,{revision:current.revision+1,data:output!.data});await audit(sql,p,ai?'ai.'+c.type:c.type,typeof c.payload.id==='string'?c.payload.id:'');}
 const result=['orders.create','orders.update'].includes(c.type)&&(p.apiKeyId||ai)?aiOrder(output!.result as Order):output!.result;return {revision:current.revision+(known.write?1:0),result};};return sqlArg?execute(sqlArg):tx(execute);
}
export const readRawState=read;
export const writeRawState=write;
