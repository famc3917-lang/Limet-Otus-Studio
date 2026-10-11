// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import type {SQL} from './database';
import {seal,unseal,fail} from './crypto';
import {deletionMarkers} from './privacy-guard';
interface Cached {workspaceId?:string;invalidated?:boolean;request:string;result?:unknown}
function mentions(value:unknown,id:string):boolean{if(Array.isArray(value))return value.some(v=>mentions(v,id));if(value&&typeof value==='object'){const row=value as Record<string,unknown>;return row.id===id||row.orderId===id||Object.values(row).some(v=>mentions(v,id));}return false;}
/** Tagged records only: never invalidate another workspace or repeat a historical write. */
export async function invalidateOrderCache(sql:SQL,workspaceId:string,orderId:string){const rows=await sql.all<{id:string;body:string}>('SELECT id,body FROM idempotency');for(const row of rows){const ctx='request:'+row.id,value=unseal<Cached>(row.body,ctx);if(value.workspaceId===workspaceId&&!value.invalidated&&mentions(value.result,orderId))await sql.run('UPDATE idempotency SET body=? WHERE id=?',[seal({workspaceId,request:value.request,invalidated:true},ctx),row.id]);}}
/** Older untagged responses are masked on replay within the authenticated workspace. */
export async function privacyReplay(sql:SQL,workspaceId:string,result:unknown){
 const markers=new Map((await deletionMarkers(sql,workspaceId)).map(m=>[m.orderId,m]));if(!markers.size)return result;let nodes=0;
 function visit(value:unknown):unknown{if(++nodes>50000)fail('历史响应过大，请重新读取当前业务数据',409);if(Array.isArray(value))return value.map(visit);if(value&&typeof value==='object'){const row=value as Record<string,unknown>,marker=markers.get(String(row.orderId??row.id??''));if(marker)return {id:row.id,orderId:row.orderId,orderNo:marker.archiveNo,customerName:'已清理',location:'',anonymizedAt:marker.at,...(typeof row.totalPrice==='number'?{totalPrice:row.totalPrice}:{})};return Object.fromEntries(Object.entries(row).map(([k,v])=>[k,visit(v)]));}return value;}
 return visit(result);
}
