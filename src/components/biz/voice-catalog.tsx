// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {errorText} from '@/lib/interface-error';
import {useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import {interfaceNotice} from '@/lib/interface-text';
import {useEffect,useState} from 'react';
import {apiRequest} from '@/lib/api-client';
import type {VoiceProfile} from '@/lib/assistant-identity';
import {useStudioLanguage} from '@/lib/i18n';
export function VoiceCatalog(){
 const uiLanguage=useInterfaceLanguage();
const language=useStudioLanguage(),t=(zh:string,en:string)=>language==='en'?en:zh;const [voices,setVoices]=useState<VoiceProfile[]>([]),[error,setError]=useState('');useEffect(()=>{void apiRequest<{voices:VoiceProfile[]}>('tts/status').then(result=>setVoices(result.voices.filter(v=>v.id.startsWith('custom-')))).catch(()=>{});},[]);const update=async(next:unknown)=>{try{const result=await apiRequest<{voices:VoiceProfile[]}>('tts/voices',{method:'PUT',body:JSON.stringify({voices:next})});setVoices(result.voices);setError('');window.dispatchEvent(new Event('studio-ai-configured'));}catch(e){setError(errorText(e));}};return <section className="voice-catalog"><strong>{t('训练音色','Trained voices')}</strong><p>{t('导入已标注性别的音色清单，男声与隅鸮绑定，女声与媱鸮绑定。','Import a voice list with a gender for every voice. Male voices bind to Limenotus; female voices bind to Limenotessa.')}</p><label className="studio-btn studio-btn-outline">{t('导入清单','Import list')}<input type="file" accept="application/json,.json" hidden onChange={async e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(!file)return;if(file.size>32000){setError(t('音色清单过大','The voice list is too large'));return;}try{const value=JSON.parse(await file.text());await update(Array.isArray(value)?value:value.voices);}catch{setError(t('请选择有效的 JSON 音色清单','Select a valid JSON voice list'));}}}/></label>{voices.map(voice=><div key={voice.id}><span>{voice.label} · {voice.gender==='male'?t('隅鸮','Limenotus'):t('媱鸮','Limenotessa')}</span><button type="button" aria-label={t('移除音色 ','Remove voice ')+voice.label} onClick={()=>void update(voices.filter(v=>v.id!==voice.id))}>×</button></div>)}{error&&<small role="alert">{interfaceNotice(error,uiLanguage)}</small>}</section>;}
