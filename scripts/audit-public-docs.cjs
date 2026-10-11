// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const files=[],problems=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(md|html|txt)$/i.test(e.name))files.push(p);}}
walk(path.join(root,'docs'));
for(const name of ['README.md','NOTICE-AS-IS.md','NOTICE-KEYS.md','ADDITIONAL_TERMS.md'])if(fs.existsSync(path.join(root,name)))files.push(path.join(root,name));
const legal=new Set(['NOTICE-AS-IS.md','NOTICE-KEYS.md','ADDITIONAL_TERMS.md']);
// Generated error references quote interface messages verbatim; they make no claims.
const quoted=new Set([path.join('docs','CN','错误与提示参考.md'),path.join('docs','English','Error-reference.md')]);
for(const file of files){const text=fs.readFileSync(file,'utf8'),relative=path.relative(root,file);for(const [i,raw] of text.split(/\r?\n/).entries()){const line=raw.replace(/`[^`]*`/g,''); // file names in code spans are not claims
 // Public documents make no certification or conformance claims.
 if(/\bcertif(?:ied|ication)\b|security\s+(?:level|standard)/i.test(line))problems.push(relative+':'+(i+1)+' contains a removed topic');
 else if(!legal.has(relative)&&!quoted.has(relative)&&/安全|\bsecurity\b/i.test(line)&&!/(?:不|不能|无法|不会).{0,12}保证|no (?:guarantee|warranty)|not (?:guarantee|warrant)/i.test(line))problems.push(relative+':'+(i+1)+' contains a removed topic');
 }
 if(file.endsWith('.md'))for(const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){const href=match[1].replace(/^<|>$/g,'').split('#')[0];if(!href||/^(?:https?:|mailto:|data:)/i.test(href))continue;const target=path.resolve(path.dirname(file),decodeURIComponent(href));if(target!==root&&!target.startsWith(root+path.sep))problems.push(relative+' has a link outside the distribution');else if(!fs.existsSync(target))problems.push(relative+' has a missing link: '+href);}
}
if(problems.length){console.error(problems.join('\n'));process.exitCode=1;}else console.log('Public documentation topics and relative links checked: '+files.length+' files.');
