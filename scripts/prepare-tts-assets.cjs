// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),root=path.resolve(__dirname,'../tts');
function digest(file){const hash=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),block=Buffer.alloc(1024*1024);try{let n;while((n=fs.readSync(fd,block,0,block.length,null)))hash.update(block.subarray(0,n));}finally{fs.closeSync(fd);}return hash.digest('hex');}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'MODEL.json'),'utf8')),output=path.join(root,'model'),source=path.resolve(process.env.STUDIO_TTS_MODEL_SOURCE||path.join(root,'.runtime/model'));
const found=manifest.files.filter(item=>fs.existsSync(path.join(output,item.name))||fs.existsSync(path.join(source,item.name))).length;
if(!found){console.log('CosyVoice model not bundled; users install it from the app.');process.exit(0);}
fs.mkdirSync(output,{recursive:true});
for(const item of manifest.files){if(path.basename(item.name)!==item.name)throw Error('Unsafe model name');const target=path.join(output,item.name);if(fs.existsSync(target)&&digest(target)===item.sha256)continue;const input=path.join(source,item.name);if(!fs.existsSync(input)||digest(input)!==item.sha256)throw Error('Verified local voice model required: '+item.name);const temp=target+'.preparing-'+process.pid;try{try{fs.linkSync(input,temp);}catch{fs.copyFileSync(input,temp);}fs.renameSync(temp,target);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
console.log('Verified five local CosyVoice assets; ready for packaging.');
