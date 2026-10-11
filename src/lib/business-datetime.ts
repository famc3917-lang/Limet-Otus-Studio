// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {businessTimeZone,formatZoned} from './time-zone';
/** Business timestamps are minute-precision wall times in the studio time zone; explicit ISO offsets are converted. */
export function normalizeBusinessDateTime(value:string,timeZone:string=businessTimeZone()){
 const m=value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/);
 if(!m)return value.trim();
 const [,y,mo,d,h,mi,se,zone]=m,n=[y,mo,d,h,mi,se??'0'].map(Number);
 if(n[0]<1900||n[0]>9999||n[1]<1||n[1]>12||n[2]<1||n[3]>23||n[4]>59||n[5]>59)return value.trim();
 const utc=Date.UTC(n[0],n[1]-1,n[2],n[3],n[4],n[5]),probe=new Date(utc);
 if(probe.getUTCFullYear()!==n[0]||probe.getUTCMonth()!==n[1]-1||probe.getUTCDate()!==n[2])return value.trim();
 if(!zone)return `${y}-${mo}-${d}T${h}:${mi}`;
 let offset=0;if(zone!=='Z'){const hh=Number(zone.slice(1,3)),mm=Number(zone.slice(4));if(hh>14||mm>59||hh===14&&mm!==0)return value.trim();offset=(hh*60+mm)*(zone[0]==='+'?1:-1);}
 return formatZoned(new Date(utc-offset*60000),timeZone).slice(0,16).replace(' ','T');
}
export const BUSINESS_DATE_DESCRIPTION='有效的 YYYY-MM-DDTHH:mm，按工作室时区；例如 2026-10-07T15:00。先将相对日期换算为明确日期，不传“明天下午”等自然语言。';
