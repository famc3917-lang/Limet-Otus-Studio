// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
/**
 * Start-up unlock. Before the local service starts, the studio's master key must be opened from the key ring with an
 * account name and either of its passwords. Wrong passwords are slowed by
 * scrypt and, after five failures, by a growing wait. Resolves with the master key and how to sign in, or null when
 * the window is closed.
 */
const {BrowserWindow,ipcMain}=require('electron');
const path=require('path');
const vault=require('./vault.cjs');

module.exports=function unlockStudio({dir,icon}){return new Promise(resolve=>{
 const win=new BrowserWindow({width:420,height:580,resizable:false,maximizable:false,show:false,backgroundColor:'#1c1c1e',title:'解锁工作室',icon,autoHideMenuBar:true,
  webPreferences:{preload:path.join(__dirname,'unlock-preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 win.loadFile(path.join(__dirname,'unlock.html'));win.once('ready-to-show',()=>win.show());
 let done=false,failures=0,waitUntil=0,timer=null;
 /* the window stays until the studio's own window is up, so the app never sees zero windows and quits */
 const finish=result=>{if(done)return;done=true;clearInterval(timer);ipcMain.removeHandler('vault-unlock');resolve({...result,close:()=>{if(!win.isDestroyed())win.destroy();}});};
 ipcMain.handle('vault-unlock',async(event,username,password)=>{if(event.sender!==win.webContents||done)return {ok:false};
  if(Date.now()<waitUntil)return {ok:false,error:`尝试次数过多，请 ${Math.ceil((waitUntil-Date.now())/1000)} 秒后再试`};
  const key=await vault.unlockWithPassword(dir,username,password);
  if(!key){failures++;if(failures>=5)waitUntil=Date.now()+Math.min(300000,30000*2**(failures-5));return {ok:false,error:'账户名或密码不正确'};}
  finish({masterKey:key,login:{username,password}});return {ok:true};});
 win.on('closed',()=>{if(!done){done=true;clearInterval(timer);ipcMain.removeHandler('vault-unlock');resolve(null);}});
});};
