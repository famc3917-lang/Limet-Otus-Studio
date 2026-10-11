// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText as useInterfaceText,useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import { useContext, useId, useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { FieldLabelContext, useSurface } from './surface';

const pad = (n: number) => String(n).padStart(2,'0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

export function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

  const [open,setOpen] = useState(false);
  const [localValue,setLocalValue] = useState(String(props.defaultValue ?? ''));
  const value = String(props.value ?? localValue);
  const timed = props.type === 'datetime-local';
  const [draft,setDraft] = useState('');
  const [hour,setHour] = useState('09'), [minute,setMinute] = useState('00');
  const [month,setMonth] = useState(() => new Date());
  const input = useRef<HTMLInputElement>(null);
  const { anchor,panel } = useSurface(open,()=>setOpen(false));
  const label = useContext(FieldLabelContext);
  const id = useId();
  const start = new Date(month.getFullYear(),month.getMonth(),1);
  start.setDate(1-(start.getDay()+6)%7);
  const cells = Array.from({length:42},(_,i)=>new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
  const begin = () => {
    const initial = value ? new Date(`${value.slice(0,10)}T12:00:00`) : new Date();
    setMonth(Number.isFinite(initial.getTime()) ? initial : new Date());
    setDraft(value.slice(0,10) || dateKey(new Date()));
    setHour(value.slice(11,13) || '09'); setMinute(value.slice(14,16) || '00');
    setOpen(!open);
  };
  const commit = (next: string) => {
    setLocalValue(next);
    if (input.current) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input.current,next);
      input.current.dispatchEvent(new Event('input',{bubbles:true}));
    }
    setOpen(false); anchor.current?.focus();
  };
  const nextValue = `${draft}${timed ? `T${pad(Number(hour))}:${pad(Number(minute))}` : ''}`;
  const allowed = !!draft && (!props.min || nextValue >= String(props.min)) && (!props.max || nextValue <= String(props.max)) && Number(hour)>=0 && Number(hour)<=23 && Number(minute)>=0 && Number(minute)<=59;
  return <div className="studio-date-input">
    <input {...props} ref={input} type="text" value={value} className="select-value" tabIndex={-1} aria-hidden="true" onChange={props.onChange}/>
    <button ref={anchor} type="button" className="select-trigger date-trigger" disabled={props.disabled || props.readOnly} aria-labelledby={props['aria-labelledby'] ?? label} aria-label={props['aria-label']} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={begin}><span>{value ? value.replace('T','  ').replaceAll('-',' / ') : (timed?uiText('选择日期与时间','Select date and time'):uiText('选择日期','Select date'))}</span><CalendarDays size={15}/></button>
    {open && <div ref={panel} popover="manual" id={id} className="date-panel studio-popover" role="dialog" aria-label={timed ? uiText("选择日期与时间","Select date and time") : uiText("选择日期","Select date")}>
      <div className="date-panel-heading"><button type="button" aria-label={uiText("上个月","Previous month")} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={16}/></button><div><input aria-label={uiText("年份","Year")} type="number" min="1900" max="9999" value={month.getFullYear()} onChange={e=>{const y=Number(e.target.value);if(y>=1900&&y<=9999)setMonth(new Date(y,month.getMonth(),1));}}/> {uiLanguage==='en'?' · ':' 年 '}{uiLanguage==='en'?month.toLocaleDateString('en-GB',{month:'long'}):month.getMonth()+1+' 月'}</div><button type="button" aria-label={uiText("下个月","Next month")} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={16}/></button></div>
      <div className="date-week" aria-hidden="true">{(uiLanguage==='en'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['一','二','三','四','五','六','日']).map(d=><span key={d}>{d}</span>)}</div>
      <div className="date-days">{cells.map(d=>{const key=dateKey(d);return <button key={key} type="button" aria-label={key} aria-pressed={draft===key} data-outside={d.getMonth()!==month.getMonth()} data-today={key===dateKey(new Date())} onClick={()=>setDraft(key)} onKeyDown={e=>{
        const offset=({ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7} as Record<string,number>)[e.key];
        if(offset){e.preventDefault();const next=new Date(d.getFullYear(),d.getMonth(),d.getDate()+offset);setDraft(dateKey(next));setMonth(new Date(next.getFullYear(),next.getMonth(),1));requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>(`[aria-label="${dateKey(next)}"]`)?.focus());}
      }}>{d.getDate()}</button>;})}</div>
      {timed && <div className="date-time-row"><span>{uiText("拍摄 / 安排时间","Scheduled time")}</span><input aria-label={uiText("小时","Hour")} type="number" min="0" max="23" value={hour} onChange={e=>setHour(e.target.value)}/><span>:</span><input aria-label={uiText("分钟","Minute")} type="number" min="0" max="59" value={minute} onChange={e=>setMinute(e.target.value)}/></div>}
      <div className="date-panel-actions"><button type="button" onClick={()=>{const today=new Date();setDraft(dateKey(today));setMonth(today);}}>{uiText("今天","Today")}</button><button type="button" onClick={()=>commit('')}>{uiText("清空","Clear")}</button><button type="button" className="date-apply" disabled={!allowed} onClick={()=>commit(nextValue)}>{uiText("确认日期","Apply date")}</button></div>
    </div>}
  </div>;
}
