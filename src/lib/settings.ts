// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import type {StudioCurrency} from './money';
import {DEFAULT_INSTALLMENTS,DEFAULT_REFUND_RULES,type InstallmentStage,type RefundRule} from './payment-plan';

/** A credit line printed on orders; studios add and edit their own. */
export interface SignatureOption { id:string; name:string; sub?:string }

export interface StudioSettings {
 name:string; tagline:string; dailyLines:boolean; customLines:string; reduceMotion:boolean; accent:string;
 backgroundAssistant:boolean; floatingAssistant:boolean; autoBackup?:boolean; currency?:StudioCurrency;
 /** IANA time zone for business times; defaults to the device's zone. */
 timeZone?:string;
 signatures?:SignatureOption[];
 orderChannels?:string[];
 customerTags?:string[];
 paymentMethods?:string[];
 installments?:InstallmentStage[];
 refundRules?:RefundRule[];
}

type Language='zh'|'en';
const DAILY_LINES:Record<Language,string>={
 zh:'山光悦鸟性，潭影空人心。\n长风破浪会有时，直挂云帆济沧海。\n行到水穷处，坐看云起时。\n清风徐来，水波不兴。\n且将新火试新茶，诗酒趁年华。',
 en:'Mountain light delights the birds; reflected stillness clears the mind.\nA day will come to sail through wind and waves.\nWhere the waters end, sit and watch the clouds rise.\nA gentle breeze arrives; the water rests.\nFresh fire, new tea; make time for the present.',
};
export const DEFAULT_LISTS:Record<Language,{orderChannels:string[];customerTags:string[];paymentMethods:string[]}>={
 zh:{orderChannels:['微博','小红书','B站','QQ群','漫展','老客介绍','其他'],customerTags:['Cos','JK','洛丽塔'],paymentMethods:['支付宝','微信','银行卡','现金']},
 en:{orderChannels:['Instagram','Facebook','X (Twitter)','TikTok','Telegram','Convention','Client referral','Other'],customerTags:['Cosplay','JK','Lolita'],paymentMethods:['Visa','Mastercard','Bank transfer','PayPal','Cash']},
};

/** True for an IANA time-zone name the runtime can format. */
export function isTimeZone(zone:string):boolean{try{new Intl.DateTimeFormat('en-US',{timeZone:zone});return zone.length<=64;}catch{return false;}}
/** The device's time zone, or UTC when it cannot be determined. */
export function deviceTimeZone():string{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}catch{return 'UTC';}}

export function defaultSettings(language:Language='zh'):StudioSettings{
 const en=language==='en';
 return {name:en?'My Studio':'我的工作室',tagline:en?'Every shoot, with care.':'用心对待每一次拍摄。',dailyLines:true,customLines:DAILY_LINES[language],reduceMotion:false,accent:'#347665',backgroundAssistant:false,floatingAssistant:false,currency:en?'USD':'CNY',
  ...DEFAULT_LISTS[language],installments:DEFAULT_INSTALLMENTS[language],refundRules:DEFAULT_REFUND_RULES};
}
/** Chinese defaults, kept for callers that merge settings over a base object. */
export const DEFAULT_SETTINGS:StudioSettings=defaultSettings('zh');

const lang=(language:string):Language=>language==='en'?'en':'zh';
export const signaturesOf=(s:Partial<StudioSettings>|undefined):SignatureOption[]=>s?.signatures?.length?s.signatures:[{id:'studio',name:s?.name||DEFAULT_SETTINGS.name}];
export const channelsOf=(s:Partial<StudioSettings>|undefined,language:string)=>s?.orderChannels??DEFAULT_LISTS[lang(language)].orderChannels;
export const tagsOf=(s:Partial<StudioSettings>|undefined,language:string)=>s?.customerTags??DEFAULT_LISTS[lang(language)].customerTags;
export const paymentMethodsOf=(s:Partial<StudioSettings>|undefined,language:string)=>s?.paymentMethods??DEFAULT_LISTS[lang(language)].paymentMethods;
export const timeZoneOf=(s:Partial<StudioSettings>|undefined)=>s?.timeZone||deviceTimeZone();

/** Untouched default texts and lists follow the interface language; edited values are kept as entered. */
export function localizeSettings(s:StudioSettings|undefined,language:Language):StudioSettings|undefined{
 if(!s)return s;
 const mine=defaultSettings(language),theirs=defaultSettings(language==='en'?'zh':'en'),out:StudioSettings={...s};
 for(const key of ['name','tagline','customLines'] as const)if(s[key]===theirs[key])out[key]=mine[key];
 const same=(a?:string[],b?:string[])=>!!a&&!!b&&a.length===b.length&&a.every((v,i)=>v===b[i]);
 for(const key of ['orderChannels','customerTags','paymentMethods'] as const)if(same(s[key],theirs[key]))out[key]=mine[key];
 const plan=s.installments,from=theirs.installments!,to=mine.installments!;
 if(plan&&plan.length===from.length&&plan.every((p,i)=>p.name===from[i].name&&(p.desc??'')===(from[i].desc??'')))out.installments=plan.map((p,i)=>({...p,name:to[i].name,...(to[i].desc?{desc:to[i].desc}:{})}));
 return out;
}
