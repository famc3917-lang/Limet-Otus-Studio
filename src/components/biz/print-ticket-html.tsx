// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {paren} from '@/lib/interface-text';
import {useStudioText as useInterfaceText,useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';

import { PRINT_DEFAULTS, PRINT_DEFAULTS_EN, type PrintCopy } from "./print-editor";
import { forwardRef } from "react";
import {formatStudioMoney} from '@/lib/money';
import type { PrintTicketData } from "@/lib/print-ticket";

/**
 * 订单打印单 · HTML 版（订单创建后的确认单）
 * 用 HTML/CSS 排版（效果比 Canvas 精致），导出图片时由 html-to-image 抓取本节点转 PNG。
 * 注意：确认单不含个人信息保护声明，声明只在订单创建前的预定单中出现。
 */
export const PrintTicketHtml = forwardRef<HTMLDivElement, { d: PrintTicketData; copy?: PrintCopy }>(
  function PrintTicketHtml({ d, copy:providedCopy }, ref) {
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

    const copy=providedCopy??(uiLanguage==='en'?PRINT_DEFAULTS_EN:PRINT_DEFAULTS);
    const o = d.order;
    return (
      <div
        id="print-ticket"
        ref={ref}
        className="print-paper w-[760px] bg-white px-12 py-10 text-zinc-900"
        style={{ fontFamily: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif' }}
      >
        {/* 顶部 */}
        <div className="flex items-start justify-between text-[11px] text-zinc-400">
          <span>{d.signatureName}</span>
          <span>{copy.title}</span>
        </div>
        <h1 className="mt-3 text-center text-[26px] font-bold tracking-wide">{copy.title}</h1>
        <p className="mt-1 text-center font-mono text-[15px] font-semibold text-amber-600">
          {o.orderNo}
        </p>
        <div className="my-5 border-t border-zinc-200" />

        {/* 客户信息（两列） */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {d.infoRows.map((row, i) => (
            <div key={i} className="flex">
              <span className="w-28 shrink-0 text-zinc-500">{row.label}</span>
              <span className="font-medium text-zinc-800">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="my-5 border-t border-zinc-200" />

        {/* 服务内容 */}
        <div className="text-sm">
          <div className="mb-2 text-[15px] font-bold">{copy.serviceTitle}</div>
          <div className="flex items-center justify-between py-1">
            <span>{uiText('套餐','Package')} · {d.packageRow.name}</span>
            {d.packageRow.price != null && (
              <span className="font-medium">{formatStudioMoney(d.packageRow.price,d.currency,d.language)}</span>
            )}
          </div>
          {d.extraRows.length === 0 ? (
            <div className="py-1 text-zinc-400">{uiText("（无附加服务）","No additional services")}</div>
          ) : (
            d.extraRows.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span>{r.detail ? `· ${r.name}${paren(r.detail,uiLanguage)}` : `· ${r.name}`}</span>
                <span className={r.amount < 0 ? "font-medium text-green-600" : "font-medium"}>
                  {formatStudioMoney(r.amount,d.currency,d.language)}
                </span>
              </div>
            ))
          )}
          <div className="my-3 border-t border-zinc-200" />
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-bold">{copy.totalTitle}</span>
            <span className="text-xl font-bold text-amber-600">{formatStudioMoney(d.total,d.currency,d.language)}</span>
          </div>
        </div>

        {d.note && (
          <>
            <div className="my-5 border-t border-zinc-200" />
            <div className="text-sm">
              <div className="mb-2 text-[15px] font-bold">{copy.noteTitle}</div>
              <p className="whitespace-pre-wrap text-zinc-600">{d.note}</p>
            </div>
          </>
        )}

        {copy.extraNote && <p className="mt-5 whitespace-pre-wrap text-sm text-zinc-600">{copy.extraNote}</p>}
        <p className="mt-5 text-center text-xs text-zinc-500">{copy.footer}</p>
        <p className="mt-5 border border-zinc-200 p-3 text-[11px] leading-relaxed text-zinc-500">{uiText('金额仅供内部参考，不保证准确；不可用于记账、报税或代替原始凭证。','Amounts are estimates only and may be inaccurate. Not for bookkeeping, tax filing or statutory financial evidence.')}</p>
        <div className="mt-6 text-center text-[11px] text-zinc-400">
          {uiText('日期','Date')}: {d.generatedAt}
        </div>
      </div>
    );
  },
);

