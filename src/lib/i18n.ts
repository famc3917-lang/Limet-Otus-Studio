// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {desktop} from './desktop';
import {useSyncExternalStore} from 'react';

export type StudioLanguage='zh'|'en';
const KEY='limet-studio-language';
const listeners=new Set<()=>void>();
function subscribe(listener:()=>void){listeners.add(listener);window.addEventListener('storage',listener);return ()=>{listeners.delete(listener);window.removeEventListener('storage',listener);};}
function snapshot():StudioLanguage{try{return localStorage.getItem(KEY)==='en'?'en':'zh';}catch{return 'zh';}}
export function useStudioLanguage():StudioLanguage{return useSyncExternalStore(subscribe,snapshot,()=> 'zh');}
export function setStudioLanguage(language:StudioLanguage){try{localStorage.setItem(KEY,language);}catch{}const request=desktop()?.interfaceLanguage?.(language);void request?.catch(()=>{});document.documentElement.lang=language==='en'?'en':'zh-CN';for(const listener of listeners)listener();}
export function useStudioText(){const language=useStudioLanguage();return (zh:string,en:string)=>language==='en'?en:zh;}

export async function synchronizeDesktopLanguage(){let stored:StudioLanguage|null=null;try{stored=await desktop()?.interfaceLanguage?.()??null;}catch{}setStudioLanguage(stored??snapshot());}

export function getStudioLanguage():StudioLanguage{return snapshot();}
