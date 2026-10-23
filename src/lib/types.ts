// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import { signaturesOf, type SignatureOption, type StudioSettings } from './settings';
import { refundRangeLabel, refundRateLabel, refundRuleFor, type InstallmentStage, type RefundRule } from './payment-plan';
/**
 * Copyright (C) 2026 博成 · FMLC 中成博成
 */

// ============ 摄影工作室管理系统 · 数据类型定义 ============

/** 性别（工单号编码用：1=男，2=女） */
export type Gender = 'male' | 'female' | 'nonbinary';

/** 是否成年 */
export type AdultStatus = 'adult' | 'minor';

/** 客户类型（编号前缀：C=Coser、J=JK、L=Lolita、N=普通人） */
export interface CustomerType {
  id: string;
  name: string;
  /** 编号前缀字母：C / J / L / N */
  prefix: 'C' | 'J' | 'L' | 'N';
  builtin?: boolean;
}

/** 套餐档位 */
export interface PackageTier {
  id: string;
  name: string;
  /** 备注/包含内容说明 */
  description?: string;
  /** 套餐金额（元），后台配置可填 */
  price?: number;
  /** 返图张数（档位联动：选档位自动带出） */
  returnCount?: number;
  /** 返图周期（天），档位联动：返图时间 = 拍摄时间 + 该天数 */
  returnDays?: number;
  builtin?: boolean;
}

/** 其他/增项服务（后台「其他」Tab 维护，订单可选并计入总价） */
export interface ExtraItem {
  id: string;
  /** 增项名称，如「加急出图」「多场景加拍」「电子相册」 */
  name: string;
  /** 增项价值（元） */
  price: number;
  /** 提前返图天数：如加急出图提前2天，返图时间 = 档位周期 - 提前天数 */
  advanceDays?: number;
  /** 按数量计费：true 时订单勾选后可填数量，价格 = 单价 × 数量（如 RAW 原片 2元/张） */
  perUnit?: boolean;
  /** 数量单位名，如「张」「组」，perUnit=true 时展示 */
  unitName?: string;
  /** 备注 */
  note?: string;
  builtin?: boolean;
}

/** 拍摄风格（亮调/暗调/蓝调等，可后台维护） */
export interface ShootStyle {
  id: string;
  name: string;
  builtin?: boolean;
}

/** 设备大类 */
export type EquipmentCategory =
  | '相机机身'
  | '镜头'
  | '灯光'
  | '灯光附件'
  | '脚架'
  | '配件'
  | '存储'
  | 'ND滤镜';

/** 设备台账条目（每台设备永久绑定固定编号） */
export interface Equipment {
  id: string;
  /** 永久编号，如 Camera 001A */
  code: string;
  /** 设备名称，如 Sony Alpha 7 Mark 4（A7M4） */
  name: string;
  brand: string;
  category: EquipmentCategory;
  /** 入库时间 YYYY-MM-DD */
  stockInDate: string;
  /** 基础参数 */
  specs: string;
  /** 是否为 SD/内存卡（前期工单选卡用） */
  isSdCard?: boolean;
  builtin?: boolean;
  /** 灯光的测光参数（灯光测试使用） */
  light?: import('./lighting').LightSpec;
}

/** 时间戳钢印：任何创建/状态变更同时固定工作室时区与 UTC 两个时间，只读不可篡改 */
export interface TimeSeal {
  /** 事件说明 */
  event: string;
  /** ISO 字符串（UTC 基准） */
  iso: string;
  /** 工作室时区显示文本 YYYY-MM-DD HH:mm:ss */
  local?: string;
  /** 记录时的工作室时区（IANA 名称） */
  zone?: string;
  /** UTC 显示文本 YYYY-MM-DD HH:mm:ss */
  utc: string;
}

/** 订单阶段（总控台进度） */
export type OrderStage = 'prep' | 'shooting' | 'post' | 'done';

/** 工单状态 */
export type WorkStatus = 'pending' | 'in_progress' | 'completed';

/** 作品署名：工作室在设置中维护的署名项 id。 */
export type Signature = string;

/** 按 id 找到署名；找不到（如旧数据）时使用第一项。 */
export function getSignature(id: string | null | undefined, settings?: Partial<StudioSettings>): SignatureOption {
  const list = signaturesOf(settings);
  return list.find((s) => s.id === id) ?? list[0];
}
/** 打印与显示用的完整署名文字。 */
export const signatureText = (sig: SignatureOption) => (sig.sub ? `${sig.name} · ${sig.sub}` : sig.name);

