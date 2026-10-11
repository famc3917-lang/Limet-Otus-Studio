// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText as useInterfaceText} from '@/lib/i18n';
import {useEffect,useRef} from 'react';
import type {ReactNode} from 'react';

export function MotionCanvas({children,editorial=false}:{children:ReactNode;editorial?:boolean}){

 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!editorial||!root.current||typeof IntersectionObserver==='undefined')return;
  const elements=[...root.current.querySelectorAll<HTMLElement>('.about-section,.motion-arrive')];
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('motion-visible');observer.unobserve(entry.target);}}, {threshold:.12});
  for(const element of elements)observer.observe(element);
  return ()=>observer.disconnect();
 },[editorial]);
 return <div ref={root} className={'motion-canvas'+(editorial?' editorial-motion':'')}>{children}</div>;
}
export function LightStudy({compact=false}:{compact?:boolean}){
 const uiText=useInterfaceText();

 const ref=useRef<HTMLDivElement>(null);
 return <div ref={ref} className={`light-study ${compact?'light-study-compact':''}`} role="img" tabIndex={0} aria-label={uiText("互动光影：移动光标改变玻璃折射，按 Escape 复位","Interactive light study. Move the pointer to adjust refraction; press Escape to reset.")} onPointerMove={e=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.reduceMotion==='true')return;const r=e.currentTarget.getBoundingClientRect();e.currentTarget.style.setProperty('--light-x',((e.clientX-r.left)/r.width-.5)*14+'deg');e.currentTarget.style.setProperty('--light-y',((e.clientY-r.top)/r.height-.5)*-14+'deg');}} onPointerLeave={e=>{e.currentTarget.style.setProperty('--light-x','0deg');e.currentTarget.style.setProperty('--light-y','0deg');}} onKeyDown={e=>{if(e.key==='Escape'){ref.current?.style.setProperty('--light-x','0deg');ref.current?.style.setProperty('--light-y','0deg');}}}>
  <div className="light-study-orbit"/><div className="light-study-plane plane-one"/><div className="light-study-plane plane-two"/><div className="light-study-beam"/><span className="light-study-caption">{uiText("光，是创作的起点。","Light begins the image.")}</span>
 </div>;
}
