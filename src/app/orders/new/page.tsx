// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/**
 * Copyright (C) 2026 博成 · FMLC 中成博成
 */

'use client';
import {errorText} from '@/lib/interface-error';
import {paren} from '@/lib/interface-text';
import {useStudioLanguage as useViewLanguage} from '@/lib/i18n';
import {interfaceText as localeText} from '@/lib/interface-text';
import {useStudioText} from '@/lib/i18n';
import {useUnsavedChanges} from '@/components/biz/navigation-guard';
import { confirmAction } from '@/components/biz/dialogs';

import {OrderAttributionFields} from '@/components/biz/order-attribution';
import {getSessionUser} from '@/lib/auth';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useRef } from "react";
import { useStudio } from "@/lib/store";
import { planOf, refundRulesOf } from "@/lib/payment-plan";
import {
  buildBaseNo,
  codeDateParts,
  countOrdersOnDay,
  nextMonthlySerial,
  nowLocalDateTimeInput,
  pad,
} from "@/lib/studio";
import {
  getSignature,
  type ExtraItem,
  type Gender,
  type Signature,
} from "@/lib/types";
import { Printer } from "lucide-react";
import {useMoneyFormatter} from '@/lib/use-money';
import {
  AppShell,
  Badge,
  Btn,
  Card,
  Field,
  Money,
  SectionTitle,
  Select,
  SignatureSwitch,
  TextArea,
  TextInput,
} from "@/components/biz/ui";