/** 订单工单（总控台） */
export interface Order {
  signatureMemberId?:string;
  /** 绑定时的成员网名；账户改名不改写历史署名。 */
  signatureMemberName?:string;
  channel?:string;
  customerTags?:string[];
  flow?:'awaiting_post'|'post'|'awaiting_review'|'awaiting_delivery'|'delivered';
  deliveredAt?:string;
  anonymizedAt?:string;
  id: string;
  /** 订单号，如 C-260830-1-0001 */
  orderNo: string;
  /** 月内序列号（后四位），三单共享，月内全局唯一 */
  serial: string;
  /** 编号归属月份 YYYY-MM（按拍摄时间） */
  serialMonth: string;
  customerName: string;
  gender: Gender;
  adult: AdultStatus;
  customerTypeId: string;
  /** 冗余客户类型名（防止类型被删后显示丢失） */
  customerTypeName: string;
  packageTierId?: string;
  packageTierName?: string;
  /** 订单创建时间（表单填写） */
  orderCreatedAt: string;
  /** 拍摄时间 */
  shootTime: string;
  /** 拍摄地点 */
  /** 拍摄人（摄影师），创建订单时可填，前期工单联动带出 */
  photographer?: string;
  location: string;
  /** 返图张数（档位联动自动带出，后台可随时改） */
  returnCount?: number;
  /** 返图时间（档位联动自动带出，后台可随时改） */
  returnTime?: string;
  /** 增项服务（「其他」增项，计入总价） */
  extras?: ExtraItem[];
  /** 增项数量：extraId → 数量（按数量计费的增项，如 RAW 原片） */
  extraQty?: Record<string, number>;
  /** 是否需要 RAW 原片（打印单客户确认项） */
  needRaw?: boolean;
  /** 服务全部完成时间 ISO（后期工单完成时写入，用于 3 个月后待回收） */
  doneAt?: string;
  /** 订单总价值（套餐金额 + 增项金额，自动计算） */
  totalPrice?: number;
  /** 备注 */
  note?: string;
  /** 作品署名（设置中的署名项 id） */
  signature: Signature;
  stage: OrderStage;
  preOrderId?: string;
  postOrderId?: string;
  seals: TimeSeal[];
  /** 系统录入时间（实际创建动作发生时间） */
  /** 付款进度：已付到第几期（0=未付） */
  paymentStage?: number;
  /** 创建订单时约定的分期方案；旧订单缺省为四期 35/30/20/15 */
  paymentPlan?: InstallmentStage[];
  /** 创建订单时约定的退款规则 */
  refundRules?: RefundRule[];
  /** 各期收款方式：期数 → 收款方式名称 */
  paymentMethods?: Record<number, PaymentMethod>;
  /** 付款截图留痕：期数 → 截图文件名（Electron 文件模式）或内嵌 base64（浏览器降级） */
  paymentProofs?: Record<number, string>;
  /** 退款记录（已退款订单） */
  refund?: RefundRecord;
  createdAt: string;
}

// ============ 付款与退款 ============

/** 收款方式：工作室在设置中维护的名称。 */
export type PaymentMethod = string;

/** 收款方式显示名 */
export function paymentMethodLabel(id?: PaymentMethod): string {
  return id || '—';
}

/** 退款记录 */
export interface RefundRecord {
  /** 实际退款金额（元） */
  amount: number;
  /** 适用退还比例（0~1） */
  rate: number;
  /** 退款时已付款金额（元） */
  paidAmount: number;
  /** 距拍摄日天数（拍摄时间往前推） */
  days: number;
  /** 适用规则文案（如「15~29 天：70% 退还」或「不可抗力全额退款」） */
  ruleText: string;
  /** 退款时间 ISO */
  at: string;
  /** 退款截图留痕：截图文件名（Electron 文件模式）或内嵌 base64（浏览器降级） */
  proofImage?: string;
}

/**
 * 普通退款金额：已付款 × 适用档位比例，再扣除前期工单记录的预计支出（下限 0）。
 * 档位来自订单创建时保存的退款规则。
 */
