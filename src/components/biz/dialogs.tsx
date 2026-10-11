// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {catalogEnglish} from '@/lib/error-catalog';
import {useStudioText,useStudioLanguage} from '@/lib/i18n';
import {interfaceText} from '@/lib/interface-text';
import { useEffect, useRef, useState } from 'react';
type Request = { message: string; confirm: boolean; resolve: (accepted: boolean) => void };
const EVENT = 'studio:dialog';
export function confirmAction(message: string): Promise<boolean> { return new Promise(resolve => window.dispatchEvent(new CustomEvent<Request>(EVENT, { detail: { message, confirm: true, resolve } }))); }
export function notifyUser(message: string): Promise<boolean> { return new Promise(resolve => window.dispatchEvent(new CustomEvent<Request>(EVENT, { detail: { message, confirm: false, resolve } }))); }
export function DialogHost() {
  const t=useStudioText(),language=useStudioLanguage();
  const [request, setRequest] = useState<Request | null>(null);
  const element = useRef<HTMLDialogElement>(null);
  const queue = useRef<Request[]>([]);
  const active = useRef<Request | null>(null);
  const finish = (accepted: boolean) => {
    active.current?.resolve(accepted); element.current?.close();
    active.current = queue.current.shift() || null; setRequest(active.current);
  };
  useEffect(() => {
    const receive = (event: Event) => { const next = (event as CustomEvent<Request>).detail; if (active.current) queue.current.push(next); else { active.current = next; setRequest(next); } };
    window.addEventListener(EVENT,receive);
    return () => { window.removeEventListener(EVENT,receive); active.current?.resolve(false); queue.current.forEach(r=>r.resolve(false)); };
  }, []);
  useEffect(() => { if (request && !element.current?.open) element.current?.showModal(); }, [request]);
  return <dialog ref={element} className="studio-dialog" aria-labelledby="studio-dialog-title" onCancel={e=>{e.preventDefault();finish(false);}}>
    <span className="dialog-line" /><h2 id="studio-dialog-title">{request?.confirm ? t('请确认这次操作','Confirm operation') : t('工作室提示','Studio notice')}</h2><p>{request&&(language==='en'?catalogEnglish(request.message)??interfaceText(request.message,language):request.message)}</p><div className="dialog-actions">{request?.confirm && <button type="button" autoFocus onClick={()=>finish(false)}>{t('取消','Cancel')}</button>}<button type="button" className="dialog-confirm" onClick={()=>finish(true)}>{request?.confirm ? t('确认继续','Continue') : t('知道了','OK')}</button></div>
  </dialog>;
}
