// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {lookup} from 'node:dns/promises';
import type {LookupAddress as DNSAddress} from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type {AIConfig} from '@/lib/desktop';
import {aiFailure,aiNetworkError,aiResponseError,normalizeAIConfig} from '@/lib/ai-provider';
import {isCompatibleChatModel,usesOpenAINoneReasoning} from '@/lib/ai-presets';
import {digest,fail} from './crypto';
import {readProvider,requireScope,rateLimit,type Principal} from './security';

export const local=(host:string)=>['localhost','127.0.0.1','[::1]','::1'].includes(host);
export const privateIP=(ip:string)=>net.isIPv4(ip)?/^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.0\.|192\.0\.2\.|198\.(1[89]|51)\.|203\.0\.113\.|22[4-9]\.|23\d\.|24\d\.|25\d\.)/.test(ip):ip==='::'||ip==='::1'||/^(fc|fd|fe[89ab]|ff|::ffff:)/i.test(ip);

/** Node's family auto-selection requests all:true. Return an array in that mode. */
export function pinnedLookup(records:readonly DNSAddress[]):net.LookupFunction {
 return (_host,options,callback)=>{
  const selected=options.family?records.filter(r=>r.family===Number(options.family)):records;
  if(!selected.length){callback(Object.assign(new Error('No matching address'),{code:'ENOTFOUND'}),'',0);return;}
  if(options.all)callback(null,[...selected]);else callback(null,selected[0].address,selected[0].family);
 };
}
/** Validate every resolved address, pin those records, preserve TLS hostname, never redirect credentials. */
export const secureAIFetch:typeof fetch=async(input,init)=>{
 const url=new URL(String(input)),allowed=(process.env.STUDIO_AI_ALLOWED_HOSTS??'').split(',').filter(Boolean);
 const localAllowed=process.env.STUDIO_DESKTOP==='1'&&local(url.hostname)||allowed.includes(url.hostname);
 if(url.username||url.password||url.protocol!=='https:'&&!(url.protocol==='http:'&&localAllowed))fail('AI 地址协议不受支持');
 init?.signal?.throwIfAborted();
 const records:DNSAddress[]=await lookup(url.hostname.replace(/^\[|\]$/g,''),{all:true});
 if(!records.length||records.some(r=>privateIP(r.address))&&!localAllowed)fail('AI 地址指向保留网络；请检查 DNS，云端受信任模型主机须由部署管理员配置',403);
 init?.signal?.throwIfAborted();
 return new Promise<Response>((resolve,reject)=>{
  const request=(url.protocol==='https:'?https:http).request(url,{method:init?.method??'GET',headers:Object.fromEntries(new Headers(init?.headers)),signal:init?.signal??undefined,lookup:pinnedLookup(records)},response=>{
   if(String(response.headers['content-type']).includes('text/event-stream')){
    let size=0,closed=false;const stream=new ReadableStream<Uint8Array>({start(controller){response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>2*1024*1024){response.destroy(aiFailure('AI 响应超过大小限制'));return;}if(!closed){controller.enqueue(new Uint8Array(chunk));if((controller.desiredSize??1)<=0)response.pause();}});response.on('end',()=>{if(!closed){closed=true;controller.close();}});response.on('error',e=>{if(!closed){closed=true;controller.error(e);}});},pull(){response.resume();},cancel(){closed=true;response.destroy();request.destroy();}});
    resolve(new Response(stream,{status:response.statusCode??502,headers:{'Content-Type':'text/event-stream'}}));return;
   }
   const chunks:Buffer[]=[];let size=0;
   response.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024){response.destroy(aiFailure('AI 响应超过大小限制'));return;}chunks.push(chunk);});
   response.on('error',reject);
   response.on('end',()=>{try{const status=response.statusCode??502;resolve(new Response([204,205,304].includes(status)?null:Buffer.concat(chunks),{status,headers:{'Content-Type':String(response.headers['content-type']??'application/json')}}));}catch{reject(aiFailure('AI 服务返回了无效响应'));}});
  });
  request.setTimeout(65000,()=>request.destroy(Object.assign(new Error('Timeout'),{code:'ETIMEDOUT'})));
  request.on('error',reject);request.end(init?.body??undefined);
 });
};

