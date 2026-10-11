// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {restoreDeletionJournal} from './privacy-guard';
import {randomUUID} from 'node:crypto';
import {tx,type SQL} from './database';
import {currentAssistantPrincipal} from './assistant-policy';
import {voiceProfile} from '@/lib/assistant-identity';
import {retrieveAssistantContext,searchAssistantKnowledge} from './assistant-knowledge-index';
import {validateToolPayload} from '@/lib/tool-validation';
import {PERSONA_REVISION} from '@/lib/assistant-identity';
import {digest,fail,seal,unseal} from './crypto';
import {audit,rateLimit,readProvider,requireScope,securityExpiry,type Principal} from './security';
import {command,readRawState} from './repository';
import {requestAI,normalizeAIConfig,type AIMessage,type AICall} from '@/lib/ai-provider';
import {endpointsOf,secureWeatherFetch,weatherProvider} from './weather-provider';
import {fetchWeather,shootingAdvice,weatherDescription,type WeatherPlace} from '@/lib/weather';
import type {AIConfig} from '@/lib/desktop';
import {timeZoneOf} from '@/lib/settings';
interface Conversation {messages:AIMessage[];pending:AICall[];finished:Record<string,string>;plugins?:AIPluginId[];voiceId?:string;controlsRevision?:number;binding?:string}
import {AI_TOOL_SCHEMAS,selectedAITools,type AIPluginId} from '@/lib/ai-plugins';
import {resolveAIPlugins,searchWeb,systemSummary} from './ai-runtime-tools';
import {secureAIFetch,clearAIConnection,recordAIConnection} from './ai-connection';
export {secureAIFetch,connectionStatus,modelCatalog,testConnection} from './ai-connection';
export async function provider(request:Request,p:Principal,body?:Record<string,unknown>){
 if(p.apiKeyId)fail('AI 配置需要登录会话',403);requireScope(p,'ai:configure');
 if(request.method==='GET')return await readProvider(p)??{protocol:'openai',baseUrl:'https://api.openai.com/v1',model:'',apiKey:'',configured:false};
 const previous=await readProvider(p,true) as unknown as AIConfig|null;
 let config:AIConfig;try{config=normalizeAIConfig({...body,apiKey:body?.apiKey??''} as unknown as AIConfig);}catch(e){fail((e as Error).message);}
 if(!config!.apiKey&&previous){
  const sameService=previous.protocol===config!.protocol&&new URL(previous.baseUrl).origin===new URL(config!.baseUrl).origin;
  if(sameService)config!.apiKey=previous.apiKey;
 }
 // A key is reused only for the same authority and protocol, never another provider.
 if(!config!.searchApiKey&&previous?.searchApiKey)config!.searchApiKey=previous.searchApiKey;
 const generation=previous&&previous.baseUrl===config!.baseUrl&&previous.model===config!.model&&previous.apiKey===config!.apiKey&&previous.modelDeveloper===config!.modelDeveloper?previous.prefixGeneration:undefined;
 const {configured:ignored,searchConfigured:ignoredSearch,...rest}=config!;const stored={...rest,prefixGeneration:generation??randomUUID()};void ignored;void ignoredSearch;
 await tx(async sql=>{await sql.run('INSERT INTO providers(workspace_id,body) VALUES(?,?) ON CONFLICT(workspace_id) DO UPDATE SET body=excluded.body',[p.workspaceId,seal(stored,'provider:'+p.workspaceId)]);await audit(sql,p,'ai.configure');});
 clearAIConnection(p.workspaceId);return {ok:true,config:await readProvider(p)};
}
/** User text is filtered; tool data never originates from a caller-supplied history. */
export function privacyFilter(text:string,secrets:string[]){let result=text;for(const value of secrets.filter(s=>s&&s.length>=3).sort((a,b)=>b.length-a.length))result=result.split(value).join('[客户隐私已隐藏]');return result.replace(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g,'[手机号已隐藏]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已隐藏]').replace(/(?<!\d)\d{17}[\dXx](?!\d)/g,'[身份信息已隐藏]');}

