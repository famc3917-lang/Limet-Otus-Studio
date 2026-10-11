// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
// Fetches the pinned TTS bootstrap (uv and CosyVoice source) that the in-app installer needs.
// Neither is kept in the source repository; versions and hashes come from tts/RUNTIME.json.
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),{execFileSync}=require('child_process');
const tts=path.resolve(__dirname,'../tts'),target=path.resolve(process.env.STUDIO_TTS_BOOTSTRAP_DIR||tts);
const runtime=JSON.parse(fs.readFileSync(path.join(tts,'RUNTIME.json'),'utf8'));
const COSYVOICE='https://github.com/FunAudioLLM/CosyVoice.git',MATCHA='https://github.com/shivammehta25/Matcha-TTS.git';
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const tar=process.platform==='win32'?path.join(process.env.SystemRoot||'C:\\Windows','System32','tar.exe'):'tar';
const curl=process.platform==='win32'?path.join(process.env.SystemRoot||'C:\\Windows','System32','curl.exe'):'curl';
// Some networks reach GitHub only through curl's proxy and address fallback, so fall back to it.
async function download(url,file){
 try{const response=await fetch(url,{signal:AbortSignal.timeout(600000)});if(!response.ok)throw Error('HTTP '+response.status);fs.writeFileSync(file,Buffer.from(await response.arrayBuffer()));}
 catch{execFileSync(curl,['-fsSL','--retry','3','--max-time','600','-o',file,url],{stdio:['ignore','ignore','inherit']});}
}
function find(dir,name){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){const hit=find(file,name);if(hit)return hit;}else if(entry.name===name)return file;}return null;}
function copy(from,to){const stat=fs.statSync(from);if(stat.isDirectory()){if(path.basename(from)==='__pycache__'||path.basename(from)==='.git')return;fs.mkdirSync(to,{recursive:true});for(const name of fs.readdirSync(from))copy(path.join(from,name),path.join(to,name));}else fs.copyFileSync(from,to);}
function checkout(repo,commit,dir){
 if(!/^[a-f0-9]{40}$/.test(commit))throw Error('Invalid pinned commit');
 const git=args=>execFileSync('git',args,{cwd:dir,stdio:['ignore','pipe','inherit']}).toString().trim();
 fs.mkdirSync(dir,{recursive:true});git(['init','-q']);git(['remote','add','origin',repo]);git(['fetch','--depth','1','-q','origin',commit]);git(['checkout','-q','FETCH_HEAD']);
 if(git(['rev-parse','HEAD'])!==commit)throw Error('Checked-out commit does not match '+commit);
}
async function fetchUV(){
 const bin=path.join(target,'bin'),exe=path.join(bin,'uv.exe'),licences=['LICENSE-APACHE','LICENSE-MIT'];
 if(fs.existsSync(exe)&&sha(exe)===runtime.uvSha256&&licences.every(name=>fs.existsSync(path.join(bin,name)))){console.log('uv '+runtime.uvVersion+' already present and verified.');return;}
 if(!/^\d+\.\d+\.\d+$/.test(runtime.uvVersion))throw Error('Invalid pinned uv version');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'limet-uv-'));
 try{
  const archive=path.join(temp,'uv.zip');await download(`https://github.com/astral-sh/uv/releases/download/${runtime.uvVersion}/uv-x86_64-pc-windows-msvc.zip`,archive);
  execFileSync(tar,['-xf',archive,'-C',temp]);const found=find(temp,'uv.exe');if(!found||sha(found)!==runtime.uvSha256)throw Error('uv.exe integrity mismatch');
  fs.mkdirSync(bin,{recursive:true});fs.copyFileSync(found,exe);
  for(const name of licences)await download(`https://raw.githubusercontent.com/astral-sh/uv/${runtime.uvVersion}/${name}`,path.join(bin,name));
  console.log('uv '+runtime.uvVersion+' fetched and verified.');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
function fetchCosyVoice(){
 const vendor=path.join(target,'vendor/CosyVoice'),required=['cosyvoice/cli/model.py','LICENSE','third_party/Matcha-TTS/LICENSE','third_party/Matcha-TTS/matcha/models/components/flow_matching.py'];
 if(required.every(name=>fs.existsSync(path.join(vendor,name)))){console.log('CosyVoice source already present.');return;}
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'limet-cosyvoice-'));
 try{
  const cosy=path.join(temp,'CosyVoice'),matcha=path.join(temp,'Matcha-TTS');checkout(COSYVOICE,runtime.cosyVoiceCommit,cosy);checkout(MATCHA,runtime.matchaCommit,matcha);
  fs.rmSync(vendor,{recursive:true,force:true});
  // Only what the installer and runtime use, matching the electron-builder filter.
  for(const name of ['cosyvoice','LICENSE','README.md'])copy(path.join(cosy,name),path.join(vendor,name));
  for(const name of ['matcha','LICENSE'])copy(path.join(matcha,name),path.join(vendor,'third_party/Matcha-TTS',name));
  for(const name of required)if(!fs.existsSync(path.join(vendor,name)))throw Error('Missing CosyVoice file: '+name);
  console.log('CosyVoice '+runtime.cosyVoiceCommit.slice(0,12)+' and Matcha-TTS '+runtime.matchaCommit.slice(0,12)+' fetched.');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
(async()=>{await fetchUV();fetchCosyVoice();})().catch(error=>{console.error(error.message);process.exit(1);});
