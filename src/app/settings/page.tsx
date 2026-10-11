// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import {interfaceText,interfaceNotice} from '@/lib/interface-text';
import {RetentionPanel} from '@/components/biz/retention-panel';
import {MemberPreferences} from '@/components/biz/member-preferences';
import {VoicePreferences} from '@/components/biz/voice-preferences';

import Link from 'next/link';
import {useState} from 'react';
import {useStudio} from '@/lib/store';
import {defaultSettings,deviceTimeZone,isTimeZone,type StudioSettings} from '@/lib/settings';
import {AppShell,Card,SectionTitle,Field,TextInput,TextArea,Btn} from '@/components/biz/ui';
import {AIConfiguration} from '@/components/biz/assistant';
import {getSessionUser} from '@/lib/auth';
import {desktop} from '@/lib/desktop';
import {SecuritySettings} from '@/components/biz/security-settings';
import {LanguageSelect} from '@/components/biz/language-select';
import {useStudioText} from '@/lib/i18n';
export default function Preferences(){
 const uiLanguage=useInterfaceLanguage();

 const t=useStudioText();
 const {data,saveSettings}=useStudio(),[s,setS]=useState<StudioSettings>({...defaultSettings(uiLanguage),...data.settings}),[zones]=useState<string[]>(()=>{try{return Intl.supportedValuesOf('timeZone');}catch{return [];}}),[message,setMessage]=useState('');
 const patch=(p:Partial<StudioSettings>)=>setS({...s,...p});
 return <AppShell><h1 className="text-3xl mb-6">{t('工作室偏好','Studio preferences')}</h1><div className="settings-layout"><section className="studio-language-row"><LanguageSelect/><p>{t('语言选择在此设备上立即生效。账目币种不会随语言变化。','Language changes immediately. Recorded amounts retain their studio currency.')}</p></section>{getSessionUser()?.scopes.includes('settings:write')&&<Card className="p-6"><SectionTitle>{t('工作空间','Workspace')}</SectionTitle><div className="grid gap-4 sm:grid-cols-2"><Field label={t('工作室名称','Studio name')}><TextInput maxLength={80} value={s.name} onChange={e=>patch({name:e.target.value})}/></Field><Field label={t('工作室短句','Studio tagline')}><TextInput maxLength={200} value={s.tagline} onChange={e=>patch({tagline:e.target.value})}/></Field><Field label={t('时区','Time zone')} hint={t(`留空则跟随设备（当前：${deviceTimeZone()}）。拍摄时间、时间戳与打印单按此时区显示。`,`Leave blank to follow this device (currently ${deviceTimeZone()}). Shoot times, timestamps and printed forms use this zone.`)}><TextInput list="studio-time-zones" maxLength={64} value={s.timeZone??''} placeholder={deviceTimeZone()} onChange={e=>patch({timeZone:e.target.value})}/><datalist id="studio-time-zones">{zones.map(z=><option key={z} value={z}/>)}</datalist></Field><Field label={t('强调色','Accent color')}><input className="settings-color" type="color" aria-label={t('工作室强调色','Studio accent color')} value={s.accent} onChange={e=>patch({accent:e.target.value})}/></Field></div><p className="mt-3 text-xs opacity-70">{t('账目币种','Ledger currency')}: {s.currency??'CNY'} · {t('创建工作室时确定；切换语言不会改变历史金额。','Selected at setup; language switching does not alter historical amounts.')}</p><div className="settings-toggles">{[['dailyLines',t('每日短句','Daily lines')],['reduceMotion',t('减少动态效果','Reduce motion')],['backgroundAssistant',t('关闭主窗口后在后台运行','Keep running in the background after the main window closes')],['floatingAssistant',t('桌面 AI 悬浮球','Desktop AI floating orb')],['autoBackup',t('自动备份','Automatic backup')]] .map(([key,label])=><label key={key}><input type="checkbox" checked={Boolean(s[key as keyof StudioSettings])} disabled={['backgroundAssistant','floatingAssistant','autoBackup'].includes(key)&&!desktop()} onChange={e=>patch({[key]:e.target.checked})}/><span>{interfaceText(label,uiLanguage)}</span></label>)}</div><Field label={t('每日短句（每行一句）','Daily lines (one per line)')}><TextArea rows={6} maxLength={20000} value={s.customLines} onChange={e=>patch({customLines:e.target.value})}/></Field><div className="flex gap-3 mt-4"><Btn onClick={()=>{const zone=s.timeZone?.trim();if(zone&&!isTimeZone(zone))return setMessage(t('时区无效，请从列表中选择，例如 Europe/Zurich','Invalid time zone. Choose one from the list, e.g. Europe/Zurich'));const {timeZone:_omit,...rest}=s;void _omit;saveSettings({...data.settings,...rest,...(zone?{timeZone:zone}:{}),name:s.name.trim()||defaultSettings(uiLanguage).name});setMessage(t('偏好已保存','Preferences saved'));}}>{t('保存偏好','Save preferences')}</Btn><Btn variant="outline" onClick={()=>{const d=defaultSettings(uiLanguage);setS({...s,name:d.name,tagline:d.tagline,accent:d.accent,dailyLines:d.dailyLines,customLines:d.customLines,reduceMotion:d.reduceMotion,timeZone:undefined});}}>{t('恢复默认草稿','Restore default draft')}</Btn><span role="status">{interfaceNotice(message,uiLanguage)}</span></div><p className="text-xs opacity-60 mt-3">{t('桌面后台模式在系统托盘提供“退出”；Ctrl + Alt + Space 随时唤起助手。首次使用需在主窗口完成登录。','In background mode, quit from the system tray. Press Ctrl + Alt + Space to open the assistant at any time. Sign in from the main window on first use.')}</p></Card>}
 {getSessionUser()?.scopes.includes('settings:write')&&<Card className="p-6"><SectionTitle>{t('业务与文档','Business and documents')}</SectionTitle><div className="settings-links"><Link href="/settings/print"><strong>{t('声明与打印模板 ↗','Notices and print templates ↗')}</strong><small>{t('无限声明、富文本、表格、四套模板与实时预览','Unlimited notices, rich text, tables, four templates and live preview')}</small></Link><Link href="/admin"><strong>{t('业务配置 ↗','Business configuration ↗')}</strong><small>{t('客户类型、套餐、拍摄风格、设备、增项与备份','Client types, packages, shooting styles, equipment, add-ons and backups')}</small></Link></div></Card>}
 <Card className="p-6" ><div id="ai"><SectionTitle>{t('AI 服务接入','AI service connection')}</SectionTitle><AIConfiguration/></div></Card>
 <Card className="p-6"><SectionTitle>{t('助手声音与身份','Assistant voice and identity')}</SectionTitle><VoicePreferences/></Card>
 <Card className="p-6"><SectionTitle>{t('个人资料','Profile')}</SectionTitle><MemberPreferences/></Card><RetentionPanel settings/><SecuritySettings/></div></AppShell>;
}
