// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText,useStudioLanguage} from '@/lib/i18n';
import {interfaceText} from '@/lib/interface-text';
import {useUnsavedChanges} from '@/components/biz/navigation-guard';
import { notifyUser } from '@/components/biz/dialogs';

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useStudio } from "@/lib/store";
import { displayDateTime, genderLabel, toPreNo } from "@/lib/studio";
import {
  AppShell,
  Badge,
  Btn,
  Card,
  Empty,
  Field,
  Money,
  SectionTitle,
  TextInput,
} from "@/components/biz/ui";

function PreNewInner() {

 const uiText=useStudioText(),uiLanguage=useStudioLanguage();

  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const { data, createPreOrder } = useStudio();

  const order = data.orders.find((o) => o.id === orderId);
  const existing = data.preOrders.find((p) => p.orderId === orderId);

  // 预计支出（创建前期工单时预填，用于收支统计）
  const [expense, setExpense] = useState("");
  const [expenseNote, setExpenseNote] = useState("");

  const markSubmitted=useUnsavedChanges(JSON.stringify({expense,expenseNote}));

  useEffect(() => { if (existing) router.replace(`/pre/${existing.id}`); }, [existing, router]);
  if (existing) return null;

  if (!order) {
    return (
      <AppShell>
        <Empty text={orderId ? uiText("订单不存在或已被删除","This order does not exist or has been deleted") : uiText("请先选择订单，再创建关联工单","Select an order before creating a linked task")} />
        <div className="mt-4 text-center">
          <Link href="/orders">
            <Btn>{uiText("选择订单","Select order")}</Btn>
          </Link>
        </div>
      </AppShell>
    );
  }

  const handleCreate = async () => {
    if (expense && (!Number.isFinite(Number(expense)) || Number(expense) < 0)) return void notifyUser(uiText("预计支出不能为负数或无效金额。","Expenditure must be a valid non-negative amount."));
    const created = createPreOrder({
      preNo: toPreNo(order.orderNo),
      orderId: order.id,
      customerName: order.customerName,
      customerTypeName: order.customerTypeName,
      packageTierName: order.packageTierName,
      gender: order.gender,
      adult: order.adult,
      shootTime: order.shootTime,
      location: order.location,
      equipmentCodes: [],
      sdCardCode: undefined,
      photographer: order.photographer ?? "",
      expense: expense ? Number(expense) : undefined,
      expenseNote: expenseNote || undefined,
      roleName: "",
      styleIds: [],
      styleNames: [],
      signature: order.signature,
      status: "pending",
    });
    markSubmitted();
    router.push(`/post/new?orderId=${order.id}&preId=${created.id}`);
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5">
          <Link href={`/orders/${order.id}`} className="text-sm text-zinc-500 hover:text-zinc-700">{uiText("← 返回订单","← Back to orders")}</Link>
          <h1 className="mt-1 text-xl font-bold text-zinc-800">{uiText("创建前期工单","Create shoot task")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{uiText("客户与订单信息已自动带出，无需重复填写；确认后创建并进入下一步","Client and order details are filled in. Confirm to create the task and continue.")}</p>
        </div>

        {/* 流程指引 */}
        <Card className="mb-5 p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
            <Badge tone="green">{uiText("订单已创建","Order created")}</Badge>
            <span className="text-zinc-400">→</span>
            <Badge tone="amber">{uiText("创建前期工单（当前）","Create shoot task (current step)")}</Badge>
            <span className="text-zinc-400">→</span>
            <Badge tone="zinc">{uiText("创建后期工单","Create editing task")}</Badge>
          </div>
        </Card>

        {/* 订单信息快照 */}
        <Card className="mb-5 p-5">
          <SectionTitle right={<Link href={`/orders/${order.id}/print`}><Btn size="sm" variant="outline">{uiText("打印订单确认单","Print order confirmation")}</Btn></Link>}>{uiText("订单信息（自动带出）","Order information")}<span className="text-xs font-normal text-zinc-400">{uiText("来自订单","From the order")}{order.orderNo}</span>
          </SectionTitle>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem label={uiText("客户姓名","Client name")} value={order.customerName} />
            <InfoItem label={uiText("客户类型","Client type")} value={order.customerTypeName} />
            <InfoItem label={uiText("性别","Gender")} value={interfaceText(genderLabel(order.gender),uiLanguage)} />
            <InfoItem label={uiText("是否成年","Age category")} value={order.adult === "adult" ? uiText("成年","Adult") : uiText("未成年","Minor")} />
            <InfoItem label={uiText("拍摄时间","Shoot time")} value={displayDateTime(order.shootTime)} />
            <InfoItem label={uiText("拍摄地点","Location")} value={order.location || "—"} />
            <InfoItem label={uiText("拍摄人","Photographer")} value={order.photographer || "—"} />
            <InfoItem label={uiText("套餐","Package")} value={order.packageTierName ?? "—"} />
            <InfoItem label={uiText("订单总价值","Order value")} value={<Money value={order.totalPrice} />} />
            <InfoItem label={uiText("备注","Notes")} value={order.note || "—"} wide />
          </dl>
        </Card>

        {/* 预计支出（预填） */}
        <Card className="mb-5 p-5">
          <SectionTitle right={<span className="text-xs font-normal text-zinc-400">{uiText("用于收支统计","Included in the operations overview")}</span>}>{uiText("预计支出（选填）","Estimated expenditure (optional)")}</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={uiText(`支出金额（${data.settings?.currency??'CNY'}）`,`Expenditure (${data.settings?.currency??'CNY'})`)} hint={uiText("提前预估本次拍摄的大概花费，如场地/道具/交通等","Estimate location, props, transport and other shoot costs.")}>
              <TextInput
                type="number"
                min="0"
                step="0.01"
                placeholder={uiText("如 300","e.g. 300")}
                value={expense}
                onChange={(e) => setExpense(e.target.value)}
              />
            </Field>
            <Field label={uiText("支出说明","Expenditure notes")} hint={uiText("写清楚这笔钱花在哪，方便以后对账","Record what the expenditure covers.")}>
              <TextInput
                placeholder={uiText("如 场地费 200 + 道具 100","e.g. Location 200 + Props 100")}
                value={expenseNote}
                onChange={(e) => setExpenseNote(e.target.value)}
              />
            </Field>
          </div>
        </Card>

        {/* 创建后补充说明 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{uiText("创建后可在工单中补充","Add shoot details after creating the task")}</SectionTitle>
          <p className="text-sm text-zinc-600">{uiText("设备编号、存储卡、被拍摄人角色、拍摄风格等拍摄现场信息，创建工单后随时补充，改动自动保存；支出金额也可以在前期工单里随时修改。","Add equipment, memory cards, character names and shoot styles in the task. Changes save automatically. Expenditure can also be updated there.")}</p>
        </Card>

        <div className="flex items-center justify-end gap-3 pb-8">
          <Link href={`/orders/${order.id}`}>
            <Btn variant="ghost">{uiText("先不创建，返回订单","Back to order without creating a task")}</Btn>
          </Link>
          <Btn size="lg" onClick={handleCreate}>{uiText("创建前期工单","Create shoot task")}</Btn>
        </div>
      </div>
    </AppShell>
  );
}

function InfoItem({
  label,
  value,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {


  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-700">{value}</dd>
    </div>
  );
}

export default function PreNewPage() {


  return (
    <Suspense>
      <PreNewInner />
    </Suspense>
  );
}
