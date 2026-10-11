// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import { createContext, useLayoutEffect, useRef } from 'react';

export const FieldLabelContext = createContext<string | undefined>(undefined);

/** The top layer keeps our own panels clear of frosted cards and scroll containers. */
export function useSurface(open: boolean, close: () => void) {
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useLayoutEffect(() => { closeRef.current = close; });
  useLayoutEffect(() => {
    if (!open || !anchor.current || !panel.current) return;
    const element = panel.current;
    element.showPopover();
    const position = () => {
      const rect = anchor.current!.getBoundingClientRect();
      element.style.minWidth = `${rect.width}px`;
      element.style.maxWidth = `${window.innerWidth - 24}px`;
      const height = Math.min(element.scrollHeight + 12, 430);
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const up = below < height && above > below;
      element.style.maxHeight = `${Math.max(100, up ? above : below)}px`;
      element.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - element.offsetWidth - 12))}px`;
      element.style.top = `${up ? Math.max(12, rect.top - element.offsetHeight - 6) : rect.bottom + 6}px`;
    };
    position();
    const outside = (event: PointerEvent) => {
      if (!element.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) closeRef.current();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); closeRef.current(); anchor.current?.focus(); } };
    window.addEventListener('resize',position);
    window.addEventListener('scroll',position,true);
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return () => {
      if (element.matches(':popover-open')) element.hidePopover();
      window.removeEventListener('resize',position);
      window.removeEventListener('scroll',position,true);
      document.removeEventListener('pointerdown',outside);
      document.removeEventListener('keydown',escape);
    };
  },[open]);
  return { anchor, panel };
}
