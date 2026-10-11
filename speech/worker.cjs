// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const path=require('node:path'),{parentPort,workerData}=require('node:worker_threads'),{OfflineRecognizer}=require('sherpa-onnx-node');
const models=workerData?.models||path.join(__dirname,'models');
const recognizer=new OfflineRecognizer({featConfig:{sampleRate:16000,featureDim:80},modelConfig:{senseVoice:{model:path.join(models,'model.int8.onnx'),useInverseTextNormalization:1},tokens:path.join(models,'tokens.txt'),numThreads:2,provider:'cpu',debug:0}});
parentPort.on('message',buffer=>{let stream;try{stream=recognizer.createStream();stream.acceptWaveform({sampleRate:16000,samples:new Float32Array(buffer)});recognizer.decode(stream);const result=recognizer.getResult(stream);parentPort.postMessage({text:String(result.text??'').replace(/<\|[^>]*\|>/g,'').trim()});}catch{parentPort.postMessage({error:'recognition failed'});}finally{stream?.free?.();}});
