// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioLanguage as useViewLanguage} from '@/lib/i18n';
import {interfaceText as localeText} from '@/lib/interface-text';
import {usePathname} from 'next/navigation';
export function BrandMark({className=''}:{className?:string}){
 const viewLanguage=useViewLanguage();
return <span className={'limen-mark '+className}><img src="/brand/limen-mark.png" alt={localeText("观隅取景框标志",viewLanguage)} width={128} height={128}/></span>;}
const MOTIFS:Record<string,string>={orders:'vase',schedule:'bamboo',pre:'camera',post:'camera',finance:'vase',admin:'bamboo',settings:'owl'};
export function Owl({className=''}:{className?:string}){
const area=usePathname().split('/')[1],motif=MOTIFS[area]??'owl';return <img className={'guanyu-motif '+className} data-motif={motif} src={'/brand/'+motif+'-line.png'} alt="" aria-hidden="true" width={1254} height={1254}/>;}
