// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
"use client";
import {useEffect,useState,useSyncExternalStore} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {ArrowLeft,Minus,MoveDiagonal,X} from 'lucide-react';
import {parentRoute} from '@/lib/navigation';
import {requestLeave} from './navigation-guard';
import {useStudioText} from '@/lib/i18n';
import {APP_VERSION} from '@/lib/version';
type Action='minimize'|'maximize'|'close';type State={maximized:boolean};
type DesktopWindow=Window&{pstudio?:{windowAction?:(action:Action)=>Promise<State>;windowState?:()=>Promise<State>;onWindowState?:(callback:(state:State)=>void)=>()=>void}};
const subscribe=()=>()=>{};
export function WindowBar(){
 const t=useStudioText();
 const pathname=usePathname(),router=useRouter(),[maximized,setMaximized]=useState(false);
 const desktop=useSyncExternalStore(subscribe,()=>!!(window as DesktopWindow).pstudio?.windowAction,()=>false);
 useEffect(()=>{if(!desktop)return;const bridge=(window as DesktopWindow).pstudio;let active=true;const update=(state:State)=>{if(active)setMaximized(state.maximized);};void bridge?.windowState?.().then(update).catch(()=>{});const unsubscribe=bridge?.onWindowState?.(update);return()=>{active=false;unsubscribe?.();};},[desktop]);
 if(!desktop)return null;
 const action=(value:Action)=>{void (window as DesktopWindow).pstudio?.windowAction?.(value).then(state=>{if(state)setMaximized(state.maximized);}).catch(()=>{});};
 const back=async()=>{const target=parentRoute(pathname,new URLSearchParams(location.search));if(target&&await requestLeave())router.push(target);};
 return <div className="desktop-titlebar" onDoubleClick={event=>{if(!(event.target as Element).closest('button'))action('maximize');}}>
  <div className="desktop-titlebar-leading"><div className="window-traffic" role="group" aria-label={t("窗口控制","Window controls")}>
   <button type="button" className="traffic-close" aria-label={t("关闭窗口","Close window")} title={t("关闭窗口","Close window")} onClick={()=>action('close')}><span><X size={9}/></span></button>
   <button type="button" className="traffic-minimize" aria-label={t("最小化窗口","Minimize window")} title={t("最小化窗口","Minimize window")} onClick={()=>action('minimize')}><span><Minus size={9}/></span></button>
   <button type="button" className="traffic-maximize" aria-label={maximized?t('还原窗口','Restore window'):t('最大化窗口','Maximize window')} title={maximized?t('还原窗口','Restore window'):t('最大化窗口','Maximize window')} onClick={()=>action('maximize')}><span><MoveDiagonal size={8} style={{transform:maximized?'rotate(90deg)':undefined}}/></span></button>
  </div>{parentRoute(pathname)&&<button type="button" className="window-back" aria-label={t("返回上级","Back")} title={t("返回上级","Back")} onClick={()=>void back()}><ArrowLeft size={13}/></button>}</div>
  <span>{t('观隅','Limet Otus')} <small>Limet Otus Studio · V{APP_VERSION}</small></span><div aria-hidden="true"/>
 </div>;
}
