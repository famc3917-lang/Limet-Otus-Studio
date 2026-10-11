// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText as useInterfaceText,useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import {interfaceText,interfaceNotice} from '@/lib/interface-text';
import { confirmAction } from '@/components/biz/dialogs';
import { useEffect, useState, useRef } from 'react';
import { AGREEMENT_CONFIRMATION, PAYMENT_REFUND_STATEMENT, PRIVACY_STATEMENT } from '@/lib/print-ticket';
import { Btn, Field, TextArea } from './ui';
import { useStudio } from '@/lib/store';
import { defaultPrintDocument, isPrintDocument, type PrintDocument } from '@/lib/print-document';
import {PRIVACY_STATEMENT_EN,PAYMENT_REFUND_STATEMENT_EN,AGREEMENT_CONFIRMATION_EN} from '@/lib/print-language';
import { AdvancedPrintEditor } from './print-layout-editor';

export const PRINT_DEFAULTS = {
  title: '摄影服务订单确认单', summaryTitle: '摄影服务结算单', bookingTitle: '请您填写订单创建单',
  bookingSubtitle: '请在所选项目前的 □ 内打勾，并填写完整个人信息（本单为订单创建前预定单）',
  serviceTitle: '服务内容', totalTitle: '订单合计', noteTitle: '备注', extraNote: '',
  privacyTitle: '【个人信息与版权保护声明】', privacyIntro: '请您仔细阅读以下声明。如果同意，请通过双方约定的通信渠道回复确认。',
  privacy: PRIVACY_STATEMENT, paymentTitle: '【付款与退款声明】', payment: PAYMENT_REFUND_STATEMENT,
  agreement: AGREEMENT_CONFIRMATION, footer: '感谢您的信任，期待与您共同完成这次创作。',
  customerTitle:'客户信息',signatureTitle:'条款确认与签名',
};
export const PRINT_DEFAULTS_EN:typeof PRINT_DEFAULTS={
  "title": "Photography order confirmation",
  "summaryTitle": "Order payment summary",
  "bookingTitle": "Photography booking form",
  "bookingSubtitle": "Tick your selections and complete the required details before the order is created.",
  "serviceTitle": "Services",
  "totalTitle": "Order total",
  "noteTitle": "Notes",
  "extraNote": "",
  "privacyTitle": "Privacy and Copyright Statement",
  "privacyIntro": "Please read the statement below and confirm your agreement through the agreed communication channel.",
  "privacy": PRIVACY_STATEMENT_EN,
  "paymentTitle": "Payment and Refund Terms",
  "payment": PAYMENT_REFUND_STATEMENT_EN,
  "agreement": AGREEMENT_CONFIRMATION_EN,
  "footer": "Thank you for entrusting us with your photography.",
  "customerTitle": "Client details",
  "signatureTitle": "Agreement and signature"
};
export type PrintCopy = typeof PRINT_DEFAULTS & {document?:PrintDocument};
export function usePrintCopy(scope:string){
 const language=useInterfaceLanguage(),defaults=language==='en'?PRINT_DEFAULTS_EN:PRINT_DEFAULTS;
 const storageKey=language==='en'?scope+':en':scope;
 const {data,savePrintDocument}=useStudio();
 const storedJson=JSON.stringify(data.printDocuments?.[storageKey]??null);
 const drafts=useRef(new Map<string,{copy:PrintCopy;saved:string}>());
 const [state,setState]=useState<{key:string;copy:PrintCopy;saved:string;ready:boolean}>({key:storageKey,copy:defaults,saved:'',ready:false});
 useEffect(()=>{
  const draft=drafts.current.get(storageKey);
  let next:PrintCopy=defaults;
  if(draft)next=draft.copy;
  else try{
   const stored=JSON.parse(storedJson) as PrintDocument|null,raw={...stored?.copy};
   const valid=Object.fromEntries(Object.keys(defaults).filter(k=>typeof raw[k]==='string').map(k=>[k,raw[k]]));
   const text={...defaults,...valid};
   next={...text,document:isPrintDocument(stored)?stored:defaultPrintDocument(text,language)};
  }catch{next={...defaults,document:defaultPrintDocument(defaults,language)};}
  setState({key:storageKey,copy:next,saved:draft?.saved??'',ready:true});
 },[storageKey,storedJson,defaults,language]);
 const active:{key:string;copy:PrintCopy;saved:string;ready:boolean}=state.key===storageKey?state:{key:storageKey,copy:defaults,saved:'',ready:false};
 const update=(copy:PrintCopy,saved='有未保存的修改')=>{drafts.current.set(storageKey,{copy,saved});setState({key:storageKey,copy,saved,ready:true});};
 const save=async()=>{
  if(!active.ready)return;
  const copy=active.copy;
  try{
   const {document,...texts}=copy;
   savePrintDocument(storageKey,{...(document??defaultPrintDocument(texts,language)),copy:texts});
   update(copy,'正在保存…');
   const flush=(window as unknown as {__studioFlush?:()=>Promise<boolean>}).__studioFlush;
   const ok=Boolean(flush&&await flush());
   const saved=ok?'已保存':'未保存，请检查连接';
   if(ok)drafts.current.delete(storageKey);else drafts.current.set(storageKey,{copy,saved});
   setState(current=>current.key===storageKey?{...current,saved}:current);
  }catch{const saved='保存失败，请检查连接与操作权限';drafts.current.set(storageKey,{copy,saved});setState(current=>current.key===storageKey?{...current,saved}:current);}
 };
 return {copy:active.copy,ready:active.ready,saved:active.saved,save,
  change:(key:keyof typeof PRINT_DEFAULTS,value:string)=>update({...active.copy,[key]:value}),
  changeDocument:(document:PrintDocument)=>update({...active.copy,document}),
  reset:()=>update({...defaults,document:defaultPrintDocument(defaults,language)},'已恢复原文，点击保存后生效')};
}
export function PrintEditor({ model, booking = false, summary = false, expanded=false }: { model: ReturnType<typeof usePrintCopy>; booking?: boolean; summary?: boolean;expanded?:boolean }) {
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

  const fields: [keyof typeof PRINT_DEFAULTS, string][] = booking ? [['bookingTitle',uiText("预定单标题","Booking form title")],['bookingSubtitle',uiText("填写说明","Form instructions")],['customerTitle',uiText("客户区标题","Client section title")],['serviceTitle',uiText("服务区标题","Services section title")],['noteTitle',uiText("备注区标题","Notes section title")],['signatureTitle',uiText("签名区标题","Signature section title")],['agreement',uiText("条款确认文字","Agreement confirmation text")],['extraNote',uiText("补充说明","Additional notes")],['footer',uiText("页尾文字","Footer text")]] : [['title',uiText("确认单标题","Confirmation title")],['serviceTitle',uiText("服务区标题","Services section title")],['totalTitle',uiText("合计标签","Total label")],['noteTitle',uiText("备注标题","Notes title")],['extraNote',uiText("补充说明","Additional notes")],['footer',uiText("页尾文字","Footer text")]];
  const visibleFields: [keyof typeof PRINT_DEFAULTS, string][] = summary ? [['summaryTitle',uiText("结算单标题","Payment summary title")],['serviceTitle',uiText("服务区标题","Services section title")],['totalTitle',uiText("合计标签","Total label")],['extraNote',uiText("补充说明","Additional notes")],['footer',uiText("页尾文字","Footer text")]] : fields;
  return <details open={expanded} className="print-editor studio-card mb-5"><summary>{uiText("打印文字与声明","Print text and terms")}</summary><div className="print-editor-fields"><p className="mb-4 text-xs text-zinc-500">{uiText("修改会立即显示在下方预览，并用于打印和图片导出。","Changes appear in the preview and are used for printing and image export.")}{booking ? '' : uiText("此设置仅应用于当前订单。","These settings apply to this order only.")}{uiText("金额、客户资料与业务计算仍来自原订单。","Amounts, client details and calculations use the original order.")}</p><div className="grid gap-4 sm:grid-cols-2">{visibleFields.map(([key,label]) => <Field label={label} key={key}><TextArea disabled={!model.ready} aria-label={interfaceText(label,uiLanguage)} rows={['privacy','payment','agreement'].includes(key) ? 8 : 2} maxLength={10000} value={model.copy[key]} onChange={e => model.change(key,e.target.value)} /></Field>)}</div>{booking && model.copy.document && <AdvancedPrintEditor document={model.copy.document} onChange={model.changeDocument}/>}<div className="mt-4 flex flex-wrap items-center gap-3"><Btn disabled={!model.ready} onClick={model.save}>{uiText("保存文字","Save text")}</Btn><Btn variant="outline" onClick={async () => { if (await confirmAction(uiText("将当前打印文字恢复为原版内容？保存后生效。","Restore the original print text? Save to apply."))) model.reset(); }}>{uiText("恢复原文","Restore original")}</Btn><span role="status" className="text-xs text-zinc-500">{interfaceNotice(model.saved,uiLanguage)}</span></div></div></details>;
}
