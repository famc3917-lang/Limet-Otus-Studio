// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import type { AppData, Order, PostOrder, PreOrder, TimeSeal } from './types';
import {isPrintDocument} from './print-document';
import {validLightSpec} from './lighting';
import {rejectContactFields} from './public-data-guard';
import {planOf,validateInstallments,validateRefundRules} from './payment-plan';
import {isTimeZone} from './settings';
import {isStudioCurrency} from './money';

const textList=(value:unknown,max:number)=>value===undefined||Array.isArray(value)&&value.length<=max&&value.every(v=>typeof v==='string'&&!!v.trim()&&v.length<=40)&&new Set(value).size===value.length;
function validateSettingsLists(s:Record<string,unknown>){
 if(!textList(s.orderChannels,50)||!textList(s.customerTags,50)||!textList(s.paymentMethods,20))throw new Error('渠道、客户标签和收款方式每项 1–40 字且不能重复');
 if(s.timeZone!==undefined&&(typeof s.timeZone!=='string'||!isTimeZone(s.timeZone)))throw new Error('时区无效');
 if(s.signatures!==undefined){const list=s.signatures;if(!Array.isArray(list)||list.length<1||list.length>20||list.some(v=>!v||typeof v!=='object'||typeof v.id!=='string'||!/^[\w-]{1,40}$/.test(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.length>40||v.sub!==undefined&&(typeof v.sub!=='string'||v.sub.length>60))||new Set(list.map(v=>v.id)).size!==list.length)throw new Error('署名须为 1–20 项，名称 1–40 字');}
 if(s.installments!==undefined)validateInstallments(s.installments);
 if(s.refundRules!==undefined)validateRefundRules(s.refundRules);
}

export function mergeSeals(existing: TimeSeal[] = [], incoming: TimeSeal[] = []) {
  const seen = new Set<string>();
  return [...existing,...incoming].filter(s => {
    const key = `${s.iso}\0${s.event}`;
    if(seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function deriveStage(pre?:PreOrder,post?:PostOrder,order?:Order):Order['stage'] {
 if(order?.deliveredAt||order?.flow==='delivered'||order?.stage==='done'&&order.doneAt&&!order.flow)return 'done';
 if(post?.status==='completed'||post?.status==='in_progress'||pre?.status==='completed')return 'post';
 return pre?.status==='in_progress'?'shooting':'prep';
}
export function workOrderFlow(pre:PreOrder|undefined,post:PostOrder|undefined,order:Order):Order['flow'] {
 if(order.deliveredAt||order.flow==='delivered')return 'delivered';
 if(order.stage==='done'&&order.doneAt&&!order.flow)return undefined; // Preserve completed legacy records.
 if(post?.status==='completed')return 'awaiting_delivery';
 if(post?.status==='in_progress')return 'post';
 if(pre?.status==='completed')return 'awaiting_post';
 return undefined;
}

/** Validate before either restore or hydration, while retaining older optional fields. */
export function validateData(value: unknown): asserts value is Partial<AppData> {
  rejectContactFields(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('备份内容不是工作室数据');
  const data = value as Record<string,unknown>;
  if(data.settings!==undefined){const s=data.settings as Record<string,unknown>;if(!s||typeof s!=='object'||['name','tagline','customLines','accent'].some(k=>typeof s[k]!=='string')||['dailyLines','reduceMotion','backgroundAssistant','floatingAssistant'].some(k=>typeof s[k]!=='boolean')||!/^#[\da-f]{6}$/i.test(String(s.accent))||s.currency!==undefined&&!isStudioCurrency(s.currency))throw new Error('工作室偏好格式无效');validateSettingsLists(s);}
  if(data.printDocuments!==undefined){if(!data.printDocuments||typeof data.printDocuments!=='object'||Array.isArray(data.printDocuments)||Object.values(data.printDocuments).some(d=>!isPrintDocument(d)))throw new Error('打印模板格式无效');}
  for (const key of ['orders','preOrders','postOrders','equipments','customerTypes','packageTiers','shootStyles']) {
    if (!Array.isArray(data[key])) throw new Error(`缺少或损坏的数据列表：${key}`);
    const ids = new Set<string>();
    for(const row of data[key] as Record<string,unknown>[]) {
      if(!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error(`${key} 中存在无效或重复记录`);
      ids.add(row.id);
    }
  }
  for (const key of ['extraItems','logs']) if (data[key] !== undefined && !Array.isArray(data[key])) throw new Error(`${key} 格式不正确`);
  if (data.retiredExtraIds !== undefined && (!Array.isArray(data.retiredExtraIds) || data.retiredExtraIds.length > 500 || data.retiredExtraIds.some(id => typeof id !== 'string' || id.length > 120))) throw new Error('retiredExtraIds 格式不正确');
  const rows = (key: string) => (data[key] ?? []) as Record<string,unknown>[];
  for (const [key,fields] of Object.entries({orders:['orderNo','customerName','shootTime','serial','serialMonth'],preOrders:['preNo','orderId','customerName','photographer'],postOrders:['postNo','orderId','customerName']})) {
    for(const row of rows(key)) {
      if(key==='preOrders'&&row.sdCardCodes!==undefined&&(!Array.isArray(row.sdCardCodes)||row.sdCardCodes.some(v=>typeof v!=='string')||new Set(row.sdCardCodes).size!==row.sdCardCodes.length))throw new Error('存储卡列表无效或重复');
      if(fields.some(field=>typeof row[field] !== 'string') || !Array.isArray(row.seals)) throw new Error(`${key} 的记录字段不完整`);
      for(const field of ['totalPrice','expense','totalShots','retouchCount','returnCount']) if(row[field] !== undefined && (typeof row[field] !== 'number' || !Number.isFinite(row[field]) || Number(row[field])<0)) throw new Error(`${key} 的金额或数量无效`);
    }
  }
  for(const row of rows('equipments'))if(row.light!==undefined&&!validLightSpec(row.light))throw new Error('灯光参数无效');
  for(const row of rows('orders')){
    if(row.signatureMemberId!==undefined&&(typeof row.signatureMemberId!=='string'||!row.signatureMemberId||row.signatureMemberId.length>100))throw Error('署名成员编号无效');
    if(row.signatureMemberName!==undefined&&(typeof row.signatureMemberName!=='string'||row.signatureMemberName.length>80))throw Error('署名网名无效');
    if(row.channel!==undefined&&(typeof row.channel!=='string'||row.channel.length>80))throw Error('渠道最多80字');
    if(row.customerTags!==undefined&&(!Array.isArray(row.customerTags)||row.customerTags.length>20||row.customerTags.some(t=>typeof t!=='string'||!t.trim()||t.length>40)||new Set(row.customerTags).size!==row.customerTags.length))throw Error('客户标签最多20个，每项1–40字且不能重复');
  }
  for(const row of rows('orders')){
    if(row.signature!==undefined&&(typeof row.signature!=='string'||row.signature.length>40))throw new Error('作品署名无效');
    if(row.paymentPlan!==undefined)validateInstallments(row.paymentPlan);
    if(row.refundRules!==undefined)validateRefundRules(row.refundRules);
    const stages=planOf(row as Parameters<typeof planOf>[0]).length;
    if(row.paymentStage !== undefined && (!Number.isInteger(row.paymentStage) || Number(row.paymentStage)<0 || Number(row.paymentStage)>stages)) throw new Error(`收款期数必须介于 0 和 ${stages} 之间`);
  }
  for(const key of ['preOrders','postOrders']) {
    const parents = new Set(rows('orders').map(o=>o.id));
    const used = new Set();
    for(const row of rows(key)) {
      if(!parents.has(row.orderId) || used.has(row.orderId)) throw new Error(`${key} 存在没有关联订单或重复的工单`);
      used.add(row.orderId);
      if(!['pending','in_progress','completed'].includes(String(row.status))) throw new Error('工单状态无效');
    }
  }
}

export function applyPostPatch(data: AppData, id: string, patch: Partial<PostOrder>): AppData {
  const original = data.postOrders.find(p=>p.id===id);
  if(!original) return data;
  const next = {...original,...patch,id:original.id,orderId:original.orderId,postNo:original.postNo,seals:mergeSeals(original.seals,patch.seals)};
  return {...data,postOrders:data.postOrders.map(p=>p.id===id ? next : p),orders:data.orders.map(o=>o.id===original.orderId ? {
    ...o,
    ...(Object.hasOwn(patch,'returnTime') ? {returnTime:patch.returnTime} : {}),
    ...(Object.hasOwn(patch,'returnCount') ? {returnCount:patch.returnCount} : {}),
    stage:deriveStage(data.preOrders.find(p=>p.orderId===o.id),next,o),
    flow:workOrderFlow(data.preOrders.find(p=>p.orderId===o.id),next,o),
  } : o)};
}

export function applyPrePatch(data: AppData, id: string, patch: Partial<PreOrder>): AppData {
  const original=data.preOrders.find(p=>p.id===id); if(!original)return data;
  const next={...original,...patch,id:original.id,orderId:original.orderId,preNo:original.preNo,seals:mergeSeals(original.seals,patch.seals)};
  return {...data,preOrders:data.preOrders.map(p=>p.id===id ? next : p),orders:data.orders.map(o=>o.id===original.orderId ? {...o,
    ...(Object.hasOwn(patch,'location') ? {location:patch.location!} : {}),
    ...(Object.hasOwn(patch,'photographer') ? {photographer:patch.photographer} : {}),
    stage:deriveStage(next,data.postOrders.find(p=>p.orderId===o.id),o),
    flow:workOrderFlow(next,data.postOrders.find(p=>p.orderId===o.id),o),
  } : o)};
}
