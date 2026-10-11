// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
// Collects licence and notice texts for every npm package shipped in the installer.
// Next's standalone trace drops LICENSE files, so texts come from the full node_modules trees.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const build=process.env.STUDIO_BUILD_DIR||'.next-package-3.0.0';
const shipped=[path.join(root,build,'standalone/node_modules'),path.join(root,'speech/node_modules')];
const sources=[path.join(root,'node_modules'),path.join(root,'speech/node_modules')];
const output=path.join(root,'third-party/notices/npm/THIRD-PARTY-NOTICES.txt');
const LICENCE_FILE=/^(licen[cs]e|copying|notice)(\.(md|txt))?$/i;

function packagesIn(dir,found=new Map()){
 if(!fs.existsSync(dir))return found;
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(!entry.isDirectory()||entry.name.startsWith('.'))continue;
  const dirs=entry.name.startsWith('@')?fs.readdirSync(path.join(dir,entry.name)).map(name=>path.join(dir,entry.name,name)):[path.join(dir,entry.name)];
  for(const pkg of dirs){
   const manifest=path.join(pkg,'package.json');
   if(fs.existsSync(manifest)){const m=JSON.parse(fs.readFileSync(manifest,'utf8'));if(m.name&&m.version)found.set(m.name+'@'+m.version,m);}
   packagesIn(path.join(pkg,'node_modules'),found);
  }
 }
 return found;
}
function locate(name,version){
 for(const base of sources){
  const stack=[path.join(base,name)];
  while(stack.length){const dir=stack.pop();const manifest=path.join(dir,'package.json');if(fs.existsSync(manifest)&&JSON.parse(fs.readFileSync(manifest,'utf8')).version===version)return dir;}
 }
 // Nested copies of a different version live under another package's node_modules.
 for(const base of sources)for(const m of findAll(base,name))if(JSON.parse(fs.readFileSync(path.join(m,'package.json'),'utf8')).version===version)return m;
 return null;
}
function findAll(dir,name,depth=0,out=[]){
 if(depth>6||!fs.existsSync(dir))return out;
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(!entry.isDirectory())continue;const p=path.join(dir,entry.name);
  if(p.endsWith(path.join('node_modules',...name.split('/')))&&fs.existsSync(path.join(p,'package.json')))out.push(p);
  if(entry.name==='node_modules'||depth<2||entry.name.startsWith('@'))findAll(p,name,depth+1,out);
 }
 return out;
}
const author=m=>typeof m.author==='string'?m.author:m.author?.name??'the package authors';
const mit=holder=>`MIT License\n\nCopyright (c) ${holder}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n`;
// Full Apache-2.0 text, taken from a shipped Apache package that includes it.
const apache=()=>{const dir=locate('typescript',JSON.parse(fs.readFileSync(path.join(root,'node_modules/typescript/package.json'),'utf8')).version);const file=dir&&fs.readdirSync(dir).find(f=>LICENCE_FILE.test(f));if(!file)throw Error('Apache-2.0 text not found');return fs.readFileSync(path.join(dir,file),'utf8');};

const packages=new Map();for(const dir of shipped)packagesIn(dir,packages);
if(!packages.size)throw Error('No shipped packages found; build the frontend first ('+build+')');
const sections=[],gaps=[];
for(const [key,m] of [...packages].sort(([a],[b])=>a.localeCompare(b))){
 if(m.name.startsWith('@limet/'))continue; // project package, covered by the project licence
 const licence=typeof m.license==='string'?m.license:m.license?.type??'UNKNOWN';
 const dir=locate(m.name,m.version),files=dir?fs.readdirSync(dir).filter(f=>LICENCE_FILE.test(f)):[];
 let text=files.map(f=>fs.readFileSync(path.join(dir,f),'utf8').trim()).join('\n\n');
 if(!text){
  if(licence==='MIT')text=mit(m.name.startsWith('@next/')?'Vercel, Inc.':author(m));
  else if(licence==='Apache-2.0')text=`Copyright ${author(m)}\n\n`+apache();
  else gaps.push(key+' ('+licence+')');
  text+=`\n\n[The published package contains no licence file; text reproduced from its declared licence "${licence}".]`;
 }
 sections.push(`==== ${key} · ${licence}\n${m.repository?.url??m.repository??m.homepage??''}\n\n${text.trim()}\n`);
}
// sherpa-onnx-win-x64 bundles ONNX Runtime DLLs.
if([...packages.keys()].some(k=>k.startsWith('sherpa-onnx-win-x64@')))sections.push(`==== onnxruntime (bundled in sherpa-onnx-win-x64) · MIT\nhttps://github.com/microsoft/onnxruntime\n\n${mit('Microsoft Corporation').trim()}\n`);
if(gaps.length)throw Error('Packages without a usable licence text: '+gaps.join(', '));
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,`Third-party notices for npm packages shipped with Limet Otus Studio\nGenerated from the installed packages by scripts/third-party-notices.cjs.\n\n`+sections.join('\n'));
console.log('Third-party notices written for '+sections.length+' components: '+path.relative(root,output));
