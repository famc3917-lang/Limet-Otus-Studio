// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(process.argv[2]||process.cwd());
const problems=[];
const forbiddenPart=/^(?:\.git|node_modules|test-results|\.next(?:-.+)?|dist-api|release(?:-.+)?|photo-runtime|\.runtime|__pycache__|QA|data|user-data)$/i;
const forbiddenFile=/^(?!\.env\.example$)(?:\.env(?:\..+)?|.*\.(?:db|sqlite|sqlite3|pem|p12|pfx|key|log))$/i;
const scans=[
 ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['OpenAI-style key',/\bsk-[A-Za-z0-9_-]{20,}\b/],
 ['AWS access key',/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
 ['GitHub token',/\bgh[pousr]_[A-Za-z0-9_]{25,}\b/],
 ['Google API key',/\bAIza[0-9A-Za-z_-]{30,}\b/],
 ['live bearer token',/\bBearer [A-Za-z0-9._-]{30,}\b/],
 ['local profile path',/(?:[A-Z]:\\Users\\[^\\\s]+\\|\/Users\/[^\/\s]+\/)/i],
];
function inspect(directory,relative=''){
 for(const item of fs.readdirSync(directory,{withFileTypes:true})){
  const rel=path.join(relative,item.name),absolute=path.join(directory,item.name);
  const stat=fs.lstatSync(absolute);
  if(stat.isSymbolicLink()){problems.push(`${rel}: symbolic link`);continue;}
  if(stat.isDirectory()&&forbiddenPart.test(item.name)){problems.push(`${rel}: forbidden directory`);continue;}
  if(stat.isDirectory()){inspect(absolute,rel);continue;}
  if(forbiddenFile.test(item.name)){problems.push(`${rel}: forbidden private file`);continue;}
  if(!/\.(?:[cm]?[jt]sx?|json|md|txt|ya?ml|css|scss|html|ps1|py|xml|svg)$/.test(item.name)&&!['Dockerfile','LICENSE','.gitignore','.dockerignore'].includes(item.name))continue;
  const content=fs.readFileSync(absolute,'utf8');
  for(const [name,re] of scans){const match=re.exec(content);if(match){const line=content.slice(0,match.index).split('\n').length;problems.push(`${rel}:${line}: ${name}`);}}
 }
}
inspect(root);
if(problems.length){console.error(`Public source audit failed (${problems.length} findings):`);for(const problem of problems)console.error(problem);process.exitCode=1;}
else console.log('Public source audit passed: no forbidden private paths or high-confidence secret patterns.');
