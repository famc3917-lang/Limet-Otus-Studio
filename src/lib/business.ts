// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {orderAttribution,ATTRIBUTION_SCHEMA} from './member-profile';
import {normalizeBusinessDateTime,BUSINESS_DATE_DESCRIPTION} from './business-datetime';
import {getSignature,type AppData,type Order,type Gender,type AdultStatus} from './types';
import {planOf,refundRulesOf} from './payment-plan';
import {withBusinessTimeZone} from './time-zone';
import './extension-bootstrap';
import {uid,makeSeal,codeDateParts,nextMonthlySerial,buildBaseNo,nowLocalDateTimeInput} from './studio';
import {applyPrePatch,applyPostPatch,validateData} from './data-integrity';
import {getExtensionCommand,type StudioCommand,type CommandResult} from './extensions';
import {DEFAULT_SETTINGS} from './settings';
const text=(p:Record<string,unknown>,key:string,required=false)=>{const v=p[key];if(v===undefined&&!required)return '';if(typeof v!=='string'||v.length>10000||required&&!v.trim())throw new Error('请提供有效的 '+key);return v.trim();};
export function validDateTime(value:string){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return false;const d=new Date(value+'Z');return !Number.isNaN(d.getTime())&&value.slice(0,10)===[d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(d.getUTCDate()).padStart(2,'0')].join('-')&&d.getUTCHours()===Number(value.slice(11,13))&&d.getUTCMinutes()===Number(value.slice(14,16));}
export function orderDraft(data:AppData,p:Record<string,unknown>):Omit<Order,'id'|'seals'|'createdAt'> {
 const customerName=text(p,'customerName',true),shootTime=normalizeBusinessDateTime(text(p,'shootTime',true)),orderCreatedAt=normalizeBusinessDateTime(text(p,'orderCreatedAt')||nowLocalDateTimeInput());
 if(!validDateTime(shootTime)||!validDateTime(orderCreatedAt))throw new Error('日期须为有效的 YYYY-MM-DDTHH:mm');
 if(!['male','female','nonbinary'].includes(String(p.gender))||!['adult','minor'].includes(String(p.adult)))throw new Error('请确认客户性别及成年状态');
 const type=data.customerTypes.find(t=>t.id===p.customerTypeId||t.name===p.customerTypeId);if(!type)throw new Error('请从现有客户类型中选择');
 const tier=data.packageTiers.find(t=>t.id===p.packageTierId||t.name===p.packageTierId);if(p.packageTierId&&!tier)throw new Error('套餐不存在');
 const {yymmdd,monthKey}=codeDateParts(orderCreatedAt),serial=nextMonthlySerial(data.orders,monthKey);
 const returnDate=tier?.returnDays!=null?new Date(shootTime):null;
 if(returnDate)returnDate.setDate(returnDate.getDate()+tier!.returnDays!);
 const returnTime=returnDate?[returnDate.getFullYear(),String(returnDate.getMonth()+1).padStart(2,'0'),String(returnDate.getDate()).padStart(2,'0')].join('-')+'T'+shootTime.slice(11):undefined;
 return {...orderAttribution(p),orderNo:buildBaseNo(type.prefix,yymmdd,p.gender as Gender,serial),serial,serialMonth:monthKey,customerName,gender:p.gender as Gender,adult:p.adult as AdultStatus,customerTypeId:type.id,customerTypeName:type.name,packageTierId:tier?.id,packageTierName:tier?.name,orderCreatedAt,shootTime,location:text(p,'location'),photographer:text(p,'photographer'),note:text(p,'note'),signature:getSignature(typeof p.signature==='string'?p.signature:'',data.settings).id,paymentPlan:planOf(null,data.settings),refundRules:refundRulesOf(null,data.settings),stage:'prep',totalPrice:tier?.price??0,returnCount:tier?.returnCount,returnTime};
}
export const COMMAND_SCHEMAS:Record<string,{description:string;write:boolean;parameters:Record<string,unknown>}>={
 'studio.preferences':{description:'查看工作室名称、主题色与动画偏好。',write:false,parameters:{type:'object',properties:{}}},
 'studio.configure':{description:'调整工作室名称、主题色与动画偏好；先等待用户确认。',write:true,parameters:{type:'object',properties:{name:{type:'string',maxLength:80},accent:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},reduceMotion:{type:'boolean'}},additionalProperties:false}},
 'studio.catalog':{description:'查看当前客户类型、套餐与可用工单状态，创建订单前先调用。',write:false,parameters:{type:'object',properties:{}}},
 'orders.list':{description:'查询订单及其关联工单。仅在用户请求查询时调用。',write:false,parameters:{type:'object',properties:{query:{type:'string'},date:{type:'string',description:'YYYY-MM-DD'}}}},
 'orders.create':{description:'创建订单草稿；所有必填资料必须由用户确认。不会自动收款。',write:true,parameters:{type:'object',properties:{...ATTRIBUTION_SCHEMA,...Object.fromEntries(['customerName','customerTypeId','packageTierId','shootTime','gender','adult','location','photographer','note'].map(k=>[k,{type:'string',...(k==='shootTime'?{description:BUSINESS_DATE_DESCRIPTION}:{} )}]))},required:['customerName','customerTypeId','shootTime','gender','adult']}},
 'orders.update':{description:'修改订单拍摄时间、地点、摄影师或备注；保留订单编号与收退款记录。',write:true,parameters:{type:'object',properties:{...ATTRIBUTION_SCHEMA,id:{type:'string'},shootTime:{type:'string',description:BUSINESS_DATE_DESCRIPTION},location:{type:'string'},photographer:{type:'string'},note:{type:'string'}},required:['id']}},
 'orders.deliver':{description:'确认后期已完成并记录交付；不处理或读取照片。',write:true,parameters:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}},
 'pre.status':{description:'更新前期工单状态并同步订单阶段。',write:true,parameters:{type:'object',properties:{id:{type:'string'},status:{type:'string',enum:['pending','in_progress','completed']}},required:['id','status']}},
 'post.status':{description:'更新后期工单状态；完成后等待交付确认。',write:true,parameters:{type:'object',properties:{id:{type:'string'},status:{type:'string',enum:['pending','in_progress','completed']}},required:['id','status']}},
};
export function executeBusiness(source:AppData,command:StudioCommand,now=new Date().toISOString()):CommandResult{
 return withBusinessTimeZone(source?.settings?.timeZone,()=>runBusiness(source,command,now));
}
function runBusiness(source:AppData,command:StudioCommand,now:string):CommandResult{
 if(!command||typeof command.type!=='string'||!command.payload||typeof command.payload!=='object'||Array.isArray(command.payload))throw new Error('命令格式无效');
 let data=structuredClone(source);const p=command.payload;let result:unknown;
 switch(command.type){
 case 'studio.preferences':{const settings={...DEFAULT_SETTINGS,...data.settings};return {data:source,result:{name:settings.name,accent:settings.accent,reduceMotion:settings.reduceMotion}};}
 case 'studio.configure':{if(!Object.keys(p).length||Object.keys(p).some(key=>!['name','accent','reduceMotion'].includes(key)))throw new Error('请提供有效的工作室设置');if(p.name!==undefined&&(typeof p.name!=='string'||!p.name.trim()||p.name.trim().length>80))throw new Error('工作室名称须为 1–80 字');if(p.accent!==undefined&&(typeof p.accent!=='string'||!/^#[0-9a-fA-F]{6}$/.test(p.accent)))throw new Error('主题色须为 #RRGGBB');if(p.reduceMotion!==undefined&&typeof p.reduceMotion!=='boolean')throw new Error('动画偏好格式不正确');data.settings={...DEFAULT_SETTINGS,...data.settings,...p,...(typeof p.name==='string'?{name:p.name.trim()}: {})};result={name:data.settings.name,accent:data.settings.accent,reduceMotion:data.settings.reduceMotion};break;}
 case 'studio.catalog':return {data:source,result:{customerTypes:data.customerTypes,packages:data.packageTiers,statuses:['pending','in_progress','completed']}};
 case 'orders.list':{const query=text(p,'query').toLowerCase(),date=text(p,'date');return {data:source,result:data.orders.filter(o=>(!query||[o.orderNo,o.customerName,o.location].some(v=>v.toLowerCase().includes(query)))&&(!date||o.shootTime.startsWith(date))).slice(0,50).map(o=>({id:o.id,orderNo:o.orderNo,customerName:o.customerName,shootTime:o.shootTime,location:o.location,photographer:o.photographer,stage:o.stage,preOrderId:o.preOrderId,postOrderId:o.postOrderId}))};}
 case 'orders.create':{const draft=orderDraft(data,p),order:Order={...draft,id:uid('ord-'),createdAt:now,seals:[makeSeal('订单创建',new Date(now))]};data.orders.push(order);result=order;break;}
 case 'orders.update':{const id=text(p,'id',true),original=data.orders.find(o=>o.id===id);if(!original)throw new Error('订单不存在');const patch:Partial<Order>=orderAttribution(p);for(const k of ['shootTime','location','photographer','note'] as const)if(Object.hasOwn(p,k))patch[k]=text(p,k);if(patch.shootTime!==undefined)patch.shootTime=normalizeBusinessDateTime(patch.shootTime);if(patch.shootTime!==undefined&&!validDateTime(patch.shootTime))throw new Error('拍摄时间无效');Object.assign(original,patch);data.preOrders=data.preOrders.map(pre=>pre.orderId===id?{...pre,...(patch.shootTime?{shootTime:patch.shootTime}:{}),...(Object.hasOwn(patch,'location')?{location:patch.location!}:{}),...(Object.hasOwn(patch,'photographer')?{photographer:patch.photographer!}:{})}:pre);data.postOrders=data.postOrders.map(post=>post.orderId===id&&patch.shootTime?{...post,shootTime:patch.shootTime}:post);result=original;break;}
 case 'orders.deliver':{const id=text(p,'id',true),order=data.orders.find(o=>o.id===id),post=data.postOrders.find(v=>v.orderId===id);if(!order||order.anonymizedAt)throw new Error('订单不存在');if(order.deliveredAt)throw new Error('订单已交付');if(post?.status!=='completed')throw new Error('请先完成后期工单');order.flow='delivered';order.stage='done';order.deliveredAt=now;order.doneAt=now;order.seals=[...order.seals,makeSeal('确认交付',new Date(now))];result={id,deliveredAt:now};break;}
 case 'pre.status':case 'post.status':{const id=text(p,'id',true),status=text(p,'status',true);if(!['pending','in_progress','completed'].includes(status))throw new Error('工单状态无效');const list=command.type==='pre.status'?data.preOrders:data.postOrders;if(!list.some(v=>v.id===id))throw new Error('工单不存在');const patch={status:status as 'pending'|'in_progress'|'completed',seals:[makeSeal('工单状态更新：'+status,new Date(now))]};data=command.type==='pre.status'?applyPrePatch(data,id,patch):applyPostPatch(data,id,patch);result={id,status};break;}
 default:{const extension=getExtensionCommand(command.type);if(!extension)throw new Error('未注册的业务命令');const output=extension.execute({data,now},p);data=output.data;result=output.result;}
 }
 validateData(data);data.logs=[...(data.logs??[]),{at:now,action:command.type,detail:'通用业务接口'}].slice(-500);return {data,result};
}
