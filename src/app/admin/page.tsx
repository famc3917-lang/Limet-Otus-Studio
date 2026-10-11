// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/**
 * Copyright (C) 2026 博成 · FMLC 中成博成
 */

'use client';
import {errorText} from '@/lib/interface-error';
import {useStudioText as useInterfaceText,useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import {interfaceText,interfaceNotice,logDetailText} from '@/lib/interface-text';
import { confirmAction, notifyUser } from '@/components/biz/dialogs';
import { validateData } from '@/lib/data-integrity';
import {useMoneyFormatter} from '@/lib/use-money';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '@/lib/store';
import { OrderPaymentSettings } from '@/components/biz/order-payment-settings';
import { getCurrentUser, logout } from '@/lib/auth';
import { buildSeedData } from '@/lib/seed';
import { EQUIP_PREFIX, displayDate, displayDateTime, suggestEquipmentCode, uid } from '@/lib/studio';
import type { CustomerType, Equipment, ExtraItem, PackageTier, ShootStyle } from '@/lib/types';
import {
  AppShell, Badge, Btn, Card, Empty, Field, SectionTitle, Select, TextInput,
} from '@/components/biz/ui';

const EQUIP_CATEGORIES = ['相机机身', '镜头', '灯光', '灯光附件', '脚架', '配件', '存储', 'ND滤镜'] as const;
const PREFIX_OPTIONS = [
  { value: 'C', label: 'C（Coser/二次元）' },
  { value: 'J', label: 'J（JK）' },
  { value: 'L', label: 'L（Lolita）' },
  { value: 'N', label: 'N（普通人）' },
] as const;

const TABS = [
  { id: 'customer', label: '客户类型' },
  { id: 'tier', label: '套餐档位' },
  { id: 'style', label: '拍摄风格' },
  { id: 'equip', label: '设备台账' },
  { id: 'extra', label: '其他增项' },
  { id: 'payment', label: '订单与付款' },
  { id: 'data', label: '数据管理' },
  { id: 'account', label: '账户与关于' },
] as const;

/* —— 各表单草稿类型（均为字符串，提交时再转换） —— */
type TierDraft = { name: string; description: string; price: string; returnCount: string; returnDays: string };
type EquipDraft = {
  code: string; name: string; brand: string; category: string;
  stockInDate: string; specs: string; isSdCard: boolean;
};
type ExtraDraft = { name: string; price: string; advanceDays: string; perUnit: boolean; unitName: string; note: string };

const TIER_EMPTY: TierDraft = { name: '', description: '', price: '', returnCount: '', returnDays: '' };
const EQUIP_EMPTY: EquipDraft = {
  code: '', name: '', brand: '', category: '相机机身',
  stockInDate: '', specs: '', isSdCard: false,
};
const EXTRA_EMPTY: ExtraDraft = { name: '', price: '', advanceDays: '', perUnit: false, unitName: '', note: '' };

function TierFormFields({ v, onChange }: { v: TierDraft; onChange: (x: TierDraft) => void }) {
 const uiText=useInterfaceText();

  const {data}=useStudio();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Field label={uiText("档位名称","Package name")} required>
        <TextInput value={v.name} placeholder={uiText("如：基础档","e.g. Essentials")} onChange={(e) => onChange({ ...v, name: e.target.value })} />
      </Field>
      <Field label={uiText(`套餐金额（${data.settings?.currency??'CNY'}）`,`Package price (${data.settings?.currency??'CNY'})`)}>
        <TextInput type="number" value={v.price} placeholder="0" onChange={(e) => onChange({ ...v, price: e.target.value })} />
      </Field>
      <Field label={uiText("返图张数","Delivery count")}>
        <TextInput type="number" min={0} value={v.returnCount} placeholder={uiText("如：9","e.g. 9")} onChange={(e) => onChange({ ...v, returnCount: e.target.value })} />
      </Field>
      <Field label={uiText("返图周期（天）","Turnaround (days)")}>
        <TextInput type="number" min={0} value={v.returnDays} placeholder={uiText("如：7","e.g. 7")} onChange={(e) => onChange({ ...v, returnDays: e.target.value })} />
      </Field>
      <Field label={uiText("包含内容说明","Included services")}>
        <TextInput value={v.description} placeholder={uiText("如：单人单场景 · 精修9张","e.g. One person, one location, nine retouched images")} onChange={(e) => onChange({ ...v, description: e.target.value })} />
      </Field>
    </div>
  );
}

