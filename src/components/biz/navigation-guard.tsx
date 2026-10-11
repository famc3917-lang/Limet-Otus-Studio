// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
"use client";
import {useEffect,useLayoutEffect,useRef} from 'react';
import {useRouter} from 'next/navigation';
import {confirmAction} from './dialogs';
type Guard={dirty:()=>boolean;acknowledge:()=>void};
const guards=new Map<symbol,Guard>();let pending:Promise<boolean>|undefined;
export const hasUnsavedChanges=()=>[...guards.values()].some(guard=>guard.dirty());
export function requestLeave():Promise<boolean>{
 if(!hasUnsavedChanges())return Promise.resolve(true);
 return pending??=(async()=>{try{const accepted=await confirmAction('当前填写内容尚未提交。离开后将放弃这些内容，是否继续？');if(accepted)guards.forEach(guard=>guard.acknowledge());return accepted;}finally{pending=undefined;}})();
}
export function useUnsavedChanges(snapshot:string){
 const current=useRef(snapshot),accepted=useRef(snapshot);
 useLayoutEffect(()=>{current.current=snapshot;},[snapshot]);
 useEffect(()=>{const id=Symbol();guards.set(id,{dirty:()=>current.current!==accepted.current,acknowledge:()=>{accepted.current=current.current;}});return()=>{guards.delete(id);};},[]);
 return ()=>{accepted.current=current.current;};
}
export function NavigationGuard(){
 const router=useRouter();
 useEffect(()=>{
  const host=window as Window&{__studioCanLeave?:typeof requestLeave;__studioHasUnsaved?:typeof hasUnsavedChanges};host.__studioCanLeave=requestLeave;host.__studioHasUnsaved=hasUnsavedChanges;
  const click=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!hasUnsavedChanges())return;const link=(event.target as Element)?.closest?.('a[href]');if(!(link instanceof HTMLAnchorElement)||link.target==='_blank'||link.download)return;const url=new URL(link.href);if(url.origin!==location.origin||url.pathname===location.pathname&&url.search===location.search)return;event.preventDefault();event.stopPropagation();void requestLeave().then(ok=>{if(ok)router.push(url.pathname+url.search+url.hash);});};
  const unload=(event:BeforeUnloadEvent)=>{if(hasUnsavedChanges()){event.preventDefault();event.returnValue='';}};
  document.addEventListener('click',click,true);window.addEventListener('beforeunload',unload);
  return()=>{document.removeEventListener('click',click,true);window.removeEventListener('beforeunload',unload);delete host.__studioCanLeave;delete host.__studioHasUnsaved;};
 },[router]);return null;
}
