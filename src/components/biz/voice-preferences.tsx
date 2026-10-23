// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {StudioSelect} from '@/components/biz/select';
import {interfaceText} from '@/lib/interface-text';
import {useEffect,useState} from 'react';
import {apiRequest} from '@/lib/api-client';
import {getSessionUser} from '@/lib/auth';
import {BUILTIN_VOICES,ASSISTANT_PERSONAS,type VoiceProfile} from '@/lib/assistant-identity';
import {useStudioLanguage} from '@/lib/i18n';
export function VoicePreferences(){
const language=useStudioLanguage(),t=(zh:string,en:string)=>language==='en'?en:zh;const [voices,setVoices]=useState<VoiceProfile[]>(BUILTIN_VOICES),[id,setId]=useState('cosy-zh-male');useEffect(()=>{const user=getSessionUser(),key='studio-voice:'+user?.workspaceId+':'+user?.id;setId(localStorage.getItem(key)??'cosy-zh-male');void apiRequest<{voices:VoiceProfile[]}>('tts/status').then(v=>setVoices(v.voices)).catch(()=>{});},[]);const voice=voices.find(v=>v.id===id)??voices[0],persona=ASSISTANT_PERSONAS[voice.gender];return <section className="voice-preferences"><label>{t('助手音色','Assistant voice')}<StudioSelect aria-label={t('助手音色','Assistant voice')} value={id} onChange={e=>{const user=getSessionUser();localStorage.setItem('studio-voice:'+user?.workspaceId+':'+user?.id,e.target.value);setId(e.target.value);window.dispatchEvent(new Event('studio-voice-preference'));}}>{voices.map(v=><option key={v.id} value={v.id}>{interfaceText(v.label,language)}</option>)}</StudioSelect></label><p>{language==='en'?`${persona.english} | ${persona.introEn}`:`${persona.name} · ${persona.english}｜${persona.intro}`}</p><small>{t('切换音色后使用对应化身的独立对话。','Each voice uses its own persona and a separate conversation.')}</small></section>;}
