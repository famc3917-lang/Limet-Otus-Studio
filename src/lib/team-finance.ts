// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
export type CashKind='receipt'|'refund'|'expense'|'shared-expense'|'reversal';
export interface CashEntry {id:string;orderId:string;orderNo:string;kind:CashKind;cents:number;memberId:string;at:string;note:string;reverses?:string;stage?:number;reimbursementOf?:string;actualCents?:number;source?:'legacy-payment'}
export interface ShareMember {memberId:string;fixedCents:number;points:number}
export interface ShareRule {id:string;version:number;reserveCents:number;reservePoints:number;members:ShareMember[];normalize:boolean;script?:string}
export interface ShareResult {receipts:number;refunds:number;expenses:number;available:number;reserve:number;pool:number;deficit:number;fixedShortfall:number;members:Array<{memberId:string;cents:number}>;retained:number}
export interface ShareSnapshot {id:string;orderId:string;at:string;rule:ShareRule;result:ShareResult;delta:Array<{memberId:string;cents:number}>;entryIds:string[]}
export interface FinanceState {entries:CashEntry[];rules:Record<string,ShareRule>;snapshots:ShareSnapshot[];pending?:Record<string,{at:string;result:ShareResult;entryIds:string[]}>}
export const EMPTY_FINANCE:FinanceState={entries:[],rules:{},snapshots:[]};
export function cents(value:string|number){const raw=String(value).trim();if(!/^\d+(?:\.\d{1,2})?$/.test(raw))throw Error('金额须为非负数字，最多两位小数');const [whole,fraction='']=raw.split('.'),n=BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,'0'));if(n>BigInt(100000000000))throw Error('金额超过支持范围');return Number(n);}
function sum(values:number[]){const n=values.reduce((a,b)=>a+b,0);if(!Number.isSafeInteger(n))throw Error('金额累计超出范围');return n;}
export function validateShareRule(rule:ShareRule){if(!rule||!Number.isSafeInteger(rule.version)||rule.version<1||!Number.isSafeInteger(rule.reserveCents)||rule.reserveCents<0||!Number.isInteger(rule.reservePoints)||rule.reservePoints<0||rule.reservePoints>10000||!Array.isArray(rule.members)||rule.members.length>20||typeof rule.normalize!=='boolean')throw Error('分成规则无效');const seen=new Set<string>();for(const m of rule.members){if(typeof m.memberId!=='string'||!m.memberId||seen.has(m.memberId)||!Number.isSafeInteger(m.fixedCents)||m.fixedCents<0||!Number.isInteger(m.points)||m.points<0||m.points>10000)throw Error('成员分成金额或比例无效');seen.add(m.memberId);}if(sum(rule.members.map(m=>m.points))>10000&&!rule.normalize)throw Error('分成比例超过100%，请选择等比压缩或调整规则');}
/** Integer cents and largest remainders keep the entire common pool conserved. */
export function calculateShares(entries:CashEntry[],rule:ShareRule):ShareResult{
 validateShareRule(rule);const receipts=sum(entries.filter(e=>e.kind==='receipt').map(e=>e.cents)),refunds=sum(entries.filter(e=>e.kind==='refund').map(e=>e.cents)),expenses=sum(entries.filter(e=>e.kind==='expense').map(e=>e.cents));
 const available=receipts-refunds-expenses,reserve=Math.min(Math.max(available,0),rule.reserveCents+Number(BigInt(Math.max(available,0))*BigInt(rule.reservePoints)/BigInt(10000))),pool=Math.max(available-reserve,0),fixed=sum(rule.members.map(m=>m.fixedCents));
 if(fixed>pool)return {receipts,refunds,expenses,available,reserve,pool,deficit:Math.max(-available,0),fixedShortfall:fixed-pool,members:[],retained:Math.max(available,0)};
 const base=pool-fixed,totalPoints=sum(rule.members.map(m=>m.points)),denominator=BigInt(Math.max(10000,totalPoints)),rows=rule.members.map(m=>{const product=BigInt(base)*BigInt(m.points);return {...m,cents:m.fixedCents+Number(product/denominator),remainder:product%denominator};});
 const target=Number(BigInt(base)*BigInt(totalPoints)/denominator),allocated=sum(rows.map(m=>m.cents-m.fixedCents));const ranked=[...rows].sort((a,b)=>a.remainder===b.remainder?a.memberId.localeCompare(b.memberId):a.remainder>b.remainder?-1:1);for(let i=0;i<target-allocated;i++)ranked[i].cents++;
 return {receipts,refunds,expenses,available,reserve,pool,deficit:Math.max(-available,0),fixedShortfall:0,members:rows.map(({memberId,cents})=>({memberId,cents})),retained:Math.max(available,0)-sum(rows.map(m=>m.cents))};
}
export function effectiveEntries(entries:CashEntry[]){const reversed=new Set(entries.filter(e=>e.kind==='reversal').map(e=>e.reverses));return entries.filter(e=>e.kind!=='reversal'&&!reversed.has(e.id));}