function EquipFields({ v, onChange, items }: { v: EquipDraft; onChange: (x: EquipDraft | ((prev: EquipDraft) => EquipDraft)) => void; items: Equipment[] }) {
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

  const changeCategory = (val: string) => {
    const suggested = suggestEquipmentCode(items, val);
    onChange((prev) => {
      const next = { ...prev, category: val };
      if (!prev.code || prev.code.startsWith(EQUIP_PREFIX[prev.category] ?? '')) {
        next.code = suggested;
      }
      return next;
    });
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label={uiText("分类","Category")} required>
        <Select value={v.category} onChange={(e) => changeCategory(e.target.value)}>
          {EQUIP_CATEGORIES.map((c) => (
            <option key={c} value={c}>{interfaceText(c,uiLanguage)}</option>
          ))}
        </Select>
      </Field>
      <Field label={uiText("永久编号","Permanent ID")} required hint={uiText("新增时自动分配，编号全局唯一","Assigned when added; unique across the register")}>
        <TextInput value={v.code} onChange={(e) => onChange({ ...v, code: e.target.value })} />
      </Field>
      <Field label={uiText("设备名称","Equipment name")} required>
        <TextInput value={v.name} placeholder={uiText("如：Sony Alpha 7 Mark 4","e.g. Sony Alpha 7 IV")} onChange={(e) => onChange({ ...v, name: e.target.value })} />
      </Field>
      <Field label={uiText("品牌","Brand")}>
        <TextInput value={v.brand} placeholder={uiText("如：Sony 索尼","e.g. Sony")} onChange={(e) => onChange({ ...v, brand: e.target.value })} />
      </Field>
      <Field label={uiText("入库时间","Date added")}>
        <TextInput type="date" value={v.stockInDate} onChange={(e) => onChange({ ...v, stockInDate: e.target.value })} />
      </Field>
      <Field label={uiText("基础参数","Specifications")}>
        <TextInput value={v.specs} placeholder={uiText("如：全画幅 · 3300万像素","e.g. Full-frame · 33 MP")} onChange={(e) => onChange({ ...v, specs: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2 lg:col-span-3">
        <input
          type="checkbox"
          checked={v.isSdCard}
          onChange={(e) => onChange({ ...v, isSdCard: e.target.checked })}
          className="h-4 w-4 accent-amber-500"
        />{uiText("存储卡（前期工单可选用）","Memory card (available on shoot tasks)")}</label>
    </div>
  );
}

function ExtraFields({ v, onChange }: { v: ExtraDraft; onChange: (x: ExtraDraft) => void }) {
 const uiText=useInterfaceText();

  const {data}=useStudio();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label={uiText("增项名称","Add-on name")} required>
        <TextInput value={v.name} placeholder={uiText("如：加急出图、电子相册","e.g. Expedited delivery, digital album")} onChange={(e) => onChange({ ...v, name: e.target.value })} />
      </Field>
      <Field label={uiText(`单价（${data.settings?.currency??'CNY'}）`,`Unit price (${data.settings?.currency??'CNY'})`)} hint={uiText("可填负数表示减免","Use a negative amount for a discount")}>
        <TextInput type="number" value={v.price} placeholder="0" onChange={(e) => onChange({ ...v, price: e.target.value })} />
      </Field>
      <Field label={uiText("提前返图天数","Expedited days")} hint={uiText("选此增项后，返图时间提前 N 天（如加急出图填 2）","This add-on moves delivery earlier by the entered number of days.")}>
        <TextInput type="number" min={0} value={v.advanceDays} placeholder="0" onChange={(e) => onChange({ ...v, advanceDays: e.target.value })} />
      </Field>
      <Field label={uiText("按数量计费","Charge by quantity")} hint={uiText("开启后订单勾选此增项可填写数量，价格 = 单价 × 数量（如 RAW 原片 2元/张）","Allows a quantity on the order. Add-on price = unit price × quantity.")}>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={v.perUnit}
            onChange={(e) => onChange({ ...v, perUnit: e.target.checked })}
            className="h-4 w-4 accent-amber-600"
          />{uiText("按数量计费","Charge by quantity")}</label>
      </Field>
      {v.perUnit && (
        <Field label={uiText("数量单位","Quantity unit")} hint={uiText("如：张、组、份","e.g. images, sets, copies")}>
          <TextInput value={v.unitName} placeholder={uiText("如：张","e.g. image")} onChange={(e) => onChange({ ...v, unitName: e.target.value })} />
        </Field>
      )}
      <Field label={uiText("备注","Notes")}>
        <TextInput value={v.note} placeholder={uiText("如：48小时内交付","e.g. Delivery within 48 hours")} onChange={(e) => onChange({ ...v, note: e.target.value })} />
      </Field>
    </div>
  );
}

export default function AdminPage() {
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

  const [tab, setTab] = useState<string>(() => {
    if (typeof window === 'undefined') return 'customer';
    const selected = new URLSearchParams(window.location.search).get('tab');
    return TABS.some(t=>t.id===selected) ? selected! : 'customer';
  });
  const selectTab = (id: string) => { setTab(id); const url = new URL(window.location.href); url.searchParams.set('tab',id); window.history.replaceState(null,'',url); };
  return (
    <AppShell>
      <div className="mb-6 settings-intro">
        <h1 className="text-xl font-bold text-zinc-800">{uiText("工作室设置","Business settings")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{uiText("按工作室的业务需要，调整客户类型、套餐、拍摄风格、设备、增项，以及订单署名、渠道、收款与退款规则。","Configure client types, packages, styles, equipment, additional services, and order signatures, channels, payments and refund rules.")}</p>
      </div>
      <div className="settings-tabs" role="tablist" aria-label={uiText("设置分类","Settings categories")}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab" aria-selected={tab===t.id} aria-controls="settings-panel" tabIndex={tab===t.id?0:-1}
            onClick={() => selectTab(t.id)}
            onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const i=TABS.findIndex(x=>x.id===tab);const next=TABS[(i+(e.key==='ArrowRight'?1:-1)+TABS.length)%TABS.length];selectTab(next.id);(e.currentTarget.parentElement?.querySelectorAll('button')[TABS.findIndex(x=>x.id===next.id)] as HTMLButtonElement)?.focus();}}}
            className="settings-tab"
          >
            {interfaceText(t.label,uiLanguage)}
          </button>
        ))}
      </div>
      <div id="settings-panel" role="tabpanel" aria-label={interfaceText(TABS.find(t=>t.id===tab)?.label??'',uiLanguage)}>
      {tab === 'customer' && <CustomerTypesTab />}
      {tab === 'tier' && <PackageTiersTab />}
      {tab === 'style' && <ShootStylesTab />}
      {tab === 'equip' && <EquipmentsTab />}
      {tab === 'extra' && <ExtrasTab />}
      {tab === 'payment' && <OrderPaymentSettings />}
      {tab === 'data' && <DataTab />}
      {tab === 'account' && <AccountTab />}
      </div>
    </AppShell>
  );
}