export function calcRefundAmount(args: {
  paidAmount: number;
  days: number;
  rules: RefundRule[];
  expense?: number;
  language?: string;
}): { amount: number; rate: number; ruleText: string } {
  const { paidAmount, days, rules, expense } = args;
  const rule = refundRuleFor(days, rules);
  let amount = Math.round(paidAmount * rule.rate * 100) / 100;
  if (expense && expense > 0) amount = Math.max(0, Math.round((amount - expense) * 100) / 100);
  const language = args.language ?? 'zh';
  const ruleText = `${refundRangeLabel(rules, rule, language)}${language === 'en' ? ': ' : '：'}${refundRateLabel(rule.rate, language)}`;
  return { amount, rate: rule.rate, ruleText };
}

/** 前期拍摄工单 */
export interface PreOrder {
  id: string;
  /** 前期工单号 = 订单号 + -P */
  preNo: string;
  orderId: string;
  /** 以下为创建时从订单联动带入的快照 */
  customerName: string;
  customerTypeName: string;
  /** 订单套餐档位（联动带入快照） */
  packageTierName?: string;
  gender: Gender;
  adult: AdultStatus;
  shootTime: string;
  /** 现场拍摄地点（可手动修改） */
  location: string;
  /** 勾选使用的设备永久编号列表 */
  equipmentCodes: string[];
  /** 选用存储卡编号 */
  sdCardCode?: string;
  /** 多卡备份；旧单卡字段保留用于兼容历史备份。 */
  sdCardCodes?: string[];
  /** 拍摄人（摄影师） */
  photographer: string;
  /** 预计支出（元）：创建前期工单时预填，用于收支统计 */
  expense?: number;
  /** 支出说明（如场地/道具/交通/餐费） */
  expenseNote?: string;
  /** 被拍摄人角色（coser 填角色名） */
  roleName?: string;
  /** 拍摄风格（亮调/暗调/蓝调…） */
  styleIds: string[];
  /** 风格名冗余 */
  styleNames: string[];
  /** 作品署名（与订单一致，可在工单切换） */
  signature: Signature;
  status: WorkStatus;
  seals: TimeSeal[];
  createdAt: string;
}

/** 后期软件 */
export const POST_SOFTWARES = [
  'Lightroom (LR)',
  'Photoshop (PS)',
  '剪映',
  '达芬奇',
  'Audition (AU)',
  'After Effects (AE)',
] as const;

export type PostSoftware = (typeof POST_SOFTWARES)[number];

/** 后期修图工单 */
export interface PostOrder {
  id: string;
  /** 后期工单号 = 订单号 + -R */
  postNo: string;
  orderId: string;
  /** 联动带入快照 */
  customerName: string;
  customerTypeName: string;
  shootTime: string;
  packageTierName?: string;
  /** 总拍摄张数 */
  totalShots: number;
  /** 精修张数 */
  retouchCount: number;
  /** 使用软件（多选） */
  softwares: PostSoftware[];
  /** 返图时间（创建时不填，由后台「返图安排」随时维护） */
  returnTime?: string;
  /** 返图张数（同上，后台维护） */
  returnCount?: number;
  /** 作品署名（与订单一致，可在工单切换） */
  signature: Signature;
  status: WorkStatus;
  seals: TimeSeal[];
  createdAt: string;
}

/** 后台操作日志条目（前台不展示，仅留痕） */
export interface LogEntry {
  /** 操作时间 ISO */
  at: string;
  /** 操作动作（如「创建订单」「退款」「状态流转」） */
  action: string;
  /** 补充说明（对象、金额、字段等） */
  detail?: string;
}

/** 应用整体持久化数据 */
export interface AppData {
  settings?: import("./settings").StudioSettings;
  printDocuments?: Record<string, import("./print-document").PrintDocument>;
  version: number;
  orders: Order[];
  preOrders: PreOrder[];
  postOrders: PostOrder[];
  equipments: Equipment[];
  customerTypes: CustomerType[];
  packageTiers: PackageTier[];
  shootStyles: ShootStyle[];
  /** 其他/增项服务库（后台「其他」Tab 维护） */
  extraItems?: ExtraItem[];
  /** 已删除的内置增项 id：合并数据时不再补回 */
  retiredExtraIds?: string[];
  /** 后台操作日志（前台不展示） */
  logs?: LogEntry[];
}
