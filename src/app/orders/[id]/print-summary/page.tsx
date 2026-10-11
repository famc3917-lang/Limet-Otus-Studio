// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText as useInterfaceText,useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import {interfaceNotice} from '@/lib/interface-text';
import { notifyUser } from '@/components/biz/dialogs';

import Link from "next/link";
import {useDocumentPrint} from "@/components/biz/document-print";
import { PrintEditor, usePrintCopy } from "@/components/biz/print-editor";
import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useStudio } from "@/lib/store";
import { buildSummaryBodyHtml, buildSummaryHtml, buildSummaryData } from "@/lib/summary";
import {FinancialNotice} from '@/components/biz/financial-notice';
import {useStudioLanguage} from '@/lib/i18n';
import { displayDateTime } from "@/lib/studio";
import { AppShell, Btn, Card, Empty, SectionTitle } from "@/components/biz/ui";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Printer,
  UploadCloud,
  XCircle,
} from "lucide-react";

export default function OrderPrintSummaryPage() {
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

  const params = useParams<{ id: string }>();
  const { data } = useStudio();
  const language=useStudioLanguage();
  const printModel = usePrintCopy(`summary:${params.id}`);
  const order = data.orders.find((o) => o.id === params.id);
  const pre = data.preOrders.find((p) => p.orderId === params.id);
  const post = data.postOrders.find((p) => p.orderId === params.id);

  const summaryRef = useRef<HTMLDivElement | null>(null);
  const printDocument=useDocumentPrint(summaryRef);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const summary = useMemo(() => {
    if (!order) return null;
    const pkg = data.packageTiers.find((t) => t.id === order.packageTierId);
    return buildSummaryData({
      currency:data.settings?.currency??'CNY',language,studioName:data.settings?.name,
      order,
      packagePrice: pkg?.price,
      equipmentCodes: pre?.equipmentCodes ?? [],
      sdCardCode: pre?.sdCardCode,
    sdCardCodes: pre?.sdCardCodes,
      softwares: post?.softwares ?? [],
      expense: pre?.expense,
      expenseNote: pre?.expenseNote,
      equipments: data.equipments,
      displayDateTime,
    });
  }, [order, pre, post, data.packageTiers, data.equipments, data.settings?.currency, data.settings?.name, language]);

  if (!order || !summary) {
    return (
      <AppShell>
        <Empty text={uiText("订单不存在或已被删除","This order is unavailable or has been deleted.")} />
        <div className="mt-4 text-center">
          <Link href="/">
            <Btn>{uiText("返回总控台","Back to workspace")}</Btn>
          </Link>
        </div>
      </AppShell>
    );
  }

  const bodyHtml = buildSummaryBodyHtml(summary, printModel.copy);
  const fullHtml = buildSummaryHtml(summary, printModel.copy);

  const handleDownload = async () => {
    const node = summaryRef.current;
    if (!node) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${order.orderNo}-${uiLanguage==='en'?'payment-summary':'结算单'}.png`;
      a.click();
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    const node = summaryRef.current;
    if (!node) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const blob = await (await fetch(url)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      void notifyUser(uiText("复制失败，请改用「下载图片」后手动粘贴","Unable to copy. Download the image and attach it manually."));
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    printDocument();
  };

  /** 结算单以文本（HTML）形式上 Git，非二进制，避免仓库膨胀 */
  const handleUpload = async () => {
    setUploading(true);
    setUploadMsg(null);
    try {
      const api = (window as unknown as { pstudio?: { uploadSummary?: (p: { orderNo: string; html: string }) => Promise<{ ok: boolean; fileName?: string; error?: string }> } }).pstudio;
      if (!api?.uploadSummary) {
        setUploadMsg({ ok: false, text: "当前环境不支持 Git 上传，请使用桌面版应用" });
        return;
      }
      const res = await api.uploadSummary({ orderNo: order.orderNo, html: fullHtml });
      if (res?.ok) {
        setUploadMsg({ ok: true, text: uiText(`已上传 Git 备份：${res.fileName}`,`Git backup uploaded: ${res.fileName}`) });
      } else {
        setUploadMsg({ ok: false, text: res?.error || "上传失败" });
      }
    } catch (e) {
      setUploadMsg({ ok: false, text: String((e as Error)?.message || e) });
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppShell>
      <style>{`@media print { body * { visibility: hidden; } #print-summary, #print-summary * { visibility: visible; } #print-summary { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; } }`}</style>

      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5">
          <Link href={`/orders/${order.id}`} className="text-sm text-zinc-500 hover:text-zinc-700">{uiText("← 返回订单详情","← Back to order details")}</Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-zinc-800">{uiText("订单结束打印 · 结算汇总","Order payment summary")}</h1>
            <span className="font-mono text-sm text-amber-600">{order.orderNo}</span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">{uiText("汇总设备 / 硬件 / 软件 / 套餐 / 附加内容 / 总价 / 支出 / 退款 / 付款期数，结算单以文本形式上 Git 备份","Review services, equipment, payment stages, expenses and refunds. Export or back up the summary.")}</p>
        </div>

        <PrintEditor model={printModel} summary />
        <FinancialNotice/>
        <Card className="mb-5 p-5">
          <SectionTitle
            right={
              <div className="flex items-center gap-2">
                <Btn size="sm" variant="outline" onClick={handlePrint}>
                  <Printer size={15} className="mr-1" />{uiText("打印","Print")}</Btn>
                <Btn size="sm" variant="outline" onClick={handleCopy} disabled={exporting}>
                  {copied ? (
                    <>{uiText("✓ 已复制","✓ Copied")}</>
                  ) : (
                    <>
                      <Copy size={15} className="mr-1" />{uiText("复制图片","Copy image")}</>
                  )}
                </Btn>
                <Btn size="sm" variant="outline" onClick={handleDownload} disabled={exporting}>
                  {exporting ? (
                    <>
                      <Loader2 size={15} className="mr-1 animate-spin" />{uiText("生成中…","Generating…")}</>
                  ) : (
                    <>
                      <Download size={15} className="mr-1" />{uiText("下载图片","Download image")}</>
                  )}
                </Btn>
                <Btn size="sm" onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 size={15} className="mr-1 animate-spin" />{uiText("上传中…","Uploading…")}</>
                  ) : (
                    <>
                      <UploadCloud size={15} className="mr-1" />{uiText("上传 Git（文本）","Back up HTML to Git")}</>
                  )}
                </Btn>
              </div>
            }
          >{uiText("结算单预览","Payment summary preview")}</SectionTitle>

          {uploadMsg && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                uploadMsg.ok
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-600"
              }`}
            >
              {uploadMsg.ok ? (
                <CheckCircle2 size={15} className="shrink-0" />
              ) : (
                <XCircle size={15} className="shrink-0" />
              )}
              {interfaceNotice(uploadMsg.text,uiLanguage)}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-6">
            <div className="mx-auto w-fit overflow-hidden rounded-lg shadow-md">
              <div id="print-summary" ref={summaryRef} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-3 pb-8">
          <Link href={`/orders/${order.id}`}>
            <Btn variant="outline">
              <ArrowLeft size={15} className="mr-1" />{uiText("返回订单","Back to order")}</Btn>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
