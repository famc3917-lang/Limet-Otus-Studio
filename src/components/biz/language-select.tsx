// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {StudioSelect} from '@/components/biz/select';
import {setStudioLanguage,useStudioLanguage} from '@/lib/i18n';

export function LanguageSelect({label=true}:{label?:boolean}){
 const language=useStudioLanguage();
 return <label className="studio-language-select">{label&&<span>{language==='en'?'Language':'界面语言'}</span>}<StudioSelect aria-label={language==='en'?'Interface language':'界面语言'} value={language} onChange={e=>setStudioLanguage(e.target.value==='en'?'en':'zh')}><option value="zh">{language==='en'?'Chinese (Simplified)':'简体中文'}</option><option value="en">English</option></StudioSelect></label>;
}
