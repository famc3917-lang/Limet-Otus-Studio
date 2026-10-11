// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {errorText} from '@/lib/interface-error';
import {useStudioLanguage as useViewLanguage} from '@/lib/i18n';
import {interfaceText as localeText} from '@/lib/interface-text';
import {useStudioText,useStudioLanguage} from '@/lib/i18n';
import {interfaceText} from '@/lib/interface-text';
import {useCallback,useEffect,useState} from 'react';
import {apiRequest} from '@/lib/api-client';
import {getSessionUser} from '@/lib/auth';
import type {MemberSummary} from '@/lib/member-profile';
import {channelsOf,tagsOf} from '@/lib/settings';
import {useStudio} from '@/lib/store';
import {Btn,Field,Select,TextInput} from './ui';
type Attribution={signatureMemberId?:string;signatureMemberName?:string;channel?:string;customerTags?:string[]};
export function OrderAttributionFields({value,onChange,disabled=false}:{value:Attribution;onChange:(patch:Partial<Attribution>)=>void;disabled?:boolean}){
 const viewLanguage=useViewLanguage();

 const tr=useStudioText(),language=useStudioLanguage();

 const {data}=useStudio(),ORDER_CHANNELS=channelsOf(data.settings,language),CUSTOMER_TAGS=tagsOf(data.settings,language);
 const user=getSessionUser(),[members,setMembers]=useState<MemberSummary[]>([]),[error,setError]=useState(''),[tag,setTag]=useState('');
 const reload=useCallback(async()=>{try{const result=await apiRequest<{members:MemberSummary[]}>('team/members');setMembers(result.members);setError('');}catch(e){setError(errorText(e));}},[]);
 useEffect(()=>{let active=true;void apiRequest<{members:MemberSummary[]}>('team/members').then(result=>{if(active)setMembers(result.members);}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;};},[]);
 const options=members.length?members:user?[{id:user.id,nickname:user.nickname??user.username,role:user.role,disabled:false}]:[],tags=value.customerTags??[];
 const addTag=(input:string)=>{const text=input.trim();if(!text)return;if(text.length>40||tags.length>=20){setError(tr("标签最多20个，每个最多40字","Use up to 20 tags, each no longer than 40 characters."));return;}if(!tags.includes(text))onChange({customerTags:[...tags,text]});setTag('');setError('');};
 return <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label={tr("署名成员","Signature member")} required><Select disabled={disabled} value={value.signatureMemberId??''} onChange={e=>onChange({signatureMemberId:e.target.value})}><option value="">{tr("选择成员","Select a member")}</option>{options.filter(m=>!m.disabled||m.id===value.signatureMemberId).map(m=><option key={m.id} value={m.id} disabled={m.disabled}>{m.nickname}{m.disabled?tr("（已停用）"," (Disabled)"):''}</option>)}{value.signatureMemberId&&!options.some(m=>m.id===value.signatureMemberId)&&<option value={value.signatureMemberId}>{value.signatureMemberName??tr("已绑定成员","Assigned member")}</option>}</Select>{value.signatureMemberName&&<span className="text-xs text-zinc-500">{tr("本单署名：","Order signature: ")}{value.signatureMemberName}</span>}</Field><Field label={tr("客户来源","Referral source")}><Select disabled={disabled} value={value.channel??''} onChange={e=>onChange({channel:e.target.value})}><option value="">{tr("未填写","Not specified")}</option>{ORDER_CHANNELS.map(c=><option key={c} value={c}>{interfaceText(c,language)}</option>)}{value.channel&&!ORDER_CHANNELS.some(c=>c===value.channel)&&<option>{value.channel}</option>}</Select></Field></div>
 <Field label={tr("客户标签","Client tags")}><div className="flex flex-wrap gap-2">{CUSTOMER_TAGS.map(t=><Btn key={t} size="sm" disabled={disabled} variant={tags.includes(t)?'primary':'outline'} onClick={()=>onChange({customerTags:tags.includes(t)?tags.filter(v=>v!==t):tags.length<20?[...tags,t]:tags})} aria-pressed={tags.includes(t)}>{interfaceText(t,language)}</Btn>)}{tags.filter(t=>!CUSTOMER_TAGS.some(c=>c===t)).map(t=><Btn key={t} size="sm" disabled={disabled} onClick={()=>onChange({customerTags:tags.filter(v=>v!==t)})} aria-label={tr(`移除标签 ${t}`,`Remove tag ${t}`)}>{t} ×</Btn>)}</div><div className="mt-3 flex gap-2"><TextInput disabled={disabled} maxLength={40} value={tag} placeholder={tr("添加风格或其他标签","Add a style or another tag")} onChange={e=>setTag(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();addTag(tag);}}}/><Btn variant="outline" disabled={disabled||!tag.trim()} onClick={()=>addTag(tag)}>{localeText("添加",viewLanguage)}</Btn></div></Field>{error&&<div role="alert" className="text-sm text-rose-500">{error} <Btn size="sm" variant="ghost" onClick={()=>void reload()}>{tr("重试","Retry")}</Btn></div>}</div>;
}
