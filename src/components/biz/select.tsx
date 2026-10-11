// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import { Children, isValidElement, useContext, useEffect, useId, useRef, useState } from 'react';
import { FieldLabelContext, useSurface } from './surface';
import type { ReactElement, SelectHTMLAttributes, OptionHTMLAttributes } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/** Custom visual listbox; the hidden native select preserves form values and change events. */
export function StudioSelect({ children, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [localValue, setLocalValue] = useState(String(props.defaultValue ?? ''));
  const select = useRef<HTMLSelectElement>(null);
  const { anchor: trigger, panel } = useSurface(open, () => setOpen(false));
  const fieldLabel = useContext(FieldLabelContext);
  const id = useId();
  const options = Children.toArray(children).filter(isValidElement) as ReactElement<OptionHTMLAttributes<HTMLOptionElement>>[];
  const value = String(props.value ?? localValue);
  const index = options.findIndex(o => String(o.props.value ?? o.props.children) === value);
  const label = options[Math.max(0,index)]?.props.children;
  useEffect(() => { if (open) document.getElementById(`${id}-${cursor}`)?.scrollIntoView({block:'nearest'}); }, [open,cursor,id]);
  const choose = (i: number) => {
    const option = options[i]; if (!option || option.props.disabled || props.disabled) return;
    const next = String(option.props.value ?? option.props.children);
    setLocalValue(next);
    if (select.current) { select.current.value = next; select.current.dispatchEvent(new Event('change', { bubbles: true })); }
    setOpen(false); trigger.current?.focus();
  };
  return <div className={`studio-select ${className}`}>
    <select {...props} ref={select} tabIndex={-1} aria-hidden="true" className="select-value" value={value} onChange={props.onChange}>{children}</select>
    <button ref={trigger} type="button" role="combobox" aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby'] ?? fieldLabel} aria-expanded={open} aria-controls={id} aria-activedescendant={open ? `${id}-${cursor}` : undefined} disabled={props.disabled} className="select-trigger" onClick={() => { setCursor(Math.max(0,index)); setOpen(!open); }} onKeyDown={e => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
      if (e.key === 'Tab') { setOpen(false); return; }
      if (['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
        e.preventDefault(); setOpen(true);
        let next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length-1 : Math.max(0,Math.min(options.length-1,(open ? cursor : index) + (e.key === 'ArrowDown' ? 1 : -1)));
        while (options[next]?.props.disabled && next > 0 && next < options.length-1) next += e.key === 'ArrowUp' ? -1 : 1;
        setCursor(next);
      } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (open) choose(cursor); else { setCursor(Math.max(0,index)); setOpen(true); } }
    }}><span>{label}</span><ChevronDown size={14} aria-hidden="true" /></button>
    {open && <div ref={panel} popover="manual" className="select-options studio-popover" role="listbox" aria-labelledby={fieldLabel} id={id}>{options.map((o,i) => <div key={String(o.props.value ?? i)} id={`${id}-${i}`} role="option" aria-selected={i === index} aria-disabled={o.props.disabled} data-focused={i === cursor} onPointerMove={() => setCursor(i)} onClick={() => choose(i)}><span>{o.props.children}</span>{i === index && <Check size={14}/>}</div>)}</div>}
  </div>;
}
