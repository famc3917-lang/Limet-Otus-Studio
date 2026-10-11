// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/**
 * Copyright (C) 2026 博成 · FMLC 中成博成
 */

// ============ 订单打印单 · Canvas 图片生成（零依赖） ============
// 输出：订单确认单 PNG 图片（含客户信息 / 套餐 / 附加服务 / 合计 / 备注 / 个保法声明）
import {paren} from './interface-text';
import type { Order } from "@/lib/types";
import { getSignature, signatureText } from "@/lib/types";
import type { StudioSettings } from "./settings";
import { genderLabel } from "@/lib/studio";
import { formatZoned, offsetLabel } from "./time-zone";
import {formatStudioMoney,type StudioCurrency} from './money';
import {interfaceText} from './interface-text';
import {PRIVACY_STATEMENT_EN} from './print-language';
import type {StudioLanguage} from './i18n';

const FONT_STACK =
  '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif';

/** 个人信息与版权声明默认文本（打印单末尾附加，可在打印设置中修改） */
export const PRIVACY_STATEMENT =
  "为履行摄影服务，本单仅记录订单所需的客户昵称、拍摄安排与必要业务资料。未成年人服务须由使用者核验并取得监护人的同意。资料只供订单履行、交付及售后使用；到期按保留规则清理。原始凭证和外部副本由运营者另行管理。作品著作权与使用范围由双方实际约定。本人已阅读并理解本声明。";

/** 付款与退款条款默认文本；分期与退款比例见打印单中按设置生成的表格 */
export const PAYMENT_REFUND_STATEMENT =
  "请仔细阅读以下付款与退款条款。一、付款按上表分期进行，各期金额为订单总额乘以对应比例。二、申请退款时，以已收款项为基数，按申请当日距拍摄日的天数适用上表比例；为本订单已实际产生的费用，经向客户说明后可从退款中扣除。三、因工作室原因无法完成拍摄的，全额退还已收款项，或经双方同意另行安排档期。四、其他未尽事宜由双方协商确定。本人已阅读并理解以上内容。";

/** 打印单底部条款确认行 */
export const AGREEMENT_CONFIRMATION =
  "本人已阅读并同意以上《个人信息与版权保护声明》《付款与退款声明》全部条款。如同意，请通过双方约定的通信渠道回复确认，或在电子预订单上签名。";

export interface PrintInfoRow {
  label: string;
  value: string;
}

export interface PrintExtraRow {
  name: string;
  detail: string;
  amount: number;
}

export interface PrintTicketData {
  currency?:StudioCurrency;
  language?:StudioLanguage;
  order: Order;
  signatureName: string;
  infoRows: PrintInfoRow[];
  packageRow: { name: string; price: number | null };
  extraRows: PrintExtraRow[];
  total: number;
  note: string;
  statement: string;
  generatedAt: string;
}

/** Legacy formatter for callers without workspace context. */
export function fmtPrice(n: number): string {
  return formatStudioMoney(n);
}

/** 组装打印单数据：套餐/增项实时读取订单快照，增项按数量计费 */
export function buildPrintTicketData(order: Order, packagePrice?: number,currency:StudioCurrency='CNY',language:StudioLanguage='zh',settings?:Partial<StudioSettings>): PrintTicketData {
  const text=(value:string)=>interfaceText(value,language);
  const extras = order.extras ?? [];
  const extraRows: PrintExtraRow[] = extras.map((e) => {
    const qty = e.perUnit ? (order.extraQty?.[e.id] ?? 1) : 1;
    const amount = Math.round(e.price * qty * 100) / 100;
    const detail = e.perUnit ? `${formatStudioMoney(e.price,currency,language)} × ${qty}${text(e.unitName ?? "")}` : "";
    return { name: e.name, detail, amount };
  });
  const extraSum = extraRows.reduce((s, r) => s + r.amount, 0);
  const pkg = packagePrice ?? null;
  const total =
    pkg == null
      ? (order.totalPrice ?? extraSum)
      : Math.round((pkg + extraSum) * 100) / 100;

  const infoRows: PrintInfoRow[] = [
    { label: text("客户姓名"), value: order.customerName || "—" },
    { label: text("性别"), value: text(genderLabel(order.gender)) },
    { label: text("被拍摄人身份"), value: order.customerTypeName || "—" },
    { label: text("是否成年"), value: text(order.adult === "adult" ? "成年" : "未成年") },
    { label: text("拍摄时间"), value: order.shootTime ? order.shootTime.replace("T", " ").slice(0, 16) : "—" },
    { label: text("拍摄地点"), value: order.location || "—" },
    { label: text("拍摄人"), value: order.photographer || "—" },
  ];

  const sig = getSignature(order.signature, settings);
  const now = `${formatZoned(new Date())} (${offsetLabel(new Date())})`;

  return {
    currency,language,
    order,
    signatureName: order.signatureMemberName ? `${order.signatureMemberName} · ${sig.name}` : signatureText(sig),
    infoRows,
    packageRow: { name: order.packageTierName ?? text("未选套餐"), price: pkg },
    extraRows,
    total,
    note: order.note ?? "",
    statement: language==='en'?PRIVACY_STATEMENT_EN:PRIVACY_STATEMENT,
    generatedAt: now,
  };
}

