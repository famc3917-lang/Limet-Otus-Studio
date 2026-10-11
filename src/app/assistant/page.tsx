// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {desktop} from '@/lib/desktop';
import {setStudioLanguage,useStudioText} from '@/lib/i18n';
import {AssistantPanel} from '@/components/biz/assistant';
export default function DesktopAssistant(){
 const t=useStudioText(),router=useRouter(),[orb,setOrb]=useState(false),[expanded,setExpanded]=useState(false),[error,setError]=useState('');
 const drag=useRef<{x:number;y:number;moved:boolean}|null>(null),suppress=useRef(false);
 useEffect(()=>{if(new URLSearchParams(location.search).get('mode')!=='orb'){(window as Window&{__studioAssistantRequested?:boolean}).__studioAssistantRequested=true;router.replace('/');return;}setOrb(true);void desktop()?.assistantPanelState?.().then(setExpanded);document.body.classList.add('assistant-orb-window');const panel=(e:Event)=>setExpanded((e as CustomEvent<boolean>).detail),language=(e:Event)=>{const value=(e as CustomEvent<string>).detail;if(value==='zh'||value==='en')setStudioLanguage(value);};window.addEventListener('studio-desktop-panel',panel);window.addEventListener('studio-interface-language-changed',language);return ()=>{document.body.classList.remove('assistant-orb-window');window.removeEventListener('studio-desktop-panel',panel);window.removeEventListener('studio-interface-language-changed',language);};},[router]);
 const move=(phase:'start'|'move'|'end')=>void desktop()?.moveAssistant?.({phase}).catch(()=>setError(t('暂时无法移动','Unable to move right now')));
 const begin:React.PointerEventHandler<HTMLElement>=e=>{if(e.button!==0||(e.target as HTMLElement).closest('input,select,a')||(e.currentTarget.tagName!=='BUTTON'&&(e.target as HTMLElement).closest('button')))return;drag.current={x:e.screenX,y:e.screenY,moved:false};suppress.current=false;e.currentTarget.setPointerCapture(e.pointerId);move('start');};
 const end=()=>{if(!drag.current)return;suppress.current=drag.current.moved;drag.current=null;move('end');};
 const close=()=>{drag.current=null;suppress.current=false;void desktop()?.closeAssistant?.();};
 if(!orb)return null;
 return <div className="desktop-assistant-root" onPointerMove={e=>{const d=drag.current;if(!d)return;if(Math.hypot(e.screenX-d.x,e.screenY-d.y)>5)d.moved=true;if(d.moved)move('move');}} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={e=>{if(e.key==='Escape'&&expanded)close();}}><div className="desktop-assistant-panel" hidden={!expanded}><AssistantPanel active={expanded} onClose={close} onDragStart={begin} onConfigure={()=>void desktop()?.assistantSettings?.()}/></div><button className="desktop-assistant-orb" title={error||t('点击打开助手；拖动移动','Click to open the assistant; drag to move')} aria-label={t('桌面 AI 助手','Desktop AI assistant')} aria-expanded={expanded} onPointerDown={begin} onClick={()=>{if(suppress.current){suppress.current=false;return;}if(expanded)close();else void desktop()?.openAssistant?.().catch(()=>setError(t('请在主窗口重新登录','Sign in again in Studio')));}}><span>✦</span><small>{t('观隅 AI','Studio AI')}</small></button></div>;
}
