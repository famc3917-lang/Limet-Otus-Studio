// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {errorText} from '@/lib/interface-error';
import {useState} from 'react';
import {useStudio} from '@/lib/store';
import {useStudioLanguage,useStudioText} from '@/lib/i18n';
import {interfaceNotice} from '@/lib/interface-text';
import {uid} from '@/lib/studio';
import {DEFAULT_LISTS,channelsOf,defaultSettings,paymentMethodsOf,signaturesOf,tagsOf,type SignatureOption} from '@/lib/settings';
import {MAX_INSTALLMENTS,planOf,refundRangeLabel,refundRateLabel,refundRulesOf,validateInstallments,validateRefundRules} from '@/lib/payment-plan';
import {Btn,Card,SectionTitle,TextInput} from './ui';

type StageDraft={name:string;desc:string;percent:string};
type RuleDraft={minDays:string;percent:string};
const percentText=(rate:number)=>String(Math.round(rate*10000)/100);

/** Chips with add and remove; values are kept in the order entered. */
function ListEditor({label,items,onChange,placeholder,max}:{label:string;items:string[];onChange:(items:string[])=>void;placeholder:string;max:number}){
 const t=useStudioText(),[value,setValue]=useState(''),[error,setError]=useState('');
 const add=()=>{const v=value.trim();if(!v)return;if(v.length>40)return setError(t('每项最多 40 字','Up to 40 characters per item'));if(items.includes(v))return setError(t('已存在相同项目','This item already exists'));if(items.length>=max)return setError(t(`最多 ${max} 项`,`Up to ${max} items`));onChange([...items,v]);setValue('');setError('');};
 return <div className="mb-6"><p className="mb-2 text-sm font-medium">{label}</p><div className="flex flex-wrap gap-2">{items.map(item=><span key={item} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700">{item}<button type="button" aria-label={t(`移除 ${item}`,`Remove ${item}`)} onClick={()=>onChange(items.filter(v=>v!==item))} className="text-xs text-zinc-500 transition hover:text-red-500">✕</button></span>)}</div>
 <div className="mt-2 flex items-center gap-2"><TextInput value={value} maxLength={40} placeholder={placeholder} className="max-w-xs" onChange={e=>setValue(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()}/><Btn size="sm" onClick={add}>{t('添加','Add')}</Btn></div>{error&&<p className="mt-1 text-xs text-red-600">{error}</p>}</div>;
}

export function OrderPaymentSettings(){
 const t=useStudioText(),language=useStudioLanguage(),{data,saveSettings}=useStudio();
 const settings=data.settings;
 const [signatures,setSignatures]=useState<SignatureOption[]>(()=>signaturesOf(settings).map(s=>({...s})));
 const [channels,setChannels]=useState(()=>channelsOf(settings,language));
 const [tags,setTags]=useState(()=>tagsOf(settings,language));
 const [methods,setMethods]=useState(()=>paymentMethodsOf(settings,language));
 const [stages,setStages]=useState<StageDraft[]>(()=>planOf(null,settings).map(s=>({name:s.name,desc:s.desc??'',percent:percentText(s.rate)})));
 const [rules,setRules]=useState<RuleDraft[]>(()=>refundRulesOf(null,settings).map(r=>({minDays:String(r.minDays),percent:percentText(r.rate)})));
 const [message,setMessage]=useState('');
 const total=Math.round(stages.reduce((sum,s)=>sum+(Number(s.percent)||0),0)*100)/100;
 const parsedRules=rules.filter(r=>r.minDays!=='').map(r=>({minDays:Number(r.minDays),rate:(Number(r.percent)||0)/100})).filter(r=>Number.isInteger(r.minDays)&&r.minDays>=0);
 const sortedRules=[...parsedRules].sort((a,b)=>b.minDays-a.minDays);
 const setStage=(i:number,p:Partial<StageDraft>)=>setStages(stages.map((s,j)=>j===i?{...s,...p}:s));
 const setRule=(i:number,p:Partial<RuleDraft>)=>setRules(rules.map((r,j)=>j===i?{...r,...p}:r));
 /* tiers are kept in order of days, longest first, once an edit is finished; blank days stay at the end */
 const sortDraft=(list:RuleDraft[])=>[...list].sort((a,b)=>a.minDays===''?1:b.minDays===''?-1:Number(b.minDays)-Number(a.minDays));
 const sortRules=()=>setRules(r=>sortDraft(r));
 const setSignature=(i:number,p:Partial<SignatureOption>)=>setSignatures(signatures.map((s,j)=>j===i?{...s,...p}:s));
 const reset=()=>{const d=defaultSettings(language);setSignatures([{id:'studio',name:settings?.name||d.name}]);setChannels(DEFAULT_LISTS[language].orderChannels);setTags(DEFAULT_LISTS[language].customerTags);setMethods(DEFAULT_LISTS[language].paymentMethods);setStages(d.installments!.map(s=>({name:s.name,desc:s.desc??'',percent:percentText(s.rate)})));setRules(d.refundRules!.map(r=>({minDays:String(r.minDays),percent:percentText(r.rate)})));setMessage('已恢复默认草稿，点击保存后生效');};
 const save=()=>{
  try{
   const cleanSignatures=signatures.map(s=>({id:s.id,name:s.name.trim(),...(s.sub?.trim()?{sub:s.sub.trim()}:{})}));
   if(!cleanSignatures.length||cleanSignatures.some(s=>!s.name))throw new Error('每个署名都需要名称');
   const installments=validateInstallments(stages.map(s=>({name:s.name,desc:s.desc,rate:Number(s.percent)/100})));
   /* a blank field is an error, never a silent 0 days or 0 % */
   const refundRules=validateRefundRules(rules.map(r=>({minDays:r.minDays===''?NaN:Number(r.minDays),rate:r.percent===''?NaN:Number(r.percent)/100})));
   saveSettings({...defaultSettings(language),...settings,signatures:cleanSignatures,orderChannels:channels,customerTags:tags,paymentMethods:methods,installments,refundRules});
   setMessage('已保存');
  }catch(error){setMessage(errorText(error,'保存失败'));}
 };
 return <div className="space-y-5">
 <Card className="p-5"><SectionTitle>{t('作品署名','Work signatures')}</SectionTitle><p className="mb-3 text-xs text-zinc-500">{t('创建订单与工单时可选择的署名，会印在订单确认单上。','Signatures available on orders and tasks. They are printed on order confirmations.')}</p>
  <div className="space-y-2">{signatures.map((s,i)=><div key={s.id} className="flex flex-wrap items-center gap-2"><TextInput aria-label={t('署名名称','Signature name')} value={s.name} maxLength={40} placeholder={t('例如：李明','e.g. Alex Morgan')} className="max-w-[14rem]" onChange={e=>setSignature(i,{name:e.target.value})}/><TextInput aria-label={t('副标题（可选）','Subtitle (optional)')} value={s.sub??''} maxLength={60} placeholder={t('副标题（可选）','Subtitle (optional)')} className="max-w-[16rem]" onChange={e=>setSignature(i,{sub:e.target.value})}/><Btn size="sm" variant="ghost" disabled={signatures.length<=1} onClick={()=>setSignatures(signatures.filter((_,j)=>j!==i))}>{t('删除','Delete')}</Btn></div>)}</div>
  <Btn size="sm" variant="outline" className="mt-3" disabled={signatures.length>=20} onClick={()=>setSignatures([...signatures,{id:uid('sig-'),name:''}])}>{t('＋ 添加署名','＋ Add signature')}</Btn>
 </Card>
 <Card className="p-5"><SectionTitle>{t('渠道、标签与收款方式','Channels, tags and payment methods')}</SectionTitle>
  <ListEditor label={t('订单来源渠道','Order channels')} items={channels} onChange={setChannels} max={50} placeholder={t('新增渠道','Add a channel')}/>
  <ListEditor label={t('客户标签','Client tags')} items={tags} onChange={setTags} max={50} placeholder={t('新增标签','Add a tag')}/>
  <ListEditor label={t('收款方式','Payment methods')} items={methods} onChange={setMethods} max={20} placeholder={t('新增收款方式','Add a payment method')}/>
 </Card>
 <Card className="p-5"><SectionTitle right={<span className={`text-sm ${total===100?'text-green-700':'text-red-600'}`}>{t('合计','Total')} {total}%</span>}>{t('分期付款','Instalments')}</SectionTitle><p className="mb-3 text-xs text-zinc-500">{t(`1–${MAX_INSTALLMENTS} 期，各期比例相加须等于 100%。新订单创建时保存当时的方案，之后修改不影响已有订单。`,`1–${MAX_INSTALLMENTS} instalments; shares must add up to 100%. Each new order keeps the plan in effect when it is created.`)}</p>
  <div className="space-y-2">{stages.map((s,i)=><div key={i} className="flex flex-wrap items-center gap-2"><span className="w-14 text-sm text-zinc-500">{t(`第 ${i+1} 期`,`#${i+1}`)}</span><TextInput aria-label={t(`第 ${i+1} 期名称`,`Instalment ${i+1} name`)} value={s.name} maxLength={40} placeholder={t('名称','Name')} className="max-w-[10rem]" onChange={e=>setStage(i,{name:e.target.value})}/><TextInput aria-label={t(`第 ${i+1} 期支付时点`,`Instalment ${i+1} due`)} value={s.desc} maxLength={80} placeholder={t('支付时点（可选）','When due (optional)')} className="max-w-[16rem]" onChange={e=>setStage(i,{desc:e.target.value})}/><span className="inline-flex items-center gap-1"><TextInput aria-label={t(`第 ${i+1} 期比例`,`Instalment ${i+1} share`)} type="number" min={0.01} max={100} step={0.01} value={s.percent} className="w-24" onChange={e=>setStage(i,{percent:e.target.value})}/>%</span><Btn size="sm" variant="ghost" disabled={stages.length<=1} onClick={()=>setStages(stages.filter((_,j)=>j!==i))}>{t('删除','Delete')}</Btn></div>)}</div>
  <Btn size="sm" variant="outline" className="mt-3" disabled={stages.length>=MAX_INSTALLMENTS} onClick={()=>setStages([...stages,{name:'',desc:'',percent:''}])}>{t('＋ 添加一期','＋ Add instalment')}</Btn>
 </Card>
 <Card className="p-5"><SectionTitle>{t('退款规则','Refund rules')}</SectionTitle><p className="mb-3 text-xs text-zinc-500">{t('客户申请退款时，按距拍摄日还有几天，退还已付款项的一定比例。每一档从“起始天数”开始，到上一档的前一天为止；最后一档从 0 天（拍摄当天）开始。','When a client asks for a refund, a share of payments received is returned according to the days left before the shoot. Each tier starts at its first day and runs up to the day before the next tier; the last tier starts at 0 days (the shoot date).')}</p>
  <div className="refund-table" role="table" aria-label={t('退款规则','Refund rules')}>
   <div className="refund-row refund-head" role="row"><span role="columnheader">{t('适用范围','Applies to')}</span><span role="columnheader">{t('起始天数','From day')}</span><span role="columnheader">{t('退款比例','Refund')}</span><span/></div>
   {rules.map((r,i)=>{const days=Number(r.minDays),valid=r.minDays!==''&&Number.isInteger(days)&&days>=0&&days<=3650,dup=valid&&parsedRules.filter(x=>x.minDays===days).length>1,rule=sortedRules.find(x=>x.minDays===days),pct=Number(r.percent);
    return <div key={i} className={`refund-row${dup||!valid?' refund-bad':''}`} role="row">
     <span role="cell" className="refund-range">{!valid?t('请填写起始天数','Enter the first day'):dup?t('天数与另一档重复','Same day as another tier'):refundRangeLabel(sortedRules,rule!,language)}</span>
     <span role="cell" className="refund-field">{t('距拍摄日','')}<TextInput aria-label={t(`第 ${i+1} 档起始天数`,`Tier ${i+1} first day`)} type="number" min={0} max={3650} step={1} value={r.minDays} className="w-20" onChange={e=>setRule(i,{minDays:e.target.value})} onBlur={sortRules}/>{t('天起','days and more')}</span>
     <span role="cell" className="refund-field">{t('退还','Refund')}<TextInput aria-label={t(`第 ${i+1} 档退款比例`,`Tier ${i+1} refund share`)} type="number" min={0} max={100} step={0.01} value={r.percent} className="w-20" onChange={e=>setRule(i,{percent:e.target.value})}/>%<small>{r.percent!==''&&Number.isFinite(pct)?refundRateLabel(Math.min(1,Math.max(0,pct/100)),language):''}</small></span>
     <span role="cell"><Btn size="sm" variant="ghost" disabled={rules.length<=1} onClick={()=>setRules(rules.filter((_,j)=>j!==i))}>{t('删除','Delete')}</Btn></span>
    </div>;})}
  </div>
  {!parsedRules.some(r=>r.minDays===0)&&<p className="mt-2 text-xs text-red-600">{t('还缺少从 0 天（拍摄当天）开始的一档，否则临近拍摄的退款无规则可依。','There is no tier starting at 0 days (the shoot date), so late refunds have no rule.')} <button type="button" className="underline" onClick={()=>setRules(sortDraft([...rules,{minDays:'0',percent:'0'}]))}>{t('添加 0 天档','Add a 0-day tier')}</button></p>}
  <Btn size="sm" variant="outline" className="mt-3" disabled={rules.length>=20} onClick={()=>setRules([...rules,{minDays:'',percent:''}])}>{t('＋ 添加一档','＋ Add tier')}</Btn>
 </Card>
 <div className="flex flex-wrap items-center gap-3"><Btn onClick={save}>{t('保存','Save')}</Btn><Btn variant="outline" onClick={reset}>{t('恢复默认草稿','Restore default draft')}</Btn><span role="status" className="text-sm">{interfaceNotice(message,language)}</span></div>
 </div>;
}
