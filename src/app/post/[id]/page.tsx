// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {paren} from '@/lib/interface-text';
import {useStudioText,useStudioLanguage} from '@/lib/i18n';
import {interfaceText} from '@/lib/interface-text';

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useStudio, SealList } from "@/lib/store";
import {
  WORK_STATUS_LABELS,
  displayDateTime,
  makeSeal,
} from "@/lib/studio";
import { POST_SOFTWARES, type PostSoftware, type Signature, type WorkStatus } from "@/lib/types";
import {
  AppShell,
  Badge,
  Btn,
  Card,
  Empty,
  Field,
  SectionTitle,
  SignatureSwitch,
  TextInput,
} from "@/components/biz/ui";

export default function PostOrderPage() {

 const uiText=useStudioText(),uiLanguage=useStudioLanguage();

  const params = useParams<{ id: string }>();
  const { data, updatePostOrder } = useStudio();
  const post = data.postOrders.find((p) => p.id === params.id);
  const order = post ? data.orders.find((o) => o.id === post.orderId) : undefined;

  const [totalShots, setTotalShots] = useState(post?.totalShots ?? 0);
  const [retouchCount, setRetouchCount] = useState(post?.retouchCount ?? 0);
  const [softwares, setSoftwares] = useState<PostSoftware[]>(post?.softwares ?? []);
  const [returnTime, setReturnTime] = useState(post?.returnTime ?? "");
  const [returnCount, setReturnCount] = useState(post?.returnCount ?? undefined);
  const [signature, setSignature] = useState<Signature>(post?.signature ?? "");

  if (!post) {
    return (
      <AppShell>
        <Empty text={uiText("后期工单不存在或已被删除","This editing task does not exist or has been deleted")} />
        <div className="mt-4 text-center">
          <Link href="/">
            <Btn>{uiText("返回总控台","Back to workspace")}</Btn>
          </Link>
        </div>
      </AppShell>
    );
  }

  const toggleSoftware = (s: PostSoftware) => {
    const next = softwares.includes(s)
      ? softwares.filter((x) => x !== s)
      : [...softwares, s];
    setSoftwares(next);
    if (post) updatePostOrder(post.id, { softwares: next });
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5">
          <Link href={`/orders/${post.orderId}`} className="text-sm text-zinc-500 hover:text-zinc-700">{uiText("← 返回订单","← Back to orders")}</Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-zinc-800">{post.postNo}</h1>
            <Link className="studio-btn studio-btn-outline px-3 py-1" href={`/orders/${encodeURIComponent(post.orderId)}`}>{uiText("查看关联订单","View linked order")}</Link><Badge tone={statusTone(post.status)}>{interfaceText(WORK_STATUS_LABELS[post.status],uiLanguage)}</Badge>
            {post.status === "pending" && (
              <Btn
                size="sm"
                onClick={() =>
                  updatePostOrder(post.id, {
                    status: "in_progress",
                    seals: [makeSeal("开始修图")],
                  })
                }
              >{uiText("开始工单","Start task")}</Btn>
            )}
            {post.status === "in_progress" && (
              <Btn
                size="sm"
                onClick={() =>
                  updatePostOrder(post.id, {
                    status: "completed",
                    seals: [makeSeal("后期完成")],
                  })
                }
              >{uiText("完成后期，等待交付","Editing completed; awaiting delivery")}</Btn>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {post.customerName} · {post.customerTypeName}
            {post.packageTierName ? ` · ${post.packageTierName}` : ""}
          </p>
        </div>

        {/* 基础信息 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{uiText("工单信息","Task information")}</SectionTitle>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label={uiText("客户","Client")} value={post.customerName+paren(post.customerTypeName,uiLanguage)} />
            <InfoItem label={uiText("拍摄时间","Shoot time")} value={displayDateTime(post.shootTime)} />
            <InfoItem label={uiText("套餐档位","Package tier")} value={post.packageTierName ?? "—"} />
          </dl>
        </Card>

        {/* 修图数据 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{uiText("修图数据","Editing details")}</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={uiText("总拍摄张数","Total shots")}>
              <TextInput
                type="number"
                min={0}
                value={totalShots}
                onChange={(e) => {
                  const count = Math.max(0, Math.floor(Number(e.target.value) || 0));
                  setTotalShots(count);
                  updatePostOrder(post.id, { totalShots: count });
                }}
              />
            </Field>
            <Field label={uiText("精修张数","Retouch count")} hint={uiText("默认等于档位返图张数，可微调","Defaults to the package delivery count; editable")}>
              <TextInput
                type="number"
                min={0}
                value={retouchCount}
                onChange={(e) => {
                  const count = Math.max(0, Math.floor(Number(e.target.value) || 0));
                  setRetouchCount(count);
                  updatePostOrder(post.id, { retouchCount: count });
                }}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label={uiText("使用软件（可多选）","Applications (multiple selections allowed)")}>
                <div className="flex flex-wrap gap-2 pt-1">
                  {POST_SOFTWARES.map((s) => {
                    const active = softwares.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSoftware(s)}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                          active
                            ? "border-amber-500 bg-amber-50 text-amber-700"
                            : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
                        }`}
                      >
                        {interfaceText(s,uiLanguage)}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </div>
        </Card>

        {/* 返图安排 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{uiText("返图安排","Delivery arrangements")}</SectionTitle>
          {order?.returnCount || order?.returnTime ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-zinc-700">{uiText("已按订单档位联动带出：返图","Package delivery count: ")}<b className="text-amber-600">{order.returnCount ?? "—"}{uiText("张"," images")}</b>{uiText("· 预计"," · Estimated: ")}{" "}
              <b className="text-amber-600">{order.returnTime ? displayDateTime(order.returnTime) : "—"}</b>
              {order.extras?.some((e) => (e.advanceDays ?? 0) > 0) && (
                <span className="ml-1 text-zinc-500">{uiText("（含加急提前","(expedited by ")}{" "}
                  {order.extras.reduce((s, e) => s + (e.advanceDays ?? 0), 0)}{uiText("天）"," days)")}</span>
              )}{uiText("，如需调整可直接修改","; edit to adjust")}</div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={uiText("返图时间","Delivery time")} hint={uiText("默认带出订单档位联动值，可微调","Defaults to the package setting; editable")}>
              <TextInput
                type="datetime-local"
                value={returnTime}
                onChange={(e) => {
                  setReturnTime(e.target.value);
                  updatePostOrder(post.id, { returnTime: e.target.value || undefined });
                }}
              />
            </Field>
            <Field label={uiText("返图张数","Delivery count")} hint={uiText("默认带出档位返图张数，可微调","Defaults to the package delivery count; editable")}>
              <TextInput
                type="number"
                min={0}
                value={returnCount ?? ""}
                placeholder={uiText("例如：15","e.g. 15")}
                onChange={(e) => {
                  const v = e.target.value === "" ? undefined : Math.max(0, Math.floor(Number(e.target.value) || 0));
                  setReturnCount(v);
                  updatePostOrder(post.id, { returnCount: v });
                }}
              />
            </Field>
          </div>
        </Card>

        {/* 署名 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{uiText("作品署名","Work signature")}</SectionTitle>
          <SignatureSwitch
            value={signature}
            onChange={(v) => {
              setSignature(v);
              updatePostOrder(post.id, { signature: v });
            }}
            compact
          />
          <p className="mt-2 text-xs text-zinc-400">{uiText("工单状态请在订单详情页推进：拍摄 → 结束 → 后期","Update progress from the order: Shoot → Complete shoot → Editing")}</p>
        </Card>

        {/* 时间戳钢印 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{uiText("时间戳钢印（工作室时区 / UTC）","Activity timestamps (studio time zone / UTC)")}</SectionTitle>
          <SealList seals={post.seals} />
        </Card>

        <div className="flex items-center justify-end gap-3 pb-8">
          <Link href={`/orders/${post.orderId}`}>
            <Btn variant="outline">{uiText("返回订单","Back to order")}</Btn>
          </Link>
          <span className="text-xs text-zinc-400">{uiText("所有改动自动保存","All changes save automatically")}</span>
        </div>
      </div>
    </AppShell>
  );
}

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

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {


  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-700">{value}</dd>
    </div>
  );
}