const controllers=new Map<string,AbortController>();
function resolvedVoice(id:unknown,custom:unknown){try{return voiceProfile(id,custom);}catch(e){return fail((e as Error).message);}}
const ownerKey=(p:Principal,id:string)=>digest('conversation:'+p.workspaceId+':'+p.id+':'+id);
function conversationId(value:unknown){if(typeof value!=='string'||! /^[a-zA-Z0-9_-]{1,100}$/.test(value))fail('对话编号无效');return value as string;}
async function loadConversation(sql:SQL,p:Principal,id:string){await restoreDeletionJournal(sql,p.workspaceId);const row=await sql.one<{body:string}>('SELECT body FROM conversations WHERE id=? AND workspace_id=? AND user_id=? AND expires_at>?',[id,p.workspaceId,p.id,new Date().toISOString()]);if(!row)fail('对话不存在或已过期',404);return unseal<Conversation>(row!.body,ownerKey(p,id));}
async function saveConversation(sql:SQL,p:Principal,id:string,c:Conversation){await sql.run('INSERT INTO conversations(id,workspace_id,user_id,body,expires_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,expires_at=excluded.expires_at',[id,p.workspaceId,p.id,seal(c,ownerKey(p,id)),securityExpiry(2)]);}
async function policy(sql:SQL,p:Principal,c:Conversation){const actor=await currentAssistantPrincipal(sql,p),row=await sql.one<{body:string}>('SELECT body FROM providers WHERE workspace_id=?',[p.workspaceId]);if(!row)fail('请由管理员先配置 AI 服务');const config=unseal<AIConfig>(row!.body,'provider:'+p.workspaceId),effective=resolveAIPlugins(actor,config,c.plugins);try{effective.voiceId=voiceProfile(c.voiceId,config.voiceCatalog).id;}catch{c.voiceId='cosy-zh-male';effective.voiceId=c.voiceId;}return {actor,config,effective,allowed:selectedAITools(effective)};}
function prefixKey(p:Principal,c:AIConfig){return digest(['prefix-v240',p.workspaceId,c.prefixGeneration??'',c.protocol,c.baseUrl,c.apiKey,c.model,voiceProfile(c.voiceId,c.voiceCatalog).gender,PERSONA_REVISION].join('|'));}
function memoryBinding(config:AIConfig){return digest([config.protocol,config.baseUrl,config.model,config.prefixGeneration??'',config.voiceId,PERSONA_REVISION].join('|'));}
function bindMemory(c:Conversation,config:AIConfig){const binding=memoryBinding(config);if(c.binding&&c.binding!==binding){c.messages=[];c.pending=[];c.finished={};c.controlsRevision=(c.controlsRevision??0)+1;}c.binding=binding;}
function view(id:string,c:Conversation){const results=new Map(c.messages.filter(m=>m.role==='tool').map(m=>[m.callId,m.content]));return {conversationId:id,messages:c.messages.filter(m=>m.role!=='tool'),pending:c.pending,finished:c.finished,voiceId:c.voiceId,plugins:c.plugins,controlsRevision:c.controlsRevision??0,activity:c.messages.flatMap(m=>m.calls??[]).map(call=>{let failed=false;try{failed=!!JSON.parse(results.get(call.id)??'{}').error;}catch{}return {id:call.id,type:call.type,state:c.finished[call.id]==='已取消'?'cancelled':c.pending.some(v=>v.id===call.id)?'pending':failed?'failed':'completed'};})};}
function revokePending(c:Conversation,allowed:Record<string,unknown>){for(const call of c.pending.filter(call=>!allowed[call.type])){c.finished[call.id]='已取消';c.messages.push({role:'tool',callId:call.id,content:'{"cancelled":true}'});}c.pending=c.pending.filter(call=>!!allowed[call.type]);}
export async function assistantControl(p:Principal,body:Record<string,unknown>){requireScope(p,'ai:use');await rateLimit('ai-control:'+p.id,60,60);const id=conversationId(body.conversationId);const result=await tx(async sql=>{const c=await loadConversation(sql,p,id),prior=await policy(sql,p,c);if(body.plugins!==undefined)c.plugins=resolveAIPlugins(prior.actor,prior.config,body.plugins).plugins;if(body.voiceId!==undefined)c.voiceId=resolvedVoice(String(body.voiceId),prior.config.voiceCatalog).id;const next=await policy(sql,p,c);bindMemory(c,next.effective);c.controlsRevision=(c.controlsRevision??0)+1;revokePending(c,next.allowed);const complete=new Set(c.messages.filter(m=>m.role==='tool').map(m=>m.callId));for(const call of c.messages.flatMap(m=>m.calls??[]))if(!complete.has(call.id)&&!c.pending.some(p=>p.id===call.id)){c.messages.push({role:'tool',callId:call.id,content:'{"cancelled":true}'});c.finished[call.id]='已取消';}await saveConversation(sql,p,id,c);await audit(sql,p,'ai.controls',id);return view(id,c);});controllers.get(ownerKey(p,id))?.abort();return result;}
type Publish=(event:string,value:unknown)=>void;
/** Release complete sentences only; never expose a secret split across provider chunks. */
export function sentencePublisher(secrets:string[],emit:(text:string)=>void){let pending='';return (delta:string,final=false)=>{pending+=delta;let cut=final?pending.length:0;if(!final){for(const m of pending.matchAll(/[。！？!?\n]|\.(?=\s)/g))cut=m.index!+m[0].length;let previous;do{previous=cut;for(const secret of secrets.filter(s=>s.length>=3)){for(let n=Math.min(secret.length-1,cut);n>0;n--)if(pending.slice(0,cut).endsWith(secret.slice(0,n))){cut-=n;break;}}}while(cut!==previous);}if(cut){emit(privacyFilter(pending.slice(0,cut),secrets));pending=pending.slice(cut);}};}
async function assistantTurn(p:Principal,body:Record<string,unknown>,publish?:Publish,externalSignal?:AbortSignal){
 requireScope(p,'ai:use');await rateLimit('ai:'+p.id,20,60);if('messages' in body||'config' in body)fail('助手不接受客户端提供的工具结果或密钥配置',403);
 if(body.language!==undefined&&body.language!=='zh'&&body.language!=='en')fail('界面语言无效');
 const interfaceLanguage=body.language==='en'?'en':'zh';
 const id=body.conversationId?conversationId(body.conversationId):randomUUID();
 const initial=await tx(async sql=>{await sql.run('DELETE FROM conversations WHERE expires_at<?',[new Date().toISOString()]);const c:Conversation=body.conversationId?await loadConversation(sql,p,id):{messages:[],pending:[],finished:{},controlsRevision:0};const pol=await policy(sql,p,c);if(body.plugins!==undefined)c.plugins=resolveAIPlugins(pol.actor,pol.config,body.plugins).plugins;else c.plugins=pol.effective.plugins;if(body.voiceId!==undefined)c.voiceId=resolvedVoice(String(body.voiceId),pol.config.voiceCatalog).id;else c.voiceId=pol.effective.voiceId;const current=await policy(sql,p,c);bindMemory(c,current.effective);revokePending(c,current.allowed);const snapshot=await readRawState(sql,current.actor),secrets=[current.config.apiKey,current.config.searchApiKey??'',...snapshot.data.orders.flatMap(o=>[o.note??''])];
  if(body.confirmation){const confirmation=body.confirmation as {id:string;approved:boolean;privateFields?:Record<string,unknown>};if(typeof confirmation.approved!=='boolean')fail('确认状态无效');const call=c.pending.find(call=>call.id===confirmation.id);if(!call)fail('待确认操作不存在或已经处理',409);let result:unknown={cancelled:true};if(confirmation.approved){if(!current.allowed[call!.type])fail('当前权限不允许此操作',403);let payload=call!.payload;if(call!.type==='orders.create'){const fields=confirmation.privateFields??{};if(Object.keys(fields).some(k=>!['gender','adult'].includes(k)))fail('客户确认资料包含不支持的字段',403);payload={...payload,...fields};}result=(await command(current.actor,{type:call!.type,payload},snapshot.revision,sql,true)).result;}c.finished[call!.id]=confirmation.approved?'已执行':'已取消';c.pending=c.pending.filter(v=>v.id!==call!.id);c.messages.push({role:'tool',callId:call!.id,content:privacyFilter(JSON.stringify(result),secrets)});
  }else{if(c.pending.length)fail('请先确认或取消待执行操作',409);if(typeof body.text!=='string'||!body.text.trim()||body.text.length>8000)fail('消息须为 1–8000 字');c.messages.push({role:'user',content:privacyFilter(body.text.trim(),secrets)});}
  await saveConversation(sql,p,id,c);return {c,secrets,revision:c.controlsRevision??0};});
 publish?.('session',view(id,initial.c));const controller=new AbortController(),key=ownerKey(p,id);controllers.set(key,controller);const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(240000),...(externalSignal?[externalSignal]:[])]);
 try{if(!initial.c.pending.length)for(let step=0;step<4;step++){
  const prepared=await tx(async sql=>{const c=await loadConversation(sql,p,id);if((c.controlsRevision??0)!==initial.revision)return null;const pol=await policy(sql,p,c);const texts=c.messages.filter(m=>m.role==='user').map(m=>m.content);pol.effective.interfaceLanguage=interfaceLanguage;pol.effective.timeZone=timeZoneOf((await readRawState(sql,p)).data.settings);pol.effective.knowledge=retrieveAssistantContext(texts.at(-1)??'',Object.keys(pol.allowed),texts.slice(-3,-1),interfaceLanguage);const count=await sql.one<{count:number}>('SELECT count FROM ai_prefix_usage WHERE id=?',[prefixKey(p,pol.effective)]);pol.effective.prefixMode=(count?.count??0)<100?'expanded':'compact';return {c,...pol};});if(!prepared||signal.aborted)break;
  const emit=sentencePublisher(initial.secrets,text=>{if(!signal.aborted)publish?.('text',{step,text,controlsRevision:initial.revision});});publish?.('phase',{phase:'thinking'});const response=await requestAI(prepared.effective,prepared.c.messages,AbortSignal.any([signal,AbortSignal.timeout(60000)]),secureAIFetch,publish?delta=>emit(delta):undefined);recordAIConnection(p,prepared.config);
  const accepted=await tx(async sql=>{await sql.run('INSERT INTO ai_prefix_usage(id,count) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET count=ai_prefix_usage.count+1',[prefixKey(p,prepared.effective)]);const c=await loadConversation(sql,p,id);if((c.controlsRevision??0)!==initial.revision||signal.aborted)return false;const pol=await policy(sql,p,c);if(response.calls.some(call=>!pol.allowed[call.type]))fail('模型请求了未挂载的插件',403);for(const call of response.calls)validateToolPayload(pol.allowed[call.type].parameters,call.payload);for(const call of response.calls)if(Object.keys(call.payload).some(k=>['note','gender','adult'].includes(k)))fail('模型返回了禁止访问的客户资料字段',403);c.messages.push({role:'assistant',content:privacyFilter(response.text,initial.secrets),calls:response.calls});for(const call of response.calls)if(AI_TOOL_SCHEMAS[call.type]?.write)c.pending.push(call);await saveConversation(sql,p,id,c);return true;});if(!accepted)break;
  emit('',true);publish?.('snapshot',view(id,await tx(sql=>loadConversation(sql,p,id))));publish?.('phase',{phase:response.calls.length?'tools':'complete'});if(!response.calls.length)break;
  for(const call of response.calls){if(AI_TOOL_SCHEMAS[call.type]?.write)continue;let result:unknown;
   try{const pol=await tx(async sql=>{const c=await loadConversation(sql,p,id);if((c.controlsRevision??0)!==initial.revision||signal.aborted)fail('操作已取消',409);const pol=await policy(sql,p,c);if(!pol.allowed[call.type])fail('该插件已停用',403);if(!['weather.get','web.search','system.status','knowledge.search'].includes(call.type))return {result:(await command(pol.actor,{type:call.type,payload:call.payload},undefined,sql,true)).result};return pol;});
    if('result' in pol)result=pol.result;
    else if(call.type==='weather.get'){const place=body.place as WeatherPlace;if(!place||!Number.isFinite(place.latitude)||Math.abs(place.latitude)>90||!Number.isFinite(place.longitude)||Math.abs(place.longitude)>180)fail('请先在拍摄日历选择城市');const days=await fetchWeather({...place,timezone:'auto'},AbortSignal.any([signal,AbortSignal.timeout(20000)]),endpointsOf((await tx(sql=>weatherProvider(sql,p))).data),secureWeatherFetch),day=days.find(d=>d.date===call.payload.date);result=day?{...day,weather:weatherDescription(day.code,interfaceLanguage),advice:shootingAdvice(day,interfaceLanguage)}:{message:interfaceLanguage==='en'?'The date is outside the forecast range.':'日期不在预报范围内'};}
    else if(call.type==='knowledge.search')result={entries:searchAssistantKnowledge(String(call.payload.query??''),Object.keys(pol.allowed),[],interfaceLanguage)};
    else if(call.type==='system.status')result=await systemSummary(pol.actor);
    else{const query=String(call.payload.query??'');if(privacyFilter(query,initial.secrets)!==query)fail('搜索关键词包含隐私信息，请改为公开关键词',403);result=await searchWeb(pol.actor,pol.effective,query);}
   }catch(e){result={error:(e as Error).message};}
   const saved=await tx(async sql=>{const c=await loadConversation(sql,p,id);if((c.controlsRevision??0)!==initial.revision||signal.aborted)return false;await policy(sql,p,c);c.messages.push({role:'tool',callId:call.id,content:privacyFilter(JSON.stringify(result),initial.secrets)});await saveConversation(sql,p,id,c);return true;});if(!saved)break;
  }
  const current=await tx(sql=>loadConversation(sql,p,id));publish?.('snapshot',view(id,current));if(current.pending.length)break;
 }}catch(e){if(!controller.signal.aborted)throw e;}finally{if(controllers.get(key)===controller)controllers.delete(key);await tx(sql=>audit(sql,p,'ai.turn',id));}
 const current=await tx(sql=>loadConversation(sql,p,id));return view(id,current);
}
export async function assistant(p:Principal,body:Record<string,unknown>,publish?:Publish,signal?:AbortSignal){const lease=digest('ai-lease:'+p.workspaceId+':'+p.id),holder=randomUUID();await tx(async sql=>{const existing=await sql.one<{expires_at:string}>('SELECT expires_at FROM leases WHERE id=?',[lease]);if(existing&&existing.expires_at>new Date().toISOString())fail('上一条助手请求仍在处理，请稍候',409);await sql.run('INSERT INTO leases(id,holder,expires_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET holder=excluded.holder,expires_at=excluded.expires_at',[lease,holder,new Date(Date.now()+300000).toISOString()]);});try{return await assistantTurn(p,body,publish,signal);}finally{await tx(sql=>sql.run('DELETE FROM leases WHERE id=? AND holder=?',[lease,holder]));}}
export function assistantStream(p:Principal,body:Record<string,unknown>,signal?:AbortSignal){const encoder=new TextEncoder(),cancel=new AbortController();let closed=false;return new Response(new ReadableStream({start(controller){const publish:Publish=(event,value)=>{if(!closed)controller.enqueue(encoder.encode('event: '+event+'\ndata: '+JSON.stringify(value)+'\n\n'));};void assistant(p,body,publish,signal?AbortSignal.any([signal,cancel.signal]):cancel.signal).then(result=>publish('result',result)).catch(e=>publish('error',{error:typeof e==='object'&&e&&'status' in e?(e as Error).message:'助手暂不可用，请稍后重试'})).finally(()=>{if(!closed){closed=true;controller.close();}});},cancel(){closed=true;cancel.abort();}}),{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'}});}
