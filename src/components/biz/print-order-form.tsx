// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText as useInterfaceText,useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import {interfaceText} from '@/lib/interface-text';
import {forwardRef,type CSSProperties} from 'react';
import {PRINT_DEFAULTS,PRINT_DEFAULTS_EN,type PrintCopy} from './print-editor';
import {defaultPrintDocument,renderPlanTokens,sanitizeRichHtml} from '@/lib/print-document';
import {planOf,refundRulesOf} from '@/lib/payment-plan';
import {useStudio} from '@/lib/store';
import {useMoneyFormatter} from '@/lib/use-money';
import type {ExtraItem,PackageTier} from '@/lib/types';
export const PrintOrderForm=forwardRef<HTMLDivElement,{copy?:PrintCopy;packages:PackageTier[];extras:ExtraItem[];signatureName:string;generatedAt:string}>(function PrintOrderForm({copy:providedCopy,packages,extras,signatureName,generatedAt},ref){
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

 const copy=providedCopy??(uiLanguage==='en'?PRINT_DEFAULTS_EN:PRINT_DEFAULTS);
 const money=useMoneyFormatter(),{data}=useStudio(),plan=planOf(null,data.settings),rules=refundRulesOf(null,data.settings);
 const {document,...texts}=copy as PrintCopy,d=document??defaultPrintDocument(texts,uiLanguage);
 const sections:Record<string,React.ReactNode>={
 customer:<><h2>{copy.customerTitle}</h2><div className="booking-info-grid">{[uiText("客户姓名","Client name"),uiText("被拍摄人身份","Client type"),uiText("拍摄时间","Shoot time"),uiText("拍摄地点","Location"),uiText("拍摄人","Photographer")].map(label=><div key={label}><span>{interfaceText(label,uiLanguage)}</span><i/></div>)}<div><span>{uiText("性别","Gender")}</span>{uiText('□ 女　□ 男　□ 非二元性别','□ Female　□ Male　□ Non-binary')}</div><div><span>{uiText("是否成年","Adult status")}</span>{uiText('□ 成年　□ 未成年','□ Adult　□ Minor')}</div></div></>,
 services:<><h2>{copy.serviceTitle}</h2><h3>{uiText("套餐（请在所选项目前打勾）","Packages (tick your selection)")}</h3>{packages.length?packages.map(p=><div className="booking-service-row" key={p.id}><div>□ <strong>{p.name}</strong>{p.description&&<small>{uiLanguage==='en'?` (${p.description})`:`（${p.description}）`}</small>}{p.returnCount!=null&&<small>{uiText(` · 返图 ${p.returnCount} 张 / ${p.returnDays??'—'} 天`,` · ${p.returnCount} images / ${p.returnDays??'—'} days`)}</small>}</div><strong>{p.price!=null?money(p.price):uiText("面议","By agreement")}</strong></div>):<p>{uiText("暂无套餐配置","No packages configured")}</p>}<h3>{uiText("增值服务（请在所选项目前打勾）","Add-ons (tick your selection)")}</h3>{extras.length?extras.map(e=><div className="booking-service-row" key={e.id}><div>□ <strong>{e.name}</strong><small>{e.perUnit?' · '+money(e.price)+' / '+interfaceText(e.unitName??uiText("单位","unit"),uiLanguage)+uiText('，按数量计费',', charged by quantity'):e.note?(uiLanguage==='en'?' ('+e.note+')':'（'+e.note+'）'):''}</small></div><strong>{money(e.price)}</strong></div>):<p>{uiText("暂无增值服务配置","No add-ons configured")}</p>}</>,
 notes:<><h2>{copy.noteTitle}</h2>{[0,1,2].map(i=><div className="booking-writing-line" key={i}>&nbsp;</div>)}</>,
 statements:<>{d.blocks.map(b=><article key={b.id} className="print-statement" style={{background:b.background,color:b.color,fontFamily:b.font,fontSize:b.size,fontWeight:b.bold?700:400}}><h2>{b.title}</h2><div className="rich-print-content" dangerouslySetInnerHTML={{__html:renderPlanTokens(sanitizeRichHtml(b.html),plan,rules,uiLanguage)}}/></article>)}</>,
 signature:<><h2>{copy.signatureTitle}</h2><p className="booking-agreement">{copy.agreement}</p><div className="booking-signature"><span>{uiText("签名","Signature")}<i/></span><span>{uiText("日期","Date")}<i/></span></div></>
 };
 return <div id="print-order-form" ref={ref} className="print-paper booking-paper" data-template={d.template} style={{fontFamily:d.font,fontSize:d.size,color:d.color,backgroundColor:d.background,padding:d.padding,"--print-bg":d.background,"--print-ink":d.color} as CSSProperties}><header><span>{signatureName}</span><span>{uiText("摄影服务订单预定单","Photography booking form")}</span></header><h1>{copy.bookingTitle}</h1><p className="booking-subtitle">{copy.bookingSubtitle}</p>{d.sectionOrder.filter(id=>!d.hiddenSections.includes(id)).map(id=><section className={'booking-section booking-section-'+id} key={id}>{sections[id]}</section>)}{copy.extraNote&&<p className="booking-extra-note">{copy.extraNote}</p>}<p className="booking-financial-notice">{uiText('金额仅供内部参考，不保证准确；不可用于记账、报税或代替原始凭证。','Amounts are estimates only and may be inaccurate. Not for bookkeeping, tax filing or statutory financial evidence.')}</p><footer>{copy.footer}<small>{uiText('日期','Date')}: {generatedAt}</small></footer></div>;
});


