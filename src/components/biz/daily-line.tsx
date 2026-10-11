// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioLanguage,useStudioText} from '@/lib/i18n';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {useStudio} from '@/lib/store';
import {DEFAULT_SETTINGS} from '@/lib/settings';
export function DailyLine(){const language=useStudioLanguage(),tr=useStudioText();const {data}=useStudio(),path=usePathname(),[day,setDay]=useState(()=>new Date().toLocaleDateString('en-CA'));const s={...DEFAULT_SETTINGS,...data.settings};useEffect(()=>{const t=setInterval(()=>setDay(new Date().toLocaleDateString('en-CA')),60000);return ()=>clearInterval(t);},[]);const lines=(language==='en'&&s.customLines===DEFAULT_SETTINGS.customLines?'Mountain light delights the birds; reflected stillness clears the mind.\nA day will come to sail through wind and waves.\nWhere the waters end, sit and watch the clouds rise.\nA gentle breeze arrives; the water rests.\nFresh fire, new tea; make time for the present.':s.customLines).split('\n').map(v=>v.trim()).filter(Boolean),index=Array.from(day+path).reduce((a,c)=>a+c.charCodeAt(0),0)%lines.length;if(!s.dailyLines||!lines.length||!['/','/orders','/schedule','/pre','/post','/finance'].includes(path))return null;return <div className="daily-line"><span>{tr('今日 · 一句','A thought for today')}</span><p>{lines[index]}</p><i aria-hidden="true">✧</i></div>;}
