// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import http from 'node:http';
import {once} from 'node:events';
import {Readable} from 'node:stream';
import {handleAPI} from './http';
import {APP_VERSION} from '@/lib/version';
import {database} from './database';
const host=process.env.STUDIO_API_HOST??'127.0.0.1',port=Number(process.env.STUDIO_API_PORT??38322);
const server=http.createServer(async(req,res)=>{try{const origin=process.env.STUDIO_API_ORIGIN??`http://${host}:${port}`;const controller=new AbortController();req.on('aborted',()=>controller.abort());res.on('close',()=>{if(!res.writableEnded)controller.abort();});const headers=new Headers();for(const [name,value] of Object.entries(req.headers))if(value)headers.set(name,Array.isArray(value)?value.join(','):value);const request=new Request(new URL(req.url??'/',origin),{method:req.method,headers,signal:controller.signal,...(!['GET','HEAD'].includes(req.method??'GET')?{body:Readable.toWeb(req),duplex:'half'}:{})} as RequestInit);const response=await handleAPI(request);res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body){const reader=response.body.getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;if(!res.write(Buffer.from(value)))await once(res,'drain');}}finally{reader.releaseLock();}}res.end();}catch{if(res.headersSent){res.destroy();return;}res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"服务暂不可用"}');}});
server.requestTimeout=70000;server.headersTimeout=15000;server.maxHeadersCount=64;server.listen(port,host,()=>console.log(`Studio API ${APP_VERSION} listening on ${host}:${port}`));
for(const event of ['SIGINT','SIGTERM'] as const)process.on(event,()=>server.close(()=>void database().then(db=>db.close()).finally(()=>process.exit(0))));
