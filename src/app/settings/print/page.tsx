// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText as useInterfaceText,useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import {interfaceText,interfaceNotice} from '@/lib/interface-text';
import Link from 'next/link';
import {useStudio} from '@/lib/store';
import {PrintEditor,usePrintCopy} from '@/components/biz/print-editor';
import {PrintOrderForm} from '@/components/biz/print-order-form';
import {AppShell,Btn} from '@/components/biz/ui';
export default function PrintSettings(){
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();
const {data}=useStudio(),model=usePrintCopy('booking');return <AppShell><Link href="/settings" className="text-sm underline">{uiText("← 工作室偏好","← Studio preferences")}</Link><h1 className="my-5 text-3xl">{uiText("声明与打印模板","Terms and print templates")}</h1><p className="mb-5 text-sm opacity-70">{uiText("先编辑，实时查看预定单，再保存。已保存的模板可在创建订单和打印页面使用。","Edit the template, review the live preview and save. Saved templates are available when creating and printing orders.")}</p><div className="print-workspace"><div><PrintEditor model={model} booking expanded/><div className="flex gap-3 mb-5"><Btn onClick={model.save}>{uiText("保存模板","Save template")}</Btn><Link href="/orders/new/print"><Btn variant="outline">{uiText("打印 / 导出图片","Print / Export image")}</Btn></Link><span role="status">{interfaceNotice(model.saved,uiLanguage)}</span></div></div><aside className="print-preview-panel"><h2>{uiText("实时预览","Live preview")}</h2><div className="print-live-preview"><PrintOrderForm copy={model.copy} packages={data.packageTiers} extras={data.extraItems??[]} signatureName={interfaceText(data.settings?.name??'观隅鸮馆',uiLanguage)} generatedAt={uiText("预览","Preview")}/></div></aside></div></AppShell>;}
