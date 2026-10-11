// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
// ============ 订单结束结算单 · HTML 生成 ============
// 生成完整 HTML 文档（内联样式，文本形式），用于：
//  1) 订单结束打印页预览与截图（html-to-image 抓取）
//  2) 上传 Git 备份（非二进制文本，避免仓库膨胀）
import {paren} from './interface-text';
import { paymentMethodLabel, type PaymentMethod } from "@/lib/types";
import { paidAmount as paidAmountOf, planOf, stageAmount, type InstallmentStage } from "./payment-plan";
import {formatStudioMoney,type StudioCurrency} from './money';
import {interfaceText} from './interface-text';
import {formatZoned,offsetLabel} from './time-zone';
import {PRINT_FINANCIAL_NOTICE_EN,PRINT_FINANCIAL_NOTICE_ZH} from './print-language';
import type {StudioLanguage} from './i18n';

/** 金额取整到分 */
export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface SummaryEquipmentRow {
  code: string;
  name: string;
  brand: string;
  category: string;
}
export interface SummarySdCard {
  code: string;
  name: string;
  brand: string;
}
export interface SummaryExtraRow {
  name: string;
  detail: string;
  amount: number;
}
export interface SummaryPayRow {
  stage: number;
  name: string;
  rate: number;
  amt: number;
  paid: boolean;
  method: string;
}
export interface SummaryData {
  currency?:StudioCurrency;
  /** 页眉显示的工作室名称 */
  studioName?: string;
  language?:StudioLanguage;
  orderNo: string;
  customerName: string;
  customerTypeName: string;
  shootTime: string;
  location: string;
  photographer: string;
  packageName: string;
  packagePrice?: number;
  extraRows: SummaryExtraRow[];
  totalPrice: number;
  equipmentRows: SummaryEquipmentRow[];
  sdCard?: SummarySdCard;
  sdCards?: SummarySdCard[];
  softwares: string[];
  payRows: SummaryPayRow[];
  paidStage: number;
  paidAmount: number;
  refund?: { amount: number; rate: number; ruleText: string; at: string } | null;
  expense?: number;
  expenseNote?: string;
  balance: number;
  generatedAt: string;
}

