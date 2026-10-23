// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {paren} from '@/lib/interface-text';
import {useStudioText,useStudioLanguage} from '@/lib/i18n';
import {interfaceText} from '@/lib/interface-text';

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useStudio, SealList } from "@/lib/store";
import {
  WORK_STATUS_LABELS,
  displayDateTime,
  genderLabel,
  makeSeal,
} from "@/lib/studio";
import type { Signature, WorkStatus } from "@/lib/types";
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

export default function PreOrderPage() {

 const uiText=useStudioText(),uiLanguage=useStudioLanguage();

  const params = useParams<{ id: string }>();
  const { data, updatePreOrder, addLog } = useStudio();
  const pre = data.preOrders.find((p) => p.id === params.id);

  const [equipmentCodes, setEquipmentCodes] = useState<string[]>(
    pre?.equipmentCodes ?? [],
  );
  const [sdCardCodes, setSdCardCodes] = useState<string[]>(pre?.sdCardCodes ?? (pre?.sdCardCode ? [pre.sdCardCode] : []));
  const [photographer, setPhotographer] = useState(pre?.photographer ?? "");
  const [roleName, setRoleName] = useState(pre?.roleName ?? "");
  const [styleIds, setStyleIds] = useState<string[]>(pre?.styleIds ?? []);
  const [expense, setExpense] = useState(pre?.expense != null ? String(pre.expense) : "");
  const [expenseNote, setExpenseNote] = useState(pre?.expenseNote ?? "");
  const [location, setLocation] = useState(pre?.location ?? "");
  const [signature, setSignature] = useState<Signature>(pre?.signature ?? "");

  const equipments = data.equipments;
  const sdCards = equipments.filter((e) => e.isSdCard);

  const groupedEquip = useMemo(() => {
    const map = new Map<string, typeof equipments>();
    for (const e of equipments) {
      if (e.isSdCard) continue;
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category)!.push(e);
    }
    return map;
  }, [equipments]);

  if (!pre) {
    return (
      <AppShell>
        <Empty text={uiText("前期工单不存在或已被删除","This shoot task does not exist or has been deleted")} />
        <div className="mt-4 text-center">
          <Link href="/">
            <Btn>{uiText("返回总控台","Back to workspace")}</Btn>
          </Link>
        </div>
      </AppShell>
    );
  }

  const toggleEquip = (code: string) => {
    const next = equipmentCodes.includes(code)
      ? equipmentCodes.filter((c) => c !== code)
      : [...equipmentCodes, code];
    setEquipmentCodes(next);
    if (pre) updatePreOrder(pre.id, { equipmentCodes: next });
  };

  const toggleStyle = (id: string) => {
    const next = styleIds.includes(id)
      ? styleIds.filter((s) => s !== id)
      : [...styleIds, id];
    setStyleIds(next);
    if (pre) {
      updatePreOrder(pre.id, {
        styleIds: next,
        styleNames: next.map(
          (sid) => data.shootStyles.find((s) => s.id === sid)?.name ?? sid,
        ),
      });
    }
  };

  return (    <AppShell>
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-5">
          <Link href={`/orders/${pre.orderId}`} className="text-sm text-zinc-500 hover:text-zinc-700">{uiText("← 返回订单","← Back to orders")}</Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-zinc-800">{pre.preNo}</h1>
            <Badge tone={statusTone(pre.status)}>{interfaceText(WORK_STATUS_LABELS[pre.status],uiLanguage)}</Badge>
            {pre.status === 'pending' && <Btn size="sm" onClick={()=>{updatePreOrder(pre.id,{status:'in_progress',seals:[makeSeal("开始拍摄")]});addLog("状态流转",`前期工单 ${pre.preNo} → 拍摄中`);}}>{uiText("开始拍摄","Start shoot")}</Btn>}
            {pre.status === 'in_progress' && <Btn size="sm" onClick={()=>{updatePreOrder(pre.id,{status:'completed',seals:[makeSeal("拍摄结束，进入后期")]});addLog("状态流转",`前期工单 ${pre.preNo} → 已完成拍摄`);}}>{uiText("结束拍摄","Complete shoot")}</Btn>}
            {pre.status === 'completed' && <Link href={data.postOrders.some(p=>p.orderId===pre.orderId) ? `/post/${data.postOrders.find(p=>p.orderId===pre.orderId)!.id}` : `/post/new?orderId=${pre.orderId}`}><Btn size="sm" variant="outline">{uiText("进入后期交付","Continue to editing and delivery")}</Btn></Link>}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {pre.customerName} · {pre.customerTypeName}
            {pre.packageTierName ? ` · ${pre.packageTierName}` : ""}
          </p>
        </div>

        {/* 基础信息 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{uiText("工单信息","Task information")}</SectionTitle>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label={uiText("客户","Client")} value={pre.customerName+paren(pre.customerTypeName,uiLanguage)} />
            <InfoItem label={uiText("性别 / 成年","Gender / Age category")} value={`${interfaceText(genderLabel(pre.gender),uiLanguage)} / ${pre.adult === "adult" ? uiText("成年","Adult") : uiText("未成年","Minor")}`} />
            <InfoItem label={uiText("拍摄时间","Shoot time")} value={displayDateTime(pre.shootTime)} />
            <InfoItem label={uiText("套餐档位","Package tier")} value={pre.packageTierName ?? "—"} />
          </dl>
        </Card>

        {/* 拍摄现场 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{uiText("拍摄现场","Shoot details")}</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={uiText("拍摄地点","Location")} hint={uiText("已从订单带出，可修改","Filled in from the order; editable")}>
              <TextInput
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  updatePreOrder(pre.id, { location: e.target.value });
                }}
                placeholder={pre.location || uiText("拍摄地点","Location")}
              />
            </Field>
            <Field label={uiText("拍摄人（摄影师）","Photographer")} hint={uiText("已从订单带出，可修改","Filled in from the order; editable")}>
              <TextInput
                value={photographer}
                onChange={(e) => {
                  setPhotographer(e.target.value);
                  updatePreOrder(pre.id, { photographer: e.target.value });
                }}
                placeholder={uiText("例如：李明","e.g. Alex Morgan")}
              />
            </Field>
            <Field label={uiText("被拍摄人角色（coser 填角色名）","Character name (for cosplay shoots)")}>
              <TextInput
                value={roleName}
                onChange={(e) => {
                  setRoleName(e.target.value);
                  updatePreOrder(pre.id, { roleName: e.target.value });
                }}
                placeholder={uiText("角色名（可选）","Character name (optional)")}
              />
            </Field>
            <Field label={uiText("拍摄风格","Style")} hint={uiText("可多选","Multiple selections allowed")}>
              <div className="flex flex-wrap gap-2 pt-1">
                {data.shootStyles.map((s) => {
                  const active = styleIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleStyle(s.id)}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                        active
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        </Card>

        {/* 预计支出 */}
        <Card className="mb-5 p-5">
          <SectionTitle right={<span className="text-xs font-normal text-zinc-400">{uiText("用于收支统计","Included in the operations overview")}</span>}>{uiText("预计支出","Estimated expenditure")}</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={uiText(`支出金额（${data.settings?.currency??'CNY'}）`,`Expenditure (${data.settings?.currency??'CNY'})`)}>
              <TextInput
                type="number"
                min="0"
                step="0.01"
                placeholder={uiText("如 300","e.g. 300")}
                value={expense}
                onChange={(e) => {
                  setExpense(e.target.value);
                  const amount = Number(e.target.value);
                  if(e.target.value === '' || (Number.isFinite(amount) && amount >= 0)) updatePreOrder(pre.id, { expense: e.target.value === '' ? undefined : amount });
                }}
              />
            </Field>
            <Field label={uiText("支出说明","Expenditure notes")}>
              <TextInput
                placeholder={uiText("如 场地费 200 + 道具 100","e.g. Location 200 + Props 100")}
                value={expenseNote}
                onChange={(e) => {
                  setExpenseNote(e.target.value);
                  updatePreOrder(pre.id, { expenseNote: e.target.value || undefined });
                }}
              />
            </Field>
          </div>
        </Card>

        {/* 设备选择 */}
        <Card className="mb-5 p-5">
          <SectionTitle
            right={<Badge tone="amber">{uiText("已选","Selected: ")}{equipmentCodes.length}{uiText("项"," items")}</Badge>}
          >{uiText("拍摄设备","Shoot equipment")}</SectionTitle>
          <div className="space-y-4">
            {Array.from(groupedEquip.entries()).map(([cat, items]) => (
              <div key={cat}>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {interfaceText(cat,uiLanguage)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {items.map((e) => {
                    const active = equipmentCodes.includes(e.code);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => toggleEquip(e.code)}
                        className="pick-tile"
                        aria-pressed={active}
                        title={`${e.name} · ${e.brand} · ${e.specs}`}
                      >
                        <span className="pick-tile-box" aria-hidden="true">{active ? "✓" : ""}</span>
                        <span className="pick-tile-text"><span className="pick-tile-code">{e.code}</span><span className="pick-tile-name">{e.name}</span></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* 存储卡 */}
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{uiText("存储卡（可多选，主卡与备份卡）","Memory cards (primary and backup)")}</div>
              <div className="flex flex-wrap gap-2">
                {sdCards.map((e) => {
                  const active = sdCardCodes.includes(e.code);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        const next = active ? sdCardCodes.filter(code=>code!==e.code) : [...sdCardCodes,e.code];
                        setSdCardCodes(next);
                        updatePreOrder(pre.id, { sdCardCodes: next, sdCardCode: next[0] });
                      }}
                      className="pick-tile"
                      aria-pressed={active}
                      title={`${e.name} · ${e.specs}`}
                    >
                      <span className="pick-tile-box" aria-hidden="true">{active ? "✓" : ""}</span>
                      <span className="pick-tile-text"><span className="pick-tile-code">{e.code}</span><span className="pick-tile-name">{e.name}</span></span>
                    </button>
                  );
                })}
                {sdCards.length === 0 && (
                  <p className="text-xs text-zinc-500">{uiText("暂无存储卡设备","No memory cards recorded")}</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* 署名 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{uiText("作品署名","Work signature")}</SectionTitle>
          <SignatureSwitch
            value={signature}
            onChange={(v) => {
              setSignature(v);
              updatePreOrder(pre.id, { signature: v });
            }}
            compact
          />
          <p className="mt-2 text-xs text-zinc-400">{uiText("工单状态请在订单详情页推进：拍摄 → 结束 → 后期","Update progress from the order: Shoot → Complete shoot → Editing")}</p>
        </Card>

        {/* 时间戳钢印 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{uiText("时间戳钢印（工作室时区 / UTC）","Activity timestamps (studio time zone / UTC)")}</SectionTitle>
          <SealList seals={pre.seals} />
        </Card>

        <div className="flex items-center justify-end gap-3 pb-8">
          <Link href={`/orders/${pre.orderId}`}>
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
