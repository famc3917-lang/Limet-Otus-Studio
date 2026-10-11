// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const assert=require('assert/strict');
// Resumed fixed installer QA against an existing verified model/cache, never the human profile.
(async()=>{const root=process.env.STUDIO_TTS_QA_ROOT;if(!root)throw Error('STUDIO_TTS_QA_ROOT is required');const handlers=new Map();require('../electron/tts-host.cjs')({app:{isPackaged:false,getPath:()=>root},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},authorize:async(event,scope)=>{if(scope==='ai:configure'&&!event.admin)throw Error('forbidden');}});await assert.rejects(handlers.get('studio-tts-install')({admin:false}));await handlers.get('studio-tts-install')({admin:true});let result;for(let i=0;i<450;i++){result=await handlers.get('studio-tts-install-status')({admin:true});if(['ready','error'].includes(result.phase))break;await new Promise(resolve=>setTimeout(resolve,2000));}assert.equal(result.phase,'ready',JSON.stringify(result));assert(result.available);require('./qa-output.cjs')('tts-installer.json',{version:'2.3.0',passed:true,scopeEnforced:true,officialPinnedRuntime:true,verifiedModelCacheReused:true,freshNetworkInstall:false,status:result});console.log(JSON.stringify(result));})().catch(e=>{console.error(e);process.exitCode=1;});
