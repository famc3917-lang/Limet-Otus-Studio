// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {privacyReplay} from './privacy-cache';
import {retentionAPI,startRetention} from './retention';
import {softwareElevation} from './software-elevation';
import {memberDirectory} from './member-profiles';
import {requireScope} from './security';
import {CLI_MANUAL} from '@/lib/cli-manual';
import {CLI_MANUAL_EN} from '@/lib/cli-manual-en';
import {cliAPI} from './cli';
import {financeAPI,teamProfile} from './team-finance';
import {authenticate,authLogin,authLogout,authMe,authRegister,bootstrap,checkOrigin,manageSecurity,type Principal} from './security';
import {assistant,assistantControl,assistantStream,provider,connectionStatus,modelCatalog,testConnection} from './ai';
import {pluginCatalog} from './ai-runtime-tools';
import {APP_VERSION} from '@/lib/version';
import {speechStatus,transcribe} from './speech';
import {ttsStatus,synthesize,updateVoices} from './tts';
import {hardware} from './hardware';
import {command,getState,saveState} from './repository';
import {tx,database} from './database';
import {digest,fail,seal,unseal} from './crypto';
import {COMMAND_SCHEMAS} from '@/lib/business';
import {getStudioExtensions} from '@/lib/extensions';
import '@/lib/extension-bootstrap';
import {fetchWeather,searchCities,shootingAdvice,weatherDescription} from '@/lib/weather';
import {endpointsOf,secureWeatherFetch,weatherProvider} from './weather-provider';
import {familyAPI} from './family';
export async function boundedJson(request:Request,max=256000):Promise<Record<string,unknown>>{if(Number(request.headers.get('content-length'))>max)fail('请求内容过大',413);const reader=request.body?.getReader();if(!reader)fail('请求为空');let size=0;const parts:Uint8Array[]=[];for(;;){const {done,value}=await reader!.read();if(done)break;size+=value.length;if(size>max){await reader!.cancel();fail('请求内容过大',413);}parts.push(value);}const data=JSON.parse(Buffer.concat(parts).toString('utf8'),(key,value)=>{if(['__proto__','prototype','constructor'].includes(key))fail('请求包含不安全字段');return value;});if(!data||typeof data!=='object'||Array.isArray(data))fail('请求须为 JSON 对象');return data;}
async function dispatch(request:Request,path:string){const method=request.method;
 if(path==='health'&&method==='GET'){await database();startRetention();return {ok:true,version:APP_VERSION};}
 if(path==='auth/status'&&method==='GET'){checkOrigin(request);return tx(async sql=>({initialized:!!await sql.one('SELECT id FROM workspaces LIMIT 1'),setupMode:process.env.STUDIO_DESKTOP==='1'?'desktop':process.env.STUDIO_SETUP_TOKEN?'setup-token':'unavailable'}));}
 if(path==='auth/bootstrap'&&method==='POST')return bootstrap(request,await boundedJson(request));
 if(path==='auth/login'&&method==='POST')return authLogin(request,await boundedJson(request));
 if(path==='auth/register'&&method==='POST')return authRegister(request,await boundedJson(request));
 if(path==='auth/me'&&method==='GET')return authMe(request);
 if(path==='auth/logout'&&method==='POST')return authLogout(request);
 const p:Principal=await authenticate(request);startRetention();
 if(path.startsWith('family/'))return familyAPI(p,path.slice(7),request);
 if(path==='cli/manual'&&method==='GET'){
  const params=new URL(request.url).searchParams,en=params.get('language')==='en',manual=en?CLI_MANUAL_EN:CLI_MANUAL;
  if(p.role!=='owner'||p.apiKeyId)fail(en?'The manual requires a Super Administrator session.':'手册仅供超级管理员登录会话使用',403);
  if(params.get('download')==='1')return new Response(manual,{headers:{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename=CLI-manual-v3.0.0-'+(en?'en':'zh')+'.md'}});
  const escaped=manual.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!));
  return new Response('<!doctype html><html lang="'+(en?'en':'zh-CN')+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+(en?'Limet Otus CLI manual':'观隅 CLI语法手册')+'</title><style>body{margin:0;background:#08140e;color:#cce1d4;font:15px/1.9 system-ui}main{max-width:1050px;margin:auto;padding:40px 24px}a{color:#97cdaa}pre{font:14px/1.9 ui-monospace,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}nav{padding:16px 0 32px;display:flex;gap:24px}</style><main><nav><a href="/?cli=1">'+(en?'Return to command panel':'返回命令面板')+'</a><a href="?language='+(en?'en':'zh')+'&download=1">'+(en?'Download Markdown':'下载Markdown')+'</a></nav><pre>'+escaped+'</pre></main></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
 }
 if(path==='cli'&&method==='POST')return cliAPI(p,await boundedJson(request,64000));
 if(path==='retention/order-access'&&method==='GET'){if(p.apiKeyId)fail('桌面操作需要登录会话',403);requireScope(p,'business:read');const orderId=new URL(request.url).searchParams.get('orderId');return tx(async sql=>{const order=(await (await import('./repository')).readRawState(sql,p)).data.orders.find(o=>o.id===orderId);if(!order||order.anonymizedAt)fail('订单不存在或资料已经清理',404);return {available:true};});}
 if(path==='retention'&&['GET','POST'].includes(method))return retentionAPI(p,method,method==='POST'?await boundedJson(request,6000):{});
 if(path==='software/elevation'&&['GET','POST','DELETE'].includes(method))return softwareElevation(p,method,method==='GET'?{}:await boundedJson(request,4000));
 if(path==='team/members'&&method==='GET'){requireScope(p,'business:read');return tx(async sql=>({members:await memberDirectory(sql,p)}));}
 if(path==='team/profile'&&['GET','PATCH'].includes(method))return teamProfile(p,method==='PATCH'?await boundedJson(request,4000):undefined);
 if(path==='team/finance'&&['GET','POST'].includes(method))return financeAPI(p,method,method==='POST'?await boundedJson(request,32000):{});
 if(path==='tts/voices'&&method==='PUT')return updateVoices(p,await boundedJson(request,32000));
 if(path==='tts/status'&&method==='GET')return ttsStatus(p);
 if(path==='tts/synthesize'&&method==='POST')return synthesize(p,await boundedJson(request,6000));
 if(path==='speech'){if(method==='GET')return speechStatus(p);if(method==='POST')return transcribe(p,await boundedJson(request,1400000));}
 if(path==='ai/status'&&method==='GET')return connectionStatus(p);
 if(path==='ai/plugins'&&method==='GET')return pluginCatalog(p);
 if(path==='ai/models'&&method==='GET')return modelCatalog(p);
 if(path==='ai/test'&&method==='POST')return testConnection(p);
 if(path.startsWith('hardware/'))return hardware(p,request,path.slice(9),method==='GET'?{}:await boundedJson(request));
 if(['members','invitations','keys','audit','password'].includes(path)){const allowed:Record<string,string[]>={members:['GET','PATCH'],invitations:['POST'],keys:['GET','POST','PATCH','DELETE'],audit:['GET'],password:['POST']};if(!allowed[path].includes(method))fail('请求方法不受支持',405);return manageSecurity(request,p,path,method==='GET'?undefined:await boundedJson(request));}
 if(path==='state'){if(method==='GET'){const revision=new URL(request.url).searchParams.get('revision');return getState(p,revision!==null&&/^\d+$/.test(revision)&&Number.isSafeInteger(Number(revision))?Number(revision):undefined);}if(method==='PUT'){const body=await boundedJson(request,32*1024*1024);if(!Number.isSafeInteger(body.revision)||Number(body.revision)<0)fail('revision 无效');return saveState(p,body.data as Parameters<typeof saveState>[1],Number(body.revision));}}
 if(path==='commands'){if(method==='GET')return {version:1,commands:{...COMMAND_SCHEMAS,...Object.fromEntries(getStudioExtensions().flatMap(e=>Object.entries(e.commands??{}).map(([id,c])=>[id,{description:c.description,write:c.write,parameters:c.schema}])))} };if(method==='POST'){const body=await boundedJson(request),id=request.headers.get('idempotency-key');if(id&&(!/^[a-zA-Z0-9_-]{8,120}$/.test(id)))fail('Idempotency-Key 无效');return tx(async sql=>{const key=id?digest('idempotency:'+p.workspaceId+':'+p.id+':'+id):'',ctx='request:'+key;await sql.run('DELETE FROM idempotency WHERE expires_at<?',[new Date().toISOString()]);const previous=key?await sql.one<{body:string}>('SELECT body FROM idempotency WHERE id=?',[key]):undefined;if(previous){const saved=unseal<{workspaceId?:string;invalidated?:boolean;request:string;result:unknown}>(previous.body,ctx);if(saved.invalidated)fail('历史请求已随隐私清理失效，不能重复执行',409);if(saved.request!==digest(JSON.stringify(body)))fail('同一幂等键不能用于不同请求',409);return privacyReplay(sql,p.workspaceId,saved.result);}const result=await command(p,{type:String(body.type),payload:body.payload as Record<string,unknown>},body.revision as number|undefined,sql);if(key)await sql.run('INSERT INTO idempotency(id,body,expires_at) VALUES(?,?,?)',[key,seal({workspaceId:p.workspaceId,request:digest(JSON.stringify(body)),result},ctx),new Date(Date.now()+86400000).toISOString()]);return result;});}}
 if(path==='ai/provider'&&['GET','PUT'].includes(method))return provider(request,p,method==='PUT'?await boundedJson(request):undefined);
 if(path==='assistant/control'&&method==='POST')return assistantControl(p,await boundedJson(request,4000));
 if(path==='assistant'&&method==='POST'){const body=await boundedJson(request,16000);return request.headers.get('accept')?.includes('text/event-stream')?assistantStream(p,body,request.signal):assistant(p,body);}
 if(path==='weather'&&method==='GET'){requireScope(p,'business:read');const q=new URL(request.url).searchParams,latitude=Number(q.get('latitude')),longitude=Number(q.get('longitude'));if(!q.has('latitude')||!q.has('longitude')||!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180)fail('请提供有效的 latitude 与 longitude');const zone=q.get('timezone')??'auto',language=q.get('language')==='en'?'en':'zh';if(zone.length>64||!/^[A-Za-z0-9_+\-/]+$/.test(zone))fail('请提供有效的 latitude 与 longitude');const api=endpointsOf((await tx(sql=>weatherProvider(sql,p))).data);const days=await fetchWeather({name:q.get('name')??'拍摄地',latitude,longitude,timezone:zone},AbortSignal.timeout(20000),api,secureWeatherFetch);return {days:days.filter(d=>!q.get('date')||d.date===q.get('date')).map(d=>({...d,weather:weatherDescription(d.code,language),advice:shootingAdvice(d,language)}))};}
 if(path==='weather/search'&&method==='GET'){requireScope(p,'business:read');const q=new URL(request.url).searchParams,name=(q.get('name')??'').trim();if(!name||name.length>100)fail('请输入城市名称');const api=endpointsOf((await tx(sql=>weatherProvider(sql,p))).data);return {places:await searchCities(name,AbortSignal.timeout(20000),q.get('language')==='en'?'en':'zh',api,secureWeatherFetch)};}
 return fail('接口或请求方法不存在',404);
}
export async function handleAPI(request:Request){let response:Response;try{checkOrigin(request);if(request.method==='OPTIONS')response=new Response(null,{status:204});else{const prefix='/api/v1/',path=new URL(request.url).pathname.split(prefix)[1]?.replace(/\/$/,'')??'';const result=await dispatch(request,path);response=result instanceof Response?result:Response.json(result);}}catch(e){const status=typeof e==='object'&&e&&'status' in e?Number(e.status):e instanceof SyntaxError?400:500;response=Response.json({error:status>=500?'服务暂不可用，请检查服务端配置与运行日志':(e as Error).message,...(typeof e==='object'&&e&&'conflicts' in e?{conflicts:e.conflicts}:{})},{status});if(status>=500)console.error('[Studio API]',e instanceof Error?e.name+': '+e.message:'unexpected failure');}
 response.headers.set('Cache-Control','no-store');response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('X-Frame-Options','DENY');response.headers.set('Referrer-Policy','no-referrer');if(response.status===429)response.headers.set('Retry-After','60');const origin=request.headers.get('origin');if(origin&&(process.env.STUDIO_ORIGINS??'').split(',').includes(origin)){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Access-Control-Allow-Credentials','true');response.headers.set('Access-Control-Allow-Headers','Content-Type, X-Studio-CSRF, Authorization, Idempotency-Key, X-Studio-Bootstrap, X-Studio-Elevation');response.headers.set('Access-Control-Allow-Methods','GET, POST, PUT, PATCH, DELETE, OPTIONS');response.headers.set('Vary','Origin');}return response;
}
