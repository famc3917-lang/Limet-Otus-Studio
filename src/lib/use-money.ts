// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioLanguage} from './i18n';
import {useStudio} from './store';
import {formatStudioMoney} from './money';

export function useMoneyFormatter(){
 const language=useStudioLanguage(),{data}=useStudio();
 return (value:number)=>formatStudioMoney(value,data.settings?.currency??'CNY',language);
}
