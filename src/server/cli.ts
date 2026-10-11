// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {ENDPOINT_FIELDS,WEATHER_MODULE,validateWeatherEndpoint,validateWeatherKey,weatherProvider,weatherSummary,type WeatherProvider} from './weather-provider';
import {randomUUID} from 'node:crypto';
import {CLI_MODULES,cliHelp,cliModule,cliModuleLabel,cliCanonicalTokens,cliMessage} from '@/lib/cli';
import {EMPTY_FINANCE,effectiveEntries,cents,validateShareRule,type ShareRule,type FinanceState} from '@/lib/team-finance';
import {readModule,writeModule} from './modules';
import {tx,type SQL} from './database';
import {audit,rateLimit,readProvider,type Principal} from './security';
import {fail} from './crypto';
import {readRawState,command,aiOrder} from './repository';
import type {StudioCommand} from '@/lib/extensions';
import {workspacePolicy} from './workspace-policy';
import {memberDirectory,financialView,createShareSnapshot} from './team-finance';
import {businessShareCalculation} from './share-calculation';
import {requestAI} from '@/lib/ai-provider';
import {secureAIFetch} from './ai-connection';
import {privacyFilter} from './ai';
import type {AIConfig} from '@/lib/desktop';
interface Change {type:'policy'|'rule'|'calculate'|'business'|'weather';module:string;args:string[];script?:string;command?:StudioCommand}
interface Proposal {id:string;at:number;changes:Change[];revisions:Record<string,number>}
const owner=(p:Principal)=>{if(p.role!=='owner'||p.apiKeyId)fail('命令面板仅供超级管理员登录会话使用',403);};
function exact(args:string[],count:number){if(args.length!==count)fail('参数数量不符，请使用帮助查看固定语法');}
function integer(text:string,min:number,max:number){if(!/^\d+$/.test(text))fail('参数须为整数');const n=Number(text);if(n<min||n>max)fail(`参数须为${min}至${max}`);return n;}
function percent(text:string){if(!/^\d+(?:\.\d{1,2})?$/.test(text)||Number(text)>100)fail('百分比须为0至100，最多两位小数');return cents(text);}
const toggle=(v:string)=>{if(!['开','关'].includes(v))fail('开关参数只能是开或关');return v==='开';};
async function locate(sql:SQL,p:Principal,id:string){const state=await readRawState(sql,p),o=state.data.orders.find(o=>o.id===id||o.orderNo===id);if(!o)fail('订单不存在');return o!;}
async function applyChange(sql:SQL,p:Principal,c:Change,preview=false){
 if(c.type==='weather'){const state=await weatherProvider(sql,p),next:WeatherProvider={...state.data},[action,field,value]=c.args;
  if(action==='密钥')next.key=validateWeatherKey(field);
  else if(action==='地址')next[ENDPOINT_FIELDS[field as keyof typeof ENDPOINT_FIELDS]]=validateWeatherEndpoint(value);
  else if(action==='恢复默认'){delete next.key;delete next.forecast;delete next.air;delete next.geocoding;}
  if(!preview){state.data=next;state.revision++;await writeModule(sql,p,WEATHER_MODULE,state);await audit(sql,p,'weather.configure',action);}
  return weatherSummary(next);
 }
 if(c.type==='policy'){const state=await workspacePolicy(sql,p),[field,value]=c.args;switch(field){case '提权分钟':state.data.elevationMinutes=integer(value,1,120);break;case '延期审批提权':state.data.elevationScopes=toggle(value)?['retention:approve']:[];break;case '模式':if(!['个人','团队'].includes(value))fail('模式只能是个人或团队');state.data.mode=value==='个人'?'personal':'team';break;case '独立审片':state.data.independentReview=toggle(value);break;case '保留月数':state.data.retentionMonths=integer(value,1,120);break;case '清理宽限月数':state.data.graceMonths=integer(value,1,24);break;case '自动清理':state.data.autoDelete=toggle(value);break;case '起算':if(!['交付','拍摄','创建'].includes(value))fail('起算只能是交付、拍摄或创建');state.data.retentionStart=({交付:'delivery',拍摄:'shoot',创建:'created'} as const)[value as '交付'];break;default:fail('未知设置字段');}if(!preview){state.revision++;await writeModule(sql,p,'policy',state);}return state.data;}
 if(c.type==='rule'){const state=await readModule<FinanceState>(sql,p,'finance',EMPTY_FINANCE),order=await locate(sql,p,c.args[0]);if(state.data.snapshots.some(s=>s.orderId===order.id))fail('本单已有分成快照，历史规则不改写');const rule:ShareRule=structuredClone(state.data.rules[order.id]??{id:randomUUID(),version:0,reserveCents:0,reservePoints:0,members:[],normalize:false});const command=c.module;
  if(command==='预留'){rule.reserveCents=cents(c.args[1]);rule.reservePoints=percent(c.args[2]);}
  if(command==='成员'){const members=await memberDirectory(sql,p);if(!members.some(m=>m.id===c.args[1]&&!m.disabled))fail('账户编号不存在');const m={memberId:c.args[1],fixedCents:cents(c.args[2]),points:percent(c.args[3])};rule.members=rule.members.filter(r=>r.memberId!==m.memberId).concat(m);}
  if(command==='移除成员')rule.members=rule.members.filter(m=>m.memberId!==c.args[1]);
  if(command==='等比压缩')rule.normalize=toggle(c.args[1]);
  if(command==='导入规则'){const script=c.script??'';rule.script=script;try{businessShareCalculation(effectiveEntries(state.data.entries).filter(e=>e.orderId===order.id),rule);}catch(e){fail((e instanceof Error?e.message:'业务脚本无效').slice(0,300));}}
  rule.version++;validateShareRule(rule);if(!preview){state.data.rules[order.id]=rule;state.revision++;await writeModule(sql,p,'finance',state);}return rule;
 }
 if(c.type==='business'){const state=await readRawState(sql,p);const result=await command(p,c.command!,state.revision,sql);return c.command!.type==='orders.create'||c.command!.type==='orders.update'?aiOrder(result.result as Parameters<typeof aiOrder>[0]):result.result;}
 if(c.type==='calculate'){const order=await locate(sql,p,c.args[0]),state=await readModule<FinanceState>(sql,p,'finance',EMPTY_FINANCE),result=createShareSnapshot(state.data,order.id);if(!preview){state.revision++;await writeModule(sql,p,'finance',state);await audit(sql,p,'finance.calculate',order.id);}return result;}
}
export async function cliAPI(p:Principal,body:Record<string,unknown>){
 const language=body.language==='en'?'en':'zh';
 try {
  const result=await executeCLI(p,body);
  if('message' in result && typeof result.message==='string')result.message=cliMessage(result.message,language);
  if('messages' in result && Array.isArray(result.messages))result.messages=result.messages.map(m=>typeof m==='string'&&m!=='清屏'?cliMessage(m,language):m);
  return result;
 } catch(error) {
  if(error instanceof Error)error.message=cliMessage(error.message,language);
  throw error;
 }
}
async function executeCLI(p:Principal,body:Record<string,unknown>){owner(p);await rateLimit('cli:'+p.id,60,60);const action=String(body.action??'command'),requestedModule=cliModule(String(body.module??'通用')),language=body.language==='en'?'en':'zh',help=cliHelp(language);
 if(action==='catalog')return {modules:CLI_MODULES.map(m=>cliModuleLabel(m,language)),help:Object.fromEntries(Object.entries(help).map(([m,rows])=>[cliModuleLabel(m,language),rows]))};
 if(action==='ai'){if(typeof body.text!=='string'||body.text.length>4000)fail('AI需求最多4000字');const config=await readProvider(p,true) as AIConfig|null;if(!config)fail('请先配置软件内的模型');const source=await tx(sql=>readRawState(sql,p)),text=privacyFilter(body.text,[config.apiKey,config.searchApiKey??'',...source.data.orders.flatMap(o=>[o.note??''])]);const reply=await requestAI({...config,plugins:[],allowedCommands:[],knowledge:(language==='en'?'Draft only English fixed-syntax Studio CLI commands. Do not execute or create tool calls; no system shell. Return plain commands. ':'只起草观隅中文CLI固定命令，不执行、不创建工具调用，不使用系统shell。输出纯命令文本。')+'Command amounts use major currency units; percentages use 0..100. Script amounts use minor units and ratios use basis points. Writes require human confirmation Y. Catalog: '+JSON.stringify(help)+' Current module: '+cliModuleLabel(requestedModule,language)+' Business references (no contacts, private notes or demographics): '+JSON.stringify({orders:source.data.orders.filter(o=>!o.anonymizedAt).slice(-20).map(aiOrder),types:source.data.customerTypes,packages:source.data.packageTiers.map(t=>({id:t.id,name:t.name})),tasks:[...source.data.preOrders,...source.data.postOrders].slice(-40).map(t=>({id:t.id,orderId:t.orderId,status:t.status}))})},[{role:'user',content:text}],AbortSignal.timeout(180000),secureAIFetch);await tx(sql=>audit(sql,p,'cli.ai.draft'));return {draft:privacyFilter(reply.text,[config.apiKey,config.searchApiKey??'']),message:'草稿请核对后提交；所有写入仍需确认 Y'};}
 if(action==='cancel')return tx(async sql=>{const pending=await readModule<Proposal|null>(sql,p,'cli-pending:'+p.id,null);pending.data=null;pending.revision++;await writeModule(sql,p,'cli-pending:'+p.id,pending);return {message:'已取消'};});
 if(action==='confirm'){
  if(body.answer!=='Y')fail('执行确认须输入大写 Y');
  await tx(async sql=>{const pending=await readModule<Proposal|null>(sql,p,'cli-pending:'+p.id,null);if(!pending.data||pending.data.id!==body.id||Date.now()-pending.data.at>300000)fail('方案已过期，请重新提交',409);for(const [name,revision] of Object.entries(pending.data.revisions))if(name!=='business'&&((await readModule(sql,p,name,null)).revision!==revision))fail('业务规则已变化，请重新预览',409);if((await readRawState(sql,p)).revision!==pending.data.revisions.business)fail('业务记录已变化，请重新预览',409);const plan=pending.data;for(const change of plan.changes)await applyChange(sql,p,change);pending.data=null;pending.revision++;await writeModule(sql,p,'cli-pending:'+p.id,pending);await audit(sql,p,'cli.confirm',plan.id);return plan;});
  return {message:'操作已执行'};
 }
 const script=String(body.text??'');if(script.length>20000||!script.trim())fail('请输入命令');const lines=script.split(/\r?\n/).filter(line=>line.trim());if(lines.length>50)fail('一次最多50条命令');let current=requestedModule;const changes:Change[]=[],messages:unknown[]=[];
 for(const line of lines){if(/^ {4}/.test(line))fail('原生解释器只向已注册的软件维护插件开放，当前没有匹配处理器；不会转交系统终端');const [verb,...args]=cliCanonicalTokens(line,current);
  if(verb==='引入'){exact(args,1);if(!CLI_MODULES.includes(args[0] as typeof CLI_MODULES[number]))fail('模块不存在');current=args[0];messages.push('已引入 '+current);continue;}
  if(verb==='退出'){exact(args,0);current='通用';messages.push('已退出模块');continue;}
  if(verb==='帮助'){if(args.length>1)fail('帮助最多一个模块参数');messages.push(help[args[0]??current]??help['通用']);continue;}
  if(verb==='模块'){exact(args,0);messages.push(CLI_MODULES.map(m=>cliModuleLabel(m,language)));continue;}
  if(verb==='清屏'){exact(args,0);messages.push('清屏');continue;}
  if(current==='设置'&&verb==='设定'){exact(args,2);changes.push({type:'policy',module:current,args});continue;}
  if(current==='设置'&&verb==='查看'){exact(args,0);messages.push(await tx(async sql=>(await workspacePolicy(sql,p)).data));continue;}
  if(current==='分润'){
   if(verb==='查看'){exact(args,1);messages.push(await tx(async sql=>{const o=await locate(sql,p,args[0]),state=await readModule<FinanceState>(sql,p,'finance',EMPTY_FINANCE);const snapshot=state.data.snapshots.filter(s=>s.orderId===o.id);return language==='en'?{order:o.orderNo,rule:state.data.rules[o.id],snapshots:snapshot}:{订单:o.orderNo,规则:state.data.rules[o.id],快照:snapshot};}));continue;}
   const counts:Record<string,number>={预留:3,成员:4,移除成员:2,等比压缩:2,计算:1,导入规则:1};if(Object.hasOwn(counts,verb)){exact(args,counts[verb]);changes.push({type:verb==='计算'?'calculate':'rule',module:verb,args,script:verb==='导入规则'?String(body.rule??''):undefined});continue;}
  }
  if(current==='订单'&&verb==='查看'){if(args.length>1)fail('订单查询最多一个关键词');messages.push(await tx(async sql=>(await readRawState(sql,p)).data.orders.filter(o=>!args[0]||[o.orderNo,o.customerName].some(v=>v.includes(args[0]))).slice(0,50).map(o=>(language==='en'?{order:o.orderNo,customer:o.customerName,shootTime:o.shootTime,stage:o.flow??o.stage}:{编号:o.orderNo,客户:o.customerName,拍摄:o.shootTime,阶段:o.flow??o.stage}))));continue;}
  if(current==='订单'&&verb==='创建'){if(!args.length||args.length%2)fail('创建命令需要成对字段和值');const names:Record<string,string>={客户:'customerName',类型:'customerTypeId',拍摄:'shootTime',性别:'gender',成年:'adult',套餐:'packageTierId',地点:'location',摄影师:'photographer',署名:'signatureMemberId',渠道:'channel'},payload:Record<string,unknown>={};for(let i=0;i<args.length;i+=2){const field=names[args[i]];if(!field||Object.hasOwn(payload,field))fail('命令字段重复或不支持');const value=args[i+1];payload[field]=field==='gender'?({男:'male',女:'female',非二元:'nonbinary'} as Record<string,string>)[value]??value:field==='adult'?({成年:'adult',未成年:'minor'} as Record<string,string>)[value]??value:value;}changes.push({type:'business',module:current,args,command:{type:'orders.create',payload}});continue;}
  if(current==='订单'&&verb==='修改'){exact(args,3);const fields:Record<string,string>={拍摄:'shootTime',地点:'location',摄影师:'photographer',署名:'signatureMemberId',渠道:'channel'},field=fields[args[1]];if(!field)fail('订单修改字段无效');const order=await tx(sql=>locate(sql,p,args[0]));changes.push({type:'business',module:current,args,command:{type:'orders.update',payload:{id:order.id,[field]:args[2]}}});continue;}
  if(current==='订单'&&verb==='交付'){exact(args,1);const order=await tx(sql=>locate(sql,p,args[0]));changes.push({type:'business',module:current,args,command:{type:'orders.deliver',payload:{id:order.id}}});continue;}
  if(current==='工单'&&['查看','设定'].includes(verb)){if(!['前期','后期'].includes(args[0]))fail('工单类型无效');if(verb==='查看'){if(args.length<1||args.length>2)fail('参数数量不符，请使用帮助查看固定语法');messages.push(await tx(async sql=>{const state=await readRawState(sql,p),order=args[1]?await locate(sql,p,args[1]):null;return (args[0]==='前期'?state.data.preOrders:state.data.postOrders).filter(task=>!order||task.orderId===order.id).slice(0,100).map(task=>({id:task.id,orderId:task.orderId,customerName:task.customerName,shootTime:task.shootTime,status:task.status}));}));continue;}exact(args,3);const status=({待开始:'pending',进行中:'in_progress',已完成:'completed'} as Record<string,string>)[args[2]];if(!status)fail('工单状态无效');changes.push({type:'business',module:current,args,command:{type:args[0]==='前期'?'pre.status':'post.status',payload:{id:args[1],status}}});continue;}
  if(current==='目录'&&verb==='查看'){exact(args,1);const keys:Record<string,string>={客户类型:'customerTypes',套餐:'packageTiers',设备:'equipments',风格:'shootStyles',增项:'extraItems'};if(args[0]!=='全部'&&!keys[args[0]])fail('目录类型无效');messages.push(await tx(async sql=>{const state=await readRawState(sql,p),catalog={customerTypes:state.data.customerTypes,packageTiers:state.data.packageTiers,equipments:state.data.equipments,shootStyles:state.data.shootStyles,extraItems:state.data.extraItems??[]};return args[0]==='全部'?catalog:catalog[keys[args[0]] as keyof typeof catalog];}));continue;}
  if(current==='经营'&&['概览','流水','账户'].includes(verb)){if(verb==='流水'){if(args.length>1)fail('参数数量不符，请使用帮助查看固定语法');}else exact(args,0);messages.push(await tx(async sql=>{const view=await financialView(sql,p);if(!('accounts' in view))fail('命令面板仅供超级管理员登录会话使用',403);if(verb==='概览')return {...view.summary,currency:(await readRawState(sql,p)).data.settings?.currency??'CNY',unit:'minor currency unit',estimateOnly:true};if(verb==='账户')return view.accounts;const order=args[0]?await locate(sql,p,args[0]):null;return [...view.data.entries].filter(entry=>!order||entry.orderId===order.id).slice(-100);}));continue;}
  if(current==='天气'&&verb==='查看'){exact(args,0);messages.push(await tx(async sql=>weatherSummary((await weatherProvider(sql,p)).data)));continue;}
  if(current==='天气'&&verb==='密钥'){exact(args,1);validateWeatherKey(args[0]);changes.push({type:'weather',module:current,args:['密钥',args[0]]});continue;}
  if(current==='天气'&&verb==='地址'){exact(args,2);if(!Object.hasOwn(ENDPOINT_FIELDS,args[0]))fail('天气接口类型只能是预报、空气或城市');validateWeatherEndpoint(args[1]);changes.push({type:'weather',module:current,args:['地址',args[0],args[1]]});continue;}
  if(current==='天气'&&verb==='恢复默认'){exact(args,0);changes.push({type:'weather',module:current,args:['恢复默认']});continue;}
  if(current==='系统'&&verb==='账户'){exact(args,0);messages.push(await tx(sql=>memberDirectory(sql,p)));continue;}
  if(current==='系统'&&verb==='状态'){exact(args,0);messages.push(language==='en'?{service:'OK',account:p.username,workspace:p.workspaceId}:{服务:'正常',账户:p.username,工作室:p.workspaceId});continue;}
  fail('命令不属于当前模块或语法不符，请输入帮助');
 }
 if(!changes.length)return {module:current,messages};
 const proposal=await tx(async sql=>{const previews=[];await sql.run('SAVEPOINT cli_preview');try{for(const c of changes)previews.push(await applyChange(sql,p,c,c.type==='calculate'));}finally{await sql.run('ROLLBACK TO SAVEPOINT cli_preview');await sql.run('RELEASE SAVEPOINT cli_preview');}const revisions:Record<string,number>={};for(const name of ['policy','finance',WEATHER_MODULE])revisions[name]=(await readModule(sql,p,name,null)).revision;revisions.business=(await readRawState(sql,p)).revision;const plan:Proposal={id:randomUUID(),at:Date.now(),changes,revisions},pending=await readModule<Proposal|null>(sql,p,'cli-pending:'+p.id,null);pending.data=plan;pending.revision++;await writeModule(sql,p,'cli-pending:'+p.id,pending);await audit(sql,p,'cli.preview',plan.id);return {id:plan.id,previews};});return {module:current,messages,proposal};
}
