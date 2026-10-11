// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
// Real rendered first-use QA, exclusively synthetic accounts and isolated data.
'use strict';
const {app,BrowserWindow,ipcMain}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const project=path.resolve(__dirname,'..'),origin='http://127.0.0.1:38336',out=path.join(project,'docs/qa');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'guanyu-first-use-ui-')));
delete process.env.STUDIO_REMOTE_API_URL;
let main,backend;const checks=[];const password='Synthetic-first-use-2026!';
const pass=name=>{checks.push(name);console.log('PASS '+name);};
app.whenReady().then(async()=>{try{
 const server=path.join(project,'.next-upgrade/standalone/server.js'),key=crypto.randomBytes(32).toString('base64'),token=crypto.randomBytes(32).toString('hex');
 fs.cpSync(path.join(project,'.next-upgrade/static'),path.join(path.dirname(server),'.next-upgrade/static'),{recursive:true});fs.cpSync(path.join(project,'public'),path.join(path.dirname(server),'public'),{recursive:true});backend=spawn(process.execPath,[server],{cwd:path.dirname(server),windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',DATABASE_URL:'',NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:'38336',STUDIO_DESKTOP:'1',STUDIO_DATA_DIR:path.join(app.getPath('userData'),'api'),STUDIO_MASTER_KEY:key,STUDIO_SESSION_TOKEN:token,STUDIO_ORIGINS:origin,STUDIO_SPEECH_RUNTIME:path.join(project,'speech')},stdio:'ignore'});
 backend.on('error',error=>console.error(error.message));
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/v1/health')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 const authorize=require(project+'/electron/security.cjs').authorizeFactory(origin);
 require(project+'/electron/drafts-host.cjs')({app,url:origin,key,authorize});
 const host=require(project+'/electron/assistant-host.cjs')({app,getMain:()=>main,url:origin,sessionToken:token,authorize,preload:project+'/electron/preload.cjs'});
 const chrome=require(project+'/electron/window-host.cjs')({ipcMain,getMain:()=>main,getOrigin:()=>origin});
 main=new BrowserWindow({width:1440,height:960,show:false,frame:false,webPreferences:{preload:project+'/electron/preload.cjs',contextIsolation:true,sandbox:true,nodeIntegration:false}});host.attachMain(main);chrome.attach(main);
 const run=body=>main.webContents.executeJavaScript(`(async()=>{const wait=async predicate=>{for(let i=0;i<150;i++){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('UI timeout '+location.pathname+' '+document.querySelector('h1')?.textContent+' '+document.body.innerText.slice(-500));};const button=text=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===text);const fill=(selector,text)=>{const input=document.querySelector(selector);if(!input)throw Error('Missing '+selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,text);input.dispatchEvent(new Event('input',{bubbles:true}));};${body}})()`);
 await main.loadURL(origin+'/login');
 await run("await wait(()=>document.querySelector('h1')?.textContent==='开始使用观隅');button('创建工作室').click();await wait(()=>location.pathname==='/register'&&document.querySelector('h1')?.textContent==='创建工作室');");pass('empty instance guides login to workspace creation');
 if(await run("return document.body.innerText.includes('邀请代码')||document.body.innerText.includes('首次开通授权');"))throw Error('Desktop first use unexpectedly asks for invitation/setup secret');
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'first-run-register.png'),(await main.webContents.capturePage()).toPNG());pass('desktop first account requires neither invitation nor setup input');
 await run("fill('[placeholder=\"例如：博成 / 前台小李\"]','SyntheticFirstOwner');fill('[autocomplete=\"new-password\"]','too-short');fill('[placeholder=\"再次输入密码\"]','too-short');await new Promise(r=>setTimeout(r,100));button('创建并进入').click();await wait(()=>document.querySelector('[role=alert]')?.textContent.includes('12')); ");
 if((await (await fetch(origin+'/api/v1/auth/status')).json()).initialized)throw Error('Invalid form created a workspace');pass('invalid password leaves the instance uninitialized');
 await run(`fill('[autocomplete="new-password"]',${JSON.stringify(password)});fill('[placeholder="再次输入密码"]',${JSON.stringify(password)});await new Promise(r=>setTimeout(r,100));button('创建并进入').click();await wait(()=>location.pathname==='/'&&document.querySelector('.assistant-launch'));`);
 let user=await run("return (await (await fetch('/api/v1/auth/me')).json()).user;");
 if(user.id!=='0'||user.role!=='owner'||!user.scopes.includes('members:manage'))throw Error('First account is not UID 0 owner');pass('rendered form creates UID 0 owner and enters the workspace');
 await main.loadURL(origin+'/settings');await run("await wait(()=>document.body.innerText.includes('UID 0'));");pass('account settings identify the first super administrator');
 const invitation=await run("const me=await (await fetch('/api/v1/auth/me')).json();return (await (await fetch('/api/v1/invitations',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-CSRF':me.csrf},body:JSON.stringify({role:'viewer'})})).json()).invitation;");
 await run("button('退出登录').click();await wait(()=>location.pathname==='/login'&&document.querySelector('[autocomplete=username]'));");pass('after setup the usual login form replaces first-use onboarding');
 await main.loadURL(origin+'/register');await run("await wait(()=>document.body.innerText.includes('邀请代码')&&document.querySelector('h1')?.textContent==='注册账户');");
 await run(`fill('[placeholder="例如：博成 / 前台小李"]','SyntheticInvitedMember');fill('[autocomplete="new-password"]',${JSON.stringify(password)});fill('[placeholder="再次输入密码"]',${JSON.stringify(password)});await new Promise(r=>setTimeout(r,100));button('注册并进入').click();await wait(()=>document.querySelector('[role=alert]')?.textContent.includes('邀请代码'));`);pass('subsequent accounts cannot register without an invitation');
 await run(`const invite=[...document.querySelectorAll('input')].find(input=>input.type==='text'&&!input.placeholder);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(invite,${JSON.stringify(invitation)});invite.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,100));button('注册并进入').click();await wait(()=>location.pathname==='/');`);
 user=await run("return (await (await fetch('/api/v1/auth/me')).json()).user;");if(user.id==='0'||user.role!=='viewer')throw Error('Invited member acquired first-owner privileges');pass('invitation grants only its assigned member role');
 await run("button('退出登录').click();await wait(()=>location.pathname==='/login'&&document.querySelector('[autocomplete=username]'));");
 await run(`fill('[autocomplete="username"]','SyntheticFirstOwner');fill('[autocomplete="current-password"]',${JSON.stringify(password)});await new Promise(r=>setTimeout(r,100));button('登录').click();await wait(()=>location.pathname==='/');`);
 user=await run("return (await (await fetch('/api/v1/auth/me')).json()).user;");if(user.id!=='0'||user.role!=='owner')throw Error('Owner cannot log back in');pass('first owner can log out and log back in');
 const result={version:'2.3.0',case:'Q006',passed:true,syntheticAccountsOnly:true,checks,completedAt:new Date().toISOString()};fs.writeFileSync(path.join(out,'first-run-ui.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(error){console.error(error.stack);if(main){console.error(await main.webContents.executeJavaScript('JSON.stringify({url:location.href,text:document.body.innerText.slice(-1200)})'));}process.exitCode=1;}finally{backend?.kill();app.exit(process.exitCode||0);}});
