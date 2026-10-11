// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {Worker} from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import {fail} from './crypto';
import {rateLimit,requireScope,type Principal} from './security';
import {acquireInference,registerInferenceEngine} from './inference-budget';
const runtime=()=>process.env.STUDIO_SPEECH_RUNTIME||path.join(process.cwd(),'speech');
/** Bundled models win; otherwise the copy installed from the app into STUDIO_SPEECH_MODELS. */
const modelDirectory=()=>{const bundled=path.join(runtime(),'models'),installed=process.env.STUDIO_SPEECH_MODELS;return !fs.existsSync(path.join(bundled,'model.int8.onnx'))&&installed&&fs.existsSync(path.join(installed,'model.int8.onnx'))?installed:bundled;};
let worker:Worker|undefined,busy=false,idle:ReturnType<typeof setTimeout>|undefined;
registerInferenceEngine('asr',()=>{if(idle)clearTimeout(idle);void worker?.terminate();worker=undefined;});
export function speechStatus(p:Principal){requireScope(p,'ai:use');return {available:fs.existsSync(path.join(modelDirectory(),'model.int8.onnx'))&&fs.existsSync(path.join(modelDirectory(),'tokens.txt'))&&fs.existsSync(path.join(runtime(),'node_modules/sherpa-onnx-node/package.json')),model:'SenseVoiceSmall',quantization:'INT8',sampleRate:16000,maxSeconds:30};}
export async function transcribe(p:Principal,body:Record<string,unknown>){
 requireScope(p,'ai:use');await rateLimit('speech:'+p.id,12,60);
 if(body.sampleRate!==16000||typeof body.pcm!=='string'||body.pcm.length>1280000||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.pcm))fail('录音格式无效');
 const pcm=Buffer.from(body.pcm as string,'base64');if(pcm.length<3200||pcm.length>960000||pcm.length%2)fail('录音须为 0.1–30 秒');
 if(!speechStatus(p).available)fail('语音识别暂不可用',503);if(busy)fail('语音识别忙碌，请稍后重试',429);
 const release=acquireInference('asr');busy=true;if(idle)clearTimeout(idle);const samples=new Float32Array(pcm.length/2),duration=samples.length/16000;for(let i=0;i<samples.length;i++)samples[i]=pcm.readInt16LE(i*2)/32768;
 try{return await new Promise<{text:string;duration:number}>((resolve,reject)=>{
  const engine=worker??=new Worker(path.join(runtime(),'worker.cjs'),{workerData:{models:modelDirectory()}});engine.ref();
  const timeout=setTimeout(()=>{void engine.terminate();if(worker===engine)worker=undefined;finish(new Error('语音识别超时，请重试'));},45000);
  const finish=(error?:Error,value?:{text:string;duration:number})=>{clearTimeout(timeout);engine.off('message',message);engine.off('error',errorHandler);engine.off('exit',exit);if(error)reject(error);else resolve(value!);};
  const message=(value:{text?:string;error?:string})=>value.error?finish(new Error('语音识别失败，请重试')):finish(undefined,{text:String(value.text??'').slice(0,8000),duration});
  const errorHandler=(error:Error)=>{if(worker===engine)worker=undefined;finish(error);};const exit=()=>{if(worker===engine)worker=undefined;finish(new Error('语音识别已停止'));};
  engine.once('message',message);engine.once('error',errorHandler);engine.once('exit',exit);engine.postMessage(samples.buffer,[samples.buffer]);
 });}finally{release();busy=false;worker?.unref();idle=setTimeout(()=>{void worker?.terminate();worker=undefined;},90000);idle.unref();}
}
