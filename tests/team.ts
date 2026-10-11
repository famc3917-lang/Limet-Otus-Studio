// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {database,tx} from '../src/server/database';
import {bootstrap,authRegister,authenticate,type Principal} from '../src/server/security';
import {digest} from '../src/server/crypto';
import {teamProfile,memberDirectory} from '../src/server/member-profiles';
import {readRawState,getState,saveState,command} from '../src/server/repository';
import {financeAPI} from '../src/server/team-finance';
import {ROLE_SCOPES} from '../src/lib/permissions';
import {parseMemberProfile} from '../src/lib/member-profile';
import {buildSeedData} from '../src/lib/seed';
import {orderDraft} from '../src/lib/business';
import {validateData} from '../src/lib/data-integrity';
import type {FinanceState,ShareResult} from '../src/lib/team-finance';
const request=new Request('http://localhost/api/v1/auth/bootstrap',{method:'POST',headers:{Origin:'http://localhost'}});
async function failure(fn:()=>Promise<unknown>,status:number){await assert.rejects(fn,e=>(e as {status:number}).status===status);}
type FinanceView={revision:number;data:FinanceState;accounts:Array<{id:string;handledOrders:number}>;result?:ShareResult};
async function main(){
 assert.throws(()=>parseMemberProfile({nickname:''}));assert.throws(()=>parseMemberProfile({nickname:'测试',realName:[]}));
 await failure(()=>bootstrap(request,{username:'owner',password:'Synthetic-test-password',setupToken:'synthetic-setup'}),400);
 assert.equal(await tx(sql=>sql.one('SELECT id FROM workspaces LIMIT 1')),undefined);
 await bootstrap(request,{username:'owner',nickname:'负责人网名',realName:'可选真名',password:'Synthetic-test-password',setupToken:'synthetic-setup'});
 const workspace=(await tx(sql=>sql.one<{id:string}>('SELECT id FROM workspaces LIMIT 1')))!;
 const p:Principal={id:'0',workspaceId:workspace.id,username:'owner',role:'owner',scopes:ROLE_SCOPES.owner};
 const invite='synthetic-one-use-invitation';await tx(sql=>sql.run('INSERT INTO invitations(hash,workspace_id,role,expires_at) VALUES(?,?,?,?)',[digest(invite),p.workspaceId,'photographer','2099-01-01T00:00:00.000Z']));
 await failure(()=>authRegister(request,{username:'member',nickname:'',password:'Synthetic-member-password',invitation:invite}),400);
 const response=await authRegister(request,{username:'member',nickname:'摄影师网名',password:'Synthetic-member-password',invitation:invite}),registered=await response.json() as {user:Principal};
 assert.equal(registered.user.nickname,'摄影师网名');assert.equal((await teamProfile(registered.user)).profile.realName,'');
 const cookie=response.headers.get('set-cookie')!.split(';')[0],session=await authenticate(new Request('http://localhost/api/v1/auth/me',{headers:{Cookie:cookie}}));assert.equal(session.nickname,'摄影师网名');
 await failure(()=>authRegister(request,{username:'member2',nickname:'第二人',password:'Synthetic-member-password',invitation:invite}),403);
 const member=registered.user,alias=(await tx(sql=>memberDirectory(sql,p))).find(m=>m.id===member.id);assert.ok(alias);assert.ok(!('realName' in alias));assert.ok(!('phone' in alias));
 await failure(()=>teamProfile({...p,apiKeyId:'key'}),403);
 console.log('PASS required nickname, optional real name, transactional first-run, single-use invitations and session display');
 const seed=buildSeedData(),draft=orderDraft(seed,{customerName:'客户测试',customerTypeId:seed.customerTypes[0].id,shootTime:'2026-10-10T10:00',gender:'female',adult:'adult'});
 const order={...draft,id:'synthetic-order',signatureMemberId:member.id,channel:'小红书',customerTags:['Cos','夜景'],totalPrice:100,createdAt:new Date().toISOString(),seals:[]};seed.orders.push(order);await saveState(p,seed,0);
 let state=await tx(sql=>readRawState(sql,p));assert.equal(state.data.orders[0].signatureMemberName,'摄影师网名');
 await teamProfile(member,{nickname:'摄影师新网名'});state.data.orders[0].signatureMemberName='伪造署名';await saveState(p,state.data,state.revision);state=await tx(sql=>readRawState(sql,p));assert.equal(state.data.orders[0].signatureMemberName,'摄影师网名');
 assert.throws(()=>validateData({...state.data,orders:[{...state.data.orders[0],customerTags:['重复','重复']}]}));
 await tx(sql=>sql.run('UPDATE users SET disabled=1 WHERE id=?',[member.id]));state.data.orders[0].location='保持历史署名';await saveState(p,state.data,state.revision);
 state=await tx(sql=>readRawState(sql,p));const fresh={...state.data.orders[0],id:'second-order',orderNo:'second-order'};state.data.orders.push(fresh);await failure(()=>saveState(p,state.data,state.revision),400);await tx(sql=>sql.run('UPDATE users SET disabled=0 WHERE id=?',[member.id]));
 const created=await command(p,{type:'orders.create',payload:{customerName:'接口订单',customerTypeId:seed.customerTypes[0].id,shootTime:'2026-10-11 11:00:00',gender:'female',adult:'adult'}},state.revision);assert.equal((created.result as {signatureMemberId:string}).signatureMemberId,p.id);
 const updated=await command(p,{type:'orders.update',payload:{id:order.id,channel:'漫展',customerTags:['汉服','汉服','外景']}},created.revision);const updatedOrder=updated.result as {customerTags:string[];channel:string};assert.equal(updatedOrder.channel,'漫展');assert.deepEqual(updatedOrder.customerTags,['汉服','外景']);
 console.log('PASS stable account binding, historical nickname snapshot, active-member checks and business API attribution');
 let view=await financeAPI(p,'GET') as FinanceView;
 const rule={id:'draft',version:1,reserveCents:0,reservePoints:0,members:[{memberId:member.id,fixedCents:0,points:10000}],normalize:false};
 view=await financeAPI(p,'POST',{action:'configure',orderId:order.id,revision:view.revision,rule}) as FinanceView;
 state=await tx(sql=>readRawState(sql,p));state.data.orders[0].paymentStage=1;await saveState(p,state.data,state.revision);
 view=await financeAPI(p,'GET') as FinanceView;view=await financeAPI(p,'POST',{action:'calculate',orderId:order.id,revision:view.revision}) as FinanceView;assert.equal(view.data.snapshots.at(-1)!.result.members[0].cents,3500);
 state=await tx(sql=>readRawState(sql,p));state.data.orders[0].paymentStage=2;await saveState(p,state.data,state.revision);view=await financeAPI(p,'GET') as FinanceView;assert.equal(view.data.snapshots.at(-1)!.delta[0].cents,3000);
 state=await tx(sql=>readRawState(sql,p));state.data.orders[0].refund={amount:5,rate:1,paidAmount:65,days:30,ruleText:'测试退款',at:new Date().toISOString()};await saveState(p,state.data,state.revision);view=await financeAPI(p,'GET') as FinanceView;assert.equal(view.data.snapshots.at(-1)!.delta[0].cents,-500);
 state=await tx(sql=>readRawState(sql,p));state.data.orders[0].paymentStage=1;await saveState(p,state.data,state.revision);view=await financeAPI(p,'GET') as FinanceView;assert.equal(view.data.snapshots.at(-1)!.delta[0].cents,-3000);
 const count=view.data.snapshots.length;view=await financeAPI(p,'POST',{action:'calculate',orderId:order.id,revision:view.revision}) as FinanceView;assert.equal(view.data.snapshots.length,count);
 assert.ok(view.accounts.find(a=>a.id===member.id)!.handledOrders>=1);assert.equal(view.data.snapshots.at(-1)!.rule.members[0].points,10000);
 await failure(()=>financeAPI({...p,apiKeyId:'limited',scopes:['business:read']},'GET'),403);
 const privateView=await financeAPI(member,'GET');assert.ok(!('data' in privateView));
 console.log('PASS legacy receipts/refunds/reversals yield frozen-rule deltas, idempotent recalculation and per-member views');
 view=await financeAPI(p,'POST',{action:'expense',orderId:order.id,revision:view.revision,amount:'3',memberId:member.id,note:'垫付车费'}) as FinanceView;
 const expense=view.data.entries.at(-1)!;view=await financeAPI(p,'POST',{action:'expense',orderId:order.id,revision:view.revision,amount:'3',memberId:p.id,reimbursementOf:expense.id}) as FinanceView;
 assert.equal(view.data.entries.at(-1)!.cents,0);assert.equal(view.data.entries.at(-1)!.actualCents,300);assert.equal(view.data.snapshots.at(-1)!.result.expenses,300);
 await failure(()=>financeAPI(p,'POST',{action:'refund',orderId:order.id,revision:view.revision,amount:'3',reimbursementOf:expense.id}),400);
 console.log('PASS reimbursement preserves actual cash display without double-counting direct costs');
 // A fixed amount may become unaffordable after a refund; do not silently present it as current.
 state=await tx(sql=>readRawState(sql,p));const fixed={...state.data.orders[0],id:randomUUID(),orderNo:'fixed-order',paymentStage:0,refund:undefined};state.data.orders.push(fixed);await saveState(p,state.data,state.revision);
 view=await financeAPI(p,'POST',{action:'configure',orderId:fixed.id,revision:view.revision,rule:{...rule,members:[{memberId:member.id,fixedCents:1000,points:0}]}}) as FinanceView;
 view=await financeAPI(p,'POST',{action:'receipt',orderId:fixed.id,revision:view.revision,amount:'20',memberId:p.id}) as FinanceView;view=await financeAPI(p,'POST',{action:'calculate',orderId:fixed.id,revision:view.revision}) as FinanceView;
 view=await financeAPI(p,'POST',{action:'refund',orderId:fixed.id,revision:view.revision,amount:'15',memberId:p.id}) as FinanceView;assert.equal(view.data.pending![fixed.id].result.fixedShortfall,500);
 view=await financeAPI(p,'POST',{action:'receipt',orderId:fixed.id,revision:view.revision,amount:'5',memberId:p.id}) as FinanceView;assert.equal(view.data.pending![fixed.id],undefined);
 console.log('PASS explicit pending shortfall and automatic recovery after additional receipts');
 const projected=await getState({...p,scopes:['business:read','orders:write','workflow:write','finance:read']});assert.ok('data' in projected);
 await (await database()).close();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
