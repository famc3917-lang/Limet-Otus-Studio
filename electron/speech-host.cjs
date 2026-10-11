// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFile}=require('node:child_process');
// Speech-recognition model is optional at build time; this installs the pinned archive into userData.
const ORIGIN='https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2';
const ARCHIVE_ROOT='sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17',ARCHIVE_LIMIT=600*1024*1024;
module.exports=function({app,ipcMain,authorize}){
 const resources=app.isPackaged?path.join(process.resourcesPath,'speech'):path.join(__dirname,'../speech'),home=path.join(app.getPath('userData'),'speech'),models=path.join(home,'models');
 let running=false,state={phase:'idle',progress:0,error:''};
 const manifest=()=>JSON.parse(fs.readFileSync(path.join(resources,'MODEL.json'),'utf8'));
 const present=dir=>manifest().files.every(file=>fs.existsSync(path.join(dir,file.name)));
 const runtime=()=>fs.existsSync(path.join(resources,'node_modules/sherpa-onnx-node/package.json'));
 const status=()=>({...state,available:runtime()&&(present(path.join(resources,'models'))||present(models))});
 const sha=file=>new Promise((resolve,reject)=>{const hash=crypto.createHash('sha256');fs.createReadStream(file).on('data',block=>hash.update(block)).on('error',reject).on('end',()=>resolve(hash.digest('hex').toUpperCase()));});
 const tar=args=>new Promise((resolve,reject)=>execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32','tar.exe'),args,{windowsHide:true,timeout:600000},error=>error?reject(error):resolve()));
 async function install(){
  running=true;const temp=path.join(home,'install-'+crypto.randomUUID()),archive=temp+'.tar.bz2';
  try{
   const model=manifest();if(model.origin!==ORIGIN)throw Error('语音识别模型来源不符');
   fs.mkdirSync(temp,{recursive:true});state={phase:'download',progress:5,error:''};
   const response=await fetch(ORIGIN,{signal:AbortSignal.timeout(1800000)});if(!response.ok||!response.body)throw Error('语音识别模型下载失败（HTTP '+response.status+'）');
   const total=Number(response.headers.get('content-length'))||0,out=fs.createWriteStream(archive,{flags:'wx'});let bytes=0,failure=null;out.on('error',error=>{failure=error;});
   for await(const block of response.body){if(failure)throw failure;bytes+=block.length;if(bytes>ARCHIVE_LIMIT)throw Error('语音识别模型大小异常');if(!out.write(block))await new Promise(resolve=>out.once('drain',resolve));if(total)state={phase:'download',progress:5+Math.min(75,Math.floor(bytes/total*75)),error:''};}
   await new Promise((resolve,reject)=>out.end(error=>error||failure?reject(error||failure):resolve()));
   state={phase:'verification',progress:82,error:''};if(await sha(archive)!==String(model.archiveSha256).toUpperCase())throw Error('语音识别模型压缩包校验失败');
   state={phase:'extract',progress:88,error:''};await tar(['-xf',archive,'-C',temp,'--strip-components=1',...model.files.map(file=>ARCHIVE_ROOT+'/'+file.name)]);
   for(const file of model.files)if(await sha(path.join(temp,file.name))!==String(file.Hash).toUpperCase())throw Error('语音识别模型文件校验失败：'+file.name);
   fs.rmSync(models,{recursive:true,force:true});fs.renameSync(temp,models);state={phase:'ready',progress:100,error:''};
  }catch(error){state={phase:'error',progress:state.progress,error:error.message};}
  finally{running=false;fs.rmSync(archive,{force:true});fs.rmSync(temp,{recursive:true,force:true});}
 }
 ipcMain.handle('studio-speech-install-status',async event=>{await authorize(event,'ai:use');return status();});
 ipcMain.handle('studio-speech-install',async event=>{await authorize(event,'ai:configure');if(!running&&!status().available)void install();return status();});
 return {models};
};
