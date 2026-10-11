// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import type {StudioLanguage} from './i18n';
import {refundRangeLabel,refundRateLabel,type InstallmentStage,type RefundRule} from './payment-plan';
export type PrintTemplate='white'|'black'|'pattern'|'contract';
export interface StatementBlock {id:string;title:string;html:string;background:string;color:string;font:string;size:number;bold:boolean}
export interface PrintDocument {version:1;template:PrintTemplate;font:string;size:number;background:string;color:string;padding:number;blocks:StatementBlock[];sectionOrder:string[];hiddenSections:string[];copy?:Record<string,string>}
export const PRINT_FONTS=['"Microsoft YaHei", sans-serif','"SimSun", serif','"Arial", sans-serif','"Georgia", serif'];
export const PRINT_TEMPLATES:Record<PrintTemplate,{name:string;background:string;color:string;font:string}>={white:{name:'纯白 · 工作室',background:'#ffffff',color:'#18181b',font:PRINT_FONTS[0]},black:{name:'曜黑 · 作品集',background:'#17191d',color:'#f5f5f4',font:PRINT_FONTS[0]},pattern:{name:'花色 · 流光',background:'#faf4ed',color:'#39312c',font:PRINT_FONTS[0]},contract:{name:'标准合同文档',background:'#ffffff',color:'#000000',font:PRINT_FONTS[1]}};
export const escapeHtml=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function defaultPrintDocument(copy:Record<string,string>,language:StudioLanguage='zh'):PrintDocument{
 const en=language==='en',font=en?PRINT_FONTS[2]:PRINT_FONTS[0],tokens=PLAN_TOKENS[en?'en':'zh'];
 const paragraph=(s:string)=>'<p>'+escapeHtml(s).replace(/\n/g,'<br>')+'</p>';
 return {version:1,template:'white',font,size:13,background:'#ffffff',color:'#18181b',padding:40,sectionOrder:['customer','services','notes','statements','signature'],hiddenSections:[],blocks:[
 {id:'privacy',title:copy.privacyTitle,html:paragraph(copy.privacyIntro)+paragraph(copy.privacy),background:'#fdf1ed',color:'#682a27',font,size:13,bold:false},
 {id:'payment',title:copy.paymentTitle,html:'<h3>'+(en?'Payment plan':'付款方案')+'</h3><p>'+tokens.payment+'</p><h3>'+(en?'Refund rules':'退款规则')+'</h3><p>'+tokens.refund+'</p>'+paragraph(copy.payment),background:'#eff4fb',color:'#263f61',font,size:13,bold:false}
 ]};
}
/** Placeholders replaced at print time by tables built from the studio's current instalment plan and refund rules. */
export const PLAN_TOKENS={zh:{payment:'{{付款方案}}',refund:'{{退款规则}}'},en:{payment:'{{Payment plan}}',refund:'{{Refund rules}}'}} as const;
const tableHtml=(head:string[],rows:string[][])=>'<table><thead><tr>'+head.map(v=>'<th>'+escapeHtml(v)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+escapeHtml(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
export function paymentPlanTable(plan:InstallmentStage[],language:StudioLanguage):string{
 const en=language==='en';
 return tableHtml(en?['Instalment','Name','Due','Share of total']:['期数','名称','支付时点','占订单总额'],plan.map((p,i)=>[en?String(i+1):'第 '+(i+1)+' 期',p.name,p.desc??'—',Math.round(p.rate*1000)/10+'%']));
}
export function refundRulesTable(rules:RefundRule[],language:StudioLanguage):string{
 const en=language==='en',sorted=[...rules].sort((a,b)=>b.minDays-a.minDays);
 return tableHtml(en?['Time before shoot','Refund']:['距拍摄日','退款'],sorted.map(r=>[refundRangeLabel(sorted,r,language),refundRateLabel(r.rate,language)]));
}
/** Replaces plan placeholders (in either language) with tables; the HTML must already be sanitised. */
export function renderPlanTokens(html:string,plan:InstallmentStage[],rules:RefundRule[],language:StudioLanguage):string{
 const swap=(source:string,token:string,table:string)=>source.split('<p>'+token+'</p>').join(table).split(token).join(table);
 let out=html;
 for(const set of Object.values(PLAN_TOKENS)){out=swap(out,set.payment,paymentPlanTable(plan,language));out=swap(out,set.refund,refundRulesTable(rules,language));}
 return out;
}
/** Only document formatting is retained. No scripts, URLs, events, embedded objects or CSS resources. */
export function sanitizeRichHtml(html:string):string{
 if(typeof DOMParser==='undefined')return escapeHtml(html);
 const doc=new DOMParser().parseFromString(html,'text/html');
 const allowed=new Set('P DIV SPAN BR STRONG B EM I U S H1 H2 H3 H4 UL OL LI BLOCKQUOTE TABLE THEAD TBODY TFOOT TR TH TD HR FONT'.split(' '));
 const styles=new Set('color background-color font-family font-size font-weight font-style text-decoration text-align line-height margin-left margin-right padding border border-color width'.split(' '));
 const clean=(parent:Element)=>{for(const el of Array.from(parent.children)){
  if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','IMG','VIDEO','AUDIO','LINK','META'].includes(el.tagName)){el.remove();continue;}
  clean(el);
  if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);continue;}
  const css=Array.from((el as HTMLElement).style??[]).filter(key=>styles.has(key)).map(key=>[key,(el as HTMLElement).style.getPropertyValue(key)]).filter(([,v])=>!/[\\<>]|url\s*\(|expression\s*\(|@import/i.test(v));
  const spans=['rowspan','colspan'].map(k=>[k,el.getAttribute(k)]).filter(([,v])=>v&&/^\d{1,2}$/.test(v));
  const font=el.tagName==='FONT'?el.getAttribute('face'):null,color=el.tagName==='FONT'?el.getAttribute('color'):null,size=el.tagName==='FONT'?Number(el.getAttribute('size')):0;
  for(const a of Array.from(el.attributes))el.removeAttribute(a.name);
  if(css.length)el.setAttribute('style',css.map(([k,v])=>k+':'+v).join(';'));
  for(const [k,v] of spans)el.setAttribute(k!,v!);
  if(font&&PRINT_FONTS.some(f=>f.includes(font)))el.setAttribute('face',font);
  if(color&&/^#[\da-f]{3,8}$/i.test(color))el.setAttribute('color',color);
  if(size>=1&&size<=7)el.setAttribute('size',String(size));
 }};
 clean(doc.body);return doc.body.innerHTML;
}
export function isPrintDocument(value:unknown):value is PrintDocument {
 if(!value||typeof value!=='object')return false;const d=value as PrintDocument;
 return d.version===1&&Object.hasOwn(PRINT_TEMPLATES,d.template)&&PRINT_FONTS.includes(d.font)&&Number.isFinite(d.size)&&d.size>=8&&d.size<=40&&Number.isFinite(d.padding)&&d.padding>=12&&d.padding<=80&&/^#[\da-f]{6}$/i.test(d.background)&&/^#[\da-f]{6}$/i.test(d.color)&&Array.isArray(d.sectionOrder)&&['customer','services','notes','statements','signature'].every(k=>d.sectionOrder.includes(k))&&d.sectionOrder.length===5&&Array.isArray(d.hiddenSections)&&d.hiddenSections.every(k=>d.sectionOrder.includes(k))&&Array.isArray(d.blocks)&&d.blocks.every(b=>b&&typeof b.id==='string'&&typeof b.title==='string'&&typeof b.html==='string'&&/^#[\da-f]{6}$/i.test(b.background)&&/^#[\da-f]{6}$/i.test(b.color)&&PRINT_FONTS.includes(b.font)&&Number.isFinite(b.size)&&b.size>=8&&b.size<=40&&typeof b.bold==='boolean')&&new Set(d.blocks.map(b=>b.id)).size===d.blocks.length;
}
