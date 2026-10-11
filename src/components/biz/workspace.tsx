// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';

import {useStudioLanguage,useStudioText} from '@/lib/i18n';
import {interfaceText} from '@/lib/interface-text';
import {FinancialNotice} from './financial-notice';
import {RetentionPanel} from './retention-panel';
import {deriveStage as businessStage} from '@/lib/data-integrity';
import Link from "next/link";
import { confirmAction } from './dialogs';
import { MotionCanvas, LightStudy } from "./motion";
import { StudioSelect } from "./select";
import { useMemo, useState } from "react";
import { useStudio } from "@/lib/store";
import { STAGE_LABELS, WORK_STATUS_LABELS, displayDateTime } from "@/lib/studio";
import type { Order, OrderStage, PostOrder, PreOrder, WorkStatus } from "@/lib/types";
import { planOf } from "@/lib/payment-plan";
import {
  AppShell,
  Badge,
  Btn,
  Card,
  Empty,
  Money,
  SectionTitle,
} from "@/components/biz/ui";
import {
  ArrowUpRight, Search,
  Camera,
  ClipboardList,
  ClipboardPlus,
  Clock,
  Image as ImageIcon,
} from "lucide-react";

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

/** 订单阶段由工单状态自动推导 */
function deriveStage(o:Order,pre?:PreOrder,post?:PostOrder){return businessStage(pre,post,o);}

function statusTone(s: WorkStatus) {
  switch (s) {
    case "pending":
      return "zinc" as const;
    case "in_progress":
      return "amber" as const;
    case "completed":
      return "green" as const;
  }
}

