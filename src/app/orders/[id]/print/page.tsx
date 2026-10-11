// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText as useInterfaceText,useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import { notifyUser } from '@/components/biz/dialogs';

import Link from "next/link";
import {useDocumentPrint} from "@/components/biz/document-print";
import { PrintEditor, usePrintCopy } from "@/components/biz/print-editor";
import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useStudio } from "@/lib/store";
import { buildPrintTicketData } from "@/lib/print-ticket";
import {useStudioLanguage} from '@/lib/i18n';
import { PrintTicketHtml } from "@/components/biz/print-ticket-html";
import {
  AppShell,
  Btn,
  Card,
  Empty,
  SectionTitle,
} from "@/components/biz/ui";
import { ArrowLeft, Copy, Download, Loader2, Printer } from "lucide-react";

export default function OrderPrintPage() {
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

  const params = useParams<{ id: string }>();
  const { data } = useStudio();
  const language=useStudioLanguage();
  const printModel = usePrintCopy(`order:${params.id}`);
  const order = data.orders.find((o) => o.id === params.id);
  const ticketRef = useRef<HTMLDivElement | null>(null);
  const printDocument=useDocumentPrint(ticketRef);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const ticket = useMemo(() => {
    if (!order) return null;
    const pkg = data.packageTiers.find((t) => t.id === order.packageTierId);
    return buildPrintTicketData(order, pkg?.price,data.settings?.currency??'CNY',language,data.settings);
  }, [order, data.packageTiers,data.settings,language]);

  if (!order || !ticket) {
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

  const handleDownload = async () => {
    const node = ticketRef.current;
    if (!node) return;
    setExporting(true);
    try {
      // 动态加载 html-to-image（基于浏览器原生渲染，兼容 Tailwind 4 oklch 颜色）
      const { toPng } = await import("html-to-image");
      const url = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${order.orderNo}-${uiLanguage==='en'?'confirmation':'打印单'}.png`;
      a.click();
    } catch { void notifyUser(uiText("图片生成失败，请重试或使用打印保存为 PDF。","Unable to generate the image. Retry or print to PDF.")); } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    const node = ticketRef.current;
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

  return (
    <AppShell>
      {/* 打印时只显示打印单区域 */}
      <style>{`@media print { body * { visibility: hidden; } #print-ticket, #print-ticket * { visibility: visible; } #print-ticket { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; } }`}</style>

      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5">
          <Link href={`/orders/${order.id}`} className="text-sm text-zinc-500 hover:text-zinc-700">{uiText("← 返回订单详情","← Back to order details")}</Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-zinc-800">{uiText("订单打印单","Order confirmation")}</h1>
            <span className="font-mono text-sm text-amber-600">{order.orderNo}</span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">{uiText("确认单按 HTML 高清排版生成图片，可下载发送给客户或直接打印","Print the confirmation or export an image to share with the client.")}</p>
        </div>

        <PrintEditor model={printModel} />
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
                <Btn size="sm" onClick={handleDownload} disabled={exporting}>
                  {exporting ? (
                    <>
                      <Loader2 size={15} className="mr-1 animate-spin" />{uiText("生成中…","Generating…")}</>
                  ) : (
                    <>
                      <Download size={15} className="mr-1" />{uiText("下载图片","Download image")}</>
                  )}
                </Btn>
              </div>
            }
          >{uiText("打印单预览","Confirmation preview")}</SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-6">
            <div className="mx-auto w-fit overflow-hidden rounded-lg shadow-md">
              <PrintTicketHtml ref={ticketRef} d={ticket} copy={printModel.copy} />
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
