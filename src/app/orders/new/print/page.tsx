// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText as useInterfaceText} from '@/lib/i18n';
import { notifyUser } from '@/components/biz/dialogs';

import Link from "next/link";
import { PrintEditor, usePrintCopy } from "@/components/biz/print-editor";
import {useDocumentPrint} from '@/components/biz/document-print';
import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/store";
import { getSignature, signatureText, type Signature } from "@/lib/types";
import { formatZoned, offsetLabel } from "@/lib/time-zone";
import { PrintOrderForm } from "@/components/biz/print-order-form";
import {
  AppShell,
  Btn,
  Card,
  SectionTitle,
  SignatureSwitch,
} from "@/components/biz/ui";
import { ArrowLeft, Copy, Download, Loader2, Printer } from "lucide-react";

export default function NewOrderPrintPage() {
 const uiText=useInterfaceText();

  const { data } = useStudio();
  const printModel = usePrintCopy("booking");
  const formRef = useRef<HTMLDivElement | null>(null);
  const printDocument=useDocumentPrint(formRef);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [signature, setSignature] = useState<Signature>("");
  const [generatedAt, setGeneratedAt] = useState("");

  // 生成时间在客户端挂载后写入，避免 SSR hydration 不一致
  useEffect(() => {
    setGeneratedAt(
      `${formatZoned(new Date())} (${offsetLabel(new Date())})`,
    );
  }, []);

  const sig = getSignature(signature, data.settings);

  const handleDownload = async () => {
    const node = formRef.current;
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
      a.download = uiText('订单创建单-预定单.png','booking-form.png');
      a.click();
    } catch { void notifyUser(uiText("图片生成失败，请重试或使用打印保存为 PDF。","Unable to generate the image. Retry or print to PDF.")); } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    const node = formRef.current;
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
      <style>{`@media print { body * { visibility: hidden; } #print-order-form, #print-order-form * { visibility: visible; } #print-order-form { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; } }`}</style>

      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5">
          <Link href="/orders/new" className="text-sm text-zinc-500 hover:text-zinc-700">{uiText("← 返回新建订单","← Back to new order")}</Link>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-zinc-800">{uiText("打印预定单","Print booking form")}</h1>
            <SignatureSwitch value={signature} onChange={setSignature} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">{uiText("在创建订单前打印，供客户填写。套餐与增值服务使用当前工作室配置。","Print a booking form for the client. Services use the current studio configuration.")}</p>
        </div>

        <PrintEditor model={printModel} booking />
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
          >{uiText("预定单预览","Booking form preview")}</SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-6">
            <div className="mx-auto w-fit overflow-hidden rounded-lg shadow-md">
              <PrintOrderForm
                copy={printModel.copy}
                ref={formRef}
                packages={data.packageTiers}
                extras={data.extraItems ?? []}
                signatureName={signatureText(sig)}
                generatedAt={generatedAt}
              />
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-3 pb-8">
          <Link href="/orders/new">
            <Btn variant="outline">
              <ArrowLeft size={15} className="mr-1" />{uiText("返回新建订单","Back to new order")}</Btn>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
