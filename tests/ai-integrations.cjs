// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),http=require('node:http'),assert=require('node:assert/strict');
const {load,source}=require('./security.cjs');
(async()=>{
 delete process.env.DATABASE_URL;
 process.env.STUDIO_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'guanyu-ai-integrations-'));
 process.env.STUDIO_MASTER_KEY=crypto.randomBytes(32).toString('base64');process.env.STUDIO_DESKTOP='1';process.env.STUDIO_SESSION_TOKEN='synthetic-native-bootstrap';
 const origin='http://localhost:38342';process.env.STUDIO_ORIGINS=origin;
 const {handleAPI}=load(path.join(source,'server/http.ts')),{tx,database}=load(path.join(source,'server/database.ts'));
 const {unseal}=load(path.join(source,'server/crypto.ts')),{pinnedLookup,secureAIFetch}=load(path.join(source,'server/ai-connection.ts'));
 const {normalizeAIConfig}=load(path.join(source,'lib/ai-provider.ts')),{AI_PRESETS}=load(path.join(source,'lib/ai-presets.ts'));
 let checks=[];const pass=name=>{checks.push(name);console.log('PASS '+name);};
 const pinned=pinnedLookup([{address:'127.0.0.1',family:4}]);pinned('fixture',{all:true},(e,addresses)=>{assert.ifError(e);assert(Array.isArray(addresses));assert.equal(addresses[0].family,4);});pinned('fixture',{all:false},(e,address,family)=>{assert.ifError(e);assert.equal(address,'127.0.0.1');assert.equal(family,4);});pass('DNS callback supports both Node lookup modes');
 let mode='ok',outbound=[],searches=[],chatCalls=0;
 const fake=http.createServer(async(req,res)=>{
  let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):{};
  if(req.url.endsWith('/models')){res.setHeader('Content-Type','application/json');if(mode==='unsupported'){res.writeHead(404);return res.end('{}');}if(/^error/.test(mode)){res.writeHead(Number(mode.slice(5)));return res.end(JSON.stringify({error:{message:'must-not-echo-fixture_main_key',code:mode==='error402'?'insufficient_balance':'invalid_request'}}));}return res.end(JSON.stringify({data:[{id:'fixture-model'},{id:'fixture-model'},{id:'other-model'},{id:'fixture_main_key'},{id:'bad\nmodel'}]}));}
  if(req.url.endsWith('/search')){searches.push(body);res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({results:[{title:'公开摄影资料',url:'https://example.org/photo',content:'公开资料摘要'},{title:'unsafe',url:'javascript:alert(1)',content:'ignore'}]}));}
  outbound.push(body);chatCalls++;res.setHeader('Content-Type','application/json');
  if(!body.tools)return res.end(JSON.stringify({choices:[{message:{content:'OK'}}]}));
  const follow=body.messages.some(m=>m.role==='tool');let message={content:'已完成查询。'};
  const call=(name,payload)=>({content:null,tool_calls:[{id:'call-'+chatCalls,type:'function',function:{name,arguments:JSON.stringify(payload)}}]});
  if(mode==='create'&&!follow)message=call('orders__create',{customerName:'合成客户',customerTypeId:'type-fixture',shootTime:'2026-10-08T10:00',location:'摄影棚'});
  if(mode==='web'&&!follow)message=call('web__search',{query:'户外摄影光线教程'});
  if(mode==='private-web'&&!follow)message=call('web__search',{query:'13998765432 private_wechat_canary'});
  if(mode==='forged')message=call('orders__update',{id:'never',location:'unauthorized'});
  res.end(JSON.stringify({choices:[{message}]}));
 });await new Promise(resolve=>fake.listen(0,'127.0.0.1',resolve));
 const base='http://localhost:'+fake.address().port+'/v1';process.env.STUDIO_SEARCH_URL=base+'/search';
 let owner;
 const request=async(route,method='GET',body,expected=200,principal=owner,extra={})=>{const response=await handleAPI(new Request(origin+'/api/v1/'+route,{method,headers:{Origin:origin,...(principal?{Cookie:principal.cookie,'X-Studio-CSRF':principal.csrf}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})}));const value=await response.json();assert.equal(response.status,expected,route+': '+JSON.stringify(value));return {value,response};};
 const key='fixture_main_key',searchKey='fixture_search_key';
 const config={protocol:'openai',baseUrl:base,model:'fixture-model',apiKey:key};
 const put=extra=>request('ai/provider','PUT',{...config,...extra});
 try{
  const reachable=await secureAIFetch(base+'/models',{signal:AbortSignal.timeout(5000)});assert.equal(reachable.status,200);pass('hostname HTTP request works through pinned DNS and family auto-selection');
  const normalized=normalizeAIConfig({protocol:'openai',baseUrl:' https://api.deepseek.com/chat/completions/ ',model:'DeepSeek V4 Flash',apiKey:' test-key '});assert.equal(normalized.baseUrl,'https://api.deepseek.com');assert.equal(normalized.model,'deepseek-flash');assert.equal(normalized.apiKey,'test-key');assert(AI_PRESETS.find(p=>p.name==='DeepSeek').models.includes('deepseek-v4-pro'));pass('preset IDs, display aliases, endpoint paths and key whitespace normalize');
  await request('auth/bootstrap','POST',{nickname:'AI接入测试',username:'SyntheticAIAdmin',passphrase:'春风又绿江南岸·测试',password:'Synthetic-AI-password-2026!'},200,null,{'X-Studio-Bootstrap':process.env.STUDIO_SESSION_TOKEN});
  const login=await request('auth/login','POST',{username:'SyntheticAIAdmin',password:'Synthetic-AI-password-2026!'},200,null);owner={cookie:login.response.headers.get('set-cookie').split(';')[0],csrf:login.value.csrf};
  await put({model:'',apiKey:' '+key+' '});const metadata=(await request('ai/provider')).value;assert.equal(metadata.model,'');assert.equal(metadata.configured,true);assert.equal(metadata.apiKey,'');pass('credentials save automatically before selecting a model, metadata never reveals key');
  const models=(await request('ai/models')).value;assert.deepEqual(models.models,['fixture-model','other-model']);pass('live model discovery deduplicates and rejects malformed or secret-bearing IDs');
  await put({searchApiKey:searchKey,plugins:['business-read','business-write','weather','system','web-search','studio-settings']});
  const stored=await tx(sql=>sql.one('SELECT workspace_id,body FROM providers'));assert(!stored.body.includes(key));const plain=unseal(stored.body,'provider:'+stored.workspace_id);assert.equal(plain.apiKey,key);assert.equal(plain.searchApiKey,searchKey);
  const publicConfig=JSON.stringify((await request('ai/provider')).value);assert(!publicConfig.includes(key)&&!publicConfig.includes(searchKey));pass('model and search credentials remain encrypted and masked');
  const changed=await put({baseUrl:base.replace('localhost','127.0.0.1'),apiKey:''});const row=await tx(sql=>sql.one('SELECT workspace_id,body FROM providers'));assert.equal(unseal(row.body,'provider:'+row.workspace_id).apiKey,'');assert.equal(changed.value.config.searchConfigured,true);pass('changing model provider never reuses its saved key for another authority');
  await put({plugins:['business-read','business-write','weather','system','web-search','studio-settings']});
  const before=await tx(sql=>sql.one('SELECT COUNT(*) AS n FROM conversations'));const tested=await request('ai/test','POST',{});assert(tested.value.message.includes('连接成功'));assert.equal(outbound.at(-1).messages.length,1);assert(!outbound.at(-1).tools);assert.equal((await tx(sql=>sql.one('SELECT COUNT(*) AS n FROM conversations'))).n,before.n);pass('connection test sends no business tools or customer data and creates no conversation');
  for(const status of [401,402,403,404,429,500]){mode='error'+status;await put({});if(status===404)continue;const result=await request('ai/models','GET',undefined,400);assert(result.value.error.includes('HTTP '+status));assert(!result.value.error.includes(key));}pass('upstream authentication, quota, permission, rate and service errors stay actionable without echoing secrets');
  await request('ai/models','GET',undefined,429);await tx(sql=>sql.run('DELETE FROM rate_limits'));pass('model discovery remains rate limited');
  mode='unsupported';await put({});assert.equal((await request('ai/models')).value.supported,false);assert.equal((await request('ai/status')).value.code,'models_unavailable');await request('ai/test','POST',{});assert.equal((await request('ai/status')).value.code,'ok');pass('unsupported model listing does not prevent a successful model connection test');
  mode='ok';const seed=load(path.join(source,'lib/seed.ts')).buildSeedData();seed.customerTypes[0].id='type-fixture';seed.orders=[];await request('state','PUT',{revision:0,data:seed});
  mode='forged';await put({plugins:['business-read']});await request('assistant','POST',{text:'查订单'},400);assert.equal((await request('commands','POST',{type:'orders.list',payload:{}})).value.result.length,0);pass('disabled business-write plugin rejects a forged model tool call');
  mode='create';await put({plugins:['business-read','business-write']});const proposed=(await request('assistant','POST',{text:'准备一个订单'})).value;assert.equal(proposed.pending.length,1);assert.equal((await request('commands','POST',{type:'orders.list',payload:{}})).value.result.length,0);
  const schema=outbound.at(-1).tools.find(t=>t.function.name==='orders__create').function.parameters;assert(!schema.properties.gender&&!schema.properties.adult&&!schema.properties.phone);assert(outbound.at(-1).messages[0].content.includes('Limet Otus Studio'));
  const approved=(await request('assistant','POST',{conversationId:proposed.conversationId,confirmation:{id:proposed.pending[0].id,approved:true,privateFields:{gender:'female',adult:'adult'}}})).value;assert(approved.activity.some(a=>a.state==='completed'));assert.equal((await request('commands','POST',{type:'orders.list',payload:{}})).value.result.length,1);assert(!JSON.stringify(outbound.at(-1)).includes('"female"'));pass('platform prefix, tool scoping, human write approval and private client fields work together');
  mode='create';const pending=(await request('assistant','POST',{text:'再准备一单'})).value;await put({plugins:['business-read']});await request('assistant','POST',{conversationId:pending.conversationId,confirmation:{id:pending.pending[0].id,approved:true,privateFields:{gender:'female',adult:'adult'}}},403);pass('turning off a plugin also revokes existing pending proposals');
  mode='web';await put({plugins:['web-search']});const web=(await request('assistant','POST',{text:'搜索公开教程'})).value;assert.equal(searches.length,1);assert(web.activity.some(item=>item.type==='web.search'&&item.state==='completed'));const lastTool=outbound.at(-1).messages.find(m=>m.role==='tool');const urls=[...lastTool.content.matchAll(/[a-z][a-z0-9+.-]*:[^\s"'<>]+/gi)].map(m=>{try{return new URL(m[0]);}catch{return null;}}).filter(Boolean);assert(urls.some(u=>u.protocol==='https:'&&u.hostname==='example.org'&&u.pathname==='/photo')&&!urls.some(u=>u.protocol==='javascript:'));pass('web search returns bounded public snippets with safe source URLs');
  const state=(await request('state')).value;state.data.orders[0].note='13998765432 private_wechat_canary';await request('state','PUT',{revision:state.revision,data:state.data});mode='private-web';await request('assistant','POST',{text:'查询公开资料'});assert.equal(searches.length,1);pass('customer privacy cannot leave through the web search plugin');
  mode='ok';await put({plugins:['system']});await request('assistant','POST',{text:'查询',plugins:['web-search']},403);pass('client plugin selection cannot escalate beyond workspace policy');
  const keyResult=(await request('keys','POST',{name:'synthetic-integration',scopes:['ai:use'],days:1})).value;await request('ai/models','GET',undefined,403,null,{Authorization:'Bearer '+keyResult.token});await request('ai/test','POST',{},403,null,{Authorization:'Bearer '+keyResult.token});pass('external integration keys cannot administer model connections');
  const result={version:'2.3.0',passed:true,syntheticAccountsOnly:true,checks,completedAt:new Date().toISOString()};require('./qa-output.cjs')('ai-integrations.json',result);
 }finally{await new Promise(resolve=>fake.close(resolve));await database().then(db=>db.close());}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
