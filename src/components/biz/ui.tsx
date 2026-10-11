// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';

import {errorText} from '@/lib/interface-error';
import Link from "next/link";
import { Appearance } from "./appearance";
import {DailyLine} from './daily-line';
import {DEFAULT_SETTINGS} from '@/lib/settings';
import {getStudioExtensions} from '@/lib/extensions';
import '@/lib/extension-bootstrap';
import { StudioSelect } from "./select";
import { DateInput } from "./date-input";
import { FieldLabelContext } from "./surface";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStudio } from "@/lib/store";
import {Owl,BrandMark} from './owl';
import {CLIPanel} from './cli-panel';
import {ROLE_LABELS,ROLE_LABELS_EN} from '@/lib/permissions';
import {requestLeave} from './navigation-guard';
import {interfaceText} from '@/lib/interface-text';
import {useStudioText} from '@/lib/i18n';
import {useStudioLanguage} from '@/lib/i18n';
import {formatStudioMoney} from '@/lib/money';
import {StartupSafety} from './startup-safety';
import {FinancialNotice} from './financial-notice';
import {notifyUser} from './dialogs';
import { ensureFirstRun, getCurrentUser, getSessionUser, hasAnyAccount, logout } from "@/lib/auth";
import { getSignature } from "@/lib/types";
import { signaturesOf } from "@/lib/settings";
import { businessTimeZone, formatZoned, offsetLabel, zoneLabel } from "@/lib/time-zone";
import type { Signature } from "@/lib/types";
import {
  Menu, Plus, LogOut,
  CalendarDays,
  Camera,
  ClipboardList,
  Image as ImageIcon,
  LayoutDashboard,
  Settings,
  Wallet,
} from "lucide-react";

function useInterfaceNodes(){const language=useStudioLanguage();return (children:React.ReactNode)=>React.Children.map(children,child=>typeof child==='string'?child.replace(/\S(?:[\s\S]*\S)?/,part=>interfaceText(part,language)):child);}

/* ============ 原创工作室控件系统 ============ */

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`studio-card ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  const renderText=useInterfaceNodes();
  return (
    <div className="section-title">
      <h2 className="text-base font-semibold text-zinc-800">{renderText(children)}</h2>
      {right}
    </div>
  );
}

export function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  const labelId = React.useId();
  const language=useStudioLanguage();
  return (
    <label className="block">
      <span id={labelId} className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="ml-0.5 text-amber-600">*</span>}
      </span>
      <FieldLabelContext.Provider value={labelId}>{children}</FieldLabelContext.Provider>
      {hint && <span className="mt-1 block text-xs text-zinc-400">{interfaceText(hint,language)}</span>}
    </label>
  );
}

export const inputCls =
  "studio-field w-full rounded-xl px-3 py-2 text-sm placeholder-zinc-400 outline-none transition";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  if (props.type === 'date' || props.type === 'datetime-local') return <DateInput {...props}/>;
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-[70px] ${props.className ?? ""}`} />;
}

export const Select = StudioSelect;

export function Btn({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
}) {
  const renderText=useInterfaceNodes();
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };
  return (
    <button
      type="button"
      {...props}
      className={`${base} ${sizes[size]} studio-btn studio-btn-${variant} ${className}`}
    >
      {renderText(children)}
    </button>
  );
}

export function Badge({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: "zinc" | "amber" | "green" | "red" | "blue" | "purple";
}) {
  const renderText=useInterfaceNodes();
  const tones = {
    zinc: "bg-zinc-100 text-zinc-600",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-sky-100 text-sky-700",
    purple: "bg-violet-100 text-violet-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {renderText(children)}
    </span>
  );
}

export function Empty({ text }: { text: string }) {
  const language=useStudioLanguage();
  return (
    <div className="studio-empty">
      <span className="studio-empty-mark" aria-hidden="true" />{interfaceText(text,language)}
    </div>
  );
}

export function Money({ value }: { value?: number }) {
  const {data}=useStudio();
  const language=useStudioLanguage();
  if (value === undefined || value === null) return <span>—</span>;
  const v = Math.round(value * 100) / 100;
  return (
    <span className={`font-semibold ${v < 0 ? "text-red-600" : "text-amber-600"}`}>
      {formatStudioMoney(v,data.settings?.currency??'CNY',language)}
    </span>
  );
}

/* ============ 品牌署名 ============ */

