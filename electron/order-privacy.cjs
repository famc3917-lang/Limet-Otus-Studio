// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
module.exports=async function assertLiveOrder(event,origin,orderId,fetcher=fetch){
 if(typeof orderId!=='string'||!orderId||orderId.length>200)throw Error('订单编号无效');
 const api=process.env.STUDIO_REMOTE_API_URL||origin,cookies=await event.sender.session.cookies.get({url:api});
 const response=await fetcher(api+'/api/v1/retention/order-access?orderId='+encodeURIComponent(orderId),{headers:{Origin:origin,Cookie:cookies.map(c=>c.name+'='+c.value).join('; ')},signal:AbortSignal.timeout(8000)});
 if(!response.ok||(await response.json()).available!==true)throw Error('订单不可用或资料已清理');
};
