// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText} from '@/lib/i18n';

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useStudio } from "@/lib/store";
import { displayDateTime, toPostNo } from "@/lib/studio";
import {
  AppShell,
  Badge,
  Btn,
  Card,
  Empty,
  Money,
  SectionTitle,
} from "@/components/biz/ui";

function PostNewInner() {

 const uiText=useStudioText();

  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const preId = params.get("preId") ?? "";
  const { data, createPostOrder } = useStudio();

  const order = data.orders.find((o) => o.id === orderId);
  const existing = data.postOrders.find((p) => p.orderId === orderId);

  useEffect(() => { if (existing) router.replace(`/post/${existing.id}`); }, [existing, router]);
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
    createPostOrder({
      postNo: toPostNo(order.orderNo),
      orderId: order.id,
      customerName: order.customerName,
      customerTypeName: order.customerTypeName,
      shootTime: order.shootTime,
      packageTierName: order.packageTierName,
      totalShots: 0,
      retouchCount: order.returnCount ?? 0,
      returnCount: order.returnCount,
      returnTime: order.returnTime,
      softwares: [],
      signature: order.signature,
      status: "pending",
    });
    router.push(`/orders/${order.id}?postCreated=1`);
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5">
          <Link href={`/orders/${order.id}`} className="text-sm text-zinc-500 hover:text-zinc-700">{uiText("← 返回订单","← Back to orders")}</Link>
          <h1 className="mt-1 text-xl font-bold text-zinc-800">{uiText("创建后期工单","Create editing task")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{uiText("返图张数 / 精修张数 / 返图时间已按套餐档位联动带出，确认后创建","Delivery count, retouch count and delivery time are filled in from the package. Confirm to create the task.")}</p>
        </div>

        {/* 流程指引 */}
        <Card className="mb-5 p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
            <Badge tone="green">{uiText("订单已创建","Order created")}</Badge>
            <span className="text-zinc-400">→</span>
            <Badge tone="green">{uiText("前期工单已创建","Shoot task created")}</Badge>
            <span className="text-zinc-400">→</span>
            <Badge tone="amber">{uiText("创建后期工单（当前）","Create editing task (current step)")}</Badge>
          </div>
          {preId && (
            <Link
              href={`/pre/${preId}`}
              className="mt-2 inline-block text-xs text-zinc-400 hover:text-amber-600"
            >{uiText("查看已创建的前期工单 →","View the shoot task →")}</Link>
          )}
        </Card>

        {/* 订单信息快照 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{uiText("订单信息（自动带出）","Order information")}<span className="text-xs font-normal text-zinc-400">{uiText("来自订单","From the order")}{order.orderNo}</span>
          </SectionTitle>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem label={uiText("客户姓名","Client name")} value={order.customerName} />
            <InfoItem label={uiText("客户类型","Client type")} value={order.customerTypeName} />
            <InfoItem label={uiText("拍摄时间","Shoot time")} value={displayDateTime(order.shootTime)} />
            <InfoItem label={uiText("套餐","Package")} value={order.packageTierName ?? "—"} />
            <InfoItem label={uiText("返图张数","Delivery count")} value={order.returnCount ? uiText(`${order.returnCount} 张`,`${order.returnCount} images`) : "—"} />
            <InfoItem label={uiText("预计返图时间","Estimated delivery time")} value={order.returnTime ? displayDateTime(order.returnTime) : "—"} />
            <InfoItem label={uiText("订单总价值","Order value")} value={<Money value={order.totalPrice} />} wide />
          </dl>
        </Card>

        {/* 联动说明 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{uiText("联动已带出","Filled in from the order")}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs text-zinc-500">{uiText("精修张数（联动）","Retouch count")}</div>
              <div className="mt-1 text-lg font-semibold text-amber-600">
                {order.returnCount ?? 0}{uiText("张"," images")}</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs text-zinc-500">{uiText("返图张数（联动）","Delivery count")}</div>
              <div className="mt-1 text-lg font-semibold text-amber-600">
                {order.returnCount ?? 0}{uiText("张"," images")}</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs text-zinc-500">{uiText("返图时间（联动）","Delivery time")}</div>
              <div className="mt-1 text-lg font-semibold text-amber-600">
                {order.returnTime ? displayDateTime(order.returnTime) : "—"}
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm text-zinc-600">{uiText("在工单中补充后期软件与拍摄张数，调整返图安排。","Add editing applications and the shot count in the task, and adjust delivery arrangements.")}</p>
        </Card>

        <div className="flex items-center justify-end gap-3 pb-8">
          <Link href={`/orders/${order.id}`}>
            <Btn variant="ghost">{uiText("先不创建，返回订单","Back to order without creating a task")}</Btn>
          </Link>
          <Btn size="lg" onClick={handleCreate}>{uiText("创建后期工单","Create editing task")}</Btn>
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

export default function PostNewPage() {


  return (
    <Suspense>
      <PostNewInner />
    </Suspense>
  );
}
