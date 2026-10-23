// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/**
 * Server side of the desktop key ring (vault.json, same format as electron/vault.cjs). Whenever the server learns an
 * owner's password — at first set-up, a password change or a sign-in — it wraps the master key it is running with under
 * that password, so the owner can unlock the studio at the next start. Only owners hold wraps: a member's password must
 * not open the key that also signs account records. Owners who are demoted or disabled lose their wraps. Only the desktop build keeps a key ring; servers with a deployment key leave this alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createCipheriv,createHash,randomBytes,randomUUID,scrypt} from 'node:crypto';
import {masterKey} from './crypto';

type Slot={id:string;kind:'password'|'passphrase';who:string;salt?:string;iv:string;tag:string;key:string;created:string;[extra:string]:unknown};
const N=131072;
const enabled=()=>process.env.STUDIO_DESKTOP==='1'&&!!process.env.STUDIO_DATA_DIR;
const file=()=>path.join(process.env.STUDIO_DATA_DIR!,'vault.json');
export const vaultWho=(username:string)=>createHash('sha256').update('limet-otus/vault-user/v1|'+String(username).trim()).digest('hex');
const aad=(s:Pick<Slot,'kind'|'who'|'id'>)=>Buffer.from(['limet-otus/vault/v1',s.kind,s.who,s.id].join('|'));
function read():{v:1;slots:Slot[]}{try{const v=JSON.parse(fs.readFileSync(file(),'utf8'));return v&&v.v===1&&Array.isArray(v.slots)?v:{v:1,slots:[]};}catch{return {v:1,slots:[]};}}
function write(v:{v:1;slots:Slot[]}){const tmp=file()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(v,null,1),{mode:0o600});fs.renameSync(tmp,file());}
const kdf=(secret:string,salt:Buffer)=>new Promise<Buffer>((resolve,reject)=>scrypt(secret,salt,32,{N,r:8,p:1,maxmem:256*1024*1024},(e,k)=>e?reject(e):resolve(k)));
/** Wraps the running master key under one of an account's passwords, replacing that account's earlier wrap of the same kind. */
export async function vaultSetSecret(username:string,kind:'password'|'passphrase',secret:string){if(!enabled()||!secret)return;
 const salt=randomBytes(32),kek=await kdf(kind==='passphrase'?secret.normalize('NFC'):secret,salt),slot={id:randomUUID(),kind,who:vaultWho(username)};
 const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',kek,iv);c.setAAD(aad(slot));const data=Buffer.concat([c.update(masterKey()),c.final()]);
 const v=read();v.slots=v.slots.filter(s=>!(s.kind===kind&&s.who===slot.who));v.slots.push({...slot,salt:salt.toString('base64'),iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64'),key:data.toString('base64'),created:new Date().toISOString()});write(v);}
export const vaultHas=(username:string,kind:'password'|'passphrase')=>enabled()&&read().slots.some(s=>s.kind===kind&&s.who===vaultWho(username));
/** True once the desktop key ring holds any wrap: from then on the master key opens only through it. */
export const vaultHasSlots=()=>enabled()&&read().slots.length>0;
/** Drops password wraps of anyone who is not an active owner, so earlier member wraps do not outlive this rule. */
export function vaultKeepOwners(owners:string[]){if(!enabled())return;const keep=new Set(owners.map(vaultWho)),v=read();const before=v.slots.length;v.slots=v.slots.filter(s=>keep.has(s.who));if(v.slots.length!==before)write(v);}
/** Removes an account's password wraps (account disabled or renamed). */
export function vaultForget(username:string){if(!enabled())return;const w=vaultWho(username),v=read();const before=v.slots.length;v.slots=v.slots.filter(s=>s.who!==w);if(v.slots.length!==before)write(v);}
