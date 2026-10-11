// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
"use strict";
const fs=require('fs');
// Window background per theme; matches --background in src/app/v300.css.
const BACKGROUNDS={dark:'#0b0e0c',light:'#f1f3ef'};
module.exports=function({ipcMain,getMain,getOrigin,themeFile}){
 let theme='dark';try{const saved=JSON.parse(fs.readFileSync(themeFile,'utf8')).theme;if(Object.hasOwn(BACKGROUNDS,saved))theme=saved;}catch{}
 const trusted=event=>{const main=getMain();if(!main||event.sender!==main.webContents||event.senderFrame!==main.webContents.mainFrame||new URL(event.senderFrame.url).origin!==getOrigin())throw Error('Invalid window control source');return main;};
 const state=main=>({maximized:main.isMaximized()});
 ipcMain.handle('studio-window-action',(event,action)=>{const main=trusted(event);if(action==='minimize')main.minimize();else if(action==='maximize'){if(main.isMaximized())main.unmaximize();else main.maximize();}else if(action==='close')main.close();else throw Error('Invalid window action');return state(main);});
 ipcMain.handle('studio-window-state',event=>state(trusted(event)));
 ipcMain.handle('studio-window-theme',(event,value)=>{const main=trusted(event);if(!Object.hasOwn(BACKGROUNDS,value))throw Error('Invalid window theme');main.setBackgroundColor(BACKGROUNDS[value]);if(value!==theme){theme=value;try{const tmp=themeFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify({theme}),'utf8');fs.renameSync(tmp,themeFile);}catch{}}return value;});
 return {background:()=>BACKGROUNDS[theme],attach(main){const changed=()=>{if(!main.isDestroyed())main.webContents.send('studio-window-state',state(main));};main.on('maximize',changed);main.on('unmaximize',changed);}};
};
