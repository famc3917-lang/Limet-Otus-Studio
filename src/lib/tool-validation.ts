// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/** Validate the supported tool-schema subset at the server boundary, including unknown keys. */
export function validateToolPayload(schema:Record<string,unknown>,payload:unknown){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('工具参数须为对象');
 const p=payload as Record<string,unknown>,props=(schema.properties??{}) as Record<string,Record<string,unknown>>;
 for(const key of Object.keys(p))if(!Object.hasOwn(props,key)||['__proto__','prototype','constructor'].includes(key))throw Error('不支持的工具参数：'+key);
 for(const key of (schema.required??[]) as string[])if(!Object.hasOwn(p,key))throw Error('缺少工具参数：'+key);
 for(const [key,value] of Object.entries(p)){const rule=props[key];if(rule.type==='string'&&(typeof value!=='string'||value.length>Number(rule.maxLength??10000)||rule.pattern&&!new RegExp(String(rule.pattern)).test(value)))throw Error('工具参数无效：'+key);if(rule.type==='boolean'&&typeof value!=='boolean')throw Error('工具参数须为布尔值：'+key);if(rule.type==='number'&&(typeof value!=='number'||!Number.isFinite(value)))throw Error('工具参数须为有限数值：'+key);if(rule.enum&&!(rule.enum as unknown[]).includes(value))throw Error('工具参数不在允许范围：'+key);}
}
