// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText,useStudioLanguage} from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { MapPin, RefreshCw, Search } from 'lucide-react';
import { weatherDescription, weatherKind, type WeatherDay, type WeatherPlace } from '@/lib/weather';
import { apiRequest } from '@/lib/api-client';

export function WeatherScene({ day }: { day: WeatherDay }) {

  const kind = weatherKind(day.code);
  return <span className={`weather-scene weather-type-${kind}`} aria-hidden="true">
    <span className="weather-sun" /><span className="weather-cloud cloud-one" /><span className="weather-cloud cloud-two" />
    {Array.from({ length: kind === 'snow' ? 7 : 10 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}
    <span className="weather-ripple" /><span className="weather-mist" />
  </span>;
}
export function WeatherCell({ day, enabled, loading }: { day?: WeatherDay; enabled: boolean; loading: boolean }) {
 const uiText=useStudioText(),uiLanguage=useStudioLanguage();

  return <>
    {day && <WeatherScene day={day} />}
    <span className="weather-reading">{day ? <><span>{weatherDescription(day.code,uiLanguage)}</span><strong>{Math.round(day.max)}° <small>{Math.round(day.min)}°</small></strong></> : <small>{!enabled ? uiText("设置城市","Select city") : loading ? uiText("加载中","Loading") : uiText("暂无预报","No forecast")}</small>}</span>
  </>;
}
export function useCalendarWeather() {
 const uiText=useStudioText(),uiLanguage=useStudioLanguage();

  const [place, setPlace] = useState<WeatherPlace | null>(null);
  const [days, setDays] = useState<WeatherDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState('');
  const [revision, refresh] = useState(0);
  useEffect(() => {
    // Hydrate saved coordinates only on the client.
    try { const p = JSON.parse(localStorage.getItem('studio-weather-place') || 'null'); if (p && typeof p.name === 'string' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) setPlace(p); } catch {}
  }, []);
  useEffect(() => {
    if (!place) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    const key = `studio-weather-v2:${place.latitude}:${place.longitude}`;
    // Reset the request lifecycle when external coordinates change.
    setDays([]); setLoading(true); setError(''); setUpdated('');
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (cached && Date.now() - cached.time < 86400000 && Array.isArray(cached.days)) { setDays(cached.days); setUpdated(uiText(`缓存 · ${new Date(cached.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}`,`Cached · ${new Date(cached.time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`)); }
    } catch {}
    // Through the studio server, which applies the weather provider set in the command panel and keeps any key private.
    const query = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), timezone: place.timezone || 'auto', language: uiLanguage });
    apiRequest<{ days: WeatherDay[] }>('weather?' + query, { signal: controller.signal }).then(response => response.days).then(result => {
      if (!active) return;
      setDays(result); setUpdated(uiText(`${new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} 更新`,`Updated ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`));
      try { localStorage.setItem(key, JSON.stringify({ time: Date.now(), days: result })); } catch {}
    }).catch(() => { if (active) setError(uiText("天气更新失败，可重试；已有缓存会继续显示。","Unable to update the weather. Retry to refresh; the last available forecast remains visible.")); }).finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [place, revision,uiLanguage]);
  return { place, days, loading, error, updated, refresh: () => refresh(n => n + 1), choose: (p: WeatherPlace) => { setPlace(p); try { localStorage.setItem('studio-weather-place', JSON.stringify(p)); } catch {} } };
}
export function WeatherToolbar({ weather }: { weather: ReturnType<typeof useCalendarWeather> }) {
 const uiText=useStudioText(),uiLanguage=useStudioLanguage();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherPlace[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<AbortController | null>(null);
  useEffect(() => () => searchRef.current?.abort(), []);
  async function search(e: React.FormEvent) {
    e.preventDefault(); if (!query.trim()) return;
    searchRef.current?.abort(); const controller = new AbortController(); searchRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    setBusy(true); setMessage(''); setResults([]);
    try {
      const places = (await apiRequest<{ places: WeatherPlace[] }>('weather/search?' + new URLSearchParams({ name: query.trim(), language: uiLanguage }), { signal: controller.signal })).places;
      if (searchRef.current !== controller) return;
      setResults(places); if (!places.length) setMessage(uiText('未找到城市，请尝试城市拼音或英文名称。','No city found. Try the English name.'));
    } catch { if (searchRef.current === controller) setMessage(uiText('城市搜索暂不可用，请稍后重试。','City search is unavailable. Try again later.')); }
    finally { clearTimeout(timeout); if (searchRef.current === controller) setBusy(false); }
  }
  return <div className="weather-toolbar">
    <div><span className="eyebrow">{uiText("拍摄地天气","Weather at the shoot location")}</span><p className="flex items-center gap-2"><MapPin size={15} />{weather.place?.name || uiText("为拍摄日历选择城市","Select a city for the calendar")}</p><small>{weather.updated || uiText("逐日天气 · 未来最多 16 天","Daily forecast · Up to 16 days ahead")}{weather.place ? ` · ${weather.place.timezone}` : ''}</small></div>
    <div className="weather-search"><form onSubmit={search}><Search size={15} /><input aria-label={uiText("搜索天气城市","Search for a city")} placeholder={uiText("城市名称 / City","City name")} value={query} onChange={e => setQuery(e.target.value)} /><button disabled={busy || !query.trim()}>{busy ? uiText("搜索中…","Searching…") : uiText("搜索","Search")}</button><button type="button" aria-label={uiText("刷新天气","Refresh weather")} disabled={!weather.place || weather.loading} onClick={weather.refresh}><RefreshCw size={15} className={weather.loading ? 'animate-spin' : ''} /></button></form>
      {results.length > 0 && <div className="weather-results">{results.map(p => <button type="button" key={`${p.latitude},${p.longitude}`} onClick={() => { weather.choose(p); setResults([]); setQuery(''); }}>{p.name}</button>)}</div>}
      <small role="status">{message || weather.error}</small>
    </div>
    <div className="weather-credit">{uiText("天气由","Weather by ")}<a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>{uiText("提供 · 历史日期为近期回顾，远期暂无预报"," · Recent past dates show historical readings. Longer-range forecasts are unavailable.")}</div>
  </div>;
}
