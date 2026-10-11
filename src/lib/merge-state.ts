// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** Shared deterministic three-way merge, safe for client and server. */
export function mergeChanges(base:unknown,current:unknown,proposed:unknown,path='',conflicts:string[]=[]):unknown{
 if(same(proposed,base))return current;if(same(current,base)||same(proposed,current))return proposed;
 if(Array.isArray(base)&&Array.isArray(current)&&Array.isArray(proposed)&&[...base,...current,...proposed].every(x=>x&&typeof x==='object'&&typeof x.id==='string')){const b=new Map(base.map(x=>[x.id,x])),c=new Map(current.map(x=>[x.id,x])),n=new Map(proposed.map(x=>[x.id,x]));return [...new Set([...c.keys(),...n.keys(),...b.keys()])].flatMap(id=>{const merged=mergeChanges(b.get(id),c.get(id),n.get(id),path+'.'+id,conflicts);return merged===undefined?[]:[merged];});}
 if(base&&current&&proposed&&[base,current,proposed].every(v=>typeof v==='object'&&!Array.isArray(v))){const b=base as Record<string,unknown>,c=current as Record<string,unknown>,n=proposed as Record<string,unknown>;return Object.fromEntries([...new Set([...Object.keys(b),...Object.keys(c),...Object.keys(n)])].map(k=>[k,mergeChanges(b[k],c[k],n[k],path+'.'+k,conflicts)]).filter(([,v])=>v!==undefined));}
 if(path==='.logs'&&Array.isArray(current)&&Array.isArray(proposed))return Array.from(new Map([...current,...proposed].map(x=>[JSON.stringify(x),x])).values()).slice(-500);
 conflicts.push(path);return current;
}
