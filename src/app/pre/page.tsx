// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioLanguage as useViewLanguage} from '@/lib/i18n';
import {interfaceText as localeText} from '@/lib/interface-text';

import { StudioSelect } from '@/components/biz/select';
import Link from "next/link";
import { useMemo, useState } from "react";
import { useStudio } from "@/lib/store";
import { WORK_STATUS_LABELS, displayDateTime } from "@/lib/studio";
import type { WorkStatus } from "@/lib/types";
import { AppShell, Badge, Card, Empty, SectionTitle } from "@/components/biz/ui";

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

export default function PreListPage() {
 const viewLanguage=useViewLanguage();

  const { data } = useStudio();
  const [filter, setFilter] = useState<WorkStatus | "all">("all");
  const [kw, setKw] = useState("");

  const list = useMemo(() => {
    let l = [...data.preOrders].sort((a, b) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
    );
    if (filter !== "all") l = l.filter((p) => p.status === filter);
    if (kw.trim()) {
      const k = kw.trim().toLowerCase();
      l = l.filter(
        (p) =>
          p.preNo.toLowerCase().includes(k) ||
          p.customerName.toLowerCase().includes(k) ||
          p.photographer.toLowerCase().includes(k),
      );
    }
    return l;
  }, [data.preOrders, filter, kw]);

  return (
    <AppShell>
      <div className="record-list-intro">
        <div><h1>{localeText("前期拍摄",viewLanguage)}</h1><p>{localeText("现场准备、器材与拍摄安排，清晰归于每一份工单。",viewLanguage)}</p></div>
        <div className="flex items-center gap-2">
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder={localeText("搜索工单号 / 客户 / 摄影师",viewLanguage)}
            className="studio-field w-56"
          />
          <StudioSelect
            value={filter}
            onChange={(e) => setFilter(e.target.value as WorkStatus | "all")}
            className="record-filter"
          >
            <option value="all">{localeText("全部状态",viewLanguage)}</option>
            <option value="pending">{localeText("待处理",viewLanguage)}</option>
            <option value="in_progress">{localeText("进行中",viewLanguage)}</option>
            <option value="completed">{localeText("已完成",viewLanguage)}</option>
          </StudioSelect>
        </div>
      </div>

      <SectionTitle right={<Badge tone="blue">{list.length}{viewLanguage==='en'?' tasks':'单'}</Badge>}>{localeText("工单列表",viewLanguage)}</SectionTitle>

      {list.length === 0 ? (
        <Empty text={localeText("暂无前期工单，可在订单详情页创建",viewLanguage)} />
      ) : (
        <div className="record-list">
          {list.map((p) => (
            <Link key={p.id} href={`/pre/${p.id}`}>
              <Card className="record-row">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-amber-600">{p.preNo}</span>
                    <span className="text-sm font-medium text-zinc-800">{p.customerName}</span>
                    <Badge tone={statusTone(p.status)}>{localeText(WORK_STATUS_LABELS[p.status],viewLanguage)}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                    <span>{localeText("拍摄：",viewLanguage)}{displayDateTime(p.shootTime)}</span>
                    {p.location && <span>{localeText("地点：",viewLanguage)}{p.location}</span>}
                    {p.photographer && <span>{localeText("拍摄人：",viewLanguage)}{p.photographer}</span>}
                    {data.orders.find((o) => o.id === p.orderId)?.returnCount !== undefined && (
                      <span>{viewLanguage==='en'?`Delivery: ${data.orders.find((o) => o.id === p.orderId)?.returnCount} images`:`返图${data.orders.find((o) => o.id === p.orderId)?.returnCount}张`}</span>
                    )}
                    <span className="text-zinc-400">{localeText("存储卡：",viewLanguage)}{(p.sdCardCodes ?? (p.sdCardCode ? [p.sdCardCode] : [])).join(viewLanguage==='en'?', ':'、') || '—'}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
