// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import type {AIConfig} from './desktop';
import {assistantIdentityPrefix,voiceProfile,normalizeVoiceProfiles} from './assistant-identity';
import {nowLocalDateTimeInput} from './studio';
import {businessTimeZone,zoneLabel} from './time-zone';
import {isTimeZone} from './settings';
import {isCompatibleChatModel,usesOpenAINoneReasoning,providerPreset} from './ai-presets';
import {aiPlatformPrefix,normalizePlugins,selectedAITools} from './ai-plugins';
import {readAIStream} from './ai-stream';
export interface AICall {id:string;type:string;payload:Record<string,unknown>}
export interface AIMessage {role:'user'|'assistant'|'tool';content:string;calls?:AICall[];callId?:string}
export function normalizeAIConfig(config:AIConfig,requireModel=false):AIConfig {
 if(!config||!['openai','anthropic'].includes(config.protocol))throw new Error('请选择 API 协议');
 if(typeof config.baseUrl!=='string'||!config.baseUrl.trim()||config.baseUrl.length>2000)throw new Error('请填写 API 基础地址');
 let url:URL;try{url=new URL(config.baseUrl.trim());}catch{throw new Error('API 地址格式不正确');}
 if(url.username||url.password||url.search||url.hash||url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('API 地址须使用 HTTPS；本机模型可使用 localhost HTTP');
 if(typeof config.model!=='string'||config.model.length>200)throw new Error('模型标识格式不正确');
 if(typeof config.apiKey!=='string'||config.apiKey.length>10000||/[\r\n\x00]/.test(config.apiKey.trim()))throw new Error('API 密钥格式不正确，请只粘贴密钥');
 const apiKey=config.apiKey.trim();if(/^Bearer\s/i.test(apiKey))throw new Error('API 密钥不需要 Bearer 前缀，请只粘贴密钥');
 url.pathname=url.pathname.replace(/\/+$/,'').replace(config.protocol==='anthropic'?/\/messages$/:/\/chat\/completions$/,'');
 if(config.protocol==='openai'&&url.hostname==='api.openai.com'&&!url.pathname)url.pathname='/v1';
 let model=config.model.trim();
 if(url.hostname==='api.deepseek.com'){
  const alias:Record<string,string>={deepseekv4flash:'deepseek-flash',deepseekv4pro:'deepseek-v4-pro',deepseekflash:'deepseek-flash'};
  model=alias[model.toLowerCase().replace(/[\s_-]/g,'')]??model;
 }
 if(requireModel&&!model)throw new Error('请选择或填写模型标识');
 if(config.searchApiKey!==undefined&&typeof config.searchApiKey!=='string')throw new Error('搜索服务密钥格式不正确');
 const searchApiKey=(config.searchApiKey??'').trim();if(searchApiKey.length>10000||/[\r\n\x00]/.test(searchApiKey))throw new Error('搜索服务密钥格式不正确');
 for(const field of ['providerName','modelDeveloper'] as const)if(config[field]!==undefined&&(typeof config[field]!=='string'||config[field]!.length>100||/[\r\n\x00-\x1f]/.test(config[field]!)))throw Error('模型身份字段格式不正确');
 const preset=providerPreset({baseUrl:url.toString(),protocol:config.protocol});
 return {providerName:config.providerName?.trim()||preset?.name||'自定义服务',modelDeveloper:config.modelDeveloper?.trim()||preset?.developer||'',protocol:config.protocol,baseUrl:url.toString().replace(/\/$/,''),model,apiKey,plugins:normalizePlugins(config.plugins),searchApiKey,voiceCatalog:normalizeVoiceProfiles(config.voiceCatalog),...(config.configured!==undefined?{configured:config.configured}:{}),...(config.searchConfigured!==undefined?{searchConfigured:config.searchConfigured}:{})};
}
export function validateAIConfig(config:AIConfig,requireModel=true){return normalizeAIConfig(config,requireModel).baseUrl;}
export function aiFailure(message:string,code='provider_error'):Error {return Object.assign(new Error(message),{status:400,code});}
export async function aiResponseError(response:Response){
 let hint='';try{const raw=await response.json();hint=String(raw?.error?.code??raw?.error?.type??'');}catch{}
 const status=response.status;
 const reason=status===401?'API 密钥无效或已失效，请检查服务平台密钥':status===402||/insufficient_quota|insufficient_balance/.test(hint)?'服务账户额度不足，请检查平台余额或配额':status===403?'服务拒绝访问，请检查模型权限或地区限制':status===404?'API 地址或模型标识不存在，请检查接入配置':status===429?'服务请求频率受限，请稍后再试':status>=500?'AI 服务暂时异常，请稍后重试':status>=300&&status<400?'API 地址发生跳转，请填写服务提供的最终 API 地址':'服务不接受当前参数，请检查模型与所选协议';
 return aiFailure(`${reason}（HTTP ${status}）`,'upstream_'+status);
}
export function aiNetworkError(error:unknown){
 if(error instanceof Error&&'status' in error)return error;
 const e=error as {name?:string;code?:string;cause?:{code?:string}},code=e?.code??e?.cause?.code;
 const message=e?.name==='AbortError'||e?.name==='TimeoutError'||code==='ETIMEDOUT'?'连接 AI 服务超时，请检查网络后重试':code==='ENOTFOUND'||code==='EAI_AGAIN'?'无法解析 AI 服务地址，请检查地址或 DNS':code?.includes('CERT')||code?.includes('TLS')?'AI 服务证书校验失败，请检查服务地址和证书':'无法连接 AI 服务，请检查网络、API 地址及服务状态';
 return aiFailure(message,'network_error');
}
const safeName=(name:string)=>name.replaceAll('.','__');
const originalName=(name:string,tools:Record<string,unknown>)=>Object.keys(tools).find(n=>safeName(n)===name);
export async function requestAI(config:AIConfig,messages:AIMessage[],signal?:AbortSignal,fetcher:typeof fetch=fetch,onText?:(text:string)=>void):Promise<{text:string;calls:AICall[]}>{
 const context={interfaceLanguage:config.interfaceLanguage,timeZone:config.timeZone,voiceId:config.voiceId,allowedCommands:config.allowedCommands,knowledge:config.knowledge,prefixMode:config.prefixMode,prefixGeneration:config.prefixGeneration};try{config={...normalizeAIConfig(config,true),...context};}catch(e){throw aiFailure((e as Error).message);}const base=config.baseUrl;if(!isCompatibleChatModel(config,config.model))throw aiFailure('该模型不支持当前业务工具协议，请选择 Chat Completions 工具调用模型');if(!Array.isArray(messages)||messages.length>80||JSON.stringify(messages).length>200000)throw aiFailure('对话过长，请开启新对话');
 const zone=config.timeZone&&isTimeZone(config.timeZone)?config.timeZone:businessTimeZone();const tools=selectedAITools(config),system=assistantIdentityPrefix(voiceProfile(config.voiceId,config.voiceCatalog),{model:config.model,developer:config.modelDeveloper,expanded:config.prefixMode!=='compact'})+'\n\n'+aiPlatformPrefix(config)+'\n\n'+(config.knowledge??'')+'\n'+(config.interfaceLanguage==='en'?'Respond in English. Retain the assigned persona, brand identity and permission boundaries. Use the original tool identifiers and payload keys; do not translate them. Preserve user-entered names and data.':'使用中文回复；工具标识和参数键保持原样。')+'\n当前业务时间（'+zoneLabel(new Date(),zone)+'） '+nowLocalDateTimeInput(zone)+'；拍摄时间格式 YYYY-MM-DDTHH:mm，不含自然语言。';
 let body:Record<string,unknown>,headers:Record<string,string>,endpoint:string;
 if(config.protocol==='anthropic'){
  endpoint=base.endsWith('/v1')?base+'/messages':base+'/v1/messages';headers={'Content-Type':'application/json','x-api-key':config.apiKey,'anthropic-version':'2023-06-01'};
  const converted=messages.map(m=>m.role==='tool'?{role:'user',content:[{type:'tool_result',tool_use_id:m.callId,content:m.content}]}:m.role==='assistant'&&m.calls?.length?{role:'assistant',content:[...(m.content?[{type:'text',text:m.content}]:[]),...m.calls.map(c=>({type:'tool_use',id:c.id,name:safeName(c.type),input:c.payload}))]}:{role:m.role,content:m.content});
  body={model:config.model,max_tokens:1600,system,messages:converted,...(Object.keys(tools).length?{tools:Object.entries(tools).map(([name,t])=>({name:safeName(name),description:t.description,input_schema:t.parameters}))}:{})};
 }else{
  endpoint=base.endsWith('/chat/completions')?base:base+'/chat/completions';headers={'Content-Type':'application/json',...(config.apiKey?{Authorization:'Bearer '+config.apiKey}:{})};
  body={model:config.model,...(usesOpenAINoneReasoning(config)?{reasoning_effort:'none'}:{}),messages:[{role:'system',content:system},...messages.map(m=>m.role==='tool'?{role:'tool',tool_call_id:m.callId,content:m.content}:m.role==='assistant'?{role:'assistant',content:m.content||null,...(m.calls?.length?{tool_calls:m.calls.map(c=>({id:c.id,type:'function',function:{name:safeName(c.type),arguments:JSON.stringify(c.payload)}}))}:{})}:{role:'user',content:m.content})],...(Object.keys(tools).length?{tools:Object.entries(tools).map(([name,t])=>({type:'function',function:{name:safeName(name),description:t.description,parameters:t.parameters}}))}:{})};
 }
 if(onText)body.stream=true;
 let response:Response;try{response=await fetcher(endpoint,{method:'POST',headers,body:JSON.stringify(body),signal:signal??AbortSignal.timeout(60000)});}catch(e){throw aiNetworkError(e);}
 if(!response.ok)throw await aiResponseError(response);
 let raw;try{if(onText&&response.headers.get('content-type')?.includes('text/event-stream')){const streamed=await readAIStream(response,config.protocol,onText);raw=config.protocol==='anthropic'?{content:[{type:'text',text:streamed.text},...streamed.tools.map(t=>({type:'tool_use',...t}))]}:{choices:[{message:{content:streamed.text,tool_calls:streamed.tools.map(t=>({id:t.id,function:{name:t.name,arguments:JSON.stringify(t.input)}}))}}]};}else{raw=await response.json();}}catch{throw aiFailure('AI 服务返回格式不正确或连接中断，请重试');}if(!raw||typeof raw!=='object')throw aiFailure('AI 服务返回格式不正确');let text='',calls:AICall[]=[];
 if(config.protocol==='anthropic'){for(const part of raw.content??[]){if(part.type==='text')text+=part.text??'';if(part.type==='tool_use'){const type=originalName(part.name,tools);if(!type)throw aiFailure('模型请求了未挂载或未授权的插件');calls.push({id:part.id,type,payload:part.input});}}}
 else{const m=raw.choices?.[0]?.message;if(!m)throw aiFailure('AI 响应格式不符合所选协议');text=typeof m.content==='string'?m.content:'';calls=(m.tool_calls??[]).flatMap((c:{id:string;function:{name:string;arguments:string}})=>{const type=originalName(c.function.name,tools);if(!type)throw aiFailure('模型请求了未挂载或未授权的插件');let payload;try{payload=JSON.parse(c.function.arguments);}catch{throw aiFailure('AI 返回了无效的业务参数');}return [{id:c.id,type,payload}];});}
 if(calls.some(c=>!c.id||!c.payload||typeof c.payload!=='object'||Array.isArray(c.payload)))throw aiFailure('AI 返回了无效的业务参数');
 if(onText&&!response.headers.get('content-type')?.includes('text/event-stream'))onText(text);
 return {text,calls};
}
