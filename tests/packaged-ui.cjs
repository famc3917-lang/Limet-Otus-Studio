// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),assert=require('assert/strict'),{spawn}=require('child_process');
const root=path.resolve(process.argv[2]),project=path.resolve(__dirname,'..'),exe=path.join(root,'观隅鸮馆.exe'),server=path.join(root,'resources/server/server.js');
const data=fs.mkdtempSync(path.join(os.tmpdir(),'guanyu-packaged-ui-')),origin='http://127.0.0.1:38331',output=process.env.STUDIO_QA_OUTPUT||path.join(project,'test-results',require('../package.json').version);
fs.mkdirSync(output,{recursive:true});
const env={...process.env,DATABASE_URL:'',STUDIO_REMOTE_API_URL:'',NODE_ENV:'production',STUDIO_DESKTOP:'1',STUDIO_DATA_DIR:data,STUDIO_MASTER_KEY:crypto.randomBytes(32).toString('base64'),STUDIO_SESSION_TOKEN:'studio-local-qa-fixture-token',STUDIO_ORIGINS:origin,HOSTNAME:'127.0.0.1',PORT:'38331',STUDIO_SPEECH_RUNTIME:path.join(root,'resources/speech'),STUDIO_TTS_RESOURCES:path.join(root,'resources/tts'),STUDIO_TTS_HOME:path.join(data,'tts'),STUDIO_QA_OUTPUT:output,STUDIO_QA_PRODUCT_RUNTIME:path.join(root,'resources/app.asar')};
let backend,ui,log='';
async function run(){try{
 backend=spawn(exe,[server],{cwd:path.dirname(server),windowsHide:true,env:{...env,ELECTRON_RUN_AS_NODE:'1'},stdio:['ignore','pipe','pipe']});backend.stdout.on('data',b=>log+=b);backend.stderr.on('data',b=>log+=b);backend.on('error',e=>log+=e.stack);
 let ready=false;for(let i=0;i<100;i++){if(backend.exitCode!==null)throw Error('Backend exited');try{if((await fetch(origin+'/api/v1/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready,'UI backend startup');
 const uiEnv={...env};delete uiEnv.ELECTRON_RUN_AS_NODE;
 ui=spawn(require('electron'),[path.join(project,'tests/voice-ui.cjs')],{cwd:project,windowsHide:true,env:uiEnv,stdio:['ignore','pipe','pipe']});ui.stdout.on('data',b=>{process.stdout.write(b);log+=b;});ui.stderr.on('data',b=>{process.stderr.write(b);log+=b;});
 const timer=setTimeout(()=>ui.kill(),180000);const code=await new Promise((resolve,reject)=>{ui.once('error',reject);ui.once('exit',resolve);});clearTimeout(timer);assert.equal(code,0,'Packaged native UI failed');
 }finally{ui?.kill();backend?.kill();fs.writeFileSync(path.join(output,'packaged-ui.log'),log);}}
run().catch(e=>{console.error(e);process.exitCode=1;});
