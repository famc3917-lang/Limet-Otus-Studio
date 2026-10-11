// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),Module=require('module'),assert=require('assert/strict'),crypto=require('crypto'),http=require('http');
const ts=require('typescript'),source=path.resolve(__dirname,'../src'),cache=new Map();
function load(file){file=path.resolve(file);if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));if(cache.has(file))return cache.get(file).exports;const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const m=new Module(file,module);cache.set(file,m);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m.require=name=>{if(name.startsWith('.')||name.startsWith('@/')){let target=name.startsWith('@/')?path.join(source,name.slice(2)):path.resolve(path.dirname(file),name);if(!path.extname(target))target+='.ts';return load(target);}return Module.prototype.require.call(m,name);};m._compile(code,file);return m.exports;}
module.exports={load,source};
if(require.main===module)(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'guanyu-security-'));process.env.STUDIO_DATA_DIR=directory;process.env.STUDIO_MASTER_KEY=crypto.randomBytes(32).toString('base64');process.env.STUDIO_ORIGINS='http://localhost:38332';process.env.STUDIO_SETUP_TOKEN=crypto.randomBytes(32).toString('hex');process.env.STUDIO_DESKTOP='1';process.env.STUDIO_SESSION_TOKEN='fixture-native-capability';
 const {handleAPI}=load(path.join(source,'server/http.ts')),{tx,database}=load(path.join(source,'server/database.ts')),secure=load(path.join(source,'server/crypto.ts')),{buildSeedData}=load(path.join(source,'lib/seed.ts'));
 let assertions=0;
 async function request(route,method='GET',body,session,expected=200,extra={}){const response=await handleAPI(new Request('http://localhost:38332/api/v1/'+route,{method,headers:{Origin:'http://localhost:38332',...(body?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session.cookie,'X-Studio-CSRF':session.csrf}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})}));const value=await response.json();assert.equal(response.status,expected,route+': '+JSON.stringify(value));assertions++;return {value,response};}
 const ownerPassword='Test-only-password!2026';
 await request('auth/bootstrap','POST',{nickname:'qa-owner',username:'qa-owner',password:ownerPassword},undefined,403);
 await request('auth/bootstrap','POST',{nickname:'qa-owner',username:'qa-owner',password:ownerPassword,setupToken:process.env.STUDIO_SETUP_TOKEN});
 const login=await request('auth/login','POST',{nickname:'qa-owner',username:'qa-owner',password:ownerPassword});const owner={cookie:login.response.headers.get('set-cookie').split(';')[0],csrf:login.value.csrf};assert(login.response.headers.get('set-cookie').includes('HttpOnly'));
 const me=await request('auth/me','GET',undefined,owner);assert.equal(me.value.csrf,owner.csrf);assert(!JSON.stringify(me.value).includes('password'));
 await request('state','GET',undefined,undefined,401,{Authorization:'Bearer fixture-native-capability'});
 await request('keys','POST',{name:'bad',scopes:['business:read']},{...owner,csrf:'invalid'},403);
 await request('state','GET',undefined,owner,403,{Origin:'https://attacker.invalid'});
 const seed=buildSeedData();seed.settings={...load(path.join(source,'lib/settings.ts')).DEFAULT_SETTINGS};await request('state','PUT',{revision:0,data:seed},owner);
 const command={type:'orders.create',payload:{customerName:'测试客户',customerTypeId:seed.customerTypes[0].id,shootTime:'2026-10-09T10:00',gender:'female',adult:'adult',location:'青竹摄影棚',photographer:'测试摄影师',note:'13998765432 private_wechat_canary 不得发给 AI 的客户私人备注'}};
 await request('commands','POST',{...command,payload:{...command.payload,phone:'13998765432'},revision:1},owner,400);
 const created=await request('commands','POST',{...command,revision:1},owner,200,{'Idempotency-Key':'create_qa_order_0001'});const orderId=created.value.result.id;
 const family=(await request('family/capabilities','GET',undefined,owner)).value;assert.equal(family.protocol,1);assert.deepEqual(family.capabilities,['order.reference.read']);
 const reference=(await request('family/orders/'+orderId,'GET',undefined,owner)).value.reference;assert.equal(reference.orderId,orderId);assert.equal(reference.customerName,'测试客户');assert(!JSON.stringify(reference).includes('13998765432'));assert(!JSON.stringify(reference).includes('private_wechat_canary'));
 await request('family/orders/'+orderId,'GET',undefined,owner,426,{'X-Limet-Family-Protocol':'2'});
 const repeated=await request('commands','POST',{...command,revision:1},owner,200,{'Idempotency-Key':'create_qa_order_0001'});assert.equal(repeated.value.result.id,orderId);
 await request('commands','POST',{...command,revision:2},owner,409,{'Idempotency-Key':'create_qa_order_0001'});
 const invitation=(await request('invitations','POST',{role:'photographer'},owner)).value.invitation;
 const registered=await request('auth/register','POST',{nickname:'qa-photographer',username:'qa-photographer',password:ownerPassword,invitation});const member={cookie:registered.response.headers.get('set-cookie').split(';')[0],csrf:registered.value.csrf};
 await request('auth/register','POST',{nickname:'qa-replay',username:'qa-replay',password:ownerPassword,invitation},undefined,403);
 await request('keys','POST',{name:'denied',scopes:['business:read']},member,403);
 const snap=(await request('state','GET',undefined,member)).value;const changed=structuredClone(snap.data);changed.orders[0].paymentStage=1;await request('state','PUT',{revision:snap.revision,data:changed},member,403);
 const edited=await request('commands','POST',{type:'orders.update',payload:{id:orderId,location:'新摄影棚'},revision:2},member);assert.equal(edited.value.revision,3);
 const key=(await request('keys','POST',{name:'read-only',scopes:['business:read'],days:1},owner)).value;
 const external=await request('commands','POST',{type:'orders.list',payload:{}},undefined,200,{Authorization:'Bearer '+key.token});assert.equal(external.value.result.length,1);assert(!JSON.stringify(external.value).includes('13998765432'));
 await request('state','GET',undefined,undefined,403,{Authorization:'Bearer '+key.token});
 await request('commands','POST',{...command,revision:3},undefined,403,{Authorization:'Bearer '+key.token});
 const keyList=(await request('keys','GET',undefined,owner)).value;assert(!JSON.stringify(keyList).includes(key.token));assert.equal(keyList.keys[0].stored,1);await request('keys','PATCH',{id:key.id,password:'wrong'},owner,403);await request('keys','PATCH',{id:key.id,password:ownerPassword},member,403);const exported=(await request('keys','PATCH',{id:key.id,password:ownerPassword},owner)).value;assert.equal(exported.token,key.token);const vault=await tx(sql=>sql.one('SELECT secret FROM api_keys WHERE id=?',[key.id]));assert(vault.secret.startsWith('gcm1.')&&!vault.secret.includes(key.token));
 await request('keys','DELETE',{id:key.id},owner);await request('keys','PATCH',{id:key.id,password:ownerPassword},owner,404);assert.equal((await tx(sql=>sql.one('SELECT secret FROM api_keys WHERE id=?',[key.id]))).secret,'');await request('commands','GET',undefined,undefined,401,{Authorization:'Bearer '+key.token});
 const cached=(await request('state?revision=3','GET',undefined,owner)).value;assert.equal(cached.unchanged,true);assert(!('data' in cached));
 // Disjoint edits merge; overlapping edits conflict.
 const initial=(await request('state','GET',undefined,owner)).value,a=structuredClone(initial.data),b=structuredClone(initial.data);a.orders[0].location='并发地点';b.orders[0].photographer='并发摄影师';
 await request('state','PUT',{revision:initial.revision,data:a},owner);const merged=(await request('state','PUT',{revision:initial.revision,data:b},owner)).value;assert.equal(merged.data.orders[0].location,'并发地点');assert.equal(merged.data.orders[0].photographer,'并发摄影师');
 const overlap=structuredClone(initial.data);overlap.orders[0].location='冲突地点';await request('state','PUT',{revision:initial.revision,data:overlap},owner,409);
 // Another workspace sees only its own data, even with a known order ID.
 const otherId=crypto.randomUUID(),otherUserId=crypto.randomUUID();await tx(async sql=>{await sql.run('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)',[otherId,'fixture-B',new Date().toISOString()]);await sql.run('INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',[otherUserId,otherId,'qa-other',await secure.passwordHash(ownerPassword),'owner',new Date().toISOString()]);});
 const otherLogin=await request('auth/login','POST',{nickname:'qa-other',username:'qa-other',password:ownerPassword}),other={cookie:otherLogin.response.headers.get('set-cookie').split(';')[0],csrf:otherLogin.value.csrf};const otherOrders=await request('commands','POST',{type:'orders.list',payload:{query:orderId}},other);assert.equal(otherOrders.value.result.length,0);
 await request('family/orders/'+orderId,'GET',undefined,other,404);
 const privateText='13998765432 private_wechat_canary 不得发给 AI 的客户私人备注';let outbound=[];
 const mock=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw);outbound.push(body);let result;if(outbound.length===1)result={content:null,tool_calls:[{id:'read1',type:'function',function:{name:'orders__list',arguments:'{}'}}]};else if(outbound.length===2)result={content:'已查到订单。',tool_calls:[{id:'write1',type:'function',function:{name:'orders__update',arguments:JSON.stringify({id:orderId,location:'AI 修改摄影棚'})}}]};else result={content:'已完成。'};res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:result}]}));});await new Promise(resolve=>mock.listen(38333,'127.0.0.1',resolve));
 try{await request('ai/provider','PUT',{protocol:'openai',baseUrl:'http://127.0.0.1:38333/v1',model:'fixture',apiKey:'private_provider_key'},owner);const metadata=await request('ai/provider','GET',undefined,owner);assert(!JSON.stringify(metadata.value).includes('private_provider_key'));
 await request('assistant','POST',{config:{},messages:[]},owner,403);
 const ai=(await request('assistant','POST',{text:'查询订单 '+privateText},owner)).value;assert.equal(ai.pending.length,1);assert(!JSON.stringify(outbound).includes('13998765432'));assert(!JSON.stringify(outbound).includes('private_wechat_canary'));assert(!JSON.stringify(outbound).includes('不得发给 AI 的客户私人备注'));assert(JSON.stringify(outbound).includes('测试客户'));
 await request('assistant','POST',{conversationId:ai.conversationId,confirmation:{id:'write1',approved:true}},owner);const last=JSON.stringify(outbound.at(-1));assert(!last.includes('13998765432')&&!last.includes('private_wechat_canary')&&!last.includes('不得发给 AI 的客户私人备注'));
 await request('assistant','POST',{conversationId:ai.conversationId,confirmation:{id:'write1',approved:true}},owner,409);
 }finally{await new Promise(resolve=>mock.close(resolve));}
 // Ed25519 card challenge: valid signature, replay denial, action-bound one-use ticket.
 const pair=crypto.generateKeyPairSync('ed25519');const card=(await request('hardware/cards','POST',{userId:registered.value.user.id,name:'fixture card',publicKey:pair.publicKey.export({type:'spki',format:'pem'}),password:ownerPassword,scopes:['settings:write']},owner)).value;
 const challenge=(await request('hardware/challenge','POST',{cardId:card.id,action:'state'},member)).value;const signature=crypto.sign(null,Buffer.from(challenge.message),pair.privateKey).toString('base64');const proof={challengeId:challenge.challengeId,signature};const elevation=(await request('hardware/verify','POST',proof,member)).value;await request('hardware/verify','POST',proof,member,403);
 const ms=(await request('state','GET',undefined,member)).value;ms.data.settings.name='NFC 授权修改';await request('state','PUT',{revision:ms.revision,data:ms.data},member,200,{'X-Studio-Elevation':elevation.token});await request('state','PUT',{revision:ms.revision+1,data:ms.data},member,403,{'X-Studio-Elevation':elevation.token});
 // Imported legacy hash upgrades at the first successful login.
 const legacyId=crypto.randomUUID();await tx(async sql=>{await sql.run('INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',[legacyId,login.value.user.workspaceId,'qa-legacy',await new Promise(resolve=>crypto.pbkdf2('old-pass',Buffer.alloc(16,7),210000,32,'sha256',(_,key)=>resolve('pbkdf2$210000$'+Buffer.alloc(16,7).toString('hex')+'$'+key.toString('hex')))),'viewer',new Date().toISOString()]);});await request('auth/login','POST',{nickname:'qa-legacy',username:'qa-legacy',password:'old-pass'});const migrated=await tx(sql=>sql.one('SELECT password_hash FROM users WHERE id=?',[legacyId]));assert(migrated.password_hash.startsWith('scrypt$'));
 const ciphertext=secure.seal({secret:'fixture'},'tenant-A');assert.throws(()=>secure.unseal(ciphertext,'tenant-B'));const pieces=ciphertext.split('.');pieces[3]='A'+pieces[3].slice(1);assert.throws(()=>secure.unseal(pieces.join('.'),'tenant-A'));
 const rows=await tx(sql=>sql.all('SELECT body FROM business_state'));assert(!JSON.stringify(rows).includes('13998765432'));assert(!JSON.stringify(rows).includes('private_wechat_canary'));
 await request('auth/logout','POST',{},owner);await request('state','GET',undefined,owner,401);
 await database().then(db=>db.close());cache.clear();
 console.log(`PASS: ${assertions} API responses + encrypted storage, legacy migration, sessions/CSRF/origin, roles, API revocation/idempotency, tenant isolation, conflict merging, AI privacy/read/write canaries, Ed25519 NFC anti-replay and one-use elevation.`);
 // Test directory is unique and contains fictional data only.
})().catch(e=>{console.error(e);process.exitCode=1;});
