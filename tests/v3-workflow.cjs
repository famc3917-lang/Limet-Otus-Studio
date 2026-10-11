// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {load,source}=require('./security.cjs');
const {buildSeedData}=load(path.join(source,'lib/seed.ts'));
const {executeBusiness}=load(path.join(source,'lib/business.ts'));
const {workOrderFlow}=load(path.join(source,'lib/data-integrity.ts'));
const data=buildSeedData();
const created=executeBusiness(data,{type:'orders.create',payload:{customerName:'合成客户',customerTypeId:data.customerTypes[0].id,shootTime:'2026-10-10T10:00',gender:'female',adult:'adult',location:'合成场地'}});
const order=created.result;
assert.throws(()=>executeBusiness(created.data,{type:'orders.deliver',payload:{id:order.id}}),/先完成后期工单/);
const post={id:'post-v3-fixture',orderId:order.id,postNo:'TEST-POST',customerName:'合成客户',status:'completed',seals:[],createdAt:'2026-10-10T00:00:00.000Z'};
created.data.postOrders.push(post);
assert.equal(workOrderFlow(undefined,post,order),'awaiting_delivery');
const delivered=executeBusiness(created.data,{type:'orders.deliver',payload:{id:order.id}},'2026-10-10T12:00:00.000Z');
const result=delivered.data.orders.find(v=>v.id===order.id);
assert.equal(result.flow,'delivered');assert.equal(result.stage,'done');assert.equal(result.deliveredAt,'2026-10-10T12:00:00.000Z');
assert.throws(()=>executeBusiness(delivered.data,{type:'orders.deliver',payload:{id:order.id}}),/已交付/);
console.log('PASS: V3 post-production delivery without photo workspace, with stable order data.');
