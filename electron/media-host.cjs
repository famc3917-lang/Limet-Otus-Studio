// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
module.exports=function({session,getMain,origin}){
 const trusted=(contents,url)=>{try{return !!contents&&contents.id===getMain()?.webContents.id&&new URL(url||contents.getURL()).origin===origin;}catch{return false;}};
 const basic=permission=>['clipboard-sanitized-write','fullscreen'].includes(permission);
 session.setPermissionCheckHandler((contents,permission,requestingOrigin,details)=>trusted(contents,requestingOrigin)&&details.isMainFrame!==false&&(basic(permission)||permission==='media'&&details.mediaType==='audio'));
 session.setPermissionRequestHandler((contents,permission,callback,details)=>callback(trusted(contents,details.requestingUrl)&&details.isMainFrame!==false&&(basic(permission)||permission==='media'&&Array.isArray(details.mediaTypes)&&details.mediaTypes.length>0&&details.mediaTypes.every(type=>type==='audio'))));
};
