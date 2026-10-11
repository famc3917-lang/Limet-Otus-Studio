// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {fail} from './crypto';
import {tx} from './database';
import {readRawState} from './repository';
import {requireScope,type Principal} from './security';

const protocol=1;

/** Versioned, read-only boundary for future Limetkura and Limetan clients. */
export async function familyAPI(p:Principal,path:string,request:Request){
 requireScope(p,'business:read');
 if(request.method!=='GET')fail('家族接口当前仅开放只读查询',405);
 const requested=request.headers.get('x-limet-family-protocol');
 if(requested&&requested!==String(protocol))fail('家族协议版本不兼容',426);
 if(path==='capabilities')return {family:'Limet Otus',product:'studio',applicationVersion:'3.0.0',protocol,capabilities:['order.reference.read'],plannedProducts:['Limetkura','Limetan']};
 const match=/^orders\/([A-Za-z0-9_-]{1,120})$/.exec(path);
 if(!match)fail('家族接口不存在',404);
 return tx(async sql=>{
  const snapshot=await readRawState(sql,p),order=snapshot.data.orders.find(row=>row.id===match[1]&&!row.anonymizedAt);
  if(!order)fail('订单不存在',404);
  return {protocol,reference:{workspaceId:p.workspaceId,orderId:order.id,orderNo:order.orderNo,customerName:order.customerName,shootTime:order.shootTime,location:order.location,stage:order.stage,flow:order.flow??null,deliveredAt:order.deliveredAt??null}};
 });
}
