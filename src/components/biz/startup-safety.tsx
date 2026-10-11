// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useEffect,useState} from 'react';
import {getSessionUser} from '@/lib/auth';
import {useStudioText} from '@/lib/i18n';
import {LanguageSelect} from './language-select';

const KEY='limet-safety-notice-v3';
export function StartupSafety(){
 const t=useStudioText(),[open,setOpen]=useState(false);
 useEffect(()=>{const check=()=>{if(getSessionUser()&&sessionStorage.getItem(KEY)!=='read')setOpen(true);};check();window.addEventListener('studio-auth-changed',check);return()=>window.removeEventListener('studio-auth-changed',check);},[]);
 if(!open)return null;
 const close=()=>{sessionStorage.setItem(KEY,'read');setOpen(false);};
 return <div className="startup-safety-backdrop"><section className="startup-safety-dialog" role="dialog" aria-modal="true" aria-labelledby="startup-safety-title"><div className="startup-safety-top"><span>{t('使用前须知','Before you begin')}</span><LanguageSelect label={false}/></div><h2 id="startup-safety-title">{t('安全与责任声明','Security and responsibility')}</h2><p>{t('软件以现有状态提供。权限、加密和备份措施不能保证数据绝对安全。请由部署者维护更新、密钥、访问控制与独立备份。','This software is provided as is. Access controls, encryption and backups cannot guarantee data security. The operator must maintain updates, credentials, access controls and independent backups.')}</p><p>{t('经营金额与分成仅供内部参考，不保证准确；请核对原始交易。软件不能用于记账、报税，也不能代替会计核算或法定财务凭证。','Business figures and member shares are for internal reference only and are not guaranteed accurate. Check original transactions. The software is not for bookkeeping or tax filing and cannot replace accounting records or statutory financial evidence.')}</p><button type="button" onClick={close}>{t('已阅读，进入工作室','I have read this · Continue')}</button></section></div>;
}
