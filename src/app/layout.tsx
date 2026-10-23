// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import type { Metadata } from "next";
import "./globals.css";
import "./studio.css";
import "./atelier.css";
import "./upgrade.css";
import "./v240.css";
import "./v300.css";
import "./lighting.css";

import {UIEffects} from '@/components/biz/ui-effects';
import {AuthRoot} from "@/components/biz/auth-root";

export const metadata: Metadata = {
  title: "观隅 · Limet Otus Studio",
  description: "摄影工作室的订单、档期、前后期工单、设备与交付管理",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:"try{if(localStorage.getItem('limet-studio-language')==='en'){document.documentElement.lang='en';document.title='Limet Otus Studio';}}catch(e){}"}}/><script dangerouslySetInnerHTML={{__html:"try{var p=localStorage.getItem('studio-appearance');document.documentElement.dataset.theme=p==='light'||p==='system'&&matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.reduceMotion=localStorage.getItem('studio-reduce-motion')==='true'?'true':'false';}catch(e){document.documentElement.dataset.theme='dark'}"}}/></head>
      <body className="min-h-screen antialiased">
        <AuthRoot>{children}</AuthRoot><UIEffects/>
      </body>
    </html>
  );
}
