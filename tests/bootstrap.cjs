// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {load,source}=require('./security.cjs');
process.env.STUDIO_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'guanyu-first-run-'));
process.env.STUDIO_MASTER_KEY=crypto.randomBytes(32).toString('base64');
process.env.STUDIO_ORIGINS='http://localhost:38336';
delete process.env.DATABASE_URL;process.env.STUDIO_DESKTOP='0';delete process.env.STUDIO_SETUP_TOKEN;
process.env.STUDIO_SESSION_TOKEN='synthetic-first-run-capability';
const {handleAPI}=load(path.join(source,'server/http.ts')),{tx,database}=load(path.join(source,'server/database.ts'));
let checks=0;const password='Synthetic-first-run-2026!';
async function request(route,method='GET',body,session,expected=200,extra={}){
 const response=await handleAPI(new Request('http://localhost:38336/api/v1/'+route,{method,headers:{Origin:'http://localhost:38336',...(body?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session.cookie,'X-Studio-CSRF':session.csrf}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})}));
 const value=await response.json();if(expected!==null)assert.equal(response.status,expected,route+': '+JSON.stringify(value));checks++;return {response,value};
}
(async()=>{try{
 let status=(await request('auth/status')).value;assert.equal(status.initialized,false);assert.equal(status.setupMode,'unavailable');
 await request('auth/bootstrap','POST',{nickname:'owner',username:'owner',password},undefined,403);
 await request('auth/register','POST',{nickname:'owner',username:'owner',password},undefined,403);
 process.env.STUDIO_SETUP_TOKEN='synthetic-cloud-setup-secret';
 assert.equal((await request('auth/status')).value.setupMode,'setup-token');
 await request('auth/bootstrap','POST',{nickname:'owner',username:'owner',password,setupToken:'incorrect'},undefined,403);
 await request('auth/bootstrap','POST',{username:'',password,setupToken:process.env.STUDIO_SETUP_TOKEN},undefined,400);
 assert.equal((await request('auth/status')).value.initialized,false,'invalid setup must roll back the workspace');
 process.env.STUDIO_DESKTOP='1';assert.equal((await request('auth/status')).value.setupMode,'desktop');
 const headers={'X-Studio-Bootstrap':process.env.STUDIO_SESSION_TOKEN};
 const attempts=await Promise.all(['first-A','first-B'].map(username=>request('auth/bootstrap','POST',{nickname:username,username,password},undefined,null,headers)));
 assert.deepEqual(attempts.map(r=>r.response.status).sort(),[200,409],'only one first owner may win');
 const users=await tx(sql=>sql.all('SELECT id,username,role FROM users'));assert.equal(users.length,1);assert.equal(users[0].id,'0');assert.equal(users[0].role,'owner');
 const login=await request('auth/login','POST',{username:users[0].username,password});const owner={cookie:login.response.headers.get('set-cookie').split(';')[0],csrf:login.value.csrf};
 assert.equal(login.value.user.id,'0');assert(login.value.user.scopes.includes('members:manage'));
 await request('auth/bootstrap','POST',{nickname:'replacement',username:'replacement',password},undefined,409,headers);
 await request('auth/register','POST',{nickname:'uninvited',username:'uninvited',password,role:'owner',id:'0'},undefined,403);
 const invitation=(await request('invitations','POST',{role:'viewer'},owner)).value.invitation;
 const member=await request('auth/register','POST',{nickname:'invited-member',username:'invited-member',password,invitation,role:'owner',id:'0'});
 assert.notEqual(member.value.user.id,'0');assert.equal(member.value.user.role,'viewer');
 await request('auth/register','POST',{nickname:'replay',username:'replay',password,invitation},undefined,403);
 const unchanged=await tx(sql=>sql.all('SELECT id,username,role FROM users'));assert.equal(unchanged.find(u=>u.id==='0').username,users[0].username);assert.equal(unchanged.length,2);
 await request('auth/logout','POST',{},owner);await request('auth/me','GET',undefined,owner,401);
 await request('auth/login','POST',{username:users[0].username,password});
 console.log(JSON.stringify({passed:true,checks,firstUID:'0',concurrentOwnerCreation:'one winner',cloudSetupProtection:true,invitationRequiredAfterSetup:true,logoutRevocation:true}));
 }finally{await (await database()).close();}})().catch(error=>{console.error(error);process.exitCode=1;});
