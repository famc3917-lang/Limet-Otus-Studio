// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {errorText} from '@/lib/interface-error';
import {useStudioText as useInterfaceText,useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import {interfaceNotice} from '@/lib/interface-text';
import {useEffect,useRef,useState} from 'react';
import {apiRequest} from '@/lib/api-client';
import {desktop,type TTSInstallStatus} from '@/lib/desktop';
import {getSessionUser} from '@/lib/auth';
import {type VoiceProfile} from '@/lib/assistant-identity';
import {AutomaticSpeech} from '@/lib/automatic-speech';
export function AssistantSpeech({voiceId,text,streamId,complete,active}:{voiceId:string;text:string;streamId:string;complete:boolean;active:boolean}){
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

 const user=getSessionUser(),muteKey='studio-voice-muted:'+user?.workspaceId+':'+user?.id;
 const [available,setAvailable]=useState(false),[state,setState]=useState<TTSInstallStatus|null>(null),[playing,setPlaying]=useState(false),[error,setError]=useState(''),[muted,setMuted]=useState(()=>typeof window!=='undefined'&&localStorage.getItem(muteKey)==='true');
 const queue=useRef<AutomaticSpeech|null>(null),current=useRef({text,streamId});useEffect(()=>{current.current={text,streamId};},[text,streamId]);
 useEffect(()=>{if(!available)return;let alive=true;const engine=new AutomaticSpeech(async(value,signal)=>{const result=await apiRequest<{audio:string}>('tts/synthesize',{method:'POST',body:JSON.stringify({text:value,voiceId}),signal:AbortSignal.any([signal,AbortSignal.timeout(300000)])});return result.audio;},(encoded,signal)=>new Promise<void>((resolve,reject)=>{
  const data=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0)),url=URL.createObjectURL(new Blob([data],{type:'audio/wav'})),player=new Audio(url);let ended=false;const timer=setTimeout(()=>finish(Error(uiText("声音播放超时，请检查输出设备。","Audio playback timed out. Check your output device."))),100000);
  const finish=(error?:Error)=>{if(ended)return;ended=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);player.onended=null;player.onerror=null;player.onplaying=null;player.pause();player.removeAttribute('src');player.load();URL.revokeObjectURL(url);if(alive)setPlaying(false);if(error)reject(error);else resolve();};
  const cancel=()=>finish(Error(uiText("已取消","Cancelled")));signal.addEventListener('abort',cancel,{once:true});player.onended=()=>finish();player.onerror=()=>finish(Error(uiText("声音播放失败，请检查输出设备。","Audio playback failed. Check your output device.")));player.onplaying=()=>{if(alive)setPlaying(true);};if(signal.aborted)cancel();else void player.play().catch(error=>finish(error));
 }),value=>{if(alive)setError(errorText(value));});engine.skip(current.current.streamId,current.current.text);queue.current=engine;return ()=>{alive=false;engine.reset();if(queue.current===engine)queue.current=null;};},[available,voiceId]);
 useEffect(()=>{if(!active||muted)queue.current?.skip(streamId,text);else queue.current?.feed(streamId,text,complete);},[active,muted,text,streamId,complete,available]);
 useEffect(()=>{if(!active)return;let cancelled=false;const refresh=()=>void apiRequest<{available:boolean;voices:VoiceProfile[]}>('tts/status').then(value=>{if(!cancelled){setAvailable(value.available);}}).catch(()=>{});refresh();window.addEventListener('studio-ai-configured',refresh);return ()=>{cancelled=true;window.removeEventListener('studio-ai-configured',refresh);};},[active,state?.phase]);
 useEffect(()=>{if(!active||!state||['ready','error','idle'].includes(state.phase))return;let cancelled=false;const timer=setInterval(()=>void desktop()?.ttsInstallStatus?.().then(value=>{if(!cancelled)setState(value);}),2000);return ()=>{cancelled=true;clearInterval(timer);};},[active,state]);
 const install=async()=>{setError('');try{const result=await desktop()?.ttsInstall?.();if(result)setState(result);}catch(value){setError((value as Error).message);}};
 return <div className="assistant-voice"><button type="button" aria-label={muted?uiText("取消静音","Unmute"):uiText("静音","Mute")} aria-pressed={muted} onClick={()=>{const next=!muted;localStorage.setItem(muteKey,String(next));if(next)queue.current?.skip(streamId,text);setMuted(next);setError('');}}>{muted?uiText("取消静音","Unmute"):uiText("静音","Mute")}</button>{available&&<small role="status">{muted?uiText("已静音","Muted"):playing?uiText("正在说话","Speaking"):uiText("自动朗读","Automatic read-aloud")}</small>}{!available&&(desktop()?.ttsInstall&&user?.scopes.includes('ai:configure')?<button type="button" disabled={!!state&&!['ready','error','idle'].includes(state.phase)} onClick={()=>void install()}>{state&&!['ready','error','idle'].includes(state.phase)?uiText(`安装语音 ${state.progress}%`,`Installing speech ${state.progress}%`):uiText("安装语音","Install speech")}</button>:<small>{uiText("语音待开通","Speech unavailable")}</small>)}{(error||state?.error)&&<p role="alert">{interfaceNotice(error||state?.error||'',uiLanguage)}</p>}</div>;
}
