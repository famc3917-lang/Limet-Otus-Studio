// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useCallback,useEffect,type RefObject} from 'react';
/** Print an isolated clone so glass surfaces and scroll containers cannot clip the document. */
export function useDocumentPrint(ref:RefObject<HTMLElement|null>){
 const prepare=useCallback(()=>{document.getElementById('studio-print-root')?.remove();if(!ref.current)return;const root=document.createElement('div');root.id='studio-print-root';root.className='studio-shell';root.append(ref.current.cloneNode(true));document.body.append(root);},[ref]);
 const cleanup=useCallback(()=>document.getElementById('studio-print-root')?.remove(),[]);
 useEffect(()=>{window.addEventListener('beforeprint',prepare);window.addEventListener('afterprint',cleanup);return ()=>{window.removeEventListener('beforeprint',prepare);window.removeEventListener('afterprint',cleanup);cleanup();};},[prepare,cleanup]);
 return ()=>{prepare();window.print();};
}
