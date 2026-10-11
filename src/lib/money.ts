// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import type {StudioLanguage} from './i18n';

/** Ledger currencies offered at studio creation. Amounts are stored in major units rounded to 0.01. */
export const STUDIO_CURRENCIES=[
 {code:'CNY',zh:'人民币',en:'Chinese yuan'},
 {code:'USD',zh:'美元',en:'US dollar'},
 {code:'EUR',zh:'欧元',en:'Euro'},
 {code:'GBP',zh:'英镑',en:'Pound sterling'},
 {code:'JPY',zh:'日元',en:'Japanese yen'},
 {code:'KRW',zh:'韩元',en:'South Korean won'},
 {code:'HKD',zh:'港元',en:'Hong Kong dollar'},
 {code:'SGD',zh:'新加坡元',en:'Singapore dollar'},
 {code:'AUD',zh:'澳大利亚元',en:'Australian dollar'},
 {code:'CAD',zh:'加拿大元',en:'Canadian dollar'},
 {code:'CHF',zh:'瑞士法郎',en:'Swiss franc'},
] as const;
export type StudioCurrency=typeof STUDIO_CURRENCIES[number]['code'];
export const isStudioCurrency=(value:unknown):value is StudioCurrency=>STUDIO_CURRENCIES.some(c=>c.code===value);

export function formatStudioMoney(value:number,currency:StudioCurrency='CNY',language:StudioLanguage='zh'){
 if(!Number.isFinite(value))return '—';
 const code=isStudioCurrency(currency)?currency:'CNY';
 const format=new Intl.NumberFormat(language==='en'?'en-US':'zh-CN',{style:'currency',currency:code});
 const digits=format.resolvedOptions().maximumFractionDigits??2;
 return new Intl.NumberFormat(language==='en'?'en-US':'zh-CN',{style:'currency',currency:code,currencyDisplay:'symbol',minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Math.round(value*100)/100);
}
