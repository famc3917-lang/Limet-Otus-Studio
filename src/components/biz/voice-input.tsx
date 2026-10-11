// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {errorText} from '@/lib/interface-error';
import {useStudioText as useInterfaceText} from '@/lib/i18n';
import {useEffect,useRef,useState} from 'react';
import {apiRequest} from '@/lib/api-client';
import {getSessionUser} from '@/lib/auth';
import {desktop,type TTSInstallStatus} from '@/lib/desktop';
export function VoiceInput({active=true,disabled,onText}:{active?:boolean;disabled:boolean;onText:(text:string)=>void}){
 const uiText=useInterfaceText();
 const [available,setAvailable]=useState<boolean|null>(null),[install,setInstall]=useState<TTSInstallStatus|null>(null);
 const installing=!!install&&!['ready','error','idle'].includes(install.phase);
 useEffect(()=>{let cancelled=false;void apiRequest<{available:boolean}>('speech').then(value=>{if(!cancelled)setAvailable(value.available);}).catch(()=>{});return ()=>{cancelled=true;};},[install?.phase]);
 useEffect(()=>{if(!installing)return;let cancelled=false;const timer=setInterval(()=>void desktop()?.speechInstallStatus?.().then(value=>{if(!cancelled)setInstall(value);}).catch(()=>{}),2000);return ()=>{cancelled=true;clearInterval(timer);};},[installing]);
 const startInstall=async()=>{setMessage('');try{const result=await desktop()?.speechInstall?.();if(result)setInstall(result);}catch(e){setMessage(errorText(e));}};

 const [phase,setPhase]=useState<'idle'|'preparing'|'recording'|'recognizing'>('idle'),[message,setMessage]=useState('');
 const session=useRef<{recorder:MediaRecorder;stream:MediaStream;timer:ReturnType<typeof setTimeout>;cancelled:boolean}|null>(null),controller=useRef<AbortController|null>(null),alive=useRef(true),activeRef=useRef(active),requesting=useRef(false),generation=useRef(0);
 const cancel=()=>{generation.current++;const current=session.current;if(current){current.cancelled=true;clearTimeout(current.timer);if(current.recorder.state!=='inactive')current.recorder.stop();current.stream.getTracks().forEach(t=>t.stop());session.current=null;}controller.current?.abort();};
 useEffect(()=>{alive.current=true;return ()=>{alive.current=false;cancel();};},[]);
 useEffect(()=>{activeRef.current=active;if(!active){cancel();queueMicrotask(()=>setPhase('idle'));}},[active]);
 const record=async()=>{if(session.current){session.current.recorder.stop();return;}if(disabled||phase!=='idle'||requesting.current)return;requesting.current=true;const requestGeneration=generation.current;setMessage('');setPhase('preparing');let acquired:MediaStream|undefined;
  try{if(!navigator.mediaDevices?.getUserMedia)throw new Error(uiText("请使用桌面版或 HTTPS 页面录音","Use the desktop app or an HTTPS page to record audio"));const stream=acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});if(!alive.current||!activeRef.current||generation.current!==requestGeneration){stream.getTracks().forEach(t=>t.stop());return;}
   const recorder=new MediaRecorder(stream),chunks:Blob[]=[];const current={recorder,stream,timer:setTimeout(()=>{if(recorder.state!=='inactive')recorder.stop();},29500),cancelled:false};session.current=current;
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=async()=>{clearTimeout(current.timer);stream.getTracks().forEach(t=>t.stop());session.current=null;if(current.cancelled||!alive.current)return;setPhase('recognizing');const abort=controller.current=new AbortController();let context:AudioContext|undefined;
    try{context=new AudioContext();const decoded=await context.decodeAudioData(await new Blob(chunks,{type:recorder.mimeType}).arrayBuffer());const length=Math.min(480000,Math.floor(decoded.duration*16000));if(length<3200)throw new Error(uiText("录音太短，请再试一次","The recording is too short. Please retry."));const offline=new OfflineAudioContext(1,length,16000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();const samples=(await offline.startRendering()).getChannelData(0),pcm=new Uint8Array(samples.length*2),view=new DataView(pcm.buffer);for(let i=0;i<samples.length;i++)view.setInt16(i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);let binary='';for(let i=0;i<pcm.length;i+=8192)binary+=String.fromCharCode(...pcm.subarray(i,i+8192));const result=await apiRequest<{text:string}>('speech',{method:'POST',body:JSON.stringify({pcm:btoa(binary),sampleRate:16000}),signal:abort.signal});if(alive.current&&!abort.signal.aborted){if(result.text){onText(result.text);setMessage(uiText('已识别，可编辑后发送','Transcribed. Edit before sending.'));}else setMessage(uiText('没有识别到语音，请再试一次','No speech was detected. Please retry.'));}}
    catch(e){if(alive.current&&!abort.signal.aborted)setMessage(errorText(e));}finally{await context?.close();if(alive.current&&generation.current===requestGeneration)setPhase('idle');if(controller.current===abort)controller.current=null;}};
   recorder.start();setPhase('recording');
  }catch(e){acquired?.getTracks().forEach(t=>t.stop());setPhase('idle');setMessage((e as Error).name==='NotAllowedError'?uiText('请允许麦克风权限后重试','Allow microphone access and retry.'):errorText(e));}finally{requesting.current=false;}
 };
 if(available===false)return <div className="voice-input">{desktop()?.speechInstall&&getSessionUser()?.scopes.includes('ai:configure')?<button type="button" className="voice-button" disabled={installing} onClick={()=>void startInstall()}>{installing?uiText(`安装语音识别 ${install!.progress}%`,`Installing speech recognition ${install!.progress}%`):uiText('安装语音识别','Install speech recognition')}</button>:<small>{uiText('语音识别待开通','Speech recognition unavailable')}</small>}<span role="status">{install?.phase==='error'?uiText('安装失败：','Installation failed: ')+install.error:message}</span></div>;
 return <div className="voice-input"><button type="button" className={'voice-button '+phase} disabled={disabled||phase==='recognizing'||phase==='preparing'} onClick={()=>void record()} aria-pressed={phase==='recording'} aria-label={phase==='recording'?uiText("停止录音并识别","Stop recording and transcribe"):uiText("语音输入","Voice input")}>{phase==='recording'?uiText("■ 停止","■ Stop"):phase==='recognizing'?uiText("识别中…","Transcribing…"):phase==='preparing'?uiText("准备中…","Preparing…"):uiText("◉ 语音","◉ Voice")}</button><span role="status">{phase==='recording'?uiText("正在录音 · 最长 30 秒","Recording · Up to 30 seconds"):message}</span></div>;
}
