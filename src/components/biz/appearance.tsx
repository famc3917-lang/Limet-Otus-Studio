// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioLanguage as useViewLanguage} from '@/lib/i18n';
import {interfaceText as localeText} from '@/lib/interface-text';
import {useEffect,useState} from 'react';
import {Monitor,Moon,Sun} from 'lucide-react';
import {desktop} from '@/lib/desktop';
type Theme='light'|'dark'|'system';
export function Appearance(){
 const viewLanguage=useViewLanguage();

 const [theme,setTheme]=useState<Theme|null>(null);
 useEffect(()=>{
  let saved:string|null=null;try{saved=localStorage.getItem('studio-appearance');}catch{}
  // The head bootstrap already applied the preference; never overwrite it with a temporary theme.
  setTheme(saved==='light'||saved==='dark'||saved==='system'?saved:'dark');
 },[]);
 useEffect(()=>{
  if(!theme)return;const media=matchMedia('(prefers-color-scheme: dark)');
  const apply=()=>{const resolved=theme==='system'?(media.matches?'dark':'light'):theme;if(document.documentElement.dataset.theme!==resolved)document.documentElement.dataset.theme=resolved;void desktop()?.windowTheme?.(resolved).catch(()=>{});};
  apply();media.addEventListener('change',apply);return ()=>media.removeEventListener('change',apply);
 },[theme]);
 return <div className="appearance" role="group" aria-label={localeText("外观主题",viewLanguage)}>{([['light',Sun,'浅色'],['dark',Moon,'深色'],['system',Monitor,'跟随系统']] as const).map(([value,Icon,label])=><button key={value} type="button" title={localeText(label,viewLanguage)} aria-label={localeText(label,viewLanguage)} aria-pressed={theme===value} onClick={()=>{setTheme(value);try{localStorage.setItem('studio-appearance',value);}catch{}}}><Icon size={16}/></button>)}</div>;
}
