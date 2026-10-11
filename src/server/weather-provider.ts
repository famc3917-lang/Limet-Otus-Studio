// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/**
 * Weather provider configured by the super administrator in the command panel (module 天气 / Weather).
 * Default: the free Open-Meteo API. With a key: commercial Open-Meteo hosts. Endpoints can point to any
 * Open-Meteo compatible service, such as a self-hosted Open-Meteo. The key never leaves the server.
 */
import {lookup} from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import {fail} from './crypto';
import {local,pinnedLookup,privateIP} from './ai-connection';
import {readModule} from './modules';
import type {SQL} from './database';
import type {Principal} from './security';
import {OPEN_METEO,OPEN_METEO_CUSTOMER,type WeatherEndpoints} from '@/lib/weather';

export interface WeatherProvider { key?:string; forecast?:string; air?:string; geocoding?:string }
export const WEATHER_MODULE='weather';
export const ENDPOINT_FIELDS={'预报':'forecast','空气':'air','城市':'geocoding'} as const;

export async function weatherProvider(sql:SQL,p:Pick<Principal,'workspaceId'>){return readModule<WeatherProvider>(sql,p,WEATHER_MODULE,{});}
export function endpointsOf(c:WeatherProvider):WeatherEndpoints{
 const base=c.key?OPEN_METEO_CUSTOMER:OPEN_METEO;
 return {forecast:c.forecast??base.forecast,air:c.air??base.air,geocoding:c.geocoding??base.geocoding,...(c.key?{key:c.key}:{})};
}
export function validateWeatherKey(key:string){if(!/^[A-Za-z0-9._~-]{8,200}$/.test(key))fail('天气服务密钥格式不正确');return key;}
export function validateWeatherEndpoint(value:string){
 let url:URL;try{url=new URL(value);}catch{fail('天气接口地址格式不正确');}
 if(value.length>300||url!.username||url!.password||url!.hash||!['https:','http:'].includes(url!.protocol))fail('天气接口地址格式不正确');
 return url!.toString();
}
/** Masks the key for display: first and last four characters only. */
export function weatherSummary(c:WeatherProvider){
 const e=endpointsOf(c),mode=c.forecast||c.air||c.geocoding?'custom':c.key?'commercial':'free';
 return {mode,key:c.key?c.key.slice(0,4)+'…'+c.key.slice(-4):null,forecast:e.forecast,airQuality:e.air,geocoding:e.geocoding};
}

/**
 * Fetches only public addresses over HTTPS, with DNS records pinned for the request. HTTP and private networks are
 * allowed for hosts listed in STUDIO_WEATHER_ALLOWED_HOSTS (for example a self-hosted Open-Meteo on the local network).
 */
export const secureWeatherFetch:typeof fetch=async(input,init)=>{
 const url=new URL(String(input)),allowed=(process.env.STUDIO_WEATHER_ALLOWED_HOSTS??'').split(',').map(h=>h.trim()).filter(Boolean);
 const trusted=allowed.includes(url.hostname)||process.env.STUDIO_DESKTOP==='1'&&local(url.hostname);
 if(url.username||url.password||url.protocol!=='https:'&&!(url.protocol==='http:'&&trusted))fail('天气接口须使用 HTTPS；局域网自建服务须由部署负责人放行',403);
 const records=await lookup(url.hostname.replace(/^\[|\]$/g,''),{all:true});
 if(!records.length||records.some(r=>privateIP(r.address))&&!trusted)fail('天气接口指向内网或保留地址；自建服务须由部署负责人放行',403);
 return new Promise<Response>((resolve,reject)=>{
  const request=(url.protocol==='https:'?https:http).request(url,{method:'GET',headers:{Accept:'application/json'},signal:init?.signal??undefined,lookup:pinnedLookup(records)},response=>{
   const chunks:Buffer[]=[];let size=0;
   response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>4*1024*1024){response.destroy(new Error('天气服务暂不可用'));return;}chunks.push(chunk);});
   response.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:response.statusCode??502,headers:{'Content-Type':'application/json'}})));
   response.on('error',reject);
  });
  request.on('error',reject);request.end();
 });
};
