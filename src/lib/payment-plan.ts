// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/** Instalment plans and refund rules, shared by the interface, print documents and the server. */

export interface InstallmentStage { name: string; desc?: string; rate: number }
/** Refund `rate` of the payments received when the shoot is at least `minDays` away. */
export interface RefundRule { minDays: number; rate: number }

export const MAX_INSTALLMENTS = 12;
const EPSILON = 1e-6;

export const DEFAULT_INSTALLMENTS: Record<'zh' | 'en', InstallmentStage[]> = {
  zh: [
    { name: '订金', desc: '签订订单时支付', rate: 0.35 },
    { name: '现场款', desc: '摄影师抵达现场时支付', rate: 0.3 },
    { name: '拍摄款', desc: '拍摄完成时支付', rate: 0.2 },
    { name: '尾款', desc: '全部交付完毕时支付', rate: 0.15 },
  ],
  en: [
    { name: 'Booking payment', desc: 'On booking', rate: 0.35 },
    { name: 'On-site payment', desc: 'When the photographer arrives', rate: 0.3 },
    { name: 'Shoot payment', desc: 'At the end of the shoot', rate: 0.2 },
    { name: 'Final payment', desc: 'On completion of delivery', rate: 0.15 },
  ],
};

export const DEFAULT_REFUND_RULES: RefundRule[] = [
  { minDays: 30, rate: 1 },
  { minDays: 15, rate: 0.7 },
  { minDays: 7, rate: 0.4 },
  { minDays: 4, rate: 0.1 },
  { minDays: 0, rate: 0 },
];

type WithPlan = { paymentPlan?: InstallmentStage[]; refundRules?: RefundRule[] };
type WithSettings = { installments?: InstallmentStage[]; refundRules?: RefundRule[] } | undefined;

/** Plan agreed for an order; orders created before plans were stored use the original four stages. */
export function planOf(order?: WithPlan | null, settings?: WithSettings): InstallmentStage[] {
  if (order?.paymentPlan?.length) return order.paymentPlan;
  if (!order && settings?.installments?.length) return settings.installments;
  return DEFAULT_INSTALLMENTS.zh;
}
export function refundRulesOf(order?: WithPlan | null, settings?: WithSettings): RefundRule[] {
  if (order?.refundRules?.length) return order.refundRules;
  if (!order && settings?.refundRules?.length) return settings.refundRules;
  return DEFAULT_REFUND_RULES;
}

/** Cumulative share paid after `stage` instalments (0…plan length). */
export function cumulativeRate(plan: InstallmentStage[], stage: number): number {
  return plan.slice(0, Math.max(0, Math.min(stage, plan.length))).reduce((sum, item) => sum + item.rate, 0);
}

/** Amount of one instalment in minor units, rounded so all instalments add up to the total exactly. */
export function stageCents(totalCents: number, plan: InstallmentStage[], index: number): number {
  return Math.round(totalCents * cumulativeRate(plan, index + 1)) - Math.round(totalCents * cumulativeRate(plan, index));
}
export function stageAmount(total: number, plan: InstallmentStage[], index: number): number {
  return stageCents(Math.round(total * 100), plan, index) / 100;
}
export function paidAmount(total: number, plan: InstallmentStage[], stage: number): number {
  return Math.round(Math.round(total * 100) * cumulativeRate(plan, stage)) / 100;
}

/** Highest matching tier; the lowest tier applies when none matches. */
export function refundRuleFor(days: number, rules: RefundRule[]): RefundRule {
  const sorted = [...rules].sort((a, b) => b.minDays - a.minDays);
  return sorted.find((rule) => days >= rule.minDays) ?? sorted[sorted.length - 1] ?? { minDays: 0, rate: 0 };
}

/** Human-readable range for a tier, e.g. "15–29 天" / "15–29 days". */
export function refundRangeLabel(rules: RefundRule[], rule: RefundRule, language: string): string {
  const sorted = [...rules].sort((a, b) => b.minDays - a.minDays);
  const index = sorted.indexOf(rule), upper = index > 0 ? sorted[index - 1].minDays - 1 : null;
  const en = language === 'en';
  if (upper === null) return en ? `${rule.minDays} or more days before the shoot` : `距拍摄日 ${rule.minDays} 天及以上`;
  if (upper <= rule.minDays) return en ? `${rule.minDays} days before the shoot` : `距拍摄日 ${rule.minDays} 天`;
  if (rule.minDays === 0) return en ? `Within ${upper} days, including the shoot date` : `距拍摄日 ${upper} 天以内（含当天）`;
  return en ? `${rule.minDays}–${upper} days before the shoot` : `距拍摄日 ${rule.minDays}–${upper} 天`;
}
export function refundRateLabel(rate: number, language: string): string {
  const percent = Math.round(rate * 1000) / 10;
  if (language === 'en') return percent === 0 ? 'No refund' : `${percent}% of payments received`;
  return percent === 0 ? '不予退款' : `退还已付款项的 ${percent}%`;
}

/** Throws a message suitable for the interface when a plan or rule set is invalid. */
export function validateInstallments(plan: unknown): InstallmentStage[] {
  if (!Array.isArray(plan) || plan.length < 1 || plan.length > MAX_INSTALLMENTS) throw new Error(`分期数须为 1–${MAX_INSTALLMENTS} 期`);
  const clean = plan.map((raw) => {
    const item = raw as InstallmentStage;
    const name = String(item?.name ?? '').trim().slice(0, 40), desc = String(item?.desc ?? '').trim().slice(0, 80);
    if (!name) throw new Error('每一期都需要名称');
    if (typeof item.rate !== 'number' || !Number.isFinite(item.rate) || item.rate <= 0 || item.rate > 1) throw new Error('每期比例须大于 0% 且不超过 100%');
    return { name, ...(desc ? { desc } : {}), rate: Math.round(item.rate * 10000) / 10000 };
  });
  if (Math.abs(clean.reduce((sum, item) => sum + item.rate, 0) - 1) > EPSILON) throw new Error('各期比例相加须等于 100%');
  return clean;
}
export function validateRefundRules(rules: unknown): RefundRule[] {
  if (!Array.isArray(rules) || rules.length < 1 || rules.length > 20) throw new Error('退款规则须为 1–20 条');
  const clean = rules.map((raw) => {
    const rule = raw as RefundRule;
    if (!Number.isInteger(rule?.minDays) || rule.minDays < 0 || rule.minDays > 3650) throw new Error('天数须为 0–3650 的整数');
    if (typeof rule.rate !== 'number' || !Number.isFinite(rule.rate) || rule.rate < 0 || rule.rate > 1) throw new Error('退款比例须为 0%–100%');
    return { minDays: rule.minDays, rate: Math.round(rule.rate * 10000) / 10000 };
  }).sort((a, b) => b.minDays - a.minDays);
  if (new Set(clean.map((rule) => rule.minDays)).size !== clean.length) throw new Error('退款规则的天数不能重复');
  if (clean[clean.length - 1].minDays !== 0) throw new Error('须包含从 0 天开始的规则');
  return clean;
}
