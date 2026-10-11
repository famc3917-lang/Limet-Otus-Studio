// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import policy from '../../tts/RESOURCE-POLICY.json';
import {BUILTIN_VOICES,voiceProfile} from '@/lib/assistant-identity';
import {readProvider,requireScope,rateLimit,audit,type Principal} from './security';
import {tx} from './database';
import {seal,unseal} from './crypto';
import {normalizeVoiceProfiles} from '@/lib/assistant-identity';
import {fail} from './crypto';
import type {AIConfig} from '@/lib/desktop';
import {acquireInference,registerInferenceEngine} from './inference-budget';
import {privacyFilter} from './ai';
import {currentAssistantPrincipal} from './assistant-policy';
import {readRawState} from './repository';
const home=()=>process.env.STUDIO_TTS_HOME||path.join(process.env.STUDIO_DATA_DIR||os.tmpdir(),'tts');
const resources=()=>process.env.STUDIO_TTS_RESOURCES||fail('请配置语音发行资源目录',503);
const python=()=>path.join(home(),'venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
let worker:ChildProcessWithoutNullStreams|undefined,ready:Promise<Ready>|undefined,idle:ReturnType<typeof setTimeout>|undefined;
type Ready={ready:true;device:string;speakers:string[];peakRamMiB:number};
type Audio={id:string;wav:string;duration:number;device:string;peakRamMiB:number;peakCudaMiB:number;error?:string};
let pending:{id:string;resolve:(value:Audio)=>void;reject:(error:Error)=>void}|undefined,loading:{resolve:(value:Ready)=>void;reject:(error:Error)=>void}|undefined;
let current:Ready|undefined;
export function unloadTTS(){if(idle)clearTimeout(idle);const process=worker;worker=undefined;ready=undefined;current=undefined;process?.kill();}
registerInferenceEngine('tts',unloadTTS);
export async function ttsStatus(p:Principal){requireScope(p,'ai:use');const config=await readProvider(p,true) as AIConfig|null;return {available:fs.existsSync(python())&&fs.existsSync(path.join(home(),'runtime-ready.json'))&&fs.existsSync(path.join(home(),'model-ready.json')),loaded:!!current,device:current?.device??'auto',model:'CosyVoice-300M-SFT',voices:[...BUILTIN_VOICES,...(config?.voiceCatalog??[])],policy};}
export async function updateVoices(p:Principal,body:Record<string,unknown>){if(p.apiKeyId)fail('音色配置需要登录会话',403);requireScope(p,'ai:configure');let voices;try{voices=normalizeVoiceProfiles(body.voices);}catch(e){fail((e as Error).message);}return tx(async sql=>{const row=await sql.one<{body:string}>('SELECT body FROM providers WHERE workspace_id=?',[p.workspaceId]);if(!row)fail('请先配置 AI 服务');const config=unseal<AIConfig>(row!.body,'provider:'+p.workspaceId);config.voiceCatalog=voices;await sql.run('UPDATE providers SET body=? WHERE workspace_id=?',[seal(config,'provider:'+p.workspaceId),p.workspaceId]);await audit(sql,p,'tts.voices');return {voices};});}
function startWorker(){if(ready)return ready;ready=new Promise<Ready>((resolve,reject)=>{loading={resolve,reject};const engine=spawn(python(),['-I',path.join(resources(),'worker.py'),home(),path.join(resources(),'vendor/CosyVoice')],{windowsHide:true,env:{...process.env,PYTHONPATH:'',PYTHONNOUSERSITE:'1',PYTHONUTF8:'1',OMP_NUM_THREADS:String(policy.threads),MKL_NUM_THREADS:String(policy.threads)},stdio:['pipe','pipe','pipe']});worker=engine;let buffer='';const timeout=setTimeout(()=>{loading?.reject(Object.assign(Error('语音引擎启动超时，请重试'),{status:503}));loading=undefined;unloadTTS();},policy.startupTimeoutSeconds*1000);engine.stdout.setEncoding('utf8');engine.stdout.on('data',(chunk:string)=>{buffer+=chunk;if(buffer.length>8*1024*1024){engine.kill();return;}let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let value;try{value=JSON.parse(line);}catch{continue;}if(value.ready){clearTimeout(timeout);current=value;loading?.resolve(value);loading=undefined;}else if(value.id===pending?.id){if(value.error)pending!.reject(Object.assign(Error('语音生成失败，请重试'),{status:503}));else pending!.resolve(value);pending=undefined;}}});engine.stderr.on('data',data=>console.error('[TTS worker]',String(data).slice(0,4000)));engine.once('error',()=>{clearTimeout(timeout);const error=Object.assign(Error('语音引擎无法启动，请重新安装语音组件'),{status:503});loading?.reject(error);pending?.reject(error);loading=undefined;pending=undefined;if(worker===engine)unloadTTS();});engine.once('exit',code=>{clearTimeout(timeout);const error=Object.assign(Error(code===96?'语音引擎达到资源预算，已释放，请缩短文本后重试':'语音引擎已停止，请重试'),{status:503});loading?.reject(error);pending?.reject(error);loading=undefined;pending=undefined;if(worker===engine)unloadTTS();});});return ready;}
export async function synthesize(p:Principal,body:Record<string,unknown>){requireScope(p,'ai:use');await rateLimit('tts:'+p.id,60,60);if(typeof body.text!=='string'||!body.text.trim()||body.text.length>policy.maximumTextCharacters)fail('朗读文本须为 1–600 字');const config=await readProvider(p,true) as AIConfig|null;let voice;try{voice=voiceProfile(String(body.voiceId??'cosy-zh-male'),config?.voiceCatalog);}catch(e){fail((e as Error).message);}const safeText=await tx(async sql=>{const actor=await currentAssistantPrincipal(sql,p),snapshot=await readRawState(sql,actor);return privacyFilter(String(body.text),[config?.apiKey??'',config?.searchApiKey??'',...snapshot.data.orders.flatMap(o=>[o.note??''])]);});if(!(await ttsStatus(p)).available)fail('请先安装语音组件',503);const release=acquireInference('tts');if(idle)clearTimeout(idle);try{const status=await startWorker();if(!status.speakers.includes(voice!.speakerId))fail('该音色尚未安装到语音模型',409);const result=await new Promise<Audio>((resolve,reject)=>{const id=randomUUID(),timeout=setTimeout(()=>{reject(Object.assign(Error('语音生成超时，请缩短文本后重试'),{status:503}));unloadTTS();},policy.jobTimeoutSeconds*1000);pending={id,resolve:value=>{clearTimeout(timeout);resolve(value);},reject:error=>{clearTimeout(timeout);reject(error);}};worker!.stdin.write(JSON.stringify({id,text:safeText, speakerId:voice!.speakerId})+'\n');});if(typeof result.wav!=='string'||result.wav.length>6*1024*1024||result.duration>policy.maximumAudioSeconds)fail('语音结果超过资源预算',503);return {mime:'audio/wav',audio:result.wav,duration:result.duration,voiceId:voice!.id,device:result.device};}finally{release();idle=setTimeout(unloadTTS,policy.idleUnloadSeconds*1000);idle.unref();}}


