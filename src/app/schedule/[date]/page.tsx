// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText,useStudioLanguage} from '@/lib/i18n';
import {interfaceText} from '@/lib/interface-text';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useStudio} from '@/lib/store';
import {AppShell,Card,Empty,SectionTitle,Badge} from '@/components/biz/ui';
import {WeatherScene,WeatherToolbar,useCalendarWeather} from '@/components/biz/weather';
import {shootingAdvice,weatherDescription,windDirection} from '@/lib/weather';
import {STAGE_LABELS,displayDateTime} from '@/lib/studio';
export default function DaySchedule(){
 const uiText=useStudioText(),uiLanguage=useStudioLanguage();

 const {date}=useParams<{date:string}>(),{data}=useStudio(),weather=useCalendarWeather();
 const parsed=new Date(date+'T12:00:00Z'),valid=/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date;
 const day=weather.days.find(d=>d.date===date),orders=data.orders.filter(o=>o.shootTime.slice(0,10)===date).sort((a,b)=>a.shootTime.localeCompare(b.shootTime));
 const n=(v?:number|null,unit='')=>v==null?uiText("暂无数据","Unavailable"):Math.round(v*10)/10+unit;
 return <AppShell><Link href="/schedule" className="text-sm underline">{uiText("← 返回拍摄日历","← Back to calendar")}</Link><h1 className="mt-5 mb-6 text-3xl">{valid?date:uiText("日期无效","Invalid date")}{uiText("· 拍摄日程"," · Shoot schedule")}</h1>{valid&&<><Card className="p-6 mb-6"><WeatherToolbar weather={weather}/>{day?<><div className="day-weather-hero"><WeatherScene day={day}/><div><span className="eyebrow">{weather.place?.name}</span><h2>{weatherDescription(day.code,uiLanguage)}</h2><p>{n(day.min,'°C')} — {n(day.max,'°C')}</p></div></div><div className="weather-metrics">{[[uiText("最高温","High"),n(day.max,'°C')],[uiText("最低温","Low"),n(day.min,'°C')],[uiText("降水概率","Chance of rain"),n(day.rain,'%')],[uiText("降水量","Precipitation"),n(day.precipitation,' mm')],[uiText("最大风速","Maximum wind speed"),n(day.wind,' m/s')],[uiText("最大阵风","Maximum gust"),n(day.gust,' m/s')],[uiText("主导风向","Prevailing wind"),windDirection(day.direction,uiLanguage)],[uiText("PM2.5 当日最高","Daily maximum PM2.5"),n(day.pm25,' µg/m³')],[uiText("最低能见度","Minimum visibility"),n(day.visibility,' m')],[uiText("紫外线指数","UV index"),n(day.uv)],[uiText("日出","Sunrise"),day.sunrise?.slice(11,16)||uiText("暂无","Unavailable")],[uiText("日落","Sunset"),day.sunset?.slice(11,16)||uiText("暂无","Unavailable")]].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><SectionTitle>{uiText("拍摄提示","Shoot preparation")}</SectionTitle><ul className="shooting-tips">{shootingAdvice(day,uiLanguage).map(t=><li key={t}>{t}</li>)}</ul><p className="mt-4 text-xs opacity-60">{uiText("天气为所选城市预报。空气质量最多提供未来 7 天；超出范围或服务不可用时显示暂无数据。出发前请再次核对预报。","Forecasts apply to the selected city. Air-quality forecasts cover up to seven days. Missing or out-of-range readings are marked unavailable. Check the forecast again before departure.")}</p></>:<Empty text={weather.loading?uiText("正在读取天气…","Loading weather…"):!weather.place?uiText("请选择拍摄城市","Select a city for the shoot"):uiText("该日期超出当前预报范围，仍可查看拍摄安排","This date is outside the current forecast range. Its shoots are still available.")}/>}</Card><SectionTitle right={<Badge>{orders.length}{uiText("场"," shoots")}</Badge>}>{uiText("当日拍摄","Shoots for the day")}</SectionTitle>{orders.length?orders.map(o=><Link key={o.id} href={'/orders/'+o.id}><Card className="p-5 mb-3 flex justify-between"><div><strong>{o.customerName}</strong><p className="text-sm opacity-70">{displayDateTime(o.shootTime)} · {o.location||uiText("地点待定","Location to be confirmed")} · {o.photographer||uiText("摄影师待定","Photographer to be confirmed")}</p><small>{o.orderNo}</small></div><Badge>{interfaceText(STAGE_LABELS[o.stage],uiLanguage)}</Badge></Card></Link>):<Empty text={uiText("这一天没有拍摄安排","No shoots scheduled for this day")}/>}</>}</AppShell>;
}