export interface ConnectionResult {state:'connected'|'unstable'|'disconnected';latency:number|null;message:string;code:string}
interface Catalog {models:string[];supported:boolean;latency:number;message:string}
const health=new Map<string,{fingerprint:string;at:number;verifiedUntil:number;value:ConnectionResult}>();
const catalogs=new Map<string,{fingerprint:string;at:number;value:Catalog}>();
const fingerprint=(config:AIConfig)=>digest(JSON.stringify(config));
function putHealth(p:Principal,config:AIConfig,value:ConnectionResult,verified=false){
 if(health.size>500)health.clear();
 const previous=health.get(p.workspaceId),hash=fingerprint(config);
 health.set(p.workspaceId,{fingerprint:hash,at:Date.now(),verifiedUntil:verified?Date.now()+300000:previous?.fingerprint===hash?previous.verifiedUntil:0,value});return value;
}
export function clearAIConnection(workspaceId:string){health.delete(workspaceId);catalogs.delete(workspaceId);}
export function recordAIConnection(p:Principal,config:AIConfig){putHealth(p,config,{state:'connected',latency:null,message:'连接正常',code:'ok'},true);}
function headers(config:AIConfig):Record<string,string>{return config.protocol==='anthropic'?{'x-api-key':config.apiKey,'anthropic-version':'2023-06-01'}:config.apiKey?{Authorization:'Bearer '+config.apiKey}:{};}
async function configuration(p:Principal,model=false){
 const saved=await readProvider(p,true) as AIConfig|null;
 if(!saved)throw aiFailure('请先选择服务并填写 API 密钥','not_configured');
 let config:AIConfig;try{config=normalizeAIConfig(saved,model);}catch(e){throw aiFailure((e as Error).message,'invalid_config');}
 if(['api.deepseek.com','api.openai.com','api.anthropic.com','generativelanguage.googleapis.com'].includes(new URL(config.baseUrl).hostname)&&!config.apiKey)throw aiFailure('请填写 API 密钥','missing_key');
 return config;
}
async function queryModels(config:AIConfig):Promise<Catalog>{
 let base=config.baseUrl;if(config.protocol==='anthropic'&&!base.endsWith('/v1'))base+='/v1';
 const start=Date.now();let response:Response;
 try{response=await secureAIFetch(base+'/models',{headers:headers(config),signal:AbortSignal.timeout(10000)});}catch(e){throw aiNetworkError(e);}
 const latency=Date.now()-start;
 if([404,405,501].includes(response.status))return {models:[],supported:false,latency,message:'服务未提供模型列表，可手动填写模型并测试连接'};
 if(!response.ok)throw await aiResponseError(response);
 let raw;try{raw=await response.json();}catch{throw aiFailure('模型列表格式不正确，请核对 API 基础地址与协议');}
 if(!Array.isArray(raw.data))throw aiFailure('模型列表格式不符合所选协议，请核对 API 基础地址');
 const models=[...new Set<string>(raw.data.map((m:{id?:unknown})=>m?.id).filter((id:unknown):id is string=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_./:@+-]{0,199}$/.test(id)&&!(config.apiKey.length>=3&&id.includes(config.apiKey))))].filter(id=>isCompatibleChatModel(config,id)).slice(0,1000);
 return {models,supported:true,latency,message:models.length?'模型列表已更新':'服务没有返回兼容的模型，可填写其他模型标识'};
}
export async function modelCatalog(p:Principal){
 if(p.apiKeyId)fail('AI 配置需要登录会话',403);requireScope(p,'ai:configure');
 const config=await configuration(p),hash=fingerprint(config),cached=catalogs.get(p.workspaceId);
 if(cached?.fingerprint===hash&&Date.now()-cached.at<30000)return cached.value;
 await rateLimit('ai-models:'+p.id,6,60);
 const value=await queryModels(config);if(catalogs.size>500)catalogs.clear();catalogs.set(p.workspaceId,{fingerprint:hash,at:Date.now(),value});
 return value;
}
export async function connectionStatus(p:Principal):Promise<ConnectionResult>{
 requireScope(p,'ai:use');let config:AIConfig;
 try{config=await configuration(p);}catch(e){return {state:'disconnected',latency:null,message:(e as Error).message,code:'not_configured'};}
 const hash=fingerprint(config),cached=health.get(p.workspaceId);
 if(cached?.fingerprint===hash&&Date.now()-cached.at<30000)return cached.value;
 await rateLimit('ai-status:'+p.id,6,60);
 try{
  const result=await queryModels(config),verified=cached?.fingerprint===hash&&cached.verifiedUntil>Date.now();
  return putHealth(p,config,{state:result.supported||verified?(result.latency>2500?'unstable':'connected'):'unstable',latency:result.latency,message:result.supported||verified?(result.latency>2500?'响应较慢':'连接正常'):result.message,code:result.supported||verified?'ok':'models_unavailable'});
 }catch(e){const code=String((e as {code?:string}).code??'network_error');return putHealth(p,config,{state:/upstream_(429|5\d\d)|network_error/.test(code)?'unstable':'disconnected',latency:null,message:(e as Error).message,code});}
}
export async function testConnection(p:Principal){
 if(p.apiKeyId)fail('AI 配置需要登录会话',403);requireScope(p,'ai:configure');await rateLimit('ai-test:'+p.id,6,60);
 const config=await configuration(p,true);
 if(!isCompatibleChatModel(config,config.model))throw aiFailure('该模型的业务工具需要其他协议，请选择兼容模型');
 const anthropic=config.protocol==='anthropic',base=config.baseUrl;
 const endpoint=anthropic?(base.endsWith('/v1')?base+'/messages':base+'/v1/messages'):base+'/chat/completions';
 const body={model:config.model,...(anthropic?{max_tokens:64}:new URL(base).hostname==='api.openai.com'?{max_completion_tokens:256}:{max_tokens:64}),...(usesOpenAINoneReasoning(config)?{reasoning_effort:'none'}:{}),messages:[{role:'user',content:'Reply with OK.'}]};
 const start=Date.now();let response:Response;
 try{response=await secureAIFetch(endpoint,{method:'POST',headers:{...headers(config),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});}catch(e){throw aiNetworkError(e);}
 if(!response.ok)throw await aiResponseError(response);
 let raw;try{raw=await response.json();}catch{throw aiFailure('AI 服务返回格式不正确，请核对 API 地址与协议');}
 if(anthropic?!Array.isArray(raw.content):!raw.choices?.[0]?.message)throw aiFailure('AI 响应不符合所选协议');
 const latency=Date.now()-start;
 return putHealth(p,config,{state:latency>2500?'unstable':'connected',latency,message:'连接成功 · '+config.model,code:'ok'},true);
}
