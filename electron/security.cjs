// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const {safeStorage}=require('electron');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function masterKey(app){if(!safeStorage.isEncryptionAvailable())throw new Error('系统安全存储不可用，不能启动加密业务存储');const file=path.join(app.getPath('userData'),'vault-key.dpapi');fs.mkdirSync(path.dirname(file),{recursive:true});if(fs.existsSync(file))return safeStorage.decryptString(fs.readFileSync(file));const key=crypto.randomBytes(32).toString('base64');fs.writeFileSync(file,safeStorage.encryptString(key),{mode:0o600,flag:'wx'});return key;}
function authorizeFactory(url){return async(event,scope)=>{if(!event.senderFrame||new URL(event.senderFrame.url).origin!==url)throw new Error('IPC 来源未获授权');const api=process.env.STUDIO_REMOTE_API_URL||url;const cookies=await event.sender.session.cookies.get({url:api});const response=await fetch(api+'/api/v1/auth/me',{headers:{Origin:url,Cookie:cookies.map(c=>`${c.name}=${c.value}`).join('; ')},signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('请先登录');const {user}=await response.json();if(scope&&!user.scopes.includes(scope))throw new Error('当前账户没有此桌面操作权限');return user;};}
function encryptJSON(key,value,context){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(key,'base64'),iv);cipher.setAAD(Buffer.from(context));return JSON.stringify({version:1,iv:iv.toString('base64'),tag:(()=>{const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return {bytes:bytes.toString('base64'),tag:cipher.getAuthTag().toString('base64')};})()});}
function decryptJSON(key,raw,context){const box=JSON.parse(raw);if(box.version!==1)throw new Error('加密格式无效');const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),Buffer.from(box.iv,'base64'));decipher.setAAD(Buffer.from(context));decipher.setAuthTag(Buffer.from(box.tag.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(box.tag.bytes,'base64')),decipher.final()]).toString('utf8'));}
/**
 * Locks the studio's data folder to this Windows account and SYSTEM: inherited entries (other accounts, Users,
 * Administrators) are removed, so another Windows account on the computer cannot open or change the database, the key
 * file or the journals. Programs running under this same account are not stopped by folder permissions; the account
 * seals and the encryption cover that case. Runs once per data folder and never blocks start-up.
 */
function lockDataFolder(dir){if(process.platform!=='win32')return;const marker=path.join(dir,'.folder-locked-v1');if(fs.existsSync(marker))return;
 const {execFile}=require('child_process');
 execFile('whoami',['/user','/fo','csv','/nh'],{windowsHide:true,timeout:8000},(error,out)=>{const sid=/"(S-1-[0-9-]+)"/.exec(String(out||''))?.[1];if(error||!sid)return;
  execFile('icacls',[dir,'/inheritance:r','/grant:r',`*${sid}:(OI)(CI)F`,'*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true,timeout:20000},err=>{if(!err){try{fs.writeFileSync(marker,new Date().toISOString());}catch{}}else console.warn('Data folder lock failed:',err.message);});});}
module.exports={masterKey,authorizeFactory,encryptJSON,decryptJSON,lockDataFolder};