export default function NewOrderPage() {
 const viewLanguage=useViewLanguage();

 const tr=useStudioText();

  const money=useMoneyFormatter();
  const router = useRouter();
  const { data, createOrder } = useStudio();

  // —— 表单状态 ——
  const [customerName, setCustomerName] = useState("");
  const [gender, setGender] = useState<Gender>("female");
  const [adult, setAdult] = useState<"adult" | "minor">("adult");
  const [customerTypeId, setCustomerTypeId] = useState("");
  const [packageTierId, setPackageTierId] = useState("");
  const [orderCreatedAt, setOrderCreatedAt] = useState(nowLocalDateTimeInput());
  const [shootTime, setShootTime] = useState(nowLocalDateTimeInput());
  const [location, setLocation] = useState("");
  const [photographer, setPhotographer] = useState("");
  const [note, setNote] = useState("");
  const [attribution,setAttribution]=useState({signatureMemberId:getSessionUser()?.id??'',channel:'',customerTags:[] as string[]});
  const [signature, setSignature] = useState<Signature>("");
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [extraQty, setExtraQty] = useState<Record<string, number>>({});
  const [err, setErr] = useState("");
  const [creating,setCreating]=useState(false);
  const creatingRef=useRef(false);

  const markSubmitted=useUnsavedChanges(JSON.stringify({customerName,gender,adult,customerTypeId,packageTierId,orderCreatedAt,shootTime,location,photographer,note,signature,attribution,selectedExtras,extraQty}));

  const customerType = data.customerTypes.find((c) => c.id === customerTypeId);
  const tier = data.packageTiers.find((t) => t.id === packageTierId);

  // —— 预览订单号 ——
  const previewNo = useMemo(() => {
    if (!customerType || !orderCreatedAt) return "";
    const { yymmdd, monthKey } = codeDateParts(orderCreatedAt);
    const serial = nextMonthlySerial(data.orders, monthKey);
    return buildBaseNo(customerType.prefix, yymmdd, gender, serial);
  }, [customerType, orderCreatedAt, gender, data.orders]);

  // —— 增项（提前计算，供返图时间联动） ——
  const extras = data.extraItems ?? [];
  const selectedExtraItems: ExtraItem[] = extras.filter((e) =>
    selectedExtras.includes(e.id),
  );

  // —— 档位联动：返图张数 & 返图时间（含增项提前天数） ——
  const linkedReturnCount = tier?.returnCount;
  const urgentDays = selectedExtraItems.reduce(
    (s, e) => s + (e.advanceDays ?? 0),
    0,
  );
  const linkedReturnTime = (() => {
    if (!tier?.returnDays || !shootTime) return "";
    const d = new Date(shootTime);
    if (Number.isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + Math.max(0, tier.returnDays - urgentDays));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  // —— 增项与总价（按数量计费的增项按 单价×数量 计入） ——
  const tierPrice = tier?.price ?? 0;
  const extrasPrice = selectedExtraItems.reduce(
    (s, e) => s + (e.price ?? 0) * (e.perUnit ? extraQty[e.id] ?? 1 : 1),
    0,
  );
  const totalPrice = tierPrice + extrasPrice;

  const toggleExtra = (id: string) => {
    setSelectedExtras((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      setExtraQty((q) => ({ ...q, [id]: 1 }));
      return [...prev, id];
    });
  };

  const changeQty = (id: string, n: number) => {
    setExtraQty((q) => ({ ...q, [id]: Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1 }));
  };

  const handleSubmit = async () => {
    if(creatingRef.current)return;creatingRef.current=true;setCreating(true);
    try {
    setErr("");
    if (!attribution.signatureMemberId) return setErr(tr("请选择署名成员","Select a signature member"));
    if (!customerName.trim()) return setErr(tr("请填写客户姓名","Enter a client name"));
    if (!customerType) return setErr(tr("请选择客户类型","Select a client type"));
    if (!orderCreatedAt) return setErr(tr("请填写订单创建时间","Enter the order creation time"));
    if (!shootTime) return setErr(tr("请填写拍摄时间","Enter the shoot time"));
    if (!Number.isFinite(totalPrice) || totalPrice < 0) return setErr(tr("订单金额无效，请检查套餐与增项单价","Invalid order amount. Check the package and add-on prices."));

    // 排班冲突提醒：拍摄当天已有 >= 2 单时，本次创建即为第 3 单
    const sameDay = countOrdersOnDay(data.orders, shootTime);
    if (sameDay >= 2) {
      const ok = await confirmAction(
        tr(`${shootTime.slice(0,10)} 已有 ${sameDay} 场拍摄。仍要增加订单吗？`,`${sameDay} shoots are already scheduled for ${shootTime.slice(0,10)}. Add another order?`),
      );
      if (!ok) return;
    }

    const { yymmdd, monthKey } = codeDateParts(orderCreatedAt);
    const serial = nextMonthlySerial(data.orders, monthKey);
    const orderNo = buildBaseNo(customerType.prefix, yymmdd, gender, serial);

    const order = createOrder({
      orderNo,
      serial,
      serialMonth: monthKey,
      customerName: customerName.trim(),
      gender,
      adult,
      customerTypeId: customerType.id,
      customerTypeName: customerType.name,
      packageTierId: tier?.id,
      packageTierName: tier?.name,
      orderCreatedAt,
      shootTime,
      location: location.trim(),
      photographer: photographer.trim(),
      returnCount: linkedReturnCount,
      returnTime: linkedReturnTime,
      extras: selectedExtraItems,
      extraQty: Object.fromEntries(
        Object.entries(extraQty).filter(([id]) => selectedExtras.includes(id)),
      ),
      needRaw: selectedExtraItems.some((e) => e.perUnit && e.name.includes("RAW")),
      totalPrice,
      note: note.trim(),
      signature: getSignature(signature, data.settings).id,
      paymentPlan: planOf(null, data.settings),
      refundRules: refundRulesOf(null, data.settings),
      ...attribution,
      stage: "prep",
    });

    // 订单创建成功后进入「创建前期工单」确认页，逐单确认，不重复填写
    markSubmitted();
    router.push(`/pre/new?orderId=${order.id}`);
    } catch(error){setErr(errorText(error,tr("订单创建失败","Unable to create the order")));} finally {creatingRef.current=false;setCreating(false);}
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5">
          <Link href="/orders" className="text-sm text-zinc-500 hover:text-zinc-700">{tr("← 返回订单","← Back to orders")}</Link>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-zinc-800">{tr("新建订单","New order")}</h1>
            <Link
              href="/orders/new/print"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
            >
              <Printer size={15} />{tr("打印预定单","Print booking form")}</Link>
          </div>
          <p className="mt-1 text-sm text-zinc-500">{tr("订单号将按「客户类型前缀 - 建档日期 - 性别 - 月内序列号」自动生成","Order numbers use the client-type prefix, creation date, gender and monthly sequence.")}</p>
        </div>

        <div className="space-y-5">
          {/* 客户信息 */}
          <Card className="p-5">
            <SectionTitle>{tr("客户信息","Client information")}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={localeText("客户姓名",viewLanguage)} required>
                <TextInput
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={tr("例如：王芳","e.g. Jamie Taylor")}
                />
              </Field>
              <Field label={localeText("客户类型",viewLanguage)} required>
                <Select
                  value={customerTypeId}
                  onChange={(e) => setCustomerTypeId(e.target.value)}
                >
                  <option value="">{tr("选择客户类型","Select a client type")}</option>
                  {data.customerTypes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{paren(c.prefix,viewLanguage)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={tr("性别","Gender")} required>
                <div className="flex gap-2">
                  {[
                    { v: "female", t: tr("女","Female") },
                    { v: "male", t: tr("男","Male") },
                    { v: "nonbinary", t: tr("非二元性别","Non-binary") },
                  ].map((g) => (
                    <button
                      key={g.v}
                      type="button"
                      onClick={() => setGender(g.v as Gender)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
                        gender === g.v
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
                      }`}
                    >
                      {g.t}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={tr("是否成年","Age category")}>
                <div className="flex gap-2">
                  {[
                    { v: "adult", t: tr("成年","Adult") },
                    { v: "minor", t: tr("未成年","Minor") },
                  ].map((a) => (
                    <button
                      key={a.v}
                      type="button"
                      onClick={() => setAdult(a.v as "adult" | "minor")}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
                        adult === a.v
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
                      }`}
                    >
                      {a.t}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </Card>

          {/* 拍摄信息 */}
          <Card className="p-5">
            <SectionTitle>{tr("拍摄信息","Shoot information")}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tr("订单创建时间","Order creation time")} required hint={tr("用于生成订单号月份/日期段","Used for the month and date in the order number")}>
                <TextInput
                  type="datetime-local"
                  value={orderCreatedAt}
                  onChange={(e) => setOrderCreatedAt(e.target.value)}
                />
              </Field>
              <Field label={localeText("拍摄时间",viewLanguage)} required>
                <TextInput
                  type="datetime-local"
                  value={shootTime}
                  onChange={(e) => setShootTime(e.target.value)}
                />
              </Field>
              <Field label={localeText("拍摄地点",viewLanguage)} hint={tr("手动输入，不做下拉预设","Enter a location")}>
                <TextInput
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={tr("例如：城市公园 / 摄影棚","e.g. City park / Studio")}
                />
              </Field>
              <Field label={tr("拍摄人（摄影师）","Photographer")} hint={tr("手动输入，前期工单联动带出","Used as the photographer on shoot tasks")}>
                <TextInput
                  value={photographer}
                  onChange={(e) => setPhotographer(e.target.value)}
                  placeholder={tr("例如：李明","e.g. Alex Morgan")}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label={localeText("备注",viewLanguage)}>
                  <TextArea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={tr("订单备注（可选）","Order notes (optional)")}
                  />
                </Field>
              </div>
            </div>
          </Card>

          {/* 套餐与价格 */}
          <Card className="p-5">
            <SectionTitle>{tr("套餐与价格","Package and pricing")}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tr("套餐档位","Package tier")} required hint={tr("选择后自动带出返图张数与返图时间","Sets the delivery count and turnaround time")}>
                <Select
                  value={packageTierId}
                  onChange={(e) => setPackageTierId(e.target.value)}
                >
                  <option value="">{tr("选择套餐档位","Select a package")}</option>
                  {data.packageTiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.price ? ` · ${money(t.price)}` : ""}
                      {t.returnCount ? tr(` · ${t.returnCount}张`,` · ${t.returnCount} images`) : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={tr("套餐金额","Package price")}>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                  {tier ? <Money value={tier.price} /> : "—"}
                </div>
              </Field>
            </div>

            {/* 档位联动展示 */}
            {tier && (
              <div className="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-zinc-500">{tr("返图张数（联动）","Delivery count")}</div>
                  <div className="mt-1 text-lg font-semibold text-amber-600">
                    {linkedReturnCount ?? "—"}{tr("张"," images")}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">{tr("返图周期","Turnaround")}</div>
                  <div className="mt-1 text-lg font-semibold text-amber-600">
                    {tier.returnDays
                      ? urgentDays > 0
                        ? tr(`${tier.returnDays} - ${urgentDays} = ${Math.max(0,tier.returnDays-urgentDays)} 天`,`${tier.returnDays} - ${urgentDays} = ${Math.max(0,tier.returnDays-urgentDays)} days`)
                        : tr(`${tier.returnDays} 天`,`${tier.returnDays} days`)
                      : tr("面议","To be agreed")}
                  </div>
                  {urgentDays > 0 && (
                    <div className="mt-0.5 text-[11px] text-zinc-500">{tr("含增项加急提前","Expedited by add-ons:")}{urgentDays}{tr("天"," days")}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-zinc-500">{tr("预计返图时间（拍摄 + 周期 − 提前）","Estimated delivery (shoot + turnaround − expedited days)")}</div>
                  <div className="mt-1 text-lg font-semibold text-amber-600">
                    {linkedReturnTime ? linkedReturnTime.replace("T", " ") : "—"}
                  </div>
                </div>
              </div>
            )}

            {/* 增项服务 */}
            <div className="mt-5">
              <div className="mb-2 text-sm font-medium text-zinc-700">{tr("其他 / 增项服务","Additional services")}</div>
              {extras.length === 0 ? (
                <p className="text-xs text-zinc-500">{tr("暂无增项服务，可在「工作室设置 → 其他增项」中添加","No add-ons. Add them in Business settings → Additional services.")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {extras.map((e) => {
                    const active = selectedExtras.includes(e.id);
                    return (
                      <div
                        key={e.id}
                        className={`rounded-lg border px-3 py-2 text-sm transition ${
                          active
                            ? "border-amber-500 bg-amber-50 text-amber-700"
                            : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleExtra(e.id)}
                          className="text-left"
                        >
                          {e.name} · <Money value={e.price}/>
                          {e.perUnit && e.unitName ? ` / ${e.unitName}` : ""}
                          {e.advanceDays ? tr(` · 提前${e.advanceDays}天`,` · ${e.advanceDays} days earlier`) : ""}
                        </button>
                        {active && e.perUnit && (
                          <div className="mt-2 flex items-center gap-1">
                            <span className="text-xs text-zinc-500">{tr("数量","Quantity")}</span>
                            <button
                              type="button"
                              onClick={() => changeQty(e.id, (extraQty[e.id] ?? 1) - 1)}
                              className="h-6 w-6 rounded-md border border-amber-300 text-sm leading-none text-amber-700 hover:bg-amber-100"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-sm font-semibold text-amber-700">
                              {extraQty[e.id] ?? 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => changeQty(e.id, (extraQty[e.id] ?? 1) + 1)}
                              className="h-6 w-6 rounded-md border border-amber-300 text-sm leading-none text-amber-700 hover:bg-amber-100"
                            >
                              +
                            </button>
                            <span className="text-xs text-zinc-500">
                              = {((e.price ?? 0) * (extraQty[e.id] ?? 1)) < 0 ? (
                                <Money value={(e.price ?? 0) * (extraQty[e.id] ?? 1)}/>
                              ) : (
                                <Money value={(e.price ?? 0) * (extraQty[e.id] ?? 1)}/>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 总价 */}
            <div className="mt-5 flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="text-sm text-zinc-600">{localeText("套餐",viewLanguage)}<Money value={tierPrice} />
                {selectedExtraItems.length > 0 && (
                  <span className="ml-2 text-xs text-zinc-500">{tr("+ 增项","+ Add-ons")}{" "}
                    {selectedExtraItems
                      .map(
                        (e) =>
                          `${e.name}${e.perUnit ? ` ×${extraQty[e.id] ?? 1}` : ""}`,
                      )
                      .join("、")}{" "}
                    <Money value={extrasPrice} />
                  </span>
                )}
              </div>
              <div className="text-sm text-zinc-600">{tr("订单总价值：","Order value:")}<span className="text-xl font-bold text-amber-600"><Money value={totalPrice}/></span>
              </div>
            </div>
          </Card>

          <Card className="p-5"><SectionTitle>{tr("客户声明与约定","Client terms and agreements")}</SectionTitle><p className="text-sm text-zinc-500">{tr("在独立模板页面编辑付款方案、退款规则与履约条款，预定单会同步显示。","Edit payment schedules, refund rules and service terms in the template editor. The booking form uses the same terms.")}</p><Link href="/settings/print" className="mt-3 inline-block text-sm underline">{tr("编辑声明与打印模板 →","Edit terms and print templates →")}</Link></Card>

          {/* 署名 */}
          <Card className="p-5">
            <SectionTitle>{tr("署名与客户来源","Attribution and referral source")}</SectionTitle>
            <OrderAttributionFields value={attribution} onChange={patch=>setAttribution(value=>({...value,...patch}))}/>
            <div className="mt-4 mb-2 text-xs text-zinc-500">{tr("打印品牌样式","Print branding")}</div>
            <SignatureSwitch value={signature} onChange={setSignature} />
            <p className="mt-2 text-xs text-zinc-500">{tr("工单将默认使用该署名，可在前期/后期工单中随时切换","Tasks use this signature by default. Change it on a shoot or editing task.")}</p>
          </Card>

          {/* 订单号预览 */}
          <Card className="p-5">
            <SectionTitle>{tr("订单号预览","Order number preview")}</SectionTitle>
            {previewNo ? (
              <div className="flex items-center gap-3">
                <span className="font-mono text-lg font-bold text-amber-600">{previewNo}</span>
                <Badge tone="blue">{tr("月内序列号","Monthly sequence")}{pad(parseInt(previewNo.split("-")[3] ?? "0", 10), 4)}</Badge>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">{tr("选择客户类型与创建时间后自动生成","Generated after selecting the client type and creation time")}</p>
            )}
          </Card>

          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pb-8">
            <Link href="/">
              <Btn variant="ghost">{localeText("取消",viewLanguage)}</Btn>
            </Link>
            <Btn onClick={handleSubmit} size="lg" disabled={creating}>{creating?tr("创建中…","Creating…"):"创建订单"}</Btn>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
