// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
export interface MemberProfile {nickname:string;realName?:string}
export interface MemberSummary {id:string;nickname:string;role:string;disabled:boolean}
function text(value:unknown,label:string,required=false){
 if(value!==undefined&&typeof value!=='string')throw Object.assign(Error(`${label}格式无效`),{status:400});
 const result=String(value??'').trim();
 if(required&&!result||result.length>80||/[\u0000-\u001f\u007f]/.test(result))throw Object.assign(Error(`${label}${required?'必填，':''}最多80字`),{status:400});
 return result;
}
export function parseMemberProfile(body:Record<string,unknown>):MemberProfile{return {nickname:text(body.nickname,'网名',true),realName:text(body.realName,'真名')};}

/** Optional business attribution fields, shared by GUI and command API. */
export const ATTRIBUTION_SCHEMA={signatureMemberId:{type:'string',minLength:1,maxLength:100},channel:{type:'string',maxLength:80},customerTags:{type:'array',maxItems:20,uniqueItems:true,items:{type:'string',minLength:1,maxLength:40}}};
export function orderAttribution(body:Record<string,unknown>){
 const result:{signatureMemberId?:string;channel?:string;customerTags?:string[]}={};
 if(Object.hasOwn(body,'signatureMemberId')){if(typeof body.signatureMemberId!=='string'||!body.signatureMemberId.trim()||body.signatureMemberId.length>100)throw Error('署名账户编号无效');result.signatureMemberId=body.signatureMemberId.trim();}
 if(Object.hasOwn(body,'channel'))result.channel=text(body.channel,'渠道');
 if(Object.hasOwn(body,'customerTags')){const tags=body.customerTags;if(!Array.isArray(tags)||tags.length>20||tags.some(t=>typeof t!=='string'||!t.trim()||t.length>40))throw Error('客户标签最多20个，每项1–40字');result.customerTags=[...new Set(tags.map(t=>t.trim()))];}
 return result;
}
