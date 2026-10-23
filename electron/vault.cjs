// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
/**
 * The key ring (vault.json in the data folder). The studio's master key is never stored on its own: it is kept only
 * wrapped, once per unlocking secret — each account's password and text password. Each wrap is AES-256-GCM under a
 * key derived from that password (scrypt N=2^17), bound by associated data to its kind, owner and id. Nothing in the
 * file opens the master key without one of those passwords, and adding a new wrap needs the master key itself. If
 * every password is lost, the data cannot be opened by anyone.
 *
 * src/server/vault.ts writes the same format from the server side.
 */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const FILE='vault.json',N=131072;
const file=dir=>path.join(dir,FILE);
const who=username=>crypto.createHash('sha256').update('limet-otus/vault-user/v1|'+String(username).trim()).digest('hex');
const aad=s=>Buffer.from(['limet-otus/vault/v1',s.kind,s.who,s.id].join('|'));
function read(dir){try{const v=JSON.parse(fs.readFileSync(file(dir),'utf8'));return v&&v.v===1&&Array.isArray(v.slots)?v:{v:1,slots:[]};}catch{return {v:1,slots:[]};}}
const hasSlots=dir=>read(dir).slots.length>0;
const scrypt=(secret,salt)=>new Promise((resolve,reject)=>crypto.scrypt(secret,salt,32,{N,r:8,p:1,maxmem:256*1024*1024},(e,k)=>e?reject(e):resolve(k)));
function open(slot,kek){try{const d=crypto.createDecipheriv('aes-256-gcm',kek,Buffer.from(slot.iv,'base64'));d.setAAD(aad(slot));d.setAuthTag(Buffer.from(slot.tag,'base64'));const key=Buffer.concat([d.update(Buffer.from(slot.key,'base64')),d.final()]);return key.length===32?key.toString('base64'):null;}catch{return null;}}
/** Tries the account's password and text password wraps (both in parallel); returns the master key or null. */
async function unlockWithPassword(dir,username,secret){const w=who(username),slots=read(dir).slots.filter(s=>s.who===w&&(s.kind==='password'||s.kind==='passphrase'));if(!slots.length||!secret)return null;
 const tries=await Promise.all(slots.map(async s=>open(s,await scrypt(s.kind==='passphrase'?String(secret).normalize('NFC'):String(secret),Buffer.from(s.salt,'base64')))));return tries.find(Boolean)??null;}
/** After the key ring has opened the studio once, the old Windows-protected key file is deleted for good. */
function retireLegacyKey(dir){const legacy=path.join(dir,'vault-key.dpapi');if(fs.existsSync(legacy)&&hasSlots(dir)){try{fs.rmSync(legacy,{force:true});}catch{}}}
module.exports={hasSlots,unlockWithPassword,retireLegacyKey,who,read};
