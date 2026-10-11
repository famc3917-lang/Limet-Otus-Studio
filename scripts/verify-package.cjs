// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function digest(file){const hash=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),block=Buffer.alloc(1024*1024);try{let n;while((n=fs.readSync(fd,block,0,block.length,null)))hash.update(block.subarray(0,n));}finally{fs.closeSync(fd);}return hash.digest('hex');}
function verifyPackage(directory){
const root=path.resolve(directory),resources=path.join(root,'resources');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const asar=require('@electron/asar');
const archive=path.join(resources,'app.asar');if(!fs.existsSync(archive))throw new Error('Missing app.asar');
const entries=asar.listPackage(archive);for(const e of entries)if(/(vault-key|\.env(?:\.|$)|api-config\.json|business-state\.json|studio-v2\.sqlite|ai-provider\.json)/i.test(e))throw new Error('Private runtime file included: '+e);
const packageJSON=JSON.parse(asar.extractFile(archive,'package.json'));if(packageJSON.version!=='3.0.0')throw new Error('Incorrect package version');
for(const name of ['server/server.js','server/node_modules/next/package.json'])if(!fs.existsSync(path.join(resources,name)))throw new Error('Missing server resource: '+name);
const speech=path.join(resources,'speech'),model=JSON.parse(fs.readFileSync(path.join(speech,'MODEL.json'),'utf8').replace(/^\uFEFF/,''));
const bundledSpeech=model.files.filter(file=>fs.existsSync(path.join(speech,'models',file.name))).length;if(bundledSpeech&&bundledSpeech!==model.files.length)throw new Error('Incomplete bundled speech model');
if(bundledSpeech)for(const file of model.files){const digest=crypto.createHash('sha256').update(fs.readFileSync(path.join(speech,'models',file.name))).digest('hex');if(digest.toUpperCase()!==file.Hash)throw new Error('Speech model integrity mismatch: '+file.name);}
for(const name of ['worker.cjs','node_modules/sherpa-onnx-node/package.json','node_modules/sherpa-onnx-win-x64/package.json'])if(!fs.existsSync(path.join(speech,name)))throw new Error('Missing speech runtime: '+name);
if(!fs.existsSync(path.join(resources,'third-party/notices/npm/THIRD-PARTY-NOTICES.txt')))throw Error('Missing npm third-party notices');
const tts=path.join(resources,'tts'),runtime=JSON.parse(fs.readFileSync(path.join(tts,'RUNTIME.json'),'utf8'));
for(const name of ['worker.py','download.py','requirements.txt','MODEL.json','RESOURCE-POLICY.json','vendor/CosyVoice/LICENSE','vendor/CosyVoice/cosyvoice/cli/model.py','vendor/CosyVoice/third_party/Matcha-TTS/matcha/models/components/flow_matching.py'])if(!fs.existsSync(path.join(tts,name)))throw Error('Missing TTS resource: '+name);
if(crypto.createHash('sha256').update(fs.readFileSync(path.join(tts,'bin/uv.exe'))).digest('hex')!==runtime.uvSha256)throw Error('TTS runtime bootstrap integrity mismatch');
if(fs.existsSync(path.join(tts,'.runtime')))throw Error('Development TTS environment included in installer');
const ttsModel=JSON.parse(fs.readFileSync(path.join(tts,'MODEL.json'),'utf8')),bundledVoice=ttsModel.files.filter(asset=>fs.existsSync(path.join(tts,'model',asset.name))).length;if(bundledVoice&&bundledVoice!==ttsModel.files.length)throw Error('Incomplete bundled voice model');
if(bundledVoice)for(const asset of ttsModel.files){if(digest(path.join(tts,'model',asset.name))!==asset.sha256)throw Error('Bundled voice model integrity mismatch: '+asset.name);}
const manifest=files(resources).filter(p=>!p.endsWith('integrity-manifest.json')).map(p=>({path:path.relative(resources,p).replaceAll('\\','/'),bytes:fs.statSync(p).size,sha256:digest(p)}));
fs.writeFileSync(path.join(resources,'integrity-manifest.json'),JSON.stringify({product:'Limet Otus Studio',version:'3.0.0',algorithm:'SHA-256',files:manifest},null,2));
console.log(`Verified ASAR + ${manifest.length} resource files; SHA-256 manifest written.`);

}
module.exports=verifyPackage;
if(require.main===module)verifyPackage(process.argv[2]||'release-v2.4/win-unpacked');