/** 按字符折行（中文逐字，适配宽画布） */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    if (cur.length > 0 && ctx.measureText(cur + ch).width > maxWidth) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawUnderline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  color: string,
  lineWidth = 1.2,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 渲染打印单为 Canvas（宽度 900，高度按内容动态计算） */
export function renderPrintTicket(d: PrintTicketData): HTMLCanvasElement {
  const text=(value:string)=>interfaceText(value,d.language??'zh');
  const W = 900;
  const PAD = 48;
  const CW = W - PAD * 2;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  const ctx = canvas.getContext("2d")!;

  // —— 预测量声明区行数 ——
  ctx.font = `600 15px ${FONT_STACK}`;
  const stmtLines = wrapLines(ctx, d.statement, CW - 44);
  const stmtH = 60 + stmtLines.length * 30 + 30;

  // —— 动态计算总高度 ——
  const topH = 148;
  const infoRowCount = Math.ceil(d.infoRows.length / 2);
  const infoH = 40 + infoRowCount * 48;
  const extraH = 44 + 46 + Math.max(1, d.extraRows.length) * 40 + 54;
  const noteH = d.note ? 40 + 30 * Math.max(1, wrapLines(ctx, d.note, CW).length) + 20 : 0;
  const bottomH = 60;
  const H = topH + infoH + extraH + noteH + stmtH + bottomH;
  canvas.height = H;

  // —— 背景 ——
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const ZINC = "#71717a";
  const DARK = "#27272a";
  const AMBER = "#d97706";
  const RED = "#dc2626";

  // —— 顶部：署名 + 标题 ——
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `500 13px ${FONT_STACK}`;
  ctx.fillStyle = ZINC;
  ctx.fillText(d.signatureName, PAD, 38);
  ctx.textAlign = "right";
  ctx.font = `500 13px ${FONT_STACK}`;
  ctx.fillText(text("摄影服务订单确认单"), W - PAD, 38);

  ctx.textAlign = "center";
  ctx.font = `700 26px ${FONT_STACK}`;
  ctx.fillStyle = DARK;
  ctx.fillText(text("摄影服务订单确认单"), W / 2, 92);

  ctx.font = `600 15px ${FONT_STACK}`;
  ctx.fillStyle = AMBER;
  ctx.fillText(d.order.orderNo, W / 2, 122);

  ctx.strokeStyle = "#e4e4e7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, 140);
  ctx.lineTo(W - PAD, 140);
  ctx.stroke();

  // —— 信息区（两列） ——
  let y = topH + 24;
  const colW = CW / 2;
  ctx.font = `500 14px ${FONT_STACK}`;
  d.infoRows.forEach((row, i) => {
    const col = i % 2;
    const rowIdx = Math.floor(i / 2);
    const x = PAD + col * colW;
    const yy = y + rowIdx * 48 + 18;
    ctx.textAlign = "left";
    ctx.fillStyle = ZINC;
    ctx.fillText(row.label + (d.language==='en'?': ':'：'), x, yy);
    const lw = ctx.measureText(row.label + "：").width;
    ctx.fillStyle = DARK;
    ctx.fillText(row.value, x + lw, yy);
  });

  // —— 服务内容区 ——
  y = topH + infoH + 8;
  ctx.textAlign = "left";
  ctx.font = `700 16px ${FONT_STACK}`;
  ctx.fillStyle = DARK;
  ctx.fillText(text("服务内容"), PAD, y + 24);

  // 套餐行
  y += 48;
  ctx.font = `500 14px ${FONT_STACK}`;
  ctx.fillStyle = DARK;
  ctx.fillText(text("套餐")+" · "+d.packageRow.name, PAD, y + 14);
  if (d.packageRow.price != null) {
    ctx.textAlign = "right";
    ctx.fillStyle = DARK;
    ctx.fillText(formatStudioMoney(d.packageRow.price,d.currency,d.language), W - PAD, y + 14);
  }
  y += 40;

  // 增项行
  if (d.extraRows.length === 0) {
    ctx.textAlign = "left";
    ctx.fillStyle = ZINC;
    ctx.font = `400 13px ${FONT_STACK}`;
    ctx.fillText(text("（无附加服务）"), PAD, y + 14);
    y += 40;
  } else {
    d.extraRows.forEach((r) => {
      ctx.textAlign = "left";
      ctx.font = `500 14px ${FONT_STACK}`;
      ctx.fillStyle = DARK;
      const label = r.detail ? `· ${r.name}${paren(r.detail,d.language??'zh')}` : `· ${r.name}`;
      ctx.fillText(label, PAD, y + 14);
      ctx.textAlign = "right";
      ctx.fillStyle = r.amount < 0 ? "#16a34a" : DARK;
      ctx.fillText(formatStudioMoney(r.amount,d.currency,d.language), W - PAD, y + 14);
      y += 40;
    });
  }

  // 分隔线
  ctx.strokeStyle = "#e4e4e7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y + 2);
  ctx.lineTo(W - PAD, y + 2);
  ctx.stroke();
  y += 22;

  // 合计行
  ctx.textAlign = "left";
  ctx.font = `700 18px ${FONT_STACK}`;
  ctx.fillStyle = DARK;
  ctx.fillText(text("订单合计"), PAD, y + 18);
  ctx.textAlign = "right";
  ctx.fillStyle = AMBER;
  ctx.font = `700 22px ${FONT_STACK}`;
  ctx.fillText(formatStudioMoney(d.total,d.currency,d.language), W - PAD, y + 18);

  // —— 备注区 ——
  if (d.note) {
    y += 52;
    ctx.textAlign = "left";
    ctx.font = `700 16px ${FONT_STACK}`;
    ctx.fillStyle = DARK;
    ctx.fillText(text("备注"), PAD, y);
    y += 18;
    ctx.font = `400 14px ${FONT_STACK}`;
    ctx.fillStyle = "#52525b";
    for (const line of wrapLines(ctx, d.note, CW)) {
      ctx.fillText(line, PAD, y + 14);
      y += 30;
    }
    y += 10;
  } else {
    y += 52;
  }

  // —— 个保法声明（红色背景 + 加粗 + 下划线） ——
  const stmtTop = y;
  const stmtBoxH = 44 + stmtLines.length * 30 + 26;
  ctx.fillStyle = RED;
  roundRect(ctx, PAD - 6, stmtTop - 34, CW + 12, stmtBoxH, 10);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.font = `700 16px ${FONT_STACK}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text("【个人信息保护声明】"), W / 2, stmtTop - 8);

  ctx.textAlign = "left";
  ctx.font = `600 15px ${FONT_STACK}`;
  ctx.fillStyle = "#ffffff";
  let sy = stmtTop + 20;
  for (const line of stmtLines) {
    ctx.fillText(line, PAD, sy + 10);
    drawUnderline(ctx, PAD, sy + 13, ctx.measureText(line).width, "#ffffff", 1);
    sy += 30;
  }

  // —— 底部生成时间 ——
  ctx.textAlign = "center";
  ctx.font = `400 12px ${FONT_STACK}`;
  ctx.fillStyle = ZINC;
  ctx.fillText(`${text('日期')}: ${d.generatedAt}`, W / 2, H - 22);


  return canvas;
}