export default function HomePage({ ordersOnly = false }: { ordersOnly?: boolean }) {

  const { data, deleteOrder } = useStudio();
  const language=useStudioLanguage(),t=useStudioText();
  const [search,setSearch]=useState('');
  const [stageFilter,setStageFilter]=useState<OrderStage|'all'>('all');
  const orders = useMemo(() => {
    const list = [...data.orders]
      .filter((o) => !o.anonymizedAt)
      .filter(o => [o.orderNo, o.customerName, o.location].some(v => v?.toLowerCase().includes(search.trim().toLowerCase())))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    if (stageFilter === "all") return list;
    return list.filter((o) => {
      const pre = data.preOrders.find((p) => p.orderId === o.id);
      const post = data.postOrders.find((p) => p.orderId === o.id);
      return deriveStage(o, pre, post) === stageFilter;
    });
  }, [data.orders, data.preOrders, data.postOrders, stageFilter, search]);

  const prePending = data.preOrders.filter((p) => p.status !== "completed").length;
  const postPending = data.postOrders.filter((p) => p.status !== "completed").length;
  const inProgress = data.orders.filter((o) => {
    const pre = data.preOrders.find((p) => p.orderId === o.id);
    const post = data.postOrders.find((p) => p.orderId === o.id);
    return !o.anonymizedAt&&deriveStage(o, pre, post) !== "done";
  }).length;

  const stats = [
    { label: t("订单总数","Total orders"), value: data.orders.length, href: "/orders", icon: ClipboardList, iconBg: "bg-amber-100", iconColor: "text-amber-600" },
    { label: t("进行中订单","Active orders"), value: inProgress, href: "/orders", icon: Clock, iconBg: "bg-sky-100", iconColor: "text-sky-600" },
    { label: t("前期工单","Pre-production"), value: prePending, href: "/pre", icon: Camera, iconBg: "bg-violet-100", iconColor: "text-violet-600" },
    { label: t("后期工单","Post-production"), value: postPending, href: "/post", icon: ImageIcon, iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
  ];

  const quickStarts = [
    {
      href: "/orders/new",
      title: t("创建订单","Create order"),
      desc: t("记录客户信息、拍摄安排与服务内容。","Record the client, schedule and services."),
      icon: ClipboardPlus,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
    },
    {
      href: "/pre",
      title: t("前期工单","Pre-production"),
      desc: t("查看拍摄工单，在订单详情页推进拍摄状态","Review shoot tasks and update progress from the order."),
      icon: Camera,
      iconBg: "bg-sky-100",
      iconColor: "text-sky-600",
    },
    {
      href: "/post",
      title: t("后期工单","Post-production"),
      desc: t("查看修图工单，在订单详情页推进后期状态","Review editing tasks and update progress from the order."),
      icon: ImageIcon,
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
  ];

  const handleDelete = async (o: Order) => {
    if (!await confirmAction(t(`删除订单 ${o.orderNo}？相关前期与后期工单也会删除，此操作无法撤销。`,`Delete order ${o.orderNo}? Its shoot and editing tasks will also be deleted. This cannot be undone.`))) return;
    deleteOrder(o.id);
  };

  return (
    <AppShell>
      <MotionCanvas>
      <div className="workspace-lead motion-arrive"><div><span className="lead-meta">{ordersOnly ? t("每一份委托，认真以待。","A considered approach to every commission.") : t("创作工作空间","Studio workspace")}</span><h1 className="max-w-6xl">{ordersOnly ? <>{t("从一次预约，","From booking,")}<br/>{t("到完整交付。","to final delivery.")}</> : <>{t("让日常有序，","An orderly studio.")}<br/>{t("让","Room for ")}<span className="inline-study" aria-hidden="true"/>{t("灵感自由。","creative freedom.")}</>}</h1><p>{ordersOnly ? t("管理订单、追踪进度，把细节留在清晰的记录里。","Manage commissions and progress with a clear record of every detail.") : t("把繁杂交给工作室，把时间留给光影。","Coordinate the work. Make time for photography.")}</p><div className="lead-actions"><Link href="/orders/new">{t("新建拍摄订单 ↗","New shoot order ↗")}</Link><Link href="/schedule">{t("查看拍摄日历 ↗","Shooting calendar ↗")}</Link></div></div><LightStudy compact /></div>
      {!ordersOnly && <>
      {/* 快速开始 */}
      <div className="mb-8">
        <SectionTitle>{t("快速开始","Quick start")}</SectionTitle>
        <div className="quick-grid motion-arrive">{quickStarts.map(q => <Link key={q.href} href={q.href} className="quick-panel"><q.icon className="quick-icon" size={23} strokeWidth={1.3}/><ArrowUpRight size={16} className="quick-arrow"/><strong>{q.title}</strong><p>{q.desc}</p></Link>)}</div>
      </div>
      <div className="stat-strip motion-arrive">{stats.map(s => <Link key={s.label} href={s.href}><strong>{s.value}</strong><span>{s.label}</span></Link>)}</div>
      </>}
      <label className="order-search"><Search size={17} /><input aria-label={t("搜索订单","Search orders")} value={search} onChange={e => setSearch(e.target.value)} placeholder={t("搜索订单号、客户或拍摄地点…","Search order number, client or location…")} /><kbd>{t(`${orders.length} 个结果`,`${orders.length} results`)}</kbd></label>
      <div id="orders-list" />
      {/* 订单列表 */}
      <SectionTitle
        right={
          <div className="flex items-center gap-2">
            <StudioSelect
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as OrderStage | "all")}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-700 shadow-sm outline-none focus:border-amber-500"
            >
              <option value="all">{t("全部阶段","All stages")}</option>
              {Object.entries(STAGE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{interfaceText(v,language)}</option>
              ))}
            </StudioSelect>
            <Link href="/orders/new">
              <Btn size="sm">{t("+ 新建订单","+ New order")}</Btn>
            </Link>
          </div>
        }
      >{t("订单总览","Orders")}</SectionTitle>

      {orders.length === 0 ? (
        <Empty text={search || stageFilter !== "all" ? t("没有符合筛选条件的订单，请调整搜索或阶段","No matching orders. Adjust the search or stage filter.") : t("还没有订单，点击上方「新建订单」开始第一单","No orders yet. Select New order to create your first commission.")} />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const pre = data.preOrders.find((p) => p.orderId === o.id);
            const post = data.postOrders.find((p) => p.orderId === o.id);
            return (
              <Card key={o.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-amber-600">
                        {o.orderNo}
                      </span>
                      <Badge tone={stageTone(deriveStage(o, pre, post))}>
                        {interfaceText(STAGE_LABELS[deriveStage(o, pre, post)],language)}
                      </Badge>
                      {pre && (
                        <Badge tone={statusTone(pre.status)}>{t("前期 ·","Pre-production · ")}{interfaceText(WORK_STATUS_LABELS[pre.status],language)}
                        </Badge>
                      )}
                      {post && (
                        <Badge tone={statusTone(post.status)}>{t("后期 ·","Post-production · ")}{interfaceText(WORK_STATUS_LABELS[post.status],language)}
                        </Badge>
                      )}
                      {/* 付款进度 */}
                      <Badge
                        tone={
                          (o.paymentStage ?? 0) >= planOf(o).length
                            ? "green"
                            : (o.paymentStage ?? 0) > 0
                              ? "amber"
                              : "zinc"
                        }
                      >{t("付款","Payments ")}{(o.paymentStage ?? 0)}/{planOf(o).length}{t(" 期","")}
                      </Badge>
                      {o.refund && <Badge tone="red">{t("已退款","Refunded")}</Badge>}
                    </div>
                    <div className="mt-1.5 text-sm text-zinc-700">
                      {o.customerName}
                      <span className="mx-1.5 text-zinc-400">·</span>
                      {o.customerTypeName}
                      <span className="mx-1.5 text-zinc-400">·</span>
                      {o.packageTierName ?? t("未选套餐","No package selected")}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">{t("拍摄","Shoot ")}{displayDateTime(o.shootTime)}
                      {o.location && <> · {o.location}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-xs text-zinc-500">{t("订单总价值","Order value")}</div>
                      <Money value={o.totalPrice} />
                    </div>
                    <Link href={`/orders/${o.id}`}>
                      <Btn size="sm" variant="ghost">{t("详情","Details")}</Btn>
                    </Link>
                    <Btn
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(o)}
                    >{t("删除","Delete")}</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <FinancialNotice/><RetentionPanel/>

      {/* 工单快捷入口 */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <SectionTitle
            right={
              <Link href="/orders">
                <Btn size="sm" variant="outline">{t("选择已有订单","Select an order")}</Btn>
              </Link>
            }
          >{t("前期拍摄工单","Shoot tasks")}</SectionTitle>
          {data.preOrders.length === 0 ? (
            <Empty text={t("暂无前期工单","No shoot tasks yet")} />
          ) : (
            <ul className="space-y-2">
              {[...data.preOrders]
                .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
                .slice(0, 5)
                .map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/pre/${p.id}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 transition hover:bg-zinc-50"
                    >
                      <div>
                        <span className="font-mono text-xs text-amber-600">{p.preNo}</span>
                        <span className="ml-2 text-sm text-zinc-700">{p.customerName}</span>
                      </div>
                      <Badge tone={statusTone(p.status)}>{interfaceText(WORK_STATUS_LABELS[p.status],language)}</Badge>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle
            right={
              <Link href="/orders">
                <Btn size="sm" variant="outline">{t("选择已有订单","Select an order")}</Btn>
              </Link>
            }
          >{t("后期修图工单","Editing tasks")}</SectionTitle>
          {data.postOrders.length === 0 ? (
            <Empty text={t("暂无后期工单","No editing tasks yet")} />
          ) : (
            <ul className="space-y-2">
              {[...data.postOrders]
                .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
                .slice(0, 5)
                .map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/post/${p.id}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 transition hover:bg-zinc-50"
                    >
                      <div>
                        <span className="font-mono text-xs text-amber-600">{p.postNo}</span>
                        <span className="ml-2 text-sm text-zinc-700">{p.customerName}</span>
                        {p.returnTime && (
                          <span className="ml-2 text-xs text-zinc-400">{t("返图","Delivery ")}{displayDateTime(p.returnTime)}</span>
                        )}
                      </div>
                      <Badge tone={statusTone(p.status)}>{interfaceText(WORK_STATUS_LABELS[p.status],language)}</Badge>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
      </MotionCanvas>
    </AppShell>
  );
}


