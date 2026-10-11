// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText,useStudioLanguage} from '@/lib/i18n';
import {interfaceText} from '@/lib/interface-text';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WeatherCell, WeatherToolbar, useCalendarWeather } from '@/components/biz/weather';
import { weatherDescription, weatherKind, weatherLabels } from '@/lib/weather';
import { useMemo, useState } from 'react';
import { useStudio } from '@/lib/store';
import { pad, STAGE_LABELS } from '@/lib/studio';
import type { Order } from '@/lib/types';
import { AppShell, Badge, Card, Empty, SectionTitle } from '@/components/biz/ui';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, User } from 'lucide-react';

function dayKeyOf(v: string): string | null {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeOf(v: string): string {
  const m = /T(\d{2}:\d{2})/.exec(v);
  return m ? m[1] : '';
}

const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

export default function SchedulePage() {
 const uiText=useStudioText(),uiLanguage=useStudioLanguage();

  const { data } = useStudio();
  const router = useRouter();
  const weather = useCalendarWeather();
  const weatherByDay = new Map(weather.days.map(d => [d.date, d]));
  const today = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  }, []);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(today);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthKey = `${year}-${pad(month + 1)}`;

  // 拍摄任务按天分组（来源：订单拍摄时间）
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of data.orders) {
      const key = dayKeyOf(o.shootTime);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.shootTime || '').localeCompare(b.shootTime || ''));
    }
    return map;
  }, [data.orders]);

  const monthCount = useMemo(() => {
    let c = 0;
    for (const [k, list] of tasksByDay) {
      if (k.startsWith(monthKey)) c += list.length;
    }
    return c;
  }, [tasksByDay, monthKey]);

  // 日历格子（周一开头）
  const firstDow = new Date(year, month, 1).getDay(); // 0=周日
  const offset = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedTasks = selected ? (tasksByDay.get(selected) ?? []) : [];

  return (
    <AppShell>
      <div className="calendar-intro"><div><h1 className="max-w-6xl">{uiText("与光同行，","Follow the light.")}<br/>{uiText("把每一天安排妥当。","Plan each day with clarity.")}</h1><p>{uiText("拍摄档期 · 逐日天气 · 所有值得期待的时刻","Shoot schedules · Daily weather · Upcoming commissions")}</p></div><p className="calendar-note">{uiText("点击日期查看拍摄安排。","Select a date to view its shoots.")}<br/>{uiText("天气动画跟随真实预报变化。","Weather scenes reflect the forecast.")}</p></div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle right={<Badge tone="blue">{monthCount}{uiText("场拍摄"," shoots")}</Badge>}>{uiText("排班表","Shooting schedule")}</SectionTitle>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={uiText("上个月","Previous month")}
            onClick={() => { const next = new Date(year, month - 1, 1); setCursor(next); setSelected(`${next.getFullYear()}-${pad(next.getMonth()+1)}-01`); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 transition hover:border-amber-500 hover:text-amber-600"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[120px] text-center text-sm font-semibold text-zinc-800">
            {cursor.toLocaleDateString(uiLanguage==='en'?'en-GB':'zh-CN',{year:'numeric',month:'long'})}
          </span>
          <button
            type="button"
            aria-label={uiText("下个月","Next month")}
            onClick={() => { const next = new Date(year, month + 1, 1); setCursor(next); setSelected(`${next.getFullYear()}-${pad(next.getMonth()+1)}-01`); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 transition hover:border-amber-500 hover:text-amber-600"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              const n = new Date();
              setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
              setSelected(today);
            }}
            className="ml-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-600 transition hover:border-amber-500 hover:text-amber-600"
          >{uiText("今天","Today")}</button>
        </div>
      </div>

      {/* 月历 */}
      <Card className="p-5">
        <WeatherToolbar weather={weather} />
        <div className="calendar-scroll"><div className="calendar-grid grid grid-cols-7">
          {(uiLanguage==='en'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:WEEK).map((w) => (
            <div key={w} className="pb-1 text-center text-xs font-medium text-zinc-400">
              {w}
            </div>
          ))}
          {cells.map((key, i) => {
            if (!key) return <div key={`e${i}`} className="h-16 sm:h-20" />;
            const hasTasks = tasksByDay.has(key);
            const isToday = key === today;
            const isSelected = key === selected;
            const dayNum = Number(key.slice(8, 10));
            return (
              <button
                key={key}
                type="button"
                onClick={() => router.push(`/schedule/${key}`)}
                className="calendar-cell"
                aria-pressed={isSelected}
                aria-label={uiText(`${key}，${tasksByDay.get(key)?.length||0} 场拍摄${weatherByDay.has(key)?'，'+weatherLabels[weatherKind(weatherByDay.get(key)!.code)]:''}`,`${key}, ${tasksByDay.get(key)?.length||0} shoots${weatherByDay.has(key)?', '+weatherDescription(weatherByDay.get(key)!.code,'en'):''}`)}
              >
                <span className={`calendar-date ${isToday ? 'is-today' : ''}`}>{dayNum}</span>
                <WeatherCell day={weatherByDay.get(key)} enabled={!!weather.place} loading={weather.loading} />
                {hasTasks && <span className="calendar-task">{tasksByDay.get(key)!.length}{uiText("场 ·"," shoots · ")}{tasksByDay.get(key)![0].customerName}</span>}
              </button>
            );
          })}
        </div></div>
      </Card>

      {/* 当天任务 */}
      <div className="mt-6">
        <SectionTitle
          right={
            selectedTasks.length > 0 ? <Badge tone="red">{selectedTasks.length}{uiText("场"," shoots")}</Badge> : null
          }
        >
          {selected
            ? new Date(selected+'T12:00:00Z').toLocaleDateString(uiLanguage==='en'?'en-GB':'zh-CN',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'})
            : ''}{' '}{uiText("拍摄安排","Scheduled shoots")}</SectionTitle>
        {selectedTasks.length === 0 ? (
          <Empty text={uiText("这一天没有拍摄任务","No shoots scheduled for this day")} />
        ) : (
          <div className="space-y-3">
            {selectedTasks.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                      <CalendarDays size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-amber-600">{o.orderNo}</span>
                        <Badge tone="red">{timeOf(o.shootTime) || uiText("时间待定","Time to be confirmed")}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-600">
                        <span className="inline-flex items-center gap-1">
                          <User size={12} />
                          {o.customerName}
                        </span>
                        {o.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} />
                            {o.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge tone={o.stage === 'done' ? 'green' : 'amber'}>{interfaceText(STAGE_LABELS[o.stage],uiLanguage)}</Badge>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
