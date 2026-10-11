// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/**
 * Studio time zone. Business times (shoot time, order time) are wall-clock values in this zone.
 * The interface sets it from the studio settings; server code passes the zone explicitly.
 */
import {deviceTimeZone,isTimeZone} from './settings';

let active: string | undefined;
export function setBusinessTimeZone(zone?: string) { active = zone && isTimeZone(zone) ? zone : undefined; }
export function businessTimeZone(): string { return active ?? deviceTimeZone(); }

const pad = (n: number | string) => String(n).padStart(2, '0');
const formatters = new Map<string, Intl.DateTimeFormat>();
function parts(date: Date, zone: string): Record<string, string> {
  let format = formatters.get(zone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    formatters.set(zone, format);
  }
  const out: Record<string, string> = {};
  for (const part of format.formatToParts(date)) out[part.type] = part.value;
  return out;
}

/** Runs synchronous work with a specific studio zone, e.g. a command executed on the server. */
export function withBusinessTimeZone<T>(zone: string | undefined, work: () => T): T {
  const previous = active;
  setBusinessTimeZone(zone);
  try { return work(); } finally { active = previous; }
}

/** YYYY-MM-DD HH:mm:ss in the zone. */
export function formatZoned(date: Date, zone = businessTimeZone()): string {
  const p = parts(date, zone);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
/** Minutes the zone is ahead of UTC at that instant. */
export function zoneOffsetMinutes(date: Date, zone = businessTimeZone()): number {
  const p = parts(date, zone);
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((wall - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}
export function offsetLabel(date: Date, zone = businessTimeZone()): string {
  const minutes = zoneOffsetMinutes(date, zone), abs = Math.abs(minutes);
  return `UTC${minutes < 0 ? '-' : '+'}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
/** e.g. "Europe/Zurich · UTC+02:00"; plain "UTC" for UTC. */
export function zoneLabel(date = new Date(), zone = businessTimeZone()): string {
  return zone === 'UTC' || zone === 'Etc/UTC' ? 'UTC' : `${zone} · ${offsetLabel(date, zone)}`;
}

/** UTC milliseconds for a wall-clock time in the zone; times skipped by a clock change move forward. */
export function zonedTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, zone = businessTimeZone()): number {
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = wall - zoneOffsetMinutes(new Date(wall), zone) * 60000;
  return wall - zoneOffsetMinutes(new Date(first), zone) * 60000;
}
/** ISO instant for a business wall time "YYYY-MM-DD[T ]HH:mm[:ss]"; values with an explicit offset pass through. */
export function wallTimeToIso(value: string, zone = businessTimeZone()): string {
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return value;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return '';
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m;
  return new Date(zonedTimeToUtc(+y, +mo, +d, +h, +mi, +s, zone)).toISOString();
}
