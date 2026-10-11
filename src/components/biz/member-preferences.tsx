// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {errorText} from '@/lib/interface-error';
import {useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import {interfaceNotice} from '@/lib/interface-text';
import {useEffect,useState} from 'react';
import {refreshSessionProfile} from '@/lib/auth';
import {apiRequest} from '@/lib/api-client';
import {Btn,Field,TextInput} from './ui';
import {useStudioText} from '@/lib/i18n';
export function MemberPreferences(){
 const uiLanguage=useInterfaceLanguage();
const t=useStudioText();const [nickname,setNickname]=useState(''),[realName,setRealName]=useState(''),[message,setMessage]=useState('');useEffect(()=>{void apiRequest<{profile:{nickname:string;realName?:string}}>('team/profile').then(v=>{setNickname(v.profile.nickname);setRealName(v.profile.realName??'');}).catch(e=>setMessage(errorText(e)));},[]);return <div className="v240-form-grid"><Field label={t('网名','Display name')} required><TextInput maxLength={80} value={nickname} onChange={e=>setNickname(e.target.value)}/></Field><Field label={t('真实姓名（选填）','Real name (optional)')}><TextInput maxLength={80} value={realName} onChange={e=>setRealName(e.target.value)}/></Field><Btn disabled={!nickname.trim()} onClick={()=>void apiRequest('team/profile',{method:'PATCH',body:JSON.stringify({nickname,realName})}).then(async()=>{await refreshSessionProfile();setMessage(t('已保存','Saved'));}).catch(e=>setMessage(errorText(e)))}>{t('保存资料','Save profile')}</Btn><p role="status">{interfaceNotice(message,uiLanguage)}</p></div>;}
