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
import {useStudioText,useStudioLanguage} from '@/lib/i18n';
import {interfaceText} from '@/lib/interface-text';

import {deriveStage} from '@/lib/data-integrity';
import {OrderAttributionFields} from '@/components/biz/order-attribution';
import {useMoneyFormatter} from '@/lib/use-money';
import Link from "next/link";
import { confirmAction, notifyUser } from '@/components/biz/dialogs';
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useStudio, SealList } from "@/lib/store";
import { loadProofImage, saveProofImage } from "@/lib/proof";
import {
  STAGE_LABELS,
  WORK_STATUS_LABELS,
  displayDateTime,
  genderLabel,
  makeSeal,
} from "@/lib/studio";
import {
  calcRefundAmount,
  paymentMethodLabel,
  type OrderStage,
  type PaymentMethod,
} from "@/lib/types";
import { cumulativeRate, paidAmount as paidAmountOf, planOf, refundRulesOf, stageAmount } from "@/lib/payment-plan";
import { paymentMethodsOf } from "@/lib/settings";
import {
  AppShell,
  Badge,
  Btn,
  Card,
  Empty,
  Field,
  Money,
  SectionTitle,
  TextArea,
  TextInput,
} from "@/components/biz/ui";

export default function OrderDetailPage() {
 const viewLanguage=useViewLanguage();

 const tr=useStudioText(),language=useStudioLanguage();

  const money=useMoneyFormatter();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, executeCommand, updateOrder, updatePreOrder, updatePostOrder, deleteOrder, addLog } =
    useStudio();

  const order = data.orders.find((o) => o.id === params.id);
  const pre = data.preOrders.find((p) => p.orderId === params.id);
  const post = data.postOrders.find((p) => p.orderId === params.id);


  if (!order) {
    return (
      <AppShell>
        <Empty text={tr("订单不存在或已被删除","This order does not exist or has been deleted")} />
        <div className="mt-4 text-center">
          <Link href="/">
            <Btn>{tr("返回总控台","Back to workspace")}</Btn>
          </Link>
        </div>
      </AppShell>
    );
  }

  if(order.anonymizedAt)return <AppShell><Card className="mx-auto max-w-xl p-8"><SectionTitle>{tr("已清理的订单","Archived order")}</SectionTitle><p>{order.orderNo}</p><p className="mt-3 text-sm opacity-70">{tr("客户资料和照片索引已清理，订单金额与脱敏财务记录保留。","Client information has been cleared. Order amounts and anonymized operating records are retained.")}</p><Link href="/finance" className="mt-5 inline-block underline">{tr("查看收支记录","View operating records")}</Link></Card></AppShell>;

  // 订单阶段由工单状态自动推导，不再手动选择
  const currentStage: OrderStage = deriveStage(pre,post,order);

  // —— 付款与退款（按订单创建时保存的分期与退款规则） ——
  const totalPrice = order.totalPrice ?? 0;
  const plan = planOf(order);
  const refundRules = refundRulesOf(order);
  const curStage = Math.min(order.paymentStage ?? 0, plan.length);
  const paidRate = cumulativeRate(plan, curStage);
  const paidAmount = paidAmountOf(totalPrice, plan, curStage);
  // 退款天数基准 = 拍摄时间往前推：距拍摄日还有多少天（拍摄日当天计 0 天）
  const baseTime = order.shootTime || order.orderCreatedAt || order.createdAt;
  const daysUntilShoot = (() => {
    if (!baseTime) return 0;
    const d = new Date(baseTime);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.max(0, Math.floor((dayStart - todayStart) / 86400000));
  })();
  /** 按约定退款：已付款 × 档位比例，扣除预计支出 */
  const refundCalc = calcRefundAmount({
    paidAmount,
    days: daysUntilShoot,
    rules: refundRules,
    expense: pre?.expense,
    language,
  });

  const markPaid = async (stage: number, method: PaymentMethod) => {
    if (stage > 0 && stage <= plan.length && stage === curStage + 1) {
      const item = plan[stage - 1], amount = stageAmount(totalPrice, plan, stage - 1), percent = Math.round(item.rate * 1000) / 10;
      if (!await confirmAction(tr(`确认已收到第 ${stage} 期${item.name} ${money(amount)}？收款方式：${paymentMethodLabel(method)}。`,`Confirm receipt of instalment ${stage} (${item.name}): ${money(amount)} via ${interfaceText(paymentMethodLabel(method),language)}?`))) return;
      updateOrder(order.id, {
        paymentStage: stage,
        paymentMethods: { ...(order.paymentMethods ?? {}), [stage]: method },
        seals: [makeSeal(
            `第${stage}期付款已收（${item.name} ${percent}% · ${paymentMethodLabel(method)}）`,
          )],
      });
      addLog("收款",
        `第${stage}期 ${item.name} ${percent}%（${paymentMethodLabel(method)}）· 订单 ${order.orderNo}`,
      );
    }
  };
  const unmarkPaid = async () => {
    if (curStage > 0) {
      if (!await confirmAction(tr(`撤销第 ${curStage} 期收款标记？该期收款方式与凭证关联会清除，原始凭证不会删除。`,`Reverse instalment ${curStage}? Its payment-method and proof links will be cleared; the original proof remains.`))) return;
      const methods = { ...(order.paymentMethods ?? {}) }; delete methods[curStage];
      const proofs = { ...(order.paymentProofs ?? {}) }; delete proofs[curStage];
      updateOrder(order.id, {
        paymentStage: curStage - 1,
        paymentMethods: methods, paymentProofs: proofs,
        seals: [makeSeal(`撤销第${curStage}期付款标记`)],
      });
      addLog("撤销收款", `撤销第${curStage}期付款标记 · 订单 ${order.orderNo}`);
    }
  };
  const handleRefund = async (mode: "normal" | "full") => {
    if (order.refund || paidAmount <= 0) return void notifyUser(tr("当前订单没有可退款的已收款项。","This order has no refundable payments."));
    const rate = mode === "full" ? 1 : refundCalc.rate;
    const amount = mode === "full" ? paidAmount : refundCalc.amount;
    const ruleText = mode === "full" ? tr("全额退还已付款项","Full refund of payments received") : refundCalc.ruleText;
    if (!await confirmAction(tr(`确认记录退款 ${money(amount)}？\n${ruleText}\n请在实际退款完成后确认，并上传退款凭证。`,`Record a refund of ${money(amount)}?\n${ruleText}\nConfirm after completing the refund and upload proof.`))) return;
    updateOrder(order.id, {
      refund: {
        amount,
        rate,
        paidAmount,
        days: daysUntilShoot,
        ruleText,
        at: new Date().toISOString(),
      },
      seals: [makeSeal(
          mode === "full"
            ? `全额退款 ${money(amount)}`
            : `按约定退款 ${Math.round(rate * 1000) / 10}% ${money(amount)}`,
        )],
    });
    addLog(
      mode === "full" ? "退款（全额）" : "退款",
      `订单 ${order.orderNo} · 退款 ${money(amount)}（已付款 ${money(paidAmount)} · ${ruleText} · 距拍摄日 ${daysUntilShoot} 天）`,
    );
  };

  // —— 状态推进：前期工单 ——
  const startShooting = () => {
    if (!pre) return;
    updatePreOrder(pre.id, {
      status: "in_progress",
      seals: [makeSeal("开始拍摄")],
    });
    addLog("状态流转", `前期工单 ${pre.preNo} → 拍摄中（开始拍摄）`);
  };
  const finishShooting = () => {
    if (!pre) return;
    updatePreOrder(pre.id, {
      status: "completed",
      seals: [makeSeal("拍摄结束，进入后期")],
    });
    addLog("状态流转", `前期工单 ${pre.preNo} → 已完成拍摄`);
    // 自动跳转到后期工单
    if (post) router.push(`/post/${post.id}`);
  };

  // —— 状态推进：后期工单 ——
  const startPost = () => {
    if (!post) return;
    updatePostOrder(post.id, {
      status: "in_progress",
      seals: [makeSeal("开始修图")],
    });
    addLog("状态流转", `后期工单 ${post.postNo} → 修图中`);
  };
  const finishPost = () => {
    if (!post) return;
    updatePostOrder(post.id, {
      status: "completed",
      seals: [makeSeal("后期完成")],
    });
    addLog("状态流转", `后期工单 ${post.postNo} → 完成后期，等待交付`);
  };

  const confirmDelivery = async () => {
    if (!await confirmAction(tr(`确认订单 ${order.orderNo} 已完成交付？完成后将开始计算资料保留期限。`,`Confirm delivery of ${order.orderNo}? The retention period starts after delivery.`))) return;
    try { executeCommand({type:'orders.deliver',payload:{id:order.id}}); }
    catch (error) { void notifyUser(errorText(error)); }
  };

  const handleCreatePre = () => {
    if (pre) {
      router.push(`/pre/${pre.id}`);
      return;
    }
    // 走「创建前期工单」确认页：信息自动带出，点按钮确认创建
    router.push(`/pre/new?orderId=${order.id}`);
  };

  const handleCreatePost = () => {
    if (post) {
      router.push(`/post/${post.id}`);
      return;
    }
    // 走「创建后期工单」确认页：信息自动带出，点按钮确认创建
    router.push(`/post/new?orderId=${order.id}`);
  };

  const handleDelete = async () => {
    if (!await confirmAction(tr(`删除订单 ${order.orderNo}？关联的前期和后期工单也会删除，此操作无法撤销。`,`Delete ${order.orderNo} and its shoot and editing tasks? This cannot be undone.`))) return;
    deleteOrder(order.id);
    router.push("/");
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700">{tr("← 返回总控台","← Back to workspace")}</Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-zinc-800">{order.orderNo}</h1>
            <Badge tone={stageTone(currentStage)}>{interfaceText(STAGE_LABELS[currentStage],language)}</Badge>
            <Link href={`/orders/${order.id}/print`}>
              <Btn size="sm">{tr("打印确认单","Print confirmation")}</Btn>
            </Link>
            {currentStage === "done" && (
              <Link href={`/orders/${order.id}/print-summary`}>
                <Btn size="sm" variant="outline">{tr("打印结算单","Print payment summary")}</Btn>
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {order.customerName} · {order.customerTypeName}
            {order.packageTierName ? ` · ${order.packageTierName}` : ""}
          </p>
        </div>

        {/* 流程提示 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{tr("订单流程","Order progress")}</SectionTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
            <span>{tr("前期","Pre-production")}</span>
            <Badge tone={pre && pre.status === "completed" ? "green" : pre ? "amber" : "zinc"}>
              {pre ? interfaceText(WORK_STATUS_LABELS[pre.status],language) : tr("未创建","Not created")}
            </Badge>
            <span className="text-zinc-400">→</span>
            <span>{tr("后期","Post-production")}</span>
            <Badge tone={post && post.status === "completed" ? "green" : post ? "amber" : "zinc"}>
              {post ? interfaceText(WORK_STATUS_LABELS[post.status],language) : tr("未创建","Not created")}
            </Badge>
            <span className="ml-1 text-xs text-zinc-400">{tr("直接点下方卡片按钮推进，无需选择阶段","Use the task actions below to update progress.")}</span>
          </div>
        </Card>

        {/* 基本信息 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{tr("订单信息","Order information")}</SectionTitle>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem label={localeText("客户姓名",viewLanguage)} value={order.customerName} />
            <InfoItem label={localeText("客户类型",viewLanguage)} value={order.customerTypeName} />
            <InfoItem label={tr("性别","Gender")} value={interfaceText(genderLabel(order.gender),language)} />
            <InfoItem label={tr("是否成年","Age category")} value={order.adult === "adult" ? tr("成年","Adult") : tr("未成年","Minor")} />
            <InfoItem label={tr("订单创建时间","Order creation time")} value={displayDateTime(order.orderCreatedAt)} />
            <InfoItem label={localeText("拍摄时间",viewLanguage)} value={displayDateTime(order.shootTime)} />
            <InfoItem label={localeText("拍摄地点",viewLanguage)} value={order.location || "—"} />
            <InfoItem label={tr("拍摄人","Photographer")} value={order.photographer || "—"} />
            <InfoItem label={localeText("套餐",viewLanguage)} value={order.packageTierName ?? "—"} />
            <InfoItem
              label={tr("附加服务","Additional services")}
              wide
              value={
                order.extras && order.extras.length > 0 ? (
                  <div className="space-y-0.5">
                    {order.extras.map((e) => {
                      const qty = e.perUnit ? (order.extraQty?.[e.id] ?? 1) : 1;
                      const amt = Math.round((e.price ?? 0) * qty * 100) / 100;
                      return (
                        <div key={e.id} className="flex items-center justify-between gap-3">
                          <span>
                            {e.name}
                            {e.perUnit ? ` ×${qty}${e.unitName ?? ""}` : ""}
                          </span>
                          <Money value={amt} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  "—"
                )
              }
            />
            <InfoItem label={tr("返图张数","Delivery count")} value={order.returnCount ? tr(`${order.returnCount} 张`,`${order.returnCount} images`) : "—"} />
            <InfoItem label={tr("返图时间","Delivery time")} value={order.returnTime ? displayDateTime(order.returnTime) : "—"} />
            <InfoItem label={localeText("订单总价值",viewLanguage)} value={<Money value={order.totalPrice} />} />
            <InfoItem label={localeText("备注",viewLanguage)} value={order.note || "—"} wide />
          </dl>
        </Card>

        {/* 付款与退款 */}
        <Card className="mb-5 p-5">
          <SectionTitle>{tr("付款与退款","Payments and refunds")}{order.refund && <Badge tone="amber">{localeText("已退款",viewLanguage)}</Badge>}
          </SectionTitle>

          {/* 四期付款进度 */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {plan.map((item, index) => {
              const p = { ...item, stage: index + 1 };
              const paid = curStage >= p.stage;
              const amt = stageAmount(totalPrice, plan, index);
              const payable = p.stage === curStage + 1;
              return (
                <div
                  key={p.stage}
                  className={`rounded-xl border p-3 ${
                    paid ? "border-green-200 bg-green-50" : "border-zinc-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-700">{tr("第","Instalment ")}{p.stage}{tr("期 ·"," · ")}{p.name}
                    </span>
                    <Badge tone={paid ? "green" : "zinc"}>
                      {paid
                        ? order.paymentMethods?.[p.stage]
                          ? tr(`已付·${paymentMethodLabel(order.paymentMethods[p.stage])}`,`Paid · ${interfaceText(paymentMethodLabel(order.paymentMethods[p.stage]),language)}`)
                          : tr("已付","Paid")
                        : tr("未付","Unpaid")}
                    </Badge>
                  </div>
                  {p.desc ? <p className="mt-0.5 text-xs text-zinc-500">{p.desc}</p> : null}
                  <div className="mt-1.5 flex items-center justify-between">
                    <Money value={amt} />
                    <span className="text-xs text-zinc-400">{Math.round(p.rate * 1000) / 10}%</span>
                  </div>
                  {!order.refund && paid && p.stage === curStage && (
                    <button
                      type="button"
                      onClick={unmarkPaid}
                      className="mt-2 w-full rounded-md border border-zinc-300 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
                    >{tr("撤销标记","Reverse payment")}</button>
                  )}
                  {paid && (
                    <ProofUpload
                      orderId={order.id}
                      kind={`pay${p.stage}`}
                      value={order.paymentProofs?.[p.stage]}
                      onChange={(v) =>
                        updateOrder(order.id, {
                          paymentProofs: { ...(order.paymentProofs ?? {}), [p.stage]: v },
                        })
                      }
                      label={tr("上传付款截图","Upload payment proof")}
                    />
                  )}
                  {!order.refund && payable && (
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {paymentMethodsOf(data.settings,language).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => markPaid(p.stage, m)}
                          className="rounded-md border border-green-300 bg-green-50 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-zinc-600">
            <span>{tr("订单总额：","Order total:")}<Money value={totalPrice} />
            </span>
            <span>{tr("已付款：","Received:")}<Money value={paidAmount} />{paren(`${Math.round(paidRate * 1000) / 10}%`,language)}
            </span>
            {order.refund && (
              <span>{tr("已退款：","Refunded:")}<Money value={order.refund.amount} />
              </span>
            )}
          </div>

          {/* 退款区 */}
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            {order.refund ? (
              <div className="text-sm text-amber-700">
                <p className="font-semibold">{tr("本订单已退款","This order has been refunded")}</p>
                <p className="mt-1 text-xs leading-5 text-amber-600">
                  {order.refund.rate >= 1
                    ? tr(`全额退款${order.refund.rate>1?` + ${Math.round((order.refund.rate-1)*100)}% 补偿`:""} · ${money(order.refund.amount)}`,`Full refund${order.refund.rate>1?` + ${Math.round((order.refund.rate-1)*100)}% compensation`:""} · ${money(order.refund.amount)}`)
                    : order.refund.rate > 0
                      ? tr(`退款 ${Math.round(order.refund.rate*100)}% · ${money(order.refund.amount)}`,`Refund ${Math.round(order.refund.rate*100)}% · ${money(order.refund.amount)}`)
                      : tr(`按约定退款 ${money(order.refund.amount)}`,`Agreed refund ${money(order.refund.amount)}`)}{tr("（已付款","(Received ")}{money(order.refund.paidAmount)}）· {order.refund.ruleText}{tr("· 拍摄前"," · Before shoot: ")}{order.refund.days}{tr("天 ·"," days · ")}{" "}
                  {displayDateTime(order.refund.at)}
                </p>
                <div className="mt-2 max-w-xs">
                  <ProofUpload
                    orderId={order.id}
                    kind="refund"
                    value={order.refund.proofImage}
                    onChange={(v) =>
                      updateOrder(order.id, { refund: { ...order.refund!, proofImage: v } })
                    }
                    label={tr("上传退款截图","Upload refund proof")}
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className="grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                  <div>{tr("距拍摄还有：","Time until shoot:")}<span className="font-semibold">{daysUntilShoot}</span>{tr("天"," days")}</div>
                  <div>
                    {tr("按约定可退","Refund under agreed terms")}{tr("：",": ")}
                    <span className="font-semibold text-amber-600">
                      {money(refundCalc.amount)}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 sm:col-span-2">{tr("适用档位：","Applicable tier: ")}{refundCalc.ruleText}{tr(" · 退款基数为已付款项"," · Based on payments received")}</div>
                  {pre?.expense ? (
                    <div className="text-xs text-zinc-500 sm:col-span-2">{tr("本单预计支出（已投入成本）：","Order expenditure (costs incurred):")}{money(pre.expense)}
                      {pre.expenseNote ? paren(pre.expenseNote,language) : ""}{tr("，普通退款已联动扣除","; deducted from the standard refund")}</div>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Btn
                    size="sm"
                    variant="outline" disabled={paidAmount <= 0}
                    onClick={() => handleRefund("normal")}
                  >{tr("按约定退款","Refund under agreed terms")}</Btn>
                  <Btn
                    size="sm"
                    variant="outline" disabled={paidAmount <= 0}
                    onClick={() => handleRefund("full")}
                  >{tr("全额退款","Full refund")}</Btn>
                </div>
                <p className="mt-3 text-xs leading-5 text-zinc-400">{tr("分期与退款档位按本订单创建时的设置计算；在「设置 › 订单与付款」中修改后，对之后创建的订单生效。","Instalments and refund tiers follow the settings in effect when this order was created. Changes in Settings › Orders and payments apply to orders created afterwards.")}</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="mb-5 p-5"><SectionTitle>{tr("署名与客户来源","Attribution and referral source")}</SectionTitle><OrderAttributionFields value={order} onChange={patch=>updateOrder(order.id,patch)} disabled={!!order.anonymizedAt}/></Card>

        {/* 快捷编辑（自动保存） */}
        <Card className="mb-5 p-5">
          <SectionTitle>{tr("快捷编辑","Quick edit")}<span className="text-xs font-normal text-zinc-400">{tr("改动即保存","Changes save automatically")}</span></SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={localeText("拍摄地点",viewLanguage)}>
              <TextInput
                value={order.location ?? ""}
                onChange={(e) => updateOrder(order.id, { location: e.target.value })}
              />
            </Field>
            <div />
            <div className="sm:col-span-2">
              <Field label={localeText("备注",viewLanguage)}>
                <TextArea
                  value={order.note ?? ""}
                  onChange={(e) => updateOrder(order.id, { note: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </Card>

        {/* 工单流转（按钮推进状态） */}
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <SectionTitle>{localeText("前期拍摄工单",viewLanguage)}</SectionTitle>
            {pre ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-amber-600">{pre.preNo}</span>
                  <Badge tone={statusTone(pre.status)}>{interfaceText(WORK_STATUS_LABELS[pre.status],language)}</Badge>
                </div>
                <p className="mt-2 text-xs text-zinc-500">{tr("设备","Equipment")}{pre.equipmentCodes.length}{tr("项 · SD"," items · SD ")}{pre.sdCardCode ?? tr("未选","Not selected")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pre.status === "pending" && (
                    <Btn size="sm" onClick={startShooting}>{tr("进入拍摄","Start shoot")}</Btn>
                  )}
                  {pre.status === "in_progress" && (
                    <Btn size="sm" onClick={finishShooting}>{tr("结束拍摄","Complete shoot")}</Btn>
                  )}
                  <Link href={`/pre/${pre.id}`}>
                    <Btn size="sm" variant="outline">
                      {pre.status === "completed" ? tr("查看工单","View task") : tr("进入工单 →","Open task →")}
                    </Btn>
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <Empty text={tr("尚未创建前期工单","No shoot task has been created")} />
                <div className="mt-3">
                  <Btn size="sm" onClick={handleCreatePre}>{tr("创建前期工单","Create shoot task")}</Btn>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle>{tr("后期修图工单","Editing task")}</SectionTitle>
            {post ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-amber-600">{post.postNo}</span>
                  <Badge tone={statusTone(post.status)}>{interfaceText(WORK_STATUS_LABELS[post.status],language)}</Badge>
                </div>
                <p className="mt-2 text-xs text-zinc-500">{tr("精修","Retouched: ")}{post.retouchCount}{tr("张 ·"," images · ")}{post.softwares.length ? post.softwares.join("、") : tr("未选软件","No application selected")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {post.status === "pending" && (
                    <Btn size="sm" onClick={startPost}>{tr("开始工单","Start task")}</Btn>
                  )}
                  {post.status === "in_progress" && (
                    <Btn size="sm" disabled={!!order.deliveredAt} onClick={finishPost}>{tr("完成后期","Complete editing")}</Btn>
                  )}
                  {post.status === "completed" && !order.deliveredAt && <Btn size="sm" onClick={confirmDelivery}>{tr("确认交付","Confirm delivery")}</Btn>}
                  <Link href={`/post/${post.id}`}>
                    <Btn size="sm" variant="outline">
                      {post.status === "completed" ? tr("查看工单","View task") : tr("进入工单 →","Open task →")}
                    </Btn>
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <Empty text={tr("尚未创建后期工单","No editing task has been created")} />
                <div className="mt-3">
                  <Btn size="sm" onClick={handleCreatePost}>{tr("创建后期工单","Create editing task")}</Btn>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* 时间戳钢印 */}
        <Card className="p-5">
          <SectionTitle>{tr("时间戳钢印（工作室时区 / UTC）","Activity timestamps (studio time zone / UTC)")}</SectionTitle>
          <SealList seals={order.seals} />
        </Card>

        {/* 危险区 */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Btn
            variant="outline"
            onClick={handleDelete}
          >{tr("删除订单","Delete order")}</Btn>
        </div>
      </div>
    </AppShell>
  );
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

function statusTone(s: "pending" | "in_progress" | "completed") {
  switch (s) {
    case "pending":
      return "zinc" as const;
    case "in_progress":
      return "amber" as const;
    case "completed":
      return "green" as const;
  }
}

/** 留痕截图上传/预览（Electron 写文件，浏览器降级 base64） */
function ProofUpload({
  orderId,
  kind,
  value,
  onChange,
  label,
}: {
  orderId: string;
  kind: string;
  value?: string;
  onChange: (v: string) => void;
  label: string;
}) {

 const tr=useStudioText();

  const inputRef = useRef<HTMLInputElement>(null);
  const [resolved,setResolved]=useState<{key:string;url:string}|null>(null);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState(false);
  const key=JSON.stringify([orderId,kind,value]);
  const url=!value?'':value.startsWith('data:')?value:resolved?.key===key?resolved.url:'';
  useEffect(()=>{
    if(!value||value.startsWith('data:'))return;
    let cancelled=false;
    void loadProofImage({orderId,kind,fileName:value}).then(url=>{if(!cancelled)setResolved({key,url});}).catch(()=>{if(!cancelled)setResolved({key,url:''});});
    return()=>{cancelled=true;};
  },[value,orderId,kind,key]);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    try {
      const saved = await saveProofImage({ orderId, kind, file: f });
      onChange(saved);
    } catch (err) {
      void notifyUser(tr(`截图保存失败：${err instanceof Error ? err.message : String(err)}`,`Unable to save proof: ${err instanceof Error ? err.message : String(err)}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      {url ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewer(true)}
            className="group relative overflow-hidden rounded-md border border-zinc-200"
            title={tr("点击查看大图","Open full-size image")}
          >
            <img
              src={url}
              alt={label}
              className="h-16 w-16 object-cover transition group-hover:scale-105"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[10px] text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">{tr("查看大图","View full-size")}</span>
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
          >{tr("更换","Replace")}</button>
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100"
          >{tr("移除","Remove")}</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full rounded-md border border-dashed border-zinc-300 py-1 text-xs text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50"
        >
          {busy ? tr("处理中…","Processing…") : `📎 ${label}`}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={pick}
      />

      {viewer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setViewer(false)}
        >
          <img
            src={url}
            alt={label}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setViewer(false)}
            className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-zinc-800 hover:bg-white"
          >{tr("关闭 ✕","Close ✕")}</button>
        </div>
      )}
    </div>
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

 const language=useStudioLanguage();

  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-zinc-500">{interfaceText(label,language)}</dt>
      <dd className="mt-0.5 text-sm text-zinc-700">{value}</dd>
    </div>
  );
}
