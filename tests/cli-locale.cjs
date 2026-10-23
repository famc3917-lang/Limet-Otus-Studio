// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {load,source}=require('./security.cjs'),cli=load(path.join(source,'lib/cli.ts'));
assert.deepEqual(cli.cliCanonicalTokens('Import Settings','通用'),['引入','设置']);
assert.deepEqual(cli.cliCanonicalTokens('Set Mode Team','Settings'),['设定','模式','团队']);
assert.deepEqual(cli.cliCanonicalTokens('Set StartAt Created','设置'),['设定','起算','创建']);
assert.deepEqual(cli.cliCanonicalTokens('Normalize "Team" Off','Shares'),['等比压缩','Team','关']);
assert.deepEqual(cli.cliCanonicalTokens('View "Settings"','Orders'),['查看','Settings']);
assert.deepEqual(cli.cliCanonicalTokens('View "C:\\Team photos\\On"','Orders'),['查看','C:\\Team photos\\On']);
assert.deepEqual(cli.cliCanonicalTokens('Member Team On 20 40','Shares'),['成员','Team','On','20','40']);
assert.deepEqual(cli.cliCanonicalTokens('查看 "Team"','订单'),['查看','Team']);
assert(cli.cliSuggestions('Imp','General','en').includes('Import Settings'));
assert.deepEqual(cli.cliCanonicalTokens('View constructor','Orders'),['查看','constructor']);
assert.deepEqual(cli.cliCanonicalTokens('toString Team','Orders'),['toString','Team']); // prototype keys stay literal
assert(!cli.cliSuggestions('    python','General','en').length);
assert.throws(()=>cli.cliCanonicalTokens('View "broken','Orders'),/引号未闭合/);
(async()=>{
 process.env.STUDIO_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'limet-cli-locale-'));
 process.env.STUDIO_MASTER_KEY=crypto.randomBytes(32).toString('base64');process.env.DATABASE_URL='';
 process.env.STUDIO_SETUP_TOKEN=crypto.randomBytes(32).toString('hex');process.env.STUDIO_ORIGINS='http://localhost:38332';
 const {handleAPI}=load(path.join(source,'server/http.ts')),{database}=load(path.join(source,'server/database.ts'));
 let session,checks=0;
 async function call(route,body,status=200,method='POST',auth=session){
  const response=await handleAPI(new Request('http://localhost:38332/api/v1/'+route,{method,headers:{Origin:'http://localhost:38332',...(body?{'Content-Type':'application/json'}:{}),...(auth?{Cookie:auth.cookie,'X-Studio-CSRF':auth.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})}));
  const text=await response.text();assert.equal(response.status,status,route+': '+text.slice(0,500));checks++;
  return {response,text,value:response.headers.get('content-type')?.includes('application/json')?JSON.parse(text):null};
 }
 try{
  await call('auth/bootstrap',{nickname:'Synthetic CLI owner',username:'cli-owner',passphrase:'春风又绿江南岸·测试',password:'Synthetic-CLI-only-2026!',setupToken:process.env.STUDIO_SETUP_TOKEN});
  const login=await call('auth/login',{username:'cli-owner',password:'Synthetic-CLI-only-2026!'});
  session={cookie:login.response.headers.get('set-cookie').split(';')[0],csrf:login.value.csrf};
  const catalog=(await call('cli',{action:'catalog',language:'en'})).value;
  assert.deepEqual(catalog.modules,['Settings','Shares','Orders','Workflow','Catalog','Operations','System','Weather']);for(const name of ['Workflow','Catalog','Operations'])assert(catalog.help[name]?.length,name+' help is listed');assert(catalog.help.Settings.includes('Set Mode Personal|Team'));
  // Weather provider: free by default; a key switches to commercial hosts and is never shown in full.
  let weather=(await call('cli',{module:'Weather',language:'en',text:'View'})).value.messages[0];
  assert.equal(weather.mode,'free');assert.equal(weather.key,null);assert.equal(weather.forecast,'https://api.open-meteo.com/v1/forecast');
  const keyed=(await call('cli',{module:'Weather',language:'en',text:'Key synthetic-weather-key-2026'})).value;
  assert(keyed.proposal.id);assert.equal((await call('cli',{module:'天气',text:'查看'})).value.messages[0].mode,'free','preview does not apply');
  await call('cli',{action:'confirm',id:keyed.proposal.id,answer:'Y'});
  weather=(await call('cli',{module:'Weather',language:'en',text:'View'})).value.messages[0];
  assert.equal(weather.mode,'commercial');assert.equal(weather.key,'synt…2026');assert.equal(weather.forecast,'https://customer-api.open-meteo.com/v1/forecast');
  assert(!JSON.stringify(weather).includes('synthetic-weather-key-2026'),'key is masked');
  await call('cli',{module:'Weather',language:'en',text:'Key has spaces'},400);
  await call('cli',{module:'Weather',language:'en',text:'Endpoint Forecast ftp://weather.example/v1'},400);
  await call('cli',{module:'Weather',language:'en',text:'Endpoint Radar https://weather.example/v1'},400);
  const custom=(await call('cli',{module:'Weather',language:'en',text:'Endpoint Forecast https://weather.example.com/v1/forecast'})).value;
  await call('cli',{action:'confirm',id:custom.proposal.id,answer:'Y'});
  weather=(await call('cli',{module:'天气',text:'查看'})).value.messages[0];assert.equal(weather.mode,'custom');assert.equal(weather.forecast,'https://weather.example.com/v1/forecast');
  // A configured endpoint on a private address is refused at request time unless the deployer allows the host.
  const internal=(await call('cli',{module:'Weather',language:'en',text:'Endpoint Forecast http://127.0.0.1:9/v1/forecast'})).value;
  await call('cli',{action:'confirm',id:internal.proposal.id,answer:'Y'});
  await call('weather?latitude=46.2&longitude=6.14',null,403,'GET');
  const reset=(await call('cli',{module:'Weather',language:'en',text:'Reset'})).value;
  await call('cli',{action:'confirm',id:reset.proposal.id,answer:'Y'});
  weather=(await call('cli',{module:'Weather',language:'en',text:'View'})).value.messages[0];assert.equal(weather.mode,'free');assert.equal(weather.key,null);
  const help=(await call('cli',{language:'en',text:'Import Settings\nHelp'})).value;
  assert.equal(help.module,'设置');assert.equal(help.messages[0],'Imported Settings.');assert(help.messages[1].includes('Set RetentionMonths 1..120'));
  const before=(await call('cli',{module:'Settings',language:'en',text:'View'})).value.messages[0];
  const proposed=(await call('cli',{module:'Settings',language:'en',text:'Set RetentionMonths 8'})).value;
  assert(proposed.proposal.id);assert.equal((await call('cli',{module:'设置',text:'查看'})).value.messages[0].retentionMonths,before.retentionMonths);
  const invalid=(await call('cli',{action:'confirm',language:'en',id:proposed.proposal.id,answer:'y'},400)).value;assert.match(invalid.error,/uppercase Y/);
  await call('cli',{action:'confirm',language:'en',id:proposed.proposal.id,answer:'Y'});
  assert.equal((await call('cli',{module:'Settings',text:'View'})).value.messages[0].retentionMonths,8);
  await call('cli',{action:'confirm',id:proposed.proposal.id,answer:'Y'},409);
  const cancel=(await call('cli',{module:'Settings',language:'en',text:'Set RetentionMonths 9'})).value;
  await call('cli',{action:'cancel',language:'en'});await call('cli',{action:'confirm',id:cancel.proposal.id,answer:'Y'},409);
  assert.equal((await call('cli',{module:'设置',text:'查看'})).value.messages[0].retentionMonths,8);
  const error=(await call('cli',{module:'Settings',language:'en',text:'Set Mode Broken'},400)).value;assert.match(error.error,/Personal or Team/);
  const status=(await call('cli',{language:'en',text:'Import System\nStatus'})).value;assert.equal(status.messages[1].service,'OK');
  await call('cli',{language:'en',text:'    python run.py'},400);
  const manual=await call('cli/manual?language=en',undefined,200,'GET');assert(manual.text.includes('<html lang="en">'));assert(manual.text.includes('Set Mode Team'));
  const download=await call('cli/manual?language=en&download=1',undefined,200,'GET');assert(download.response.headers.get('content-disposition').includes('-en.md'));assert(download.text.includes('# Limet Otus Studio'));
  const invitation=(await call('invitations',{role:'photographer'})).value.invitation;
  const member=await call('auth/register',{nickname:'Synthetic CLI member',username:'cli-member',passphrase:'春风又绿江南岸·测试',password:'Synthetic-CLI-only-2026!',invitation});
  const ordinary={cookie:member.response.headers.get('set-cookie').split(';')[0],csrf:member.value.csrf};
  await call('cli',{language:'en',text:'Help'},403,'POST',ordinary);
  await call('cli/manual?language=en',undefined,403,'GET',ordinary);
  console.log('PASS: CLI literal arguments, bilingual grammar/completion, '+checks+' real API responses, write previews, uppercase confirmation, cancellation, replay rejection, English manuals and role boundaries.');
 }finally{await database().then(db=>db.close());}
})().catch(e=>{console.error(e);process.exitCode=1;});
