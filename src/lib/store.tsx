// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/**
 * Copyright (C) 2026 博成 · FMLC 中成博成
 */

'use client';
import {errorText} from './interface-error';
import {useStudioLanguage as useViewLanguage} from '@/lib/i18n';
import {interfaceText as localeText,sealEventText} from '@/lib/interface-text';

import {interfaceError} from './interface-error';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import type {
  AppData,
  CustomerType,
  Equipment,
  ExtraItem,
  LogEntry,
  Order,
  PackageTier,
  PostOrder,
  PreOrder,
  ShootStyle,
  TimeSeal,
} from './types';
import { buildSeedData, localizeDefaults } from './seed';
import { makeSeal, uid } from './studio';
import { offsetLabel, setBusinessTimeZone } from './time-zone';
import { applyPostPatch, applyPrePatch, mergeSeals, validateData } from './data-integrity';
import {desktop} from './desktop';
import {apiRequest} from './api-client';
import {mergeChanges} from './merge-state';
import {notifyUser} from '@/components/biz/dialogs';
import {getSessionUser} from './auth';
import {executeBusiness,COMMAND_SCHEMAS} from './business';
import {isPrintDocument} from './print-document';
import type {StudioCommand} from './extensions';
import {confirmAction,DialogHost} from '@/components/biz/dialogs';

/** localStorage 存储键 */
const STORAGE_KEY = 'photo-studio-data-v1';

/** 深合并：以 base 为骨架，用 saved 覆盖（保证旧数据兼容新增字段） */
function mergeAppData(base: AppData, saved: Partial<AppData>): AppData {
  // 增项：saved 优先，但补入 seed 中新增的 builtin 内置项（如 RAW 原片）
  const mergeExtras = (): ExtraItem[] => {
    const savedItems = saved.extraItems ?? base.extraItems ?? [];
    const savedIds = new Set(savedItems.map((e) => e.id));
    const seedBuiltins = (base.extraItems ?? []).filter((e) => e.builtin && !savedIds.has(e.id));
    return [...savedItems, ...seedBuiltins];
  };
  return {
    ...base,
    ...saved,
    orders: saved.orders ?? base.orders,
    preOrders: (saved.preOrders ?? base.preOrders).map(p=>({...p,sdCardCodes:p.sdCardCodes ?? (p.sdCardCode?[p.sdCardCode]:[])})),
    postOrders: saved.postOrders ?? base.postOrders,
    equipments: saved.equipments ?? base.equipments,
    customerTypes: saved.customerTypes ?? base.customerTypes,
    packageTiers: saved.packageTiers ?? base.packageTiers,
    shootStyles: saved.shootStyles ?? base.shootStyles,
    extraItems: mergeExtras(),
    logs: saved.logs ?? base.logs,
  };
}

interface StudioStore {
  data: AppData;
  executeCommand: (command:StudioCommand) => unknown;
  // —— 订单 ——
  createOrder: (order: Omit<Order, 'id' | 'seals' | 'createdAt'>) => Order;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  deleteOrder: (id: string) => void;
  // —— 前期工单 ——
  createPreOrder: (pre: Omit<PreOrder, 'id' | 'seals' | 'createdAt'>) => PreOrder;
  updatePreOrder: (id: string, patch: Partial<PreOrder>) => void;
  // —— 后期工单 ——
  createPostOrder: (post: Omit<PostOrder, 'id' | 'seals' | 'createdAt'>) => PostOrder;
  updatePostOrder: (id: string, patch: Partial<PostOrder>) => void;
  // —— 基础配置 ——
  saveCustomerTypes: (items: CustomerType[]) => void;
  savePackageTiers: (items: PackageTier[]) => void;
  saveShootStyles: (items: ShootStyle[]) => void;
  saveEquipments: (items: Equipment[]) => void;
  saveExtraItems: (items: ExtraItem[]) => void;
  // —— 后台操作日志 ——
  addLog: (action: string, detail?: string) => void;
  saveSettings: (settings: import("./settings").StudioSettings) => void;
  savePrintDocument: (scope: string, document: import("./print-document").PrintDocument) => void;
  // —— 工具 ——
  resetAll: () => void;
  restoreData: (data:AppData) => void;
}

