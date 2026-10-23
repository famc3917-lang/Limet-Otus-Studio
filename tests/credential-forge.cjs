// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/* Someone who can write the database file (and read vault.json) must not be able to turn an account into an owner. */
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),crypto=require('crypto');
const {load,source}=require('./security.cjs');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'guanyu-forge-'));Object.assign(process.env,{STUDIO_DATA_DIR:directory,STUDIO_MASTER_KEY:crypto.randomBytes(32).toString('base64'),STUDIO_ORIGINS:'http://localhost:38332',STUDIO_SETUP_TOKEN:crypto.randomBytes(32).toString('hex'),STUDIO_DESKTOP:'1',STUDIO_SESSION_TOKEN:'fixture-native-capability'});
 const {handleAPI}=load(path.join(source,'server/http.ts')),{database}=load(path.join(source,'server/database.ts')),{vaultWho}=load(path.join(source,'server/vault.ts'));
 async function request(route,method='GET',body,session,expected=200){const response=await handleAPI(new Request('http://localhost:38332/api/v1/'+route,{method,headers:{Origin:'http://localhost:38332',...(body?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session.cookie,'X-Studio-CSRF':session.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})}));const value=await response.json();assert.equal(response.status,expected,route+': '+JSON.stringify(value));return {value,response};}
 const session=r=>({cookie:r.response.headers.get('set-cookie').split(';')[0],csrf:r.value.csrf});
 const password='Test-only-password!2026',passphrase='春风又绿江南岸·测试';
 await request('auth/bootstrap','POST',{nickname:'qa-owner',username:'qa-owner',passphrase,password,setupToken:process.env.STUDIO_SETUP_TOKEN});
 const owner=session(await request('auth/login','POST',{nickname:'qa-owner',username:'qa-owner',password}));
 const invitation=(await request('invitations','POST',{role:'photographer'},owner)).value.invitation;
 await request('auth/register','POST',{nickname:'qa-member',username:'qa-member',passphrase,password,invitation});
 await request('auth/login','POST',{nickname:'qa-member',username:'qa-member',password});
 await request('auth/login','POST',{nickname:'qa-member',username:'qa-member',password:passphrase});
 /* a member's passwords never wrap the master key, so they cannot derive the key that signs account records */
 const slots=JSON.parse(fs.readFileSync(path.join(directory,'vault.json'),'utf8')).slots;
 assert(slots.some(s=>s.who===vaultWho('qa-owner')));assert(!slots.some(s=>s.who===vaultWho('qa-member')));
 /* direct database write: promote the member, clear its seal and drop the migration marker, then restart */
 const reopen=async(edit)=>{await (await database()).close();delete globalThis.studioDatabase;const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(path.join(directory,'studio-v2.sqlite'));edit(db);db.close();};
 await reopen(db=>{db.prepare("UPDATE users SET role='owner',credential_seal='' WHERE username='qa-member'").run();db.prepare('DELETE FROM schema_versions WHERE version=2').run();});
 await request('auth/login','POST',{nickname:'qa-member',username:'qa-member',password},undefined,403);
 /* the same with a forged password hash on the owner's row */
 await reopen(db=>{db.prepare("UPDATE users SET password_hash=(SELECT password_hash FROM users WHERE username='qa-member'),credential_seal='' WHERE username='qa-owner'").run();db.prepare('DELETE FROM schema_versions WHERE version=2').run();});
 await request('auth/login','POST',{nickname:'qa-owner',username:'qa-owner',password},undefined,403);
 await (await database()).close();fs.rmSync(directory,{recursive:true,force:true});
 console.log('PASS: members hold no master-key wraps; database edits with a cleared seal or migration marker cannot sign in.');
})().catch(e=>{console.error(e);process.exit(1);});
