// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {SQL} from './database';
import {seal,unseal,fail,digest} from './crypto';
import type {AppData,Order} from '@/lib/types';
import {anonymizeOrder} from '@/lib/retention';
export interface DeletionMarker {orderId:string;at:string;archiveNo:string;archive?:Order}
export const deletionContext=(workspaceId:string,orderId:string)=>'deletion:'+workspaceId+':'+orderId;
const journalHome=()=>path.join(process.env.STUDIO_DATA_DIR||fail('未配置隐私日志目录',503),'privacy-journal');
/** Independent encrypted files survive GUI imports and database-only restores. No customer data. */
export async function writeDeletionJournal(workspaceId:string,marker:DeletionMarker){
 const folder=journalHome();await fs.mkdir(folder,{recursive:true});const name=digest(workspaceId+'\0'+marker.orderId);
  const target=path.join(folder,name+'.json'),temp=target+'.'+randomUUID()+'.tmp';
 try{await fs.writeFile(temp,JSON.stringify({workspaceId,orderId:marker.orderId,body:seal(marker,deletionContext(workspaceId,marker.orderId))}),{flag:'wx',mode:0o600});await fs.rename(temp,target);}finally{await fs.unlink(temp).catch(()=>{});}
}
export async function deletionMarkers(sql:SQL,workspaceId:string){const rows=await sql.all<{order_id:string;body:string}>('SELECT order_id,body FROM privacy_deletions WHERE workspace_id=?',[workspaceId]);return rows.map(r=>unseal<DeletionMarker>(r.body,deletionContext(workspaceId,r.order_id)));}
export async function applyDeletionMarkers(sql:SQL,workspaceId:string,data:AppData){
 const markers=await deletionMarkers(sql,workspaceId);if(!markers.length)return data;
 const byId=new Map(markers.map(m=>[m.orderId,m])),present=new Set(data.orders.map(o=>o.id));for(const marker of markers)if(!present.has(marker.orderId)&&marker.archive)data.orders.push(anonymizeOrder(marker.archive,marker.at,marker.archiveNo));data.orders=data.orders.map(o=>{const m=byId.get(o.id);return m?anonymizeOrder(m.archive??o,m.at,m.archiveNo):o;});
 data.preOrders=data.preOrders.filter(o=>!byId.has(o.orderId));data.postOrders=data.postOrders.filter(o=>!byId.has(o.orderId));
 data.logs=[];return data;
}
export async function restoreDeletionJournal(sql:SQL,workspaceId:string){
 let restored=false;const names=await fs.readdir(journalHome()).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return [];throw e;});
 for(const name of names){if(!/^[a-f0-9]{64}\.json$/.test(name))continue;const value=JSON.parse(await fs.readFile(path.join(journalHome(),name),'utf8')) as {workspaceId:string;orderId:string;body:string};if(value.workspaceId!==workspaceId)continue;const marker=unseal<DeletionMarker>(value.body,deletionContext(workspaceId,value.orderId));if(marker.orderId!==value.orderId)fail('隐私日志标识不一致',503);const inserted=await sql.run('INSERT INTO privacy_deletions(workspace_id,order_id,body,created_at) VALUES(?,?,?,?) ON CONFLICT(workspace_id,order_id) DO NOTHING',[workspaceId,marker.orderId,value.body,marker.at]);if(inserted){restored=true;const ctx='module:'+workspaceId+':finance',row=await sql.one<{body:string;revision:number}>('SELECT body,revision FROM studio_modules WHERE workspace_id=? AND name=?',[workspaceId,'finance']);if(row){const finance=unseal<{entries:Array<{orderId:string;orderNo:string;note:string}>}>(row.body,ctx);for(const entry of finance.entries)if(entry.orderId===marker.orderId){entry.note='';entry.orderNo=marker.archiveNo;}await sql.run('UPDATE studio_modules SET body=?,revision=? WHERE workspace_id=? AND name=?',[seal(finance,ctx),row.revision+1,workspaceId,'finance']);}await (await import('./privacy-cache')).invalidateOrderCache(sql,workspaceId,marker.orderId);}}
 if(restored){await sql.run('DELETE FROM conversations WHERE workspace_id=?',[workspaceId]);await sql.run('DELETE FROM state_history WHERE workspace_id=?',[workspaceId]);await sql.run('DELETE FROM studio_modules WHERE workspace_id=? AND name LIKE ?',[workspaceId,'cli-pending:%']);}
}
