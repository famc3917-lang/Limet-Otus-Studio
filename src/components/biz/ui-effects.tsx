// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {useStudioLanguage} from '@/lib/i18n';

export const DOCUMENT_TEXT={
 zh:{title:'观隅 · Limet Otus Studio',description:'摄影工作室的订单、档期、前后期工单、设备与交付管理'},
 en:{title:'Limet Otus Studio',description:'Orders, shoot schedules, production and editing tasks, equipment and delivery for photography studios'},
} as const;
/** Keeps the document language, title and description in the interface language; route changes reset Next's static metadata. */
function DocumentLanguage(){
 const language=useStudioLanguage(),pathname=usePathname();
 useEffect(()=>{
  const text=DOCUMENT_TEXT[language==='en'?'en':'zh'];
  const defaults=Object.values(DOCUMENT_TEXT);
  const apply=()=>{
   document.documentElement.lang=language==='en'?'en':'zh-CN';
   // Page-specific titles (such as the 404 page) are kept; only the default title follows the language.
   if((!document.title||defaults.some(t=>t.title===document.title))&&document.title!==text.title)document.title=text.title;
   const meta=document.querySelector('meta[name="description"]');
   if(meta&&defaults.some(t=>t.description===meta.getAttribute('content'))&&meta.getAttribute('content')!==text.description)meta.setAttribute('content',text.description);
  };
  apply();
  // Next writes the static metadata after hydration and on navigation; reapply when it does.
  const observer=new MutationObserver(apply);
  observer.observe(document.head,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['content']});
  return ()=>observer.disconnect();
 },[language,pathname]);
 return null;
}

/** Routing never hides the workspace. */
export function UIEffects(){
 return <><DocumentLanguage/><PressEffects/></>;
}
function PressEffects(){
 const pathname=usePathname();
 useEffect(()=>{
  const timers=new Set<ReturnType<typeof setTimeout>>(),ripples=new Set<HTMLElement>();
  const reduced=()=>document.documentElement.dataset.reduceMotion==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const press=(event:PointerEvent)=>{
   if(reduced()||event.button!==0||!(event.target instanceof Element))return;
   const button=event.target.closest<HTMLElement>('.studio-btn,.nav-primary,.assistant-launch,.about-stars button,.assistant-proposal-actions button');
   if(!button||button.hasAttribute('disabled')||button.getAttribute('aria-disabled')==='true')return;
   const bounds=button.getBoundingClientRect(),ripple=document.createElement('span');
   ripple.className='studio-press-ripple';ripple.setAttribute('aria-hidden','true');
   ripple.style.left=(event.clientX-bounds.left)+'px';ripple.style.top=(event.clientY-bounds.top)+'px';
   ripple.style.setProperty('--ripple-size',Math.hypot(bounds.width,bounds.height)*2+'px');
   button.append(ripple);ripples.add(ripple);
   const timer=setTimeout(()=>{ripple.remove();ripples.delete(ripple);timers.delete(timer);},650);timers.add(timer);
  };
  document.addEventListener('pointerdown',press,{passive:true});
  return ()=>{document.removeEventListener('pointerdown',press);timers.forEach(clearTimeout);ripples.forEach(r=>r.remove());};
 },[]);
 useEffect(()=>{
  if(document.documentElement.dataset.reduceMotion==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const content=document.querySelector('#main-content');if(!content||pathname==='/about')return;
  const animations=Array.from(content.children).filter(e=>!e.classList.contains('daily-line')).slice(0,6).map((e,i)=>e.animate([{transform:'translateY(8px)'},{transform:'translateY(0)'}],{duration:260,delay:i*25,easing:'cubic-bezier(.2,.8,.2,1)'}));
  return ()=>animations.forEach(a=>a.cancel());
 },[pathname]);
 return null;
}
