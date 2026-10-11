// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/**
 * Copyright (C) 2026 博成 · FMLC 中成博成
 */

'use client';
import {useStudioLanguage as useViewLanguage} from '@/lib/i18n';
import {interfaceText as localeText} from '@/lib/interface-text';
import {useStudioText as useInterfaceText,useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import {interfaceText} from '@/lib/interface-text';
import {getSessionUser} from '@/lib/auth';

import Link from "next/link";
import { useMemo } from "react";
import { useStudio } from "@/lib/store";
import { STAGE_LABELS, displayDateTime } from "@/lib/studio";
import { paidAmount, planOf } from "@/lib/payment-plan";
import type { Order, OrderStage, PostOrder, PreOrder } from "@/lib/types";
import { AppShell, Badge, Card, Empty, Money, SectionTitle } from "@/components/biz/ui";
import {FinancialNotice} from '@/components/biz/financial-notice';

function deriveStage(o: Order, pre?: PreOrder, post?: PostOrder): OrderStage {
  if (post?.status === "completed") return "done";
  if (post?.status === "in_progress") return "post";
  if (pre?.status === "completed") return "post";
  if (pre?.status === "in_progress") return "shooting";
  return "prep";
}

function stageTone(stage: OrderStage) {
  switch (stage) {
    case "prep":
      return "blue" as const;
    case "shooting":
      return "amber" as const;
    case "post":
      return "purple" as const;
    case "done":
      return "green" as const;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function FinancePage() {
 const viewLanguage=useViewLanguage();

 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

 if(!['owner','admin'].includes(getSessionUser()?.role??''))return <AppShell><p>{uiText("此参考页由管理者查看。","This reference page is available to administrators.")}</p></AppShell>;
  const { data } = useStudio();

  const rows = useMemo(() => {
    return data.orders
      .map((o) => {
        const pre = data.preOrders.find((p) => p.orderId === o.id);
        const post = data.postOrders.find((p) => p.orderId === o.id);
        const stage = deriveStage(o, pre, post);
        const income = paidAmount(o.totalPrice ?? 0, planOf(o), o.paymentStage ?? 0);
        const expense = pre?.expense ?? 0;
        const refund = round2(o.refund?.amount ?? 0);
        return {
          order: o,
          pre,
          stage,
          income,
          expense,
          refund,
          net: round2(income - expense - refund),
        };
      })
      .sort((a, b) => (b.order.createdAt ?? "").localeCompare(a.order.createdAt ?? ""));
  }, [data.orders, data.preOrders, data.postOrders]);

  const totalIncome = round2(rows.reduce((s, r) => s + r.income, 0));
  const totalRefund = round2(rows.reduce((s, r) => s + r.refund, 0));
  const totalExpense = round2(rows.reduce((s, r) => s + r.expense, 0));
  const totalNet = round2(totalIncome - totalExpense - totalRefund);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl">
        <div className="finance-intro">
          <h1 className="text-xl font-bold text-zinc-800">{uiText("运营趋势","Operating trends")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{uiText("按订单当前收款进度计算收入，扣除已记录退款及前期工单预计支出。这里展示经营估算，方便对账。","Estimates receipts from payment stages, less recorded refunds and planned shoot expenses. Use original records to verify these estimates.")}</p>
        </div>
        <FinancialNotice/>

        {/* 汇总卡片 */}
        <div className="finance-metrics">
          <Card className="p-5">
            <p className="text-sm text-zinc-500">{uiText("累计收入（阶段估算）","Receipts (stage estimate)")}</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">
              <Money value={totalIncome} />
            </p>
            <p className="mt-1 text-xs text-zinc-400">{uiText("共","Total: ")}{rows.length}{uiText("单 · 收款比例按订单已付期数计算"," orders · Estimated from paid instalments")}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-zinc-500">{uiText("累计退款","Total refunds")}</p>
            <p className="mt-2 text-2xl font-bold text-red-500">
              <Money value={totalRefund} />
            </p>
            <p className="mt-1 text-xs text-zinc-400">{uiText("按约定退款与全额退款","Refunds under agreed terms and full refunds")}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-zinc-500">{uiText("累计支出（预计）","Planned expenses")}</p>
            <p className="mt-2 text-2xl font-bold text-red-500">
              <Money value={totalExpense} />
            </p>
            <p className="mt-1 text-xs text-zinc-400">{uiText("来自前期工单预填的拍摄成本","Planned costs recorded on shoot tasks")}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-zinc-500">{uiText("预计结余","Estimated balance")}</p>
            <p className={`mt-2 text-2xl font-bold ${totalNet < 0 ? "text-red-500" : "text-emerald-600"}`}>
              <Money value={totalNet} />
            </p>
            <p className="mt-1 text-xs text-zinc-400">{uiText("已收款 − 已退款 − 预计支出","Receipts − refunds − planned expenses")}</p>
          </Card>
        </div>

        {/* 明细表 */}
        <Card className="finance-ledger">
          <SectionTitle right={<Badge tone="amber">{uiText("按订单统计","By order")}</Badge>}>{uiText("按订单查看收支","Receipts and expenses by order")}</SectionTitle>
          {rows.length === 0 ? (
            <Empty text={localeText("暂无订单",viewLanguage)} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                    <th className="py-2 pr-3 font-medium">{uiText("订单号","Order number")}</th>
                    <th className="py-2 pr-3 font-medium">{uiText("客户","Client")}</th>
                    <th className="py-2 pr-3 font-medium">{uiText("拍摄时间","Shoot time")}</th>
                    <th className="py-2 pr-3 font-medium">{localeText("阶段",viewLanguage)}</th>
                    <th className="py-2 pr-3 text-right font-medium">{uiText("收入","Receipts")}</th>
                    <th className="py-2 pr-3 text-right font-medium">{uiText("退款","Refund")}</th>
                    <th className="py-2 pr-3 text-right font-medium">{uiText("支出","Expenditure")}</th>
                    <th className="py-2 pr-3 text-right font-medium">{uiText("净收入","Estimated balance")}</th>
                    <th className="py-2 font-medium">{uiText("支出说明","Expense notes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.order.id} className="border-b border-zinc-100 hover:bg-zinc-50/60">
                      <td className="py-2.5 pr-3">
                        <Link href={`/orders/${r.order.id}`} className="font-mono text-xs text-amber-600 hover:underline">
                          {r.order.orderNo}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-zinc-700">{r.order.customerName}</td>
                      <td className="py-2.5 pr-3 text-zinc-500">{displayDateTime(r.order.shootTime)}</td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={stageTone(r.stage)}>{interfaceText(STAGE_LABELS[r.stage],uiLanguage)}</Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className={r.income > 0 ? "text-amber-600" : "text-zinc-400"}>
                          {r.income > 0 ? <Money value={r.income}/> : "—"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className={r.refund > 0 ? "text-red-500" : "text-zinc-400"}>
                          {r.refund > 0 ? <Money value={r.refund}/> : "—"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className={r.expense > 0 ? "text-red-500" : "text-zinc-400"}>
                          {r.expense > 0 ? <Money value={r.expense}/> : "—"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className={r.net < 0 ? "font-semibold text-red-500" : "font-semibold text-emerald-600"}>
                          <Money value={r.net}/>
                        </span>
                      </td>
                      <td className="py-2.5 text-xs text-zinc-500">
                        {r.pre?.expenseNote ? (
                          <span title={uiText(`前期工单 ${r.pre?.preNo??''}`,`Shoot task ${r.pre?.preNo??''}`)}>{r.pre.expenseNote}</span>
                        ) : r.expense > 0 ? (
                          uiText("（无说明）","No notes")
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