/* ==================== 客户类型 ==================== */

function CustomerTypesTab() {
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

  const { data, saveCustomerTypes } = useStudio();
  const [draft, setDraft] = useState({ name: '', prefix: 'N' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: '', prefix: 'N' });
  const [err, setErr] = useState('');

  const items = data.customerTypes;

  const startEdit = (it: CustomerType) => {
    setEditId(it.id);
    setEditDraft({ name: it.name, prefix: it.prefix });
    setErr('');
  };

  const saveEdit = () => {
    if (!editDraft.name.trim()) return setErr(uiText("名称不能为空","Enter a name"));
    saveCustomerTypes(
      items.map((it) =>
        it.id === editId
          ? { ...it, name: editDraft.name.trim(), prefix: editDraft.prefix as CustomerType['prefix'] }
          : it,
      ),
    );
    setEditId(null);
  };

  const addItem = () => {
    if (!draft.name.trim()) return setErr(uiText("名称不能为空","Enter a name"));
    const newItem: CustomerType = {
      id: uid('ct-'),
      name: draft.name.trim(),
      prefix: draft.prefix as CustomerType['prefix'],
    };
    saveCustomerTypes([...items, newItem]);
    setDraft({ name: '', prefix: 'N' });
    setErr('');
  };

  const removeItem = (id: string) => {
    saveCustomerTypes(items.filter((it) => it.id !== id));
  };

  return (
    <Card className="p-5">
      <SectionTitle
        right={<Badge tone="blue">{items.length}{uiText("项"," items")}</Badge>}
      >{uiText("客户类型（决定订单号前缀）","Client types (order-number prefixes)")}</SectionTitle>
      <p className="-mt-2 mb-4 text-xs text-zinc-500">{uiText("订单号编码：前缀-日期-性别-序列号，如 C-260830-1-0001","Order number: prefix-date-gender-sequence, e.g. C-260830-1-0001")}</p>

      <div className="space-y-2">
        {items.map((it) =>
          editId === it.id ? (
            <div key={it.id} className="rounded-lg border border-amber-500/40 bg-amber-50 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={uiText("类型名称","Type name")}>
                  <TextInput
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  />
                </Field>
                <Field label={uiText("编号前缀","ID prefix")}>
                  <Select
                    value={editDraft.prefix}
                    onChange={(e) => setEditDraft({ ...editDraft, prefix: e.target.value })}
                  >
                    {PREFIX_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>{interfaceText(p.label,uiLanguage)}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
              <div className="mt-3 flex gap-2">
                <Btn size="sm" onClick={saveEdit}>{uiText("保存","Save")}</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setEditId(null)}>{uiText("取消","Cancel")}</Btn>
              </div>
            </div>
          ) : (
            <div key={it.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <Badge tone="amber">{it.prefix}</Badge>
                <span className="text-sm text-zinc-800">{it.name}</span>
                {it.builtin && <span className="text-[11px] text-zinc-400">{uiText("内置","Built-in")}</span>}
              </div>
              <div className="flex gap-2">
                <Btn size="sm" variant="ghost" onClick={() => startEdit(it)}>{uiText("编辑","Edit")}</Btn>
                <Btn size="sm" variant="danger" onClick={() => removeItem(it.id)}>{uiText("删除","Delete")}</Btn>
              </div>
            </div>
          ),
        )}
        {items.length === 0 && <Empty text={uiText("暂无客户类型","No client types")} />}
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-zinc-300 p-3">
        <div className="mb-3 text-xs font-medium text-zinc-400">{uiText("新增客户类型","Add client type")}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={uiText("类型名称","Type name")}>
            <TextInput
              value={draft.name}
              placeholder={uiText("如：Cosplay、JK、Lolita、普通人像","e.g. Cosplay, JK, Lolita, Portrait")}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label={uiText("编号前缀","ID prefix")}>
            <Select
              value={draft.prefix}
              onChange={(e) => setDraft({ ...draft, prefix: e.target.value })}
            >
              {PREFIX_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{interfaceText(p.label,uiLanguage)}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-3">
          <Btn size="sm" onClick={addItem}>{uiText("添加","Add")}</Btn>
        </div>
      </div>
    </Card>
  );
}

/* ==================== 套餐档位 ==================== */

function PackageTiersTab() {
 const uiText=useInterfaceText();

  const money=useMoneyFormatter();
  const { data, savePackageTiers } = useStudio();
  const [draft, setDraft] = useState(TIER_EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(TIER_EMPTY);
  const [err, setErr] = useState('');

  const items = data.packageTiers;

  const toDraft = (t: PackageTier) => ({
    name: t.name,
    description: t.description ?? '',
    price: t.price === undefined ? '' : String(t.price),
    returnCount: t.returnCount === undefined ? '' : String(t.returnCount),
    returnDays: t.returnDays === undefined ? '' : String(t.returnDays),
  });

  const startEdit = (t: PackageTier) => {
    setEditId(t.id);
    setEditDraft(toDraft(t));
    setErr('');
  };

  const saveEdit = () => {
    if (!editDraft.name.trim()) return setErr(uiText("名称不能为空","Enter a name"));
    savePackageTiers(
      items.map((t) =>
        t.id === editId
          ? {
              ...t,
              name: editDraft.name.trim(),
              description: editDraft.description.trim(),
              price: editDraft.price === '' ? undefined : Number(editDraft.price),
              returnCount: editDraft.returnCount === '' ? undefined : Number(editDraft.returnCount),
              returnDays: editDraft.returnDays === '' ? undefined : Number(editDraft.returnDays),
            }
          : t,
      ),
    );
    setEditId(null);
  };

  const addItem = () => {
    if (!draft.name.trim()) return setErr(uiText("名称不能为空","Enter a name"));
    const newItem: PackageTier = {
      id: uid('pt-'),
      name: draft.name.trim(),
      description: draft.description.trim(),
      price: draft.price === '' ? undefined : Number(draft.price),
      returnCount: draft.returnCount === '' ? undefined : Number(draft.returnCount),
      returnDays: draft.returnDays === '' ? undefined : Number(draft.returnDays),
    };
    savePackageTiers([...items, newItem]);
    setDraft(TIER_EMPTY);
    setErr('');
  };

  const removeItem = (id: string) => {
    savePackageTiers(items.filter((t) => t.id !== id));
  };

  return (
    <Card className="p-5">
      <SectionTitle right={<Badge tone="blue">{items.length}{uiText("档"," packages")}</Badge>}>{uiText("套餐档位（订单选档位自动带出返图张数与返图时间）","Packages (delivery count and turnaround)")}</SectionTitle>
      <p className="-mt-2 mb-4 text-xs text-zinc-500">{uiText("新建订单选择档位后，返图张数 = 档位返图张数；返图时间 = 拍摄时间 + 返图周期（天），工单内仍可随时微调。","Selecting a package sets the delivery count and adds its turnaround to the shoot date. Adjust these values in the task when needed.")}</p>

      <div className="space-y-2">
        {items.map((t) =>
          editId === t.id ? (
            <div key={t.id} className="rounded-lg border border-amber-500/40 bg-amber-50 p-3">
              <TierFormFields v={editDraft} onChange={setEditDraft} />
              {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
              <div className="mt-3 flex gap-2">
                <Btn size="sm" onClick={saveEdit}>{uiText("保存","Save")}</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setEditId(null)}>{uiText("取消","Cancel")}</Btn>
              </div>
            </div>
          ) : (
            <div key={t.id} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-zinc-800">{t.name}</span>
                  {t.builtin && <span className="text-[11px] text-zinc-400">{uiText("内置","Built-in")}</span>}
                  {t.price !== undefined && <Badge tone="amber">{money(t.price)}</Badge>}
                  {t.returnCount !== undefined && <Badge tone="green">{uiText("返图","Delivery ")}{t.returnCount}{uiText("张"," images")}</Badge>}
                  {t.returnDays !== undefined && <Badge tone="purple">{t.returnDays}{uiText("天内"," days")}</Badge>}
                </div>
                <div className="flex gap-2">
                  <Btn size="sm" variant="ghost" onClick={() => startEdit(t)}>{uiText("编辑","Edit")}</Btn>
                  <Btn size="sm" variant="danger" onClick={() => removeItem(t.id)}>{uiText("删除","Delete")}</Btn>
                </div>
              </div>
              {t.description && <p className="mt-1.5 text-xs text-zinc-500">{t.description}</p>}
            </div>
          ),
        )}
        {items.length === 0 && <Empty text={uiText("暂无套餐档位","No packages")} />}
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-zinc-300 p-3">
        <div className="mb-3 text-xs font-medium text-zinc-400">{uiText("新增档位","Add package")}</div>
        <TierFormFields v={draft} onChange={setDraft} />
        <div className="mt-3">
          <Btn size="sm" onClick={addItem}>{uiText("添加","Add")}</Btn>
        </div>
      </div>
    </Card>
  );
}

/* ==================== 拍摄风格 ==================== */

function ShootStylesTab() {
 const uiText=useInterfaceText();

  const { data, saveShootStyles } = useStudio();
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [err, setErr] = useState('');

  const items = data.shootStyles;

  const startEdit = (s: ShootStyle) => {
    setEditId(s.id);
    setEditName(s.name);
    setErr('');
  };

  const saveEdit = () => {
    if (!editName.trim()) return setErr(uiText("名称不能为空","Enter a name"));
    saveShootStyles(items.map((s) => (s.id === editId ? { ...s, name: editName.trim() } : s)));
    setEditId(null);
  };

  const addItem = () => {
    if (!name.trim()) return setErr(uiText("名称不能为空","Enter a name"));
    const newItem: ShootStyle = { id: uid('ss-'), name: name.trim() };
    saveShootStyles([...items, newItem]);
    setName('');
    setErr('');
  };

  const removeItem = (id: string) => {
    saveShootStyles(items.filter((s) => s.id !== id));
  };

  return (
    <Card className="p-5">
      <SectionTitle right={<Badge tone="blue">{items.length}{uiText("种"," styles")}</Badge>}>{uiText("拍摄风格（亮调 / 暗调 / 蓝调…）","Shoot styles (high key, low key, blue tones…)")}</SectionTitle>

      <div className="flex flex-wrap gap-2">
        {items.map((s) =>
          editId === s.id ? (
            <div key={s.id} className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-50 p-1.5">
              <TextInput
                value={editName}
                className="w-32"
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
              />
              <Btn size="sm" onClick={saveEdit}>{uiText("保存","Save")}</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setEditId(null)}>{uiText("取消","Cancel")}</Btn>
            </div>
          ) : (
            <span key={s.id} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700">
              {s.name}
              {s.builtin && <span className="text-[10px] text-zinc-400">{uiText("内置","Built-in")}</span>}
              <button
                type="button"
                onClick={() => startEdit(s)}
                className="text-xs text-zinc-500 transition hover:text-amber-600"
              >{uiText("改","Edit")}</button>
              <button
                type="button"
                onClick={() => removeItem(s.id)}
                className="text-xs text-zinc-500 transition hover:text-red-500"
              >
                ✕
              </button>
            </span>
          ),
        )}
        {items.length === 0 && <Empty text={uiText("暂无拍摄风格","No shoot styles")} />}
      </div>

      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

      <div className="mt-5 flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 p-3">
        <TextInput
          value={name}
          placeholder={uiText("新增风格，如：逆光、夜景","Add a style, e.g. Backlight, Night")}
          className="max-w-xs"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
        />
        <Btn size="sm" onClick={addItem}>{uiText("添加","Add")}</Btn>
      </div>
    </Card>
  );
}

/* ==================== 设备台账 ==================== */

function EquipmentsTab() {
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

  const { data, saveEquipments } = useStudio();
  const items = data.equipments;
  const makeDraft = (cat: string) => ({ ...EQUIP_EMPTY, category: cat, code: suggestEquipmentCode(items, cat) });
  const [draft, setDraft] = useState(() => makeDraft('相机机身'));
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(EQUIP_EMPTY);
  const [err, setErr] = useState('');

  const toDraft = (e: Equipment) => ({
    code: e.code,
    name: e.name,
    brand: e.brand,
    category: e.category,
    stockInDate: e.stockInDate,
    specs: e.specs,
    isSdCard: e.isSdCard ?? false,
  });

  const startEdit = (e: Equipment) => {
    setEditId(e.id);
    setEditDraft(toDraft(e));
    setErr('');
  };

  const saveEdit = () => {
    if (!editDraft.name.trim() || !editDraft.code.trim()) return setErr(uiText("设备名称与编号不能为空","Enter an equipment name and ID"));
    const dup = items.some(
      (e) => e.id !== editId && e.code.trim().toLowerCase() === editDraft.code.trim().toLowerCase(),
    );
    if (dup) return setErr(uiText("该设备编号已存在，编号需保持唯一","This equipment ID is already in use"));
    saveEquipments(
      items.map((e) =>
        e.id === editId
          ? {
              ...e,
              code: editDraft.code.trim(),
              name: editDraft.name.trim(),
              brand: editDraft.brand.trim(),
              category: editDraft.category as Equipment['category'],
              stockInDate: editDraft.stockInDate,
              specs: editDraft.specs.trim(),
              isSdCard: editDraft.isSdCard,
            }
          : e,
      ),
    );
    setEditId(null);
  };

  const addItem = () => {
    if (!draft.name.trim() || !draft.code.trim()) return setErr(uiText("设备名称与编号不能为空","Enter an equipment name and ID"));
    const dup = items.some((e) => e.code.trim().toLowerCase() === draft.code.trim().toLowerCase());
    if (dup) return setErr(uiText("该设备编号已存在，编号需保持唯一","This equipment ID is already in use"));
    const newItem: Equipment = {
      id: uid('eq-'),
      code: draft.code.trim(),
      name: draft.name.trim(),
      brand: draft.brand.trim(),
      category: draft.category as Equipment['category'],
      stockInDate: draft.stockInDate,
      specs: draft.specs.trim(),
      isSdCard: draft.isSdCard,
    };
    saveEquipments([...items, newItem]);
    setDraft(makeDraft(draft.category));
    setErr('');
  };

  const removeItem = (id: string) => {
    saveEquipments(items.filter((e) => e.id !== id));
  };

  const groups = EQUIP_CATEGORIES.map((cat) => ({
    cat,
    list: items.filter((e) => e.category === cat),
  }));

  return (
    <Card className="p-5">
      <SectionTitle right={<Badge tone="blue">{items.length}{uiText("台"," items")}</Badge>}>{uiText("设备台账（每台设备绑定永久编号）","Equipment register (permanent IDs)")}</SectionTitle>
      <p className="-mt-2 mb-4 text-xs text-zinc-500">{uiText("编号规则：Camera / Lens / Light / LightAcc / Tripod / Acc / Card / ND + 三位序号 + 字母后缀；被工单引用的设备以编号快照留存，删除后不影响历史工单显示。","IDs use a category prefix, a three-digit sequence and a letter suffix. Tasks retain equipment references even after removal from the register.")}</p>

      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.cat}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-700">{interfaceText(g.cat,uiLanguage)}</h3>
              <Badge tone="zinc">{g.list.length}</Badge>
            </div>
            {g.list.length === 0 ? (
              <p className="text-xs text-zinc-400">{uiText("暂无设备","No equipment")}</p>
            ) : (
              <div className="space-y-2">
                {g.list.map((e) =>
                  editId === e.id ? (
                    <div key={e.id} className="rounded-lg border border-amber-500/40 bg-amber-50 p-3">
                      <EquipFields v={editDraft} onChange={setEditDraft} items={items} />
                      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
                      <div className="mt-3 flex gap-2">
                        <Btn size="sm" onClick={saveEdit}>{uiText("保存","Save")}</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => setEditId(null)}>{uiText("取消","Cancel")}</Btn>
                      </div>
                    </div>
                  ) : (
                    <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm text-amber-600">{e.code}</span>
                          <span className="text-sm text-zinc-800">{e.name}</span>
                          {e.isSdCard && <Badge tone="purple">{uiText("存储卡","Memory card")}</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {[e.brand, e.stockInDate ? uiText(`入库 ${displayDate(e.stockInDate)}`,`Added ${displayDate(e.stockInDate)}`) : '', e.specs]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Btn size="sm" variant="ghost" onClick={() => startEdit(e)}>{uiText("编辑","Edit")}</Btn>
                        <Btn size="sm" variant="danger" onClick={() => removeItem(e.id)}>{uiText("删除","Delete")}</Btn>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <Empty text={uiText("暂无设备","No equipment")} />}
      </div>

      <div className="mt-6 rounded-lg border border-dashed border-zinc-300 p-3">
        <div className="mb-3 text-xs font-medium text-zinc-400">{uiText("新增设备","Add equipment")}</div>
        <EquipFields v={draft} onChange={setDraft} items={items} />
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
        <div className="mt-3">
          <Btn size="sm" onClick={addItem}>{uiText("添加","Add")}</Btn>
        </div>
      </div>
    </Card>
  );
}

/* ==================== 其他 / 增项服务 ==================== */

function ExtrasTab() {
 const uiText=useInterfaceText();

  const money=useMoneyFormatter();
  const { data, saveExtraItems } = useStudio();
  const [draft, setDraft] = useState(EXTRA_EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(EXTRA_EMPTY);
  const [err, setErr] = useState('');

  const items = data.extraItems ?? [];

  const toDraft = (e: ExtraItem) => ({
    name: e.name,
    price: e.price === undefined ? '' : String(e.price),
    advanceDays: e.advanceDays === undefined ? '' : String(e.advanceDays),
    perUnit: e.perUnit ?? false,
    unitName: e.unitName ?? '',
    note: e.note ?? '',
  });

  const startEdit = (e: ExtraItem) => {
    setEditId(e.id);
    setEditDraft(toDraft(e));
    setErr('');
  };

  const saveEdit = () => {
    if (!editDraft.name.trim()) return setErr(uiText("名称不能为空","Enter a name"));
    saveExtraItems(
      items.map((e) =>
        e.id === editId
          ? {
              ...e,
              name: editDraft.name.trim(),
              price: editDraft.price === '' ? 0 : Number(editDraft.price),
              advanceDays: editDraft.advanceDays === '' ? undefined : Number(editDraft.advanceDays),
              perUnit: editDraft.perUnit,
              unitName: editDraft.perUnit ? editDraft.unitName.trim() : undefined,
              note: editDraft.note.trim(),
            }
          : e,
      ),
    );
    setEditId(null);
  };

  const addItem = () => {
    if (!draft.name.trim()) return setErr(uiText("名称不能为空","Enter a name"));
    const newItem: ExtraItem = {
      id: uid('ex-'),
      name: draft.name.trim(),
      price: draft.price === '' ? 0 : Number(draft.price),
      advanceDays: draft.advanceDays === '' ? undefined : Number(draft.advanceDays),
      perUnit: draft.perUnit,
      unitName: draft.perUnit ? draft.unitName.trim() : undefined,
      note: draft.note.trim(),
    };
    saveExtraItems([...items, newItem]);
    setDraft(EXTRA_EMPTY);
    setErr('');
  };

  const removeItem = (id: string) => {
    saveExtraItems(items.filter((e) => e.id !== id));
  };

  return (
    <Card className="p-5">
      <SectionTitle right={<Badge tone="blue">{items.length}{uiText("项"," items")}</Badge>}>{uiText("其他 / 增项服务（订单可选并计入总价）","Additional services (included in order totals)")}</SectionTitle>
      <p className="-mt-2 mb-4 text-xs text-zinc-500">{uiText("新建订单勾选增项后，订单总价值 = 套餐金额 + 增项金额，自动计算。","The order value is calculated from the package price and selected add-ons.")}</p>

      <div className="space-y-2">
        {items.map((e) =>
          editId === e.id ? (
            <div key={e.id} className="rounded-lg border border-amber-500/40 bg-amber-50 p-3">
              <ExtraFields v={editDraft} onChange={setEditDraft} />
              {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
              <div className="mt-3 flex gap-2">
                <Btn size="sm" onClick={saveEdit}>{uiText("保存","Save")}</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setEditId(null)}>{uiText("取消","Cancel")}</Btn>
              </div>
            </div>
          ) : (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-zinc-800">{e.name}</span>
                <Badge tone="amber">
                  {(e.price ?? 0) < 0 ? (
                    <span className="text-green-600">{money(e.price??0)}</span>
                  ) : (
                    <>{money(e.price??0)}</>
                  )}
                  {e.perUnit && e.unitName ? ` / ${e.unitName}` : ""}
                </Badge>
                {e.perUnit && <Badge tone="purple">{uiText("按数量计费","Charge by quantity")}</Badge>}
                {e.advanceDays ? <Badge tone="blue">{uiText("提前","Earlier by ")}{e.advanceDays}{uiText("天"," days")}</Badge> : null}
                {e.note && <span className="text-xs text-zinc-500">{e.note}</span>}
              </div>
              <div className="flex gap-2">
                <Btn size="sm" variant="ghost" onClick={() => startEdit(e)}>{uiText("编辑","Edit")}</Btn>
                <Btn size="sm" variant="danger" onClick={() => removeItem(e.id)}>{uiText("删除","Delete")}</Btn>
              </div>
            </div>
          ),
        )}
        {items.length === 0 && <Empty text={uiText("暂无增项服务","No additional services")} />}
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-zinc-300 p-3">
        <div className="mb-3 text-xs font-medium text-zinc-400">{uiText("新增增项","Add service")}</div>
        <ExtraFields v={draft} onChange={setDraft} />
        <div className="mt-3">
          <Btn size="sm" onClick={addItem}>{uiText("添加","Add")}</Btn>
        </div>
      </div>
    </Card>
  );
}

/* ==================== 数据管理 ==================== */

function DataTab() {
 const uiText=useInterfaceText(),uiLanguage=useInterfaceLanguage();

  const { data, resetAll,restoreData } = useStudio();
  const fileRef = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState({
    enabled: false,
    initialized: false,
    lastBackup: '',
    pending: false,
    busy: false,
    message: '',
    error: '',
  });

  // Electron 环境（存在 preload 桥）才显示 Git 备份
  useEffect(() => {
    const pstudio = (window as unknown as { pstudio?: { runBackup?: unknown } }).pstudio;
    if (pstudio && typeof pstudio.runBackup === 'function') {
      setBackup((p) => ({ ...p, enabled: true }));
      void refreshBackup();
    }
  }, []);

  const refreshBackup = useCallback(async () => {
    try {
      const pstudio = window as unknown as {
        pstudio?: {
          backupStatus: () => Promise<{ ok: boolean; initialized?: boolean; lastBackup?: string; pending?: boolean }>;
        };
      };
      if (!pstudio.pstudio) return;
      const st = await pstudio.pstudio.backupStatus();
      setBackup((p) => ({
        ...p,
        initialized: !!st.initialized,
        lastBackup: st.lastBackup || '',
        pending: !!st.pending,
      }));
    } catch {
      // 忽略
    }
  }, []);

  const runBackupNow = useCallback(async () => {
    try {
      const pstudio = window as unknown as {
        pstudio?: { runBackup: (p: { dataJson: string }) => Promise<{ ok: boolean; message?: string; error?: string }> };
      };
      if (!pstudio.pstudio) return;
      setBackup((p) => ({ ...p, busy: true, message: '', error: '' }));
      const raw = JSON.stringify(data);
      const res = await pstudio.pstudio.runBackup({ dataJson: raw });
      setBackup((p) => ({
        ...p,
        busy: false,
        message: res.ok ? uiText("备份完成 ✓","Backup complete ✓") : uiText(`备份失败：${res.error||res.message||''}`,`Backup failed: ${interfaceNotice(res.error||res.message||'',uiLanguage)}`),
      }));
      void refreshBackup();
    } catch (e) {
      setBackup((p) => ({ ...p, busy: false, error: uiText(`备份异常：${(e as Error)?.message||String(e)}`,`Backup error: ${interfaceNotice((e as Error)?.message||String(e),uiLanguage)}`) }));
    }
  }, [refreshBackup,data,uiLanguage]);

  const usage = useMemo(() => {
    try {
      const raw = JSON.stringify(data);
      if (!raw) return '0 KB';
      return `${(new Blob([raw]).size / 1024).toFixed(1)} KB`;
    } catch {
      return '—';
    }
  }, [data]);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `photo-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        validateData(parsed);
        const ok = await confirmAction(uiText(`导入这份备份？其中有 ${parsed.orders?.length??0} 个订单、${parsed.preOrders?.length??0} 份前期工单、${parsed.postOrders?.length??0} 份后期工单。当前工作室的业务数据将被替换，请先导出备份。`,`Import this backup containing ${parsed.orders?.length??0} orders, ${parsed.preOrders?.length??0} shoot tasks and ${parsed.postOrders?.length??0} editing tasks? Current business data will be replaced. Export a backup first.`));
        if (!ok) return;
        const base = buildSeedData();
        const merged = {
          ...base,
          ...parsed,
          orders: parsed.orders ?? base.orders,
          preOrders: parsed.preOrders ?? base.preOrders,
          postOrders: parsed.postOrders ?? base.postOrders,
          equipments: parsed.equipments ?? base.equipments,
          customerTypes: parsed.customerTypes ?? base.customerTypes,
          packageTiers: parsed.packageTiers ?? base.packageTiers,
          shootStyles: parsed.shootStyles ?? base.shootStyles,
          extraItems: parsed.extraItems ?? base.extraItems,
        };
        restoreData(merged);
        const saved = await (window as unknown as {__studioFlush?:()=>Promise<boolean>}).__studioFlush?.().catch(()=>false);
        void notifyUser(saved ? uiText("备份已导入。","Backup imported.") : uiText("备份已载入，尚未保存。请处理同步提示后重试。","The backup has loaded but has not been saved. Resolve the synchronization notice and retry."));
      } catch (error) {
        void notifyUser(uiText(`备份未导入，现有数据保持不变。${errorText(error,'文件格式不正确')}`,`Backup not imported. Existing data is unchanged. ${errorText(error,'文件格式不正确')}`));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle>{uiText("备份与恢复","Backup and restore")}</SectionTitle>
        <p className="-mt-2 mb-4 text-xs text-zinc-500">{uiText("导出当前工作室的业务备份，或使用已有备份恢复订单、工单与业务配置。备份文件不包含成员账户和接口密钥。","Export a business backup or restore orders, tasks and configuration from an existing backup. Member accounts and API keys are excluded.")}</p>
        <div className="flex flex-wrap gap-3">
          <Btn onClick={exportData}>{uiText("导出备份（JSON）","Export backup (JSON)")}</Btn>
          <Btn variant="outline" onClick={() => fileRef.current?.click()}>{uiText("导入备份","Import backup")}</Btn>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importData(f);
              e.target.value = '';
            }}
          />
        </div>
        <p className="mt-3 text-xs text-zinc-500">{uiText("当前数据占用：","Current data size:")}{usage}</p>
      </Card>

      {backup.enabled && (
        <Card className="p-5">
          <SectionTitle right={<Badge tone="blue">Git</Badge>}>{uiText("Git 云端备份（SSH → Gitea）","Git backup (SSH → Gitea)")}</SectionTitle>
          <p className="-mt-2 mb-4 text-xs text-zinc-500">
            {uiText('备份订单数据及付款、退款凭证，支持您配置的 Git 仓库。','Back up order data and payment or refund evidence to your configured Git repository.')}
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-xs text-zinc-500">{uiText("上次备份","Last backup")}</div>
                <div className="mt-0.5 text-xs text-zinc-700">
                  {backup.lastBackup || uiText("尚未备份","No backup yet")}
                  {backup.pending ? uiText("（有待推送变更）"," (Unpushed changes)") : ''}
                  {backup.initialized ? '' : uiText("（仓库未初始化，首次备份自动创建）"," (Repository will be initialized on the first backup)")}
                </div>
              </div>
              <Btn size="sm" onClick={() => void runBackupNow()} disabled={backup.busy}>
                {backup.busy ? uiText("备份中…","Backing up…") : uiText("立即备份","Back up now")}
              </Btn>
            </div>

            {backup.message && <p className="text-xs text-green-600">{backup.message}</p>}
            {backup.error && <p className="text-xs text-red-600">{backup.error}</p>}
          </div>
        </Card>
      )}

      <Card className="border-red-200 p-5">
        <SectionTitle>{uiText("危险操作","Destructive actions")}</SectionTitle>
        <p className="-mt-2 mb-4 text-xs text-zinc-500">{uiText("重置将清空全部订单、工单与业务配置，恢复初始设置。请先导出备份。","Reset clears all orders, tasks and business configuration. Export a backup first.")}</p>
        <Btn
          variant="danger"
          onClick={async () => { if (await confirmAction(uiText("重置全部业务数据？所有订单、工单及业务配置将恢复为初始状态。请确认已导出备份。","Reset all business data? Orders, tasks and configuration will return to their initial state. Confirm that you have exported a backup."))) resetAll(); }}
        >{uiText("重置全部数据","Reset all data")}</Btn>
      </Card>

      <Card className="p-5">
        <SectionTitle right={<Badge tone="zinc">{uiText("共","Total: ")}{(data.logs ?? []).length}{uiText("条"," entries")}</Badge>}>{uiText("操作日志","Activity log")}</SectionTitle>
        <p className="-mt-2 mb-4 text-xs text-zinc-500">{uiText("查看订单、工单、收款、退款与配置的变更记录。","View changes to orders, tasks, payments, refunds and configuration.")}</p>
        {(data.logs ?? []).length === 0 ? (
          <Empty text={uiText("暂无操作记录","No activity recorded")} />
        ) : (
          <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
            {[...(data.logs ?? [])].reverse().map((log, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2 text-xs"
              >
                <span className="shrink-0 font-mono text-zinc-400">{displayDateTime(log.at)}</span>
                <Badge tone="blue">{interfaceText(log.action,uiLanguage)}</Badge>
                {log.detail && <span className="min-w-0 flex-1 text-zinc-600">{logDetailText(log.detail,uiLanguage)}</span>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ==================== 账户与关于 ==================== */

function AccountTab() {
 const uiText=useInterfaceText();

  const [user] = useState<string | null>(() => getCurrentUser());

  const handleLogout = async () => {
    if (!(await confirmAction(uiText("确定要退出登录吗？退出后可重新登录或注册其他账户。","Sign out? You can sign in again or register another account.")))) return;
    try{await logout();window.location.href='/login';}catch(e){void notifyUser(errorText(e));}
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle>{uiText("当前账户","Current account")}</SectionTitle>
        {user ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-zinc-800">{user}</div>
              <div className="mt-0.5 text-xs text-zinc-500">{uiText("已登录","Signed in")}</div>
            </div>
            <Btn variant="danger" size="sm" onClick={handleLogout}>{uiText("退出登录","Sign out")}</Btn>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">{uiText("未登录","Signed out")}</p>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle>{uiText("软件介绍","About Studio")}</SectionTitle>
        <p className="-mt-2 mb-4 text-xs text-zinc-500">{uiText("查看版本、功能与授权信息。","View the version, features and licensing information.")}</p>
        <Link href="/about">
          <Btn variant="outline">{uiText("查看软件介绍 →","About Studio →")}</Btn>
        </Link>
      </Card>

      <Card className="p-5">
        <SectionTitle>{uiText("注册账户","Register account")}</SectionTitle>
        <p className="-mt-2 mb-4 text-xs text-zinc-500">{uiText("使用工作室邀请代码注册成员；角色与操作权限由管理员分配。","Register with a studio invitation code. An administrator assigns your role and permissions.")}</p>
        <Link href="/register">
          <Btn>{uiText("注册新账户 →","Register an account →")}</Btn>
        </Link>
      </Card>
    </div>
  );
}
