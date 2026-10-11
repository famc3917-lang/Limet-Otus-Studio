// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
// ============ 留痕截图工具：付款/退款截图 保存与读取 ============
// Electron 环境：通过 preload 桥（window.pstudio）写文件到
//   %APPDATA%\PhotoStudio\proofs\<orderId>\，字段只存文件名
// 浏览器环境（dev 直跑）：降级为把压缩后的 base64 直接存进订单字段（localStorage）
// 字段值约定：以 data: 开头 = 内嵌 base64；否则 = Electron 文件模式的文件名

/** 是否运行在 Electron（存在 preload 桥） */
export function hasPStudio(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { pstudio?: unknown }).pstudio === "object" &&
    (window as unknown as { pstudio?: { saveProof?: unknown } }).pstudio !== null
  );
}

/** 图片压缩为 JPEG dataURL：最长边 maxSide，返回压缩后的 data URL */
export function compressImage(
  file: File,
  maxSide = 1400,
  quality = 0.85,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("图片解码失败"));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("无法创建画布"));
          return;
        }
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export interface ProofSaveInput {
  orderId: string;
  /** 截图类型：pay1~pay4（四期付款）/ refund（退款） */
  kind: string;
  file: File;
}

/** 保存留痕截图，返回字段值（文件名 或 内嵌 base64） */
export async function saveProofImage(input: ProofSaveInput): Promise<string> {
  const dataUrl = await compressImage(input.file);
  if (hasPStudio()) {
    const res = await (
      window as unknown as {
        pstudio: {
          saveProof: (p: {
            orderId: string;
            kind: string;
            fileName: string;
            dataUrl: string;
          }) => Promise<{ ok: boolean; fileName?: string; error?: string }>;
        };
      }
    ).pstudio.saveProof({
      orderId: input.orderId,
      kind: input.kind,
      fileName: input.file.name,
      dataUrl,
    });
    if (res && res.ok && res.fileName) return res.fileName;
    throw new Error((res && res.error) || "截图保存失败");
  }
  return dataUrl;
}

export interface ProofLoadInput {
  orderId: string;
  kind: string;
  /** 字段值：内嵌 base64 或 Electron 文件名 */
  fileName: string;
}

/** 读取留痕截图，返回可直接显示的 data URL */
export async function loadProofImage(input: ProofLoadInput): Promise<string> {
  if (input.fileName.startsWith("data:")) return input.fileName;
  if (hasPStudio()) {
    const res = await (
      window as unknown as {
        pstudio: {
          readProof: (p: {
            orderId: string;
            kind: string;
            fileName: string;
          }) => Promise<{ ok: boolean; dataUrl?: string; error?: string }>;
        };
      }
    ).pstudio.readProof({
      orderId: input.orderId,
      kind: input.kind,
      fileName: input.fileName,
    });
    if (res && res.ok && res.dataUrl) return res.dataUrl;
    throw new Error((res && res.error) || "截图读取失败");
  }
  return "";
}