export function escapeHtml(text: string): string { return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }
function safeStrings<T>(value: T): T {
  if (typeof value === 'string') return escapeHtml(value) as T;
  if (Array.isArray(value)) return value.map(safeStrings) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,safeStrings(v)])) as T;
  return value;
}
export interface SummaryCopy { summaryTitle: string; serviceTitle: string; totalTitle: string; extraNote: string; footer: string }
const summaryDefaultsEn:SummaryCopy={summaryTitle:'Order payment summary',serviceTitle:'Services',totalTitle:'Order total',extraNote:'',footer:''};
const summaryDefaults: SummaryCopy = { summaryTitle: '摄影服务结算单', serviceTitle: '服务内容', totalTitle: '订单合计', extraNote: '', footer: '' };
/** 结算单内容区（body 内部，页面用 dangerouslySetInnerHTML 渲染，样式内联） */
export function buildSummaryBodyHtml(o: SummaryData, copy?: SummaryCopy): string {
  const language=o.language??'zh',en=language==='en',text=(value:string)=>interfaceText(value,language);
  o = safeStrings(o); copy = safeStrings(copy??(en?summaryDefaultsEn:summaryDefaults));
  const money=(n:number)=>formatStudioMoney(n,o.currency??'CNY',o.language??'zh');
  const infoRows: string[] = [];
  const row = (label: string, value: string) =>
    infoRows.push(
      `<div style="display:flex;padding:4px 0;"><span style="width:140px;flex-shrink:0;color:#71717a;">${text(label)}</span><span style="font-weight:500;color:#27272a;">${value || "—"}</span></div>`,
    );
  row("客户姓名", o.customerName);
  row("客户类型", o.customerTypeName);
  row("拍摄时间", o.shootTime);
  row("拍摄地点", o.location);
  row("拍摄人", o.photographer);

  const extraHtml =
    o.extraRows.length === 0
      ? `<div style="padding:4px 0;color:#a1a1aa;">${text("（无附加服务）")}</div>`
      : o.extraRows
          .map(
            (e) =>
              `<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>· ${e.name}${e.detail ? paren(e.detail,language) : ""}</span><span style="font-weight:500;">${money(e.amount)}</span></div>`,
          )
          .join("");

  const equipmentHtml =
    o.equipmentRows.length === 0 && !(o.sdCards?.length || o.sdCard)
      ? `<div style="padding:4px 0;color:#a1a1aa;">${text("（未选择设备）")}</div>`
      : [
          ...o.equipmentRows.map(
            (e) =>
              `<div style="padding:3px 0;">${e.code} · ${e.name}${paren(e.brand || e.category || "—",language)}</div>`,
          ),
          ...(o.sdCards ?? (o.sdCard ? [o.sdCard] : [])).map(card=>`<div style="padding:3px 0;">${en?'Memory card':'存储卡'} · ${card.code} · ${card.name}${paren(card.brand || "—",language)}</div>`),
        ].join("");

  const payHtml = o.payRows
    .map(
      (p) =>
        `<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>${en?'Instalment '+p.stage:'第'+p.stage+'期'} · ${text(p.name)}${paren(Math.round(p.rate * 1000) / 10+'%',language)}${p.paid ? ` · ${text(p.method)}` : ""}</span><span style="${p.paid ? "font-weight:600;color:#16a34a;" : "color:#a1a1aa;"}">${p.paid ? money(p.amt) : text("未付")}</span></div>`,
    )
    .join("");

  const refundHtml = o.refund
    ? `<div style="padding:4px 0;">${text('已退款')} ${money(o.refund.amount)}（${Math.round(o.refund.rate * 100)}% · ${o.refund.ruleText} · ${o.refund.at}）</div>`
    : `<div style="padding:4px 0;color:#a1a1aa;">${text("无")}</div>`;

  return `<div style="width:760px;background:#fff;padding:40px 48px;color:#18181b;font-family:'Microsoft YaHei','PingFang SC','Hiragino Sans GB',sans-serif;">
  <div style="display:flex;justify-content:space-between;font-size:11px;color:#a1a1aa;">
    <span>${o.studioName ?? ''}</span>
    <span>${en?'Order payment summary':'摄影服务结算单（订单结束）'}</span>
  </div>
  <h1 style="margin:14px 0 0;text-align:center;font-size:26px;font-weight:700;letter-spacing:2px;">${copy.summaryTitle}</h1>
  <p style="margin:6px 0 0;text-align:center;font-family:Consolas,monospace;font-size:15px;font-weight:600;color:#d97706;">${o.orderNo}</p>
  <div style="margin:20px 0;border-top:1px solid #e4e4e7;"></div>

  <div style="font-size:14px;font-weight:700;margin-bottom:6px;">${text("客户与拍摄信息")}</div>
  <div style="font-size:13px;">${infoRows.join("")}</div>
  <div style="margin:18px 0;border-top:1px solid #e4e4e7;"></div>

  <div style="font-size:14px;font-weight:700;margin-bottom:6px;">${copy.serviceTitle}</div>
  <div style="font-size:13px;">
    <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>${text('套餐')} · ${o.packageName}</span>${o.packagePrice != null ? `<span style="font-weight:500;">${money(o.packagePrice)}</span>` : ""}</div>
    ${extraHtml}
    <div style="margin:10px 0;border-top:1px solid #e4e4e7;"></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-size:14px;font-weight:700;">${copy.totalTitle}</span><span style="font-size:20px;font-weight:700;color:#d97706;">${money(o.totalPrice)}</span></div>
  </div>
  <div style="margin:18px 0;border-top:1px solid #e4e4e7;"></div>

  <div style="font-size:14px;font-weight:700;margin-bottom:6px;">${text("设备 · 硬件 · 软件")}</div>
  <div style="font-size:13px;">
    <div style="color:#71717a;font-size:12px;margin-top:4px;">${text("设备与硬件")}</div>
    ${equipmentHtml}
    <div style="color:#71717a;font-size:12px;margin-top:8px;">${text("后期软件")}</div>
    <div style="padding:3px 0;">${o.softwares.length ? o.softwares.map(text).join(en?', ':'、') : text("（未选择软件）")}</div>
  </div>
  <div style="margin:18px 0;border-top:1px solid #e4e4e7;"></div>

  <div style="font-size:14px;font-weight:700;margin-bottom:6px;">${text("收款 · 支出 · 结算")}</div>
  <div style="font-size:13px;">
    <div style="color:#71717a;font-size:12px;margin-top:4px;">${en?'Payment progress ('+o.paidStage+'/'+o.payRows.length+' paid)':'付款进度（已付 '+o.paidStage+'/'+o.payRows.length+' 期）'}</div>
    ${payHtml}
    <div style="color:#71717a;font-size:12px;margin-top:8px;">${text("已收款合计")}</div>
    <div style="padding:3px 0;font-weight:600;color:#16a34a;">${money(o.paidAmount)}</div>
    <div style="color:#71717a;font-size:12px;margin-top:8px;">${text("退款")}</div>
    ${refundHtml}
    <div style="color:#71717a;font-size:12px;margin-top:8px;">${text("本单支出")}</div>
    <div style="padding:3px 0;">${o.expense != null ? `${money(o.expense)}${o.expenseNote ? paren(o.expenseNote,language) : ""}` : text("（未填写）")}</div>
    <div style="margin:10px 0;border-top:1px solid #e4e4e7;"></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-size:14px;font-weight:700;">${text("本单结余（实收-退款-支出）")}</span><span style="font-size:20px;font-weight:700;color:#d97706;">${money(o.balance)}</span></div>
  </div>

  <p style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;">${copy.extraNote}</p>
  <p style="white-space:pre-wrap;overflow-wrap:anywhere;text-align:center;font-size:12px;color:#71717a;">${copy.footer}</p>
  <p style="margin-top:16px;padding:10px;border:1px solid #d4d4d8;font-size:11px;color:#52525b;line-height:1.6;">${en?PRINT_FINANCIAL_NOTICE_EN:PRINT_FINANCIAL_NOTICE_ZH}</p>
  <div style="margin-top:24px;text-align:center;font-size:11px;color:#a1a1aa;">${en?'Generated':'本单生成时间'}: ${o.generatedAt}</div>
</div>`;
}

