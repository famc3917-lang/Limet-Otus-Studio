// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import type {Order} from './types';
import {businessTimeZone,formatZoned,wallTimeToIso,zonedTimeToUtc} from './time-zone';
export interface RetentionPolicy {retentionMonths:number;graceMonths:number;retentionStart:'delivery'|'created'|'shoot';autoDelete:boolean}
export interface ExtensionRequest {id:string;orderId:string;userId:string;until:string;reason:string;at:string;status:'pending'|'approved'|'rejected';decidedBy?:string;decidedAt?:string}
export interface RetentionState {extensions:Record<string,string>;requests:ExtensionRequest[];snoozes:Record<string,string>}
export const EMPTY_RETENTION:RetentionState={extensions:{},requests:[],snoozes:{}};
/** Calendar arithmetic in the studio time zone, clamping e.g. January31 + one month to February28. */
export function calendarMonths(iso:string,months:number,zone:string=businessTimeZone()){
 const time=Date.parse(iso);if(!Number.isFinite(time)||!Number.isInteger(months)||months<0||months>144)throw Error('保留时间无效');
 const w=formatZoned(new Date(time),zone),y=+w.slice(0,4),mo=+w.slice(5,7)-1+months,day=+w.slice(8,10),ty=y+Math.floor(mo/12),tm=mo%12,last=new Date(Date.UTC(ty,tm+1,0)).getUTCDate();
 return new Date(zonedTimeToUtc(ty,tm+1,Math.min(day,last),+w.slice(11,13),+w.slice(14,16),+w.slice(17,19),zone)+time%1000).toISOString();
}
export function retentionWindow(order:Order,policy:RetentionPolicy,extension?:string,now=Date.now(),zone:string=businessTimeZone()){
 const base=policy.retentionStart==='delivery'?order.deliveredAt:policy.retentionStart==='shoot'?(order.shootTime?wallTimeToIso(order.shootTime,zone):''):order.createdAt;
 if(!base||!Number.isFinite(Date.parse(base))||order.anonymizedAt)return null;
 const original=calendarMonths(base,policy.retentionMonths,zone),due=extension&&Date.parse(extension)>Date.parse(original)?extension:original,erase=calendarMonths(due,policy.graceMonths,zone);
 return {due,erase,overdue:now>=Date.parse(due),remind:now>=Date.parse(due)+86400000,autoDue:policy.autoDelete&&now>=Date.parse(erase)};
}
/** Retain only business/financial fields; no free-text customer content or proof references. */
export function anonymizeOrder(order:Order,at:string,archiveNo:string):Order{
 const month=order.serialMonth||order.createdAt.slice(0,7),createdAt=/^\d{4}-\d{2}$/.test(month)?month+'-01T00:00:00.000Z':at;
 return {id:order.id,orderNo:archiveNo,serial:'0000',serialMonth:month,createdAt,customerName:'已清理',gender:'nonbinary',adult:'adult',customerTypeId:'archived',customerTypeName:'已清理',orderCreatedAt:'',shootTime:'',location:'',signature:order.signature,signatureMemberId:order.signatureMemberId,signatureMemberName:order.signatureMemberName,totalPrice:order.totalPrice,paymentStage:order.paymentStage,paymentMethods:order.paymentMethods,refund:order.refund?{amount:order.refund.amount,rate:order.refund.rate,paidAmount:order.refund.paidAmount,days:0,ruleText:'退款记录',at:order.refund.at.slice(0,7)+'-01T00:00:00.000Z'}:undefined,stage:order.stage,flow:order.flow,deliveredAt:order.deliveredAt?order.deliveredAt.slice(0,7)+'-01T00:00:00.000Z':undefined,doneAt:order.doneAt?order.doneAt.slice(0,7)+'-01T00:00:00.000Z':undefined,seals:[],anonymizedAt:at};
}
