// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto'),Module=require('module'),assert=require('assert/strict');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'guanyu-drafts-')),handlers=new Map(),original=Module._load;
Module._load=function(name,...args){return name==='electron'?{ipcMain:{handle:(id,fn)=>handlers.set(id,fn)},safeStorage:{}}:original.call(this,name,...args);};
const install=require('../electron/drafts-host.cjs');Module._load=original;
let current={id:'user-a',workspaceId:'workspace-a',scopes:['business:read','orders:write']},calls=0;
install({app:{getPath:()=>folder},url:'http://localhost:3000',key:crypto.randomBytes(32).toString('base64'),authorize:async event=>{calls++;await Promise.resolve();event.senderFrame=null;if(!current)throw new Error('session revoked');return current;}});
const invoke=(name,body,url='http://localhost:3000/orders')=>handlers.get(name)({sender:{id:1},senderFrame:{url}},body);
(async()=>{try{
 assert.equal(await invoke('studio-draft-read'),null);
 const data={revision:3,data:{orders:[{id:'synthetic-order'}]}};await invoke('studio-draft-save',data);assert.deepEqual(await invoke('studio-draft-read'),data);
 const encrypted=fs.readFileSync(path.join(folder,'encrypted-drafts/workspace-a-user-a-main.json'),'utf8');assert(!encrypted.includes('synthetic-order'));
 current={id:'user-b',workspaceId:'workspace-b',scopes:['business:read']};assert.equal(await invoke('studio-draft-read'),null);await assert.rejects(invoke('studio-draft-save',data),/只读/);
 current=null;await assert.rejects(invoke('studio-draft-clear'),/revoked/);assert(calls>=6);await assert.rejects(invoke('studio-draft-read',undefined,'https://invalid.test/orders'),/来源/);
 current={id:'user-a',workspaceId:'workspace-a',scopes:['business:read','orders:write']};await invoke('studio-draft-clear');assert.equal(await invoke('studio-draft-read'),null);
 console.log('PASS: draft IPC survives frame navigation, rechecks permissions, encrypts data and isolates accounts.');
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