/** 结算单完整 HTML 文档（上传 Git 用，文本形式） */
export function buildSummaryHtml(o: SummaryData, copy?: SummaryCopy): string {
  return `<!DOCTYPE html>
<html lang="${o.language==='en'?'en':'zh-CN'}">
<head><meta charset="utf-8"><title>${o.language==='en'?'Order payment summary':'结算单'} ${escapeHtml(o.orderNo)}</title></head>
<body style="margin:0;background:#f4f4f5;padding:24px;">
${buildSummaryBodyHtml(o, copy)}
</body>
</html>`;
}

/** 从订单数据组装结算单（订单 + 前期/后期工单 + 设备台账） */
export function buildSummaryData(opts: {
  currency?:StudioCurrency;
  studioName?: string;
  language?:StudioLanguage;
  order: {
    orderNo: string;
    customerName: string;
    customerTypeName: string;
    shootTime: string;
    location: string;
    photographer?: string;
    packageTierId?: string;
    packageTierName?: string;
    extras?: { id: string; name: string; price?: number; perUnit?: boolean; unitName?: string; note?: string }[];
    extraQty?: Record<string, number>;
    totalPrice?: number;
    paymentStage?: number;
    paymentMethods?: Record<number, PaymentMethod>;
    paymentPlan?: InstallmentStage[];
    refund?: { amount: number; rate: number; ruleText: string; at: string } | null;
  };
  packagePrice?: number;
  equipmentCodes: string[];
  sdCardCode?: string;
  sdCardCodes?: string[];
  softwares: string[];
  expense?: number;
  expenseNote?: string;
  equipments: { code: string; name: string; brand: string; category: string }[];
  displayDateTime: (s?: string) => string;
}): SummaryData {
  const o = opts.order;
  const text=(value:string)=>interfaceText(value,opts.language??'zh');
  const totalPrice = o.totalPrice ?? 0;
  const plan = planOf(o);
  const paidStage = Math.min(o.paymentStage ?? 0, plan.length);
  const paidAmount = paidAmountOf(totalPrice, plan, paidStage);
  const refundAmount = o.refund?.amount ?? 0;
  const expense = opts.expense ?? 0;
  const balance = r2(paidAmount - refundAmount - expense);

  const equipMap = new Map(opts.equipments.map((e) => [e.code, e]));
  const equipmentRows: SummaryEquipmentRow[] = opts.equipmentCodes
    .map((code) => equipMap.get(code))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .map((e) => ({ code: e.code, name: e.name, brand: e.brand, category: e.category }));
  const sdCards = [...new Set(opts.sdCardCodes ?? (opts.sdCardCode ? [opts.sdCardCode] : []))].map(code=>equipMap.get(code)).filter((e): e is NonNullable<typeof e>=>!!e).map(e=>({code:e.code,name:e.name,brand:e.brand}));
  const sd = opts.sdCardCode ? equipMap.get(opts.sdCardCode) : null;
  const sdCard: SummarySdCard | undefined = sd
    ? { code: sd.code, name: sd.name, brand: sd.brand }
    : undefined;

  const extraRows: SummaryExtraRow[] = (o.extras ?? []).map((e) => {
    const qty = e.perUnit ? (o.extraQty?.[e.id] ?? 1) : 1;
    return {
      name: e.name,
      detail: e.perUnit ? `${qty}${text(e.unitName ?? "")}` : (e.note ?? ""),
      amount: r2((e.price ?? 0) * qty),
    };
  });

  const payRows: SummaryPayRow[] = plan.map((p, index) => {
    const stage = index + 1, paid = paidStage >= stage;
    return {
      stage,
      name: p.name,
      rate: p.rate,
      amt: stageAmount(totalPrice, plan, index),
      paid,
      method: paid ? paymentMethodLabel(o.paymentMethods?.[stage]) : "",
    };
  });

  return {
    currency:opts.currency??'CNY',
    language:opts.language??'zh',
    studioName: opts.studioName,
    orderNo: o.orderNo,
    customerName: o.customerName,
    customerTypeName: o.customerTypeName,
    shootTime: opts.displayDateTime(o.shootTime),
    location: o.location || "—",
    photographer: o.photographer || "—",
    packageName: o.packageTierName ?? "—",
    packagePrice: opts.packagePrice,
    extraRows,
    totalPrice,
    equipmentRows,
    sdCard,
    sdCards,
    softwares: opts.softwares,
    payRows,
    paidStage,
    paidAmount,
    refund: o.refund
      ? {
          amount: o.refund.amount,
          rate: o.refund.rate,
          ruleText: o.refund.ruleText,
          at: opts.displayDateTime(o.refund.at),
        }
      : null,
    expense: opts.expense,
    expenseNote: opts.expenseNote,
    balance,
    generatedAt: `${formatZoned(new Date())} (${offsetLabel(new Date())})`,
  };
}
