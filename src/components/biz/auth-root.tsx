// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {errorText} from '@/lib/interface-error';
import {useStudioText,synchronizeDesktopLanguage} from '@/lib/i18n';
import {interfaceError} from '@/lib/interface-error';
import {useEffect,useState} from 'react';
import {getSessionUser,initializeAuth} from '@/lib/auth';
import {setCSRF} from '@/lib/api-client';
import {StudioProvider} from '@/lib/store';
import {NavigationGuard} from './navigation-guard';
import {WindowBar} from './window-bar';
import {AssistantDock} from './assistant';
import {DialogHost} from './dialogs';
export function AuthRoot({children}:{children:React.ReactNode}){
 const t=useStudioText();
 const [languageReady,setLanguageReady]=useState(false),[ready,setReady]=useState(false),[key,setKey]=useState('guest'),[error,setError]=useState(''),[orb,setOrb]=useState(false);
 useEffect(()=>{
  let active=true;
  const language=synchronizeDesktopLanguage().finally(()=>{if(active)setLanguageReady(true);});
  if(location.pathname==='/assistant'&&new URLSearchParams(location.search).get('mode')==='orb'){
   document.documentElement.classList.add('assistant-orb-window');queueMicrotask(()=>{if(active)setOrb(true);});
   void Promise.all([initializeAuth(),language]).then(()=>{if(active){setKey(getSessionUser()?.id??'guest');setReady(true);}}).catch(e=>{if(active)setError(errorText(e));});
   return ()=>{active=false;document.documentElement.classList.remove('assistant-orb-window');};
  }
  const changed=()=>setKey(getSessionUser()?.id??'guest');
  const expired=()=>{if(getSessionUser()){setCSRF('');location.assign('/login');}};
  window.addEventListener('studio-auth-changed',changed);window.addEventListener('studio-session-expired',expired);
  void Promise.all([initializeAuth(),language]).then(()=>{if(active){changed();setReady(true);}}).catch(e=>{if(active)setError(errorText(e));});
  return ()=>{active=false;window.removeEventListener('studio-auth-changed',changed);window.removeEventListener('studio-session-expired',expired);};
 },[]);
 if(!languageReady)return <div className="studio-loading" role="status"><span/></div>;
 if(orb&&ready&&!error)return <StudioProvider key={key}>{children}<DialogHost/></StudioProvider>;
 if(orb)return <div className="desktop-orb-loading" role="status">{error?t('请在主窗口重新登录','Sign in again in Studio'):'✦'}</div>;
 if(error)return <><WindowBar/><div className="storage-recovery"><h1>{t('暂时无法连接工作室','Unable to connect to the studio')}</h1><p>{interfaceError(error)}</p><button onClick={()=>location.reload()}>{t('重新连接','Reconnect')}</button></div></>;
 if(!ready)return <><WindowBar/><div className="studio-loading"><span/>{t('正在验证工作室会话…','Checking your studio session…')}</div></>;
 return <StudioProvider key={key}><WindowBar/><NavigationGuard/>{children}<AssistantDock/><DialogHost/></StudioProvider>;
}
