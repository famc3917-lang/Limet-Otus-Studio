// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {calculateShares,validateShareRule,type CashEntry,type ShareRule} from '@/lib/team-finance';
import {evaluateBusinessRule} from './business-rule';
export function businessShareCalculation(entries:CashEntry[],original:ShareRule){
 if(!original.script)return calculateShares(entries,original);
 const rule=structuredClone(original),receiptsCents=entries.filter(e=>e.kind==='receipt').reduce((n,e)=>n+e.cents,0),refundsCents=entries.filter(e=>e.kind==='refund').reduce((n,e)=>n+e.cents,0),expensesCents=entries.filter(e=>e.kind==='expense').reduce((n,e)=>n+e.cents,0);
 const input={receiptsCents,refundsCents,expensesCents,availableCents:receiptsCents-refundsCents-expensesCents,reserveCents:rule.reserveCents,reservePoints:rule.reservePoints,...Object.fromEntries(rule.members.flatMap((m,i)=>[[`member${i}FixedCents`,m.fixedCents],[`member${i}Points`,m.points]]))};
 const values=evaluateBusinessRule(rule.script!,input),allowed=new Set(['reserveCents','reservePoints',...rule.members.flatMap((_,i)=>[`member${i}FixedCents`,`member${i}Points`])]);
 for(const [key,value] of Object.entries(values)){if(!allowed.has(key)||!Number.isSafeInteger(value)||value<0)throw Error('业务脚本输出须为允许的非负整数数值字段');if(key==='reserveCents')rule.reserveCents=value;else if(key==='reservePoints')rule.reservePoints=value;else {const m=key.match(/^member(\d+)(FixedCents|Points)$/)!;if(m[2]==='Points')rule.members[Number(m[1])].points=value;else rule.members[Number(m[1])].fixedCents=value;}}
 validateShareRule(rule);return calculateShares(entries,rule);
}