const StoreContext = createContext<StudioStore | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
 const viewLanguage=useViewLanguage();
 const displayNotice=(value:string)=>{for(const prefix of ['业务数据无法完整读取，已停止写入。','本次修改未获授权：'])if(value.startsWith(prefix))return localeText(prefix,viewLanguage)+interfaceError(value.slice(prefix.length));return localeText(value,viewLanguage);};

  // 初始状态统一用 seed：SSR 与客户端 hydration 渲染一致，避免 hydration mismatch
  const [data, setData] = useState<AppData>(() => buildSeedData());
  // Idempotent: business times rendered below use the studio time zone.
  setBusinessTimeZone(data.settings?.timeZone);

  const dataRef = useRef(data);
  const recoveryRaw=useRef('');
  const [storageError,setStorageError] = useState('');
  const [readError,setReadError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const remoteRevision=useRef(0),generation=useRef(0),syncedGeneration=useRef(0),blocked=useRef(false);

  useEffect(()=>{
    let cancelled=false;
    if(!getSessionUser()){queueMicrotask(()=>setHydrated(true));return;}
    queueMicrotask(async()=>{try{
      let snapshot=await apiRequest<{revision:number;data:AppData}>('state');
      if(desktop()&&snapshot.revision===0&&getSessionUser()?.role==='owner'){
        const raw=localStorage.getItem(STORAGE_KEY);
        if(raw){recoveryRaw.current=raw;const legacy=JSON.parse(raw);validateData(legacy);snapshot=await apiRequest('state',{method:'PUT',body:JSON.stringify({revision:0,data:mergeAppData(buildSeedData(),legacy)})});}
      }
      // Import legacy template preferences once into the authenticated workspace, then remove browser copies.
      if(desktop()&&getSessionUser()?.role==='owner'){
        const keys=Object.keys(localStorage).filter(k=>k.startsWith('studio-print-copy:'));const documents={...snapshot.data.printDocuments};let changed=false;
        for(const key of keys){const scope=key.slice('studio-print-copy:'.length);if(documents[scope]){localStorage.removeItem(key);continue;}try{const {document,...copy}=JSON.parse(localStorage.getItem(key)||'{}');if(isPrintDocument(document)){documents[scope]={...document,copy};changed=true;}}catch{}}
        if(changed)snapshot=await apiRequest('state',{method:'PUT',body:JSON.stringify({revision:snapshot.revision,data:{...snapshot.data,printDocuments:documents}})});
        for(const key of keys)if(documents[key.slice('studio-print-copy:'.length)])localStorage.removeItem(key);
      }
      const draft=await desktop()?.readDraft?.();if(draft){recoveryRaw.current=JSON.stringify(draft.data);validateData(draft.data);dataRef.current=draft.data;snapshot=await apiRequest('state',{method:'PUT',body:JSON.stringify(draft)});await desktop()?.clearDraft?.();}
      if(cancelled)return;
      validateData(snapshot.data);const next=mergeAppData(buildSeedData(),snapshot.data);remoteRevision.current=snapshot.revision;dataRef.current=next;setData(next);
      if(desktop()){localStorage.removeItem(STORAGE_KEY);localStorage.removeItem('studio-draft:main');localStorage.removeItem('studio-draft:assistant');}
    }catch(e){blocked.current=true;setReadError('业务数据无法完整读取，已停止写入。'+errorText(e));}finally{if(!cancelled)setHydrated(true);}});
    return ()=>{cancelled=true;};
  },[]);
  useEffect(()=>{
    if(!hydrated||blocked.current||!getSessionUser()||location.pathname==='/assistant'&&new URLSearchParams(location.search).get('mode')==='orb')return;
    let running=false,active=true;
    const sync=async()=>{if(running||blocked.current)return;running=true;const dirty=generation.current>syncedGeneration.current,submitted=generation.current,submittedData=structuredClone(dataRef.current);
      try{const snapshot=await apiRequest<{revision:number;data:AppData;unchanged?:boolean}>(dirty?'state':'state?revision='+remoteRevision.current,dirty?{method:'PUT',body:JSON.stringify({revision:remoteRevision.current,data:dataRef.current})}:{});
        if(!active)return;if(snapshot.unchanged){setStorageError('');return;}remoteRevision.current=snapshot.revision;
        if(dirty)syncedGeneration.current=submitted;
        if(generation.current===submitted){if(dirty)void desktop()?.clearDraft?.().catch(()=>{});const next=mergeAppData(buildSeedData(),snapshot.data);if(JSON.stringify(dataRef.current)!==JSON.stringify(next)){dataRef.current=next;setData(next);}}else {const conflicts:string[]=[];const next=mergeChanges(submittedData,snapshot.data,dataRef.current,'',conflicts) as AppData;if(conflicts.length){blocked.current=true;setReadError('同步期间存在冲突修改，请先导出当前内容。');return;}validateData(next);dataRef.current=next;setData(next);void desktop()?.saveDraft?.({revision:remoteRevision.current,data:next}).catch(()=>{});}
        setStorageError('');
      }catch(e){const status=(e as {status?:number}).status;if(status===409||status===403){blocked.current=true;setReadError(status===403?'本次修改未获授权：'+errorText(e):'存在冲突修改。请先导出当前修改，再重新读取最新数据。');}else if(active)setStorageError('修改尚未保存。请保持窗口打开，恢复连接后会自动重试。');}
      finally{running=false;}
    };
    const flush=async()=>{for(let i=0;i<80&&running;i++)await new Promise(resolve=>setTimeout(resolve,100));if(blocked.current)return false;await sync();return !blocked.current&&generation.current===syncedGeneration.current;};
    const hostWindow=window as unknown as {__studioFlush?:()=>Promise<boolean>};hostWindow.__studioFlush=flush;
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(generation.current!==syncedGeneration.current){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',beforeUnload);
    // CLI confirmations change server state directly; pull it now instead of waiting for the next poll.
    const applied=()=>void sync();window.addEventListener('studio-cli-applied',applied);
    const timer=setInterval(()=>void sync(),1500);void sync();return ()=>{active=false;clearInterval(timer);window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('studio-cli-applied',applied);delete hostWindow.__studioFlush;};
  },[hydrated]);
  useEffect(()=>{const bridge=desktop() as unknown as {runBackup?:(payload:{dataJson:string})=>Promise<unknown>};if(!hydrated||!data.settings?.autoBackup||!getSessionUser()?.scopes.includes('settings:write')||!bridge?.runBackup)return;const timer=setTimeout(()=>{if(!blocked.current&&generation.current===syncedGeneration.current)void bridge.runBackup!({dataJson:JSON.stringify(dataRef.current)}).catch(()=>{});},20000);return ()=>clearTimeout(timer);},[data,hydrated]);
  const patchData=useCallback((fn:(d:AppData)=>AppData)=>{
    if(blocked.current)throw new Error('请先重新读取数据');const user=getSessionUser();if(!user?.scopes.includes('orders:write')){void notifyUser('当前账户为只读权限，请联系管理员分配业务操作权限');return;}
    const next=fn(structuredClone(dataRef.current));validateData(next);generation.current++;dataRef.current=next;setData(next);void desktop()?.saveDraft?.({revision:remoteRevision.current,data:next}).catch(()=>setStorageError('修改暂未保存，请保持窗口打开并先导出当前修改'));
  },[]);
  const executeCommand=useCallback((command:StudioCommand)=>{if(COMMAND_SCHEMAS[command.type]?.write===false)return executeBusiness(dataRef.current,command).result;let result:unknown;patchData(d=>{const output=executeBusiness(d,command);result=output.result;return output.data;});return result;},[patchData]);

  /** 追加后台操作日志（前台不展示；保留最近 500 条） */
  const appendLog = useCallback(
    (logs: LogEntry[] | undefined, entry: LogEntry): LogEntry[] => {
      return [...(logs ?? []), entry].slice(-500);
    },
    [],
  );

  const createOrder = useCallback(
    (order: Omit<Order, 'id' | 'seals' | 'createdAt'>): Order => {
      const now = new Date();
      const newOrder: Order = {
        ...order,
        id: uid('ord-'),
        seals: [makeSeal('订单创建', now)],
        createdAt: now.toISOString(),
      };
      patchData((d) => ({
        ...d,
        orders: [...d.orders, newOrder],
        logs: appendLog(d.logs, {
          at: now.toISOString(),
          action: '创建订单',
          detail: `订单号 ${newOrder.orderNo}`,
        }),
      }));
      return newOrder;
    },
    [patchData, appendLog],
  );

  const updateOrder = useCallback(
    (id: string, patch: Partial<Order>) => {
      patchData((d) => ({
        ...d,
        preOrders:d.preOrders.map(p=>p.orderId===id?{...p,...(Object.hasOwn(patch,'shootTime')?{shootTime:patch.shootTime!}:{}),...(Object.hasOwn(patch,'location')?{location:patch.location!}:{}),...(Object.hasOwn(patch,'photographer')?{photographer:patch.photographer??''}:{})}:p),
        postOrders:d.postOrders.map(p=>p.orderId===id&&Object.hasOwn(patch,'shootTime')?{...p,shootTime:patch.shootTime!}:p),
        orders: d.orders.map((o) =>
          o.id === id
            ? {
                ...o,
                ...patch,
                id:o.id,
                orderNo:o.orderNo,
                serial:o.serial,
                serialMonth:o.serialMonth,
                seals: mergeSeals(o.seals, patch.seals),
              }
            : o,
        ),
      }));
    },
    [patchData],
  );

  const deleteOrder = useCallback(
    (id: string) => {
      patchData((d) => {
        const target = d.orders.find((o) => o.id === id);
        return {
          ...d,
          orders: d.orders.filter((o) => o.id !== id),
          preOrders: d.preOrders.filter((p) => p.orderId !== id),
          postOrders: d.postOrders.filter((p) => p.orderId !== id),
          logs: appendLog(d.logs, {
            at: new Date().toISOString(),
            action: '删除订单',
            detail: `订单号 ${target?.orderNo ?? id}`,
          }),
        };
      });
    },
    [patchData, appendLog],
  );

  const createPreOrder = useCallback(
    (pre: Omit<PreOrder, 'id' | 'seals' | 'createdAt'>): PreOrder => {
      const existing=dataRef.current.preOrders.find(p=>p.orderId===pre.orderId);
      if(existing)return existing;
      const now = new Date();
      const newPre: PreOrder = {
        ...pre,
        id: uid('pre-'),
        seals: [makeSeal('前期工单创建', now)],
        createdAt: now.toISOString(),
      };
      patchData((d) => ({
        ...d,
        preOrders: [...d.preOrders, newPre],
        orders: d.orders.map(o=>o.id===pre.orderId ? {...o,preOrderId:newPre.id} : o),
        logs: appendLog(d.logs, {
          at: now.toISOString(),
          action: '创建前期工单',
          detail: `工单号 ${newPre.preNo}（订单 ${newPre.orderId}）`,
        }),
      }));
      return newPre;
    },
    [patchData, appendLog],
  );

  const updatePreOrder = useCallback(
    (id: string, patch: Partial<PreOrder>) => {
      patchData((d) => applyPrePatch(d,id,patch));
    },
    [patchData],
  );

  const createPostOrder = useCallback(
    (post: Omit<PostOrder, 'id' | 'seals' | 'createdAt'>): PostOrder => {
      const existing=dataRef.current.postOrders.find(p=>p.orderId===post.orderId);
      if(existing)return existing;
      const now = new Date();
      const newPost: PostOrder = {
        ...post,
        id: uid('post-'),
        seals: [makeSeal('后期工单创建', now)],
        createdAt: now.toISOString(),
      };
      patchData((d) => ({
        ...d,
        postOrders: [...d.postOrders, newPost],
        orders: d.orders.map(o=>o.id===post.orderId ? {...o,postOrderId:newPost.id} : o),
        logs: appendLog(d.logs, {
          at: now.toISOString(),
          action: '创建后期工单',
          detail: `工单号 ${newPost.postNo}（订单 ${newPost.orderId}）`,
        }),
      }));
      return newPost;
    },
    [patchData, appendLog],
  );

  const updatePostOrder = useCallback(
    (id: string, patch: Partial<PostOrder>) => {
      patchData((d) => applyPostPatch(d,id,patch));
    },
    [patchData],
  );

  const saveCustomerTypes = useCallback(
    (items: CustomerType[]) =>
      patchData((d) => ({
        ...d,
        customerTypes: items,
        logs: appendLog(d.logs, {
          at: new Date().toISOString(),
          action: '更新客户类型配置',
          detail: `${items.length} 项`,
        }),
      })),
    [patchData, appendLog],
  );
  const savePackageTiers = useCallback(
    (items: PackageTier[]) =>
      patchData((d) => ({
        ...d,
        packageTiers: items,
        logs: appendLog(d.logs, {
          at: new Date().toISOString(),
          action: '更新套餐档位配置',
          detail: `${items.length} 项`,
        }),
      })),
    [patchData, appendLog],
  );
  const saveShootStyles = useCallback(
    (items: ShootStyle[]) =>
      patchData((d) => ({
        ...d,
        shootStyles: items,
        logs: appendLog(d.logs, {
          at: new Date().toISOString(),
          action: '更新拍摄风格配置',
          detail: `${items.length} 项`,
        }),
      })),
    [patchData, appendLog],
  );
  const saveEquipments = useCallback(
    (items: Equipment[]) =>
      patchData((d) => ({
        ...d,
        equipments: items,
        logs: appendLog(d.logs, {
          at: new Date().toISOString(),
          action: '更新设备库配置',
          detail: `${items.length} 项`,
        }),
      })),
    [patchData, appendLog],
  );
  const saveExtraItems = useCallback(
    (items: ExtraItem[]) =>
      patchData((d) => ({
        ...d,
        extraItems: items,
        logs: appendLog(d.logs, {
          at: new Date().toISOString(),
          action: '更新附加项目配置',
          detail: `${items.length} 项`,
        }),
      })),
    [patchData, appendLog],
  );

  const saveSettings = useCallback((settings: import("./settings").StudioSettings) => patchData(d=>({...d,settings})),[patchData]);
  const savePrintDocument = useCallback((scope: string,document: import("./print-document").PrintDocument) => patchData(d=>({...d,printDocuments:{...d.printDocuments,[scope]:document}})),[patchData]);

  const resetAll = useCallback(() => {
    patchData(() => {
      const base = buildSeedData();
      return {
        ...base,
        logs: [{ at: new Date().toISOString(), action: '重置全部数据' }],
      };
    });
  }, [patchData]);

  const addLog = useCallback(
    (action: string, detail?: string) => {
      patchData((d) => ({
        ...d,
        logs: appendLog(d.logs, { at: new Date().toISOString(), action, detail }),
      }));
    },
    [patchData, appendLog],
  );

  const viewData = useMemo(() => localizeDefaults(data, viewLanguage === 'en' ? 'en' : 'zh'), [data, viewLanguage]);
  const value = useMemo<StudioStore>(
    () => ({
      data: viewData,
      executeCommand,
      createOrder,
      updateOrder,
      deleteOrder,
      createPreOrder,
      updatePreOrder,
      createPostOrder,
      updatePostOrder,
      saveCustomerTypes,
      savePackageTiers,
      saveShootStyles,
      saveEquipments,
      saveExtraItems,
      addLog,
      resetAll,
      restoreData:(next:AppData)=>patchData(()=>next),
      saveSettings,
      savePrintDocument,
    }),
    [
      viewData,
      executeCommand,
      createOrder,
      updateOrder,
      deleteOrder,
      createPreOrder,
      updatePreOrder,
      createPostOrder,
      updatePostOrder,
      saveCustomerTypes,
      savePackageTiers,
      saveShootStyles,
      saveEquipments,
      saveExtraItems,
      addLog,
      resetAll,
      saveSettings,
      savePrintDocument,
      patchData,
    ],
  );

  const exportRecovery = () => {
    const raw=readError&&recoveryRaw.current?recoveryRaw.current:JSON.stringify(dataRef.current,null,2);
    const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
    const link=document.createElement('a'); link.href=url;link.download='studio-recovery.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <StoreContext.Provider value={value}>{readError ? <div className="storage-recovery"><h1>{localeText("数据需要检查",viewLanguage)}</h1><p>{displayNotice(readError)}</p><button onClick={exportRecovery}>{localeText("导出原始数据",viewLanguage)}</button><button onClick={async()=>{if(await confirmAction('重新读取会放弃本窗口尚未同步的修改。请先导出当前数据。')){location.reload();}}}>{localeText("读取最新数据",viewLanguage)}</button><DialogHost/></div> : hydrated ? <>{storageError && <div className="storage-warning" role="alert">{displayNotice(storageError)}<button onClick={exportRecovery}>{localeText("导出当前数据",viewLanguage)}</button></div>}{children}</> : <div className="studio-loading"><span/>{localeText("正在打开工作室…",viewLanguage)}</div>}</StoreContext.Provider>;
}

export function useStudio(): StudioStore {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStudio must be used within StudioProvider');
  return ctx;
}

/** 钢印列表展示组件 */
export function SealList({ seals }: { seals: TimeSeal[] }) {
  const viewLanguage = useViewLanguage();
  if (!seals || seals.length === 0) return <span className="text-xs text-zinc-400">—</span>;
  return (
    <ul className="space-y-1.5">
      {seals.map((s, i) => (
        <li key={i} className="text-xs leading-relaxed">
          <span className="font-medium text-zinc-600">{sealEventText(s.event, viewLanguage)}</span>
          <span className="text-zinc-400"> · {s.local ?? s.utc} ({s.zone ? offsetLabel(new Date(s.iso), s.zone) : 'UTC'})</span>
          <span className="text-zinc-300"> / {s.utc} (UTC)</span>
        </li>
      ))}
    </ul>
  );
}
