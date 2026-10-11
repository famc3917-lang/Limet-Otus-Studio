// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const {ipcMain}=require('electron');
const fs=require('fs'),path=require('path');
const {encryptJSON,decryptJSON}=require('./security.cjs');
module.exports=function installDrafts({app,url,key,authorize}){const folder=path.join(app.getPath('userData'),'encrypted-drafts');
async function identity(event){const frame=event.senderFrame;if(!frame)throw new Error('IPC 来源未获授权');const address=new URL(frame.url);if(address.origin!==url)throw new Error('IPC 来源未获授权');const slot=address.pathname==='/assistant'?'assistant':'main';const user=await authorize(event,'business:read'),context=`draft:${user.workspaceId}:${user.id}:${slot}`,file=path.join(folder,`${user.workspaceId}-${user.id}-${slot}.json`);return {user,context,file};}
ipcMain.handle('studio-draft-read',async event=>{const {file,context}=await identity(event,true);try{return decryptJSON(key,fs.readFileSync(file,'utf8'),context);}catch(e){if(e.code==='ENOENT')return null;throw new Error('未同步草稿无法解密，请保留原始文件后检查密钥');}});
ipcMain.handle('studio-draft-save',async(event,draft)=>{const {file,context,user}=await identity(event,false);if(!user.scopes.includes('orders:write'))throw new Error('只读账户不能写入草稿');if(!draft||!Number.isSafeInteger(draft.revision)||!draft.data||JSON.stringify(draft).length>32*1024*1024)throw new Error('草稿格式无效');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(file+'.tmp',encryptJSON(key,draft,context));fs.renameSync(file+'.tmp',file);return {ok:true};});
ipcMain.handle('studio-draft-clear',async event=>{const {file}=await identity(event,false);try{fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}return {ok:true};});
};
