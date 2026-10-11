// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
// Keep the separately shipped ASR engine out of Windows Next trace copies.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),name=process.env.STUDIO_BUILD_DIR||'.next';
if(!/^\.next(?:[-\w]*)(?:\.\d+)*$/.test(name))throw Error('Unsupported build directory for trace pruning');
const build=path.join(root,name),separate=['speech','tts'].map(folder=>path.join(root,folder)+path.sep);
function walk(directory){return fs.existsSync(directory)?fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):entry.name.endsWith('.nft.json')?[path.join(directory,entry.name)]:[]):[];}
let removed=0;
for(const file of walk(path.join(build,'server'))){const trace=JSON.parse(fs.readFileSync(file,'utf8')),before=trace.files.length;trace.files=trace.files.filter(value=>!separate.some(folder=>path.resolve(path.dirname(file),value).toLowerCase().startsWith(folder.toLowerCase())));removed+=before-trace.files.length;if(trace.files.length!==before)fs.writeFileSync(file,JSON.stringify(trace));}
const standalone=path.resolve(build,'standalone');
for(const folder of ['speech','tts']){const duplicate=path.resolve(standalone,folder);if(duplicate.startsWith(standalone+path.sep)&&fs.existsSync(duplicate))fs.rmSync(duplicate,{recursive:true,force:true});}
console.log('ASR trace entries removed: '+removed+'; independent speech resource retained.');
