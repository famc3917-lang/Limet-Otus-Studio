// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md

/** Client phone and social-account fields are outside the data scope, including in imported state. */
export function rejectContactFields(value:unknown){
 const seen=new WeakSet<object>();let count=0;
 function walk(node:unknown):void{
  if(!node||typeof node!=='object')return;
  if(seen.has(node))return;seen.add(node);
  if(++count>100000)throw Object.assign(new Error('业务数据过大'),{status:413});
  for(const [key,child] of Object.entries(node)){
   if(/^(?:phone|wechat|mobile|socialAccount)$/i.test(key))throw Object.assign(new Error('不支持客户电话或社交账号字段'),{status:400});
   walk(child);
  }
 }
 walk(value);
}

