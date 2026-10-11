// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import type { Gender, Order, TimeSeal } from './types';
import { businessTimeZone, formatZoned } from './time-zone';

/** 生成简单唯一 id（仅前端本地使用） */
export function uid(prefix = ''): string {
  return (
    prefix +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

export function pad(n: number | string, len = 2): string {
  return String(n).padStart(len, '0');
}

/**
 * 按固定时区偏移格式化时间：YYYY-MM-DD HH:mm:ss
 * @param offsetMin 时区偏移分钟（UTC = 0）
 */
export function formatInZone(date: Date, offsetMin: number): string {
  const shifted = new Date(date.getTime() + offsetMin * 60000);
  const y = shifted.getUTCFullYear();
  const m = pad(shifted.getUTCMonth() + 1);
  const d = pad(shifted.getUTCDate());
  const hh = pad(shifted.getUTCHours());
  const mm = pad(shifted.getUTCMinutes());
  const ss = pad(shifted.getUTCSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

/** UTC 显示文本 */
export function fmtUtc(date: Date): string {
  return formatInZone(date, 0);
}

/**
 * 生成时间戳钢印：同一时刻固定记录工作室时区与 UTC 两个时间，
 * 作为工单创建/状态变更的不可篡改凭证。
 */
export function makeSeal(event: string, when: Date = new Date(), zone: string = businessTimeZone()): TimeSeal {
  return {
    event,
    iso: when.toISOString(),
    local: formatZoned(when, zone),
    zone,
    utc: fmtUtc(when),
  };
}

/** datetime-local 输入值（YYYY-MM-DDTHH:mm）转 Date（按本地时区解析） */
export function parseLocalDateTime(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 工作室时区当前时间的 datetime-local 值（用于表单默认值） */
export function nowLocalDateTimeInput(zone: string = businessTimeZone()): string {
  return formatZoned(new Date(), zone).slice(0, 16).replace(' ', 'T');
}

/** 从 datetime-local 值提取编号所需日期段：YYMMDD 与月份键 YYYY-MM */
export function codeDateParts(dateTimeLocal: string): {
  yymmdd: string;
  monthKey: string;
} {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateTimeLocal);
  if (m) {
    return {
      yymmdd: `${m[1].slice(2)}${m[2]}${m[3]}`,
      monthKey: `${m[1]}-${m[2]}`,
    };
  }
  // 兜底：用工作室时区的当前日期
  const today = formatZoned(new Date());
  return {
    yymmdd: today.slice(2, 4) + today.slice(5, 7) + today.slice(8, 10),
    monthKey: today.slice(0, 7),
  };
}

/** 性别编码：1=男，2=女，3=非二元 */
export function genderDigit(gender: Gender): 1 | 2 | 3 {
  if (gender === 'male') return 1;
  if (gender === 'female') return 2;
  return 3;
}

/** 性别显示文本 */
export function genderLabel(g: Gender): string {
  if (g === 'male') return '男';
  if (g === 'female') return '女';
  return '非二元性别';
}

/**
 * 计算指定月份的下一个月内序列号（四位，月内全局唯一，次月重置）
   * 序列号按订单建档时间所属月份统计，与订单号日期段保持一致。
 */
export function nextMonthlySerial(orders: Order[], monthKey: string): string {
  let max = 0;
  for (const o of orders) {
    if (o.serialMonth === monthKey) {
      const n = parseInt(o.serial, 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return pad(max + 1, 4);
}

/** 组装工单基础编号：前缀-日期-性别-序列号，如 C-260830-1-0001 */
export function buildBaseNo(
  prefix: string,
  yymmdd: string,
  gender: Gender,
  serial: string,
): string {
  return `${prefix}-${yymmdd}-${genderDigit(gender)}-${serial}`;
}

/** 订单号 → 前期工单号（-P） */
export function toPreNo(orderNo: string): string {
  return `${orderNo}-P`;
}

/** 订单号 → 后期工单号（-R） */
export function toPostNo(orderNo: string): string {
  return `${orderNo}-R`;
}

/** 阶段展示名 */
export const STAGE_LABELS: Record<Order['stage'], string> = {
  prep: '准备阶段',
  shooting: '拍摄阶段',
  post: '后期阶段',
  done: '已完成',
};

/** 工单状态展示名 */
export const WORK_STATUS_LABELS = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
} as const;

/** datetime-local 值 → 展示用 YYYY-MM-DD HH:mm */
export function displayDateTime(v?: string): string {
  if (!v) return '—';
  // Instants (ISO with Z or an offset) are shown in the studio time zone; business wall times are shown as entered.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(v)) { const d = new Date(v); if (!Number.isNaN(d.getTime())) return formatZoned(d).slice(0, 16); }
  return v.replace('T', ' ');
}

/** 设备分类 → 永久编号前缀 */
export const EQUIP_PREFIX: Record<string, string> = {
  相机机身: 'Camera',
  镜头: 'Lens',
  灯光: 'Light',
  灯光附件: 'LightAcc',
  脚架: 'Tripod',
  配件: 'Acc',
  存储: 'Card',
  ND滤镜: 'ND',
};

/**
 * 按设备分类自动分配下一个永久编号：前缀 + 三位序号 + 字母后缀。
 * 例：相机机身新增 → Camera 003A；同款批量时序号相同后缀递增（A/B/C…）。
 */
export function suggestEquipmentCode(
  existing: { code: string }[],
  category: string,
): string {
  const prefix = EQUIP_PREFIX[category] ?? 'Misc';
  let max = 0;
  for (const e of existing) {
    const m = new RegExp(`^${prefix}\\s*(\\d{3})[A-Z]?$`).exec(e.code.trim());
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix} ${pad(max + 1, 3)}A`;
}

/** 日期展示 YYYY-MM-DD */
export function displayDate(v?: string): string {
  if (!v) return '—';
  return v.slice(0, 10);
}

/** 统计某拍摄时间当天已有的订单数（用于排班冲突提醒） */
export function countOrdersOnDay(orders: Order[], shootTime: string): number {
  const d = parseLocalDateTime(shootTime);
  if (!d) return 0;
  const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return orders.filter((o) => {
    const od = parseLocalDateTime(o.shootTime);
    if (!od) return false;
    return `${od.getFullYear()}-${pad(od.getMonth() + 1)}-${pad(od.getDate())}` === key;
  }).length;
}

/** 排班冲突提醒：当天已有订单数 >= threshold 时返回 true（默认已有 2 单，即创建第 3 单时提示） */
export function shouldWarnSchedule(orders: Order[], shootTime: string, threshold = 2): boolean {
  return countOrdersOnDay(orders, shootTime) >= threshold;
}
