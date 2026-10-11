// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {errorText} from '@/lib/interface-error';
import {useStudioText as useInterfaceText,useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import {interfaceNotice} from '@/lib/interface-text';
import {useEffect,useState} from 'react';
import {apiRequest} from '@/lib/api-client';
export type ConnectionState='connected'|'unstable'|'disconnected';
export function ConnectionLights({active,state:override}:{active:boolean;state?:ConnectionState}){
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

 const [state,setState]=useState<ConnectionState>('disconnected'),[checking,setChecking]=useState(false),[detail,setDetail]=useState('');
 useEffect(()=>{if(!active)return;let cancelled=false,sequence=0;const abort=new AbortController();const check=async()=>{const id=++sequence;if(!navigator.onLine){setState('disconnected');setDetail('当前设备未联网');return;}setChecking(true);try{const status=await apiRequest<{state:ConnectionState;message?:string}>('ai/status',{signal:abort.signal});if(!cancelled&&id===sequence){setState(status.state);setDetail(status.message??'');}}catch(e){if(!cancelled&&id===sequence){setState('disconnected');setDetail(errorText(e));}}finally{if(!cancelled&&id===sequence)setChecking(false);}};void check();const timer=setInterval(()=>{if(!document.hidden)void check();},35000);const offline=()=>{sequence++;setState('disconnected');setDetail('当前设备未联网');setChecking(false);};window.addEventListener('online',check);window.addEventListener('offline',offline);window.addEventListener('studio-ai-configured',check);return ()=>{cancelled=true;abort.abort();clearInterval(timer);window.removeEventListener('online',check);window.removeEventListener('offline',offline);window.removeEventListener('studio-ai-configured',check);};},[active]);
 const current=override??state,labels={connected:uiText("连接正常","Connected"),unstable:uiText("连接波动","Connection unstable"),disconnected:uiText("未连接或连接出错","Disconnected or connection error")};
 return <div className="connection-lights" role="status" aria-label={checking?uiText("正在检测连接","Checking connection"):labels[current]} title={checking?uiText("正在检测连接","Checking connection"):interfaceNotice(detail,uiLanguage)||labels[current]}>{(['connected','disconnected','unstable'] as const).map(name=><span key={name} className={'connection-lamp lamp-'+name+(current===name?' lit':'')} aria-hidden="true"/>)}<small>{checking?uiText("检测中","Checking"):labels[current]}</small></div>;
}