export function BrandBadge({
  signature,
  size = "sm",
  dark = true,
}: {
  signature: Signature | string | null | undefined;
  size?: "sm" | "md" | "lg";
  dark?: boolean;
}) {
  const {data}=useStudio();
  const sig = getSignature(signature, data.settings);
  const sizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`${sizes[size]} font-semibold ${
          dark ? "text-white" : "text-zinc-900"
        }`}
      >
        {sig.name}
      </span>
      {size === "lg" && (
        <span className="text-xs text-zinc-500">{sig.sub}</span>
      )}
    </span>
  );
}

export function SignatureSwitch({
  value,
  onChange,
  compact,
}: {
  value: Signature;
  onChange: (v: Signature) => void;
  compact?: boolean;
}) {
  const {data}=useStudio();
  const list=signaturesOf(data.settings),current=getSignature(value,data.settings).id;
  return (
    <div className={`flex gap-1 ${compact ? "" : "flex-wrap"}`}>
      {list.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={`rounded-lg border px-3 py-1.5 text-sm transition ${
            current === s.id
              ? "border-amber-500 bg-amber-50 text-amber-700"
              : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
          }`}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}

/* ============ 侧边栏导航 ============ */

export function Sidebar() {
  const t=useStudioText(),language=useStudioLanguage();
  const pathname = usePathname(); const router = useRouter(); const { data } = useStudio();
  const currentUser = getCurrentUser();
  const menu = [
    { href: '/', label: t('工作台','Dashboard'), icon: LayoutDashboard },
    { href: '/orders', label: t('订单管理','Orders'), icon: ClipboardList, count: data.orders.length },
    { href: '/schedule', label: t('拍摄日历','Shoot calendar'), icon: CalendarDays },
    { href: '/pre', label: t('前期拍摄','Production'), icon: Camera, count: data.preOrders.filter(p => p.status !== 'completed').length },
    { href: '/post', label: t('后期交付','Post-production'), icon: ImageIcon, count: data.postOrders.filter(p => p.status !== 'completed').length },
    { href: '/finance', label: ['owner','admin'].includes(getSessionUser()?.role??'')?t('经营概览','Business overview'):t('我的经营概览','My business overview'), icon: Wallet },
    { href: '/admin', label: t('业务配置','Business settings'), icon: Settings },
    { href: '/settings', label: t('工作室偏好','Preferences'), icon: Settings },
    ...getStudioExtensions().flatMap(e=>(e.navigation??[]).map(n=>({...n,icon:Settings}))),
  ];
  return <aside className="studio-sidebar" id="studio-navigation">
    <Link href="/" className="studio-brand"><span className="brand-mark"><BrandMark/></span><span><strong>{t('观隅','Limet Otus')}</strong><small>Limet Otus Studio</small></span></Link>
    {getSessionUser()?.scopes.includes('orders:write')&&<Link href="/orders/new" className="nav-primary"><Plus size={16} /> {t('新建拍摄订单','New shoot order')}</Link>}
    <span className="eyebrow nav-label">{t('工作空间','Workspace')}</span>
    <nav aria-label={t('工作室导航','Studio navigation')} className="flex-1 overflow-y-auto">{menu.filter(m=>!getSessionUser()||(m.href==='/admin'?getSessionUser()?.scopes.includes('settings:write'):m.href==='/finance'?getSessionUser()?.scopes.includes('finance:read'):true)).map(m => <Link key={m.href} href={m.href} className="nav-item" aria-current={(m.href === '/' ? pathname === '/' : pathname.startsWith(m.href)) ? 'page' : undefined}><m.icon size={18} strokeWidth={1.6} /><span>{m.label}</span>{m.count !== undefined && m.count > 0 && <span className="nav-count">{m.count}</span>}</Link>)}</nav>
    <div className="sidebar-bottom"><p className="mb-3">{currentUser || t('欢迎来到观隅','Welcome to Limet Otus')}{getSessionUser()&&<small className="block mt-1 opacity-60">{(language==='en'?ROLE_LABELS_EN:ROLE_LABELS)[getSessionUser()!.role]}</small>}</p>{currentUser ? <button type="button" className="flex items-center gap-2" onClick={() => { void requestLeave().then(ok=>ok?logout().then(()=>router.push('/login')):undefined).catch(e=>void notifyUser(errorText(e))); }}><LogOut size={13} />{t('退出登录','Sign out')}</button> : <Link href="/login">{t('登录 / 注册','Sign in / Register')}</Link>}<p className="mt-5 text-[9px] tracking-widest">{t('为创作留出空间。','Room for creation.')}</p></div>
  </aside>;
}

/* ============ 实时时钟（右上角） ============ */


function ClockPanel() {
  const t=useStudioText();
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const zone = businessTimeZone(), local = formatZoned(now, zone);
  return <div className="studio-clock"><details><summary>{local.slice(0,16)} · {offsetLabel(now, zone)}</summary><div><p>{zoneLabel(now, zone)}　{local}</p><p className="mt-2">UTC　　{formatZoned(now, 'UTC')}</p><p className="mt-2 opacity-70">{t('设备本地系统时间','Device system clock')}</p></div></details></div>;
}

/* ============ 应用外壳 ============ */

export function AppShell({ children }: { children: React.ReactNode }) {
  const t=useStudioText(),language=useStudioLanguage();
  const {data}=useStudio();
  const pathname = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [cliOpen, setCliOpen] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('cli') === '1' && getSessionUser()?.role === 'owner') setCliOpen(true);
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.code === 'Backquote' && getSessionUser()?.role === 'owner') {
        event.preventDefault();
        setCliOpen(open => !open);
      } else if (event.key === 'Escape') setCliOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const closeCLI = () => {
    setCliOpen(false);
    if (new URLSearchParams(window.location.search).get('cli') === '1') {
      const url = new URL(window.location.href);
      url.searchParams.delete('cli');
      window.history.replaceState(null, '', url);
    }
  };
  useEffect(()=>{const s={...DEFAULT_SETTINGS,...data.settings};if(document.documentElement.dataset.reduceMotion!==String(s.reduceMotion))document.documentElement.dataset.reduceMotion=String(s.reduceMotion);try{localStorage.setItem('studio-reduce-motion',String(s.reduceMotion));}catch{}document.documentElement.style.setProperty('--user-accent',s.accent);},[data.settings]);
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);

  // 启动守卫：只标记初始化，保留已有业务数据。
  useEffect(() => {
    ensureFirstRun();
    const publicPages = ["/about", "/login", "/register"];
    if (!publicPages.includes(pathname)) {
      const user = getCurrentUser();
      if (!user) {
        router.replace(hasAnyAccount() ? "/login" : "/about");
        return;
      }
    }
    // Session was verified by the server before rendering the workspace.
    const scopes=getSessionUser()?.scopes??[];if((pathname.startsWith('/admin')||pathname==='/settings/print')&&!scopes.includes('settings:write')||pathname.startsWith('/finance')&&!scopes.includes('finance:read')||pathname==='/orders/new'&&!scopes.includes('orders:write')){router.replace('/settings');return;}
  }, [pathname, router]);


  return <div className="studio-shell" data-menu={menuOpen}>
    <StartupSafety/>
    {menuOpen && <button className="sidebar-scrim" aria-label={t("关闭导航","Close navigation")} onClick={() => setMenuOpen(false)} />}
    <Owl className="owl-watermark"/><Sidebar /><div className="studio-body"><header className="studio-header"><button type="button" className="mobile-menu" aria-label={t("打开导航","Open navigation")} aria-expanded={menuOpen} aria-controls="studio-navigation" onClick={() => setMenuOpen(!menuOpen)}><Menu size={18} /></button><span className="breadcrumb">{interfaceText(data.settings?.name??DEFAULT_SETTINGS.name,language)}</span><div className="studio-header-tools"><ClockPanel /><Appearance /></div></header><main className="studio-main" id="main-content"><DailyLine/>{(pathname==='/orders/new'||/^\/orders\/[^/]+$/.test(pathname)||pathname.startsWith('/pre/')||pathname.startsWith('/post/')||pathname==='/admin')&&<FinancialNotice/>}{children}</main><Footer /></div>
    {cliOpen && getSessionUser()?.role === 'owner' && <div className="v3-cli-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeCLI(); }}><div className="v3-cli-dialog" role="dialog" aria-modal="true" aria-label={t("超级管理员命令面板","Super Administrator command panel")}><CLIPanel onClose={closeCLI}/></div></div>}
  </div>;
}

/* ============ 页脚署名 ============ */

export function Footer() {
  const language=useStudioLanguage();
  const {data}=useStudio();
  return <footer className="studio-footer"><span>© {new Date().getFullYear()} {interfaceText(data.settings?.name??DEFAULT_SETTINGS.name,language)}</span><span>{interfaceText(data.settings?.tagline??DEFAULT_SETTINGS.tagline,language)}</span></footer>;
}
