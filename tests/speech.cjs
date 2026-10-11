// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),assert=require('assert/strict');
const {load,source}=require('./security.cjs');
(async()=>{process.env.STUDIO_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'guanyu-speech-'));process.env.STUDIO_MASTER_KEY=crypto.randomBytes(32).toString('base64');process.env.STUDIO_SPEECH_RUNTIME=process.env.STUDIO_SPEECH_RUNTIME||path.resolve('speech');
 const {transcribe,speechStatus}=load(path.join(source,'server/speech.ts')),p={id:'speech-fixture',workspaceId:'synthetic',scopes:['ai:use']};
 const installed=fs.existsSync(path.join(process.env.STUDIO_SPEECH_RUNTIME,'models/model.int8.onnx'))&&fs.existsSync(path.join(process.env.STUDIO_SPEECH_RUNTIME,'node_modules/sherpa-onnx-node/package.json'));
 assert.throws(()=>speechStatus({...p,scopes:[]}),e=>e.status===403);assert.equal(speechStatus(p).available,installed);
 for(const body of [{pcm:'AAAA',sampleRate:8000},{pcm:'not-base64!',sampleRate:16000},{pcm:Buffer.alloc(960002).toString('base64'),sampleRate:16000},{pcm:Buffer.alloc(3198).toString('base64'),sampleRate:16000}])await assert.rejects(()=>transcribe(p,body),e=>e.status===400);
 if(!installed){await assert.rejects(()=>transcribe(p,{pcm:Buffer.alloc(32000).toString('base64'),sampleRate:16000}),e=>e.status===503);console.log('PASS permission and PCM bounds; SKIP neural inference: speech model not installed (install it from the app)');await (await load(path.join(source,'server/database.ts')).database()).close();return;}
 // Synthetic 6 s, 16 kHz PCM16 tone: exercises the real inference path without shipping a voice recording.
 const pcm=Buffer.alloc(16000*6*2);for(let i=0;i<16000*6;i++)pcm.writeInt16LE(Math.round(Math.sin(2*Math.PI*220*i/16000)*3000),i*2);
 const body={pcm:pcm.toString('base64'),sampleRate:16000},results=await Promise.allSettled([transcribe(p,body),transcribe(p,body)]),ok=results.find(r=>r.status==='fulfilled'),busy=results.find(r=>r.status==='rejected');assert(ok);assert.equal(typeof ok.value.text,'string');assert.ok(ok.value.duration>5);assert.equal(busy.reason.status,429);
 console.log('PASS neural INT8 recognition, permission, PCM bounds and concurrency limit:',JSON.stringify(ok.value));await (await load(path.join(source,'server/database.ts')).database()).close();
})().catch(e=>{console.error(e);process.exit(1);});
