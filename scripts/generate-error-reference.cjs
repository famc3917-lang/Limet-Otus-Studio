// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
// Builds docs/CN/错误与提示参考.md and docs/English/Error-reference.md from src/lib/error-catalog.ts.
// HTTP status codes are read from the fail(message, status) calls in the source, so the reference follows the code.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),CJK=/[㐀-鿿]/;
function load(file){const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports,require);return m.exports;}
const {ERROR_CATALOG,FIXES,HTTP_STATUSES}=load(path.join(root,'src/lib/error-catalog.ts'));
const shape=s=>s.replace(/\{[^}]*\}/g,'{}');

// Status codes per message shape.
const statuses=new Map();
function text(node){
 if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;
 if(ts.isTemplateExpression(node))return node.head.text+node.templateSpans.map(s=>'{}'+s.literal.text).join('');
 if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.PlusToken){const a=text(node.left),b=text(node.right);return (a??'{}')+(b??'{}');}
 return null;
}
function inspect(file){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const visit=node=>{
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='fail'&&node.arguments.length){
   const message=text(node.arguments[0]);
   if(message&&CJK.test(message)){const code=node.arguments[1]&&ts.isNumericLiteral(node.arguments[1])?Number(node.arguments[1].text):400;const key=shape(message);statuses.set(key,new Set([...(statuses.get(key)??[]),code]));}
  }
  ts.forEachChild(node,visit);
 };visit(source);
}
(function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(tsx?|cjs)$/.test(e.name))inspect(p);}})(path.join(root,'src'));

const AREAS=[
 ['account','账户与权限','Accounts and permissions'],
 ['business','订单与工单','Orders and tasks'],
 ['finance','收付款与分成','Payments and shares'],
 ['settings','设置与数据','Settings and data'],
 ['retention','资料留存','Retention'],
 ['ai','AI 助手','AI assistant'],
 ['voice','语音','Voice'],
 ['desktop','桌面端','Desktop app'],
 ['cli','命令面板','Command panel'],
 ['api','接口','API'],
 ['server','服务器与连接','Server and connection'],
];
const cell=s=>String(s).replace(/\\/g,'\\\\').replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
const code=s=>'`'+s.replace(/`/g,'\'')+'`';

function render(lang){
 const en=lang==='en',out=[];
 out.push(en?'# Limet Otus Studio · Error and message reference':'# 观隅鸮馆 · 错误与提示参考','');
 out.push(en?'This reference lists every error and refusal message the software can show, in the order of the areas below. Each entry gives the HTTP status code returned by the service (if any), what the message means and how to resolve it.':'本文列出软件可能显示的全部错误与拒绝提示，按下列领域分组。每条给出服务返回的 HTTP 状态码（如有）、提示的含义和解决办法。','');
 out.push(en?'How to use it:':'使用方法：','');
 out.push(en?'- Search this page for the words in the message you see. The interface shows the message in the language you selected; both languages list the same entries.':'- 在本页搜索你看到的提示文字。界面会按所选语言显示提示，中英文两份参考的条目完全对应。');
 out.push(en?'- `{1}` and `{2}` stand for values filled in at run time, such as a field name, a number or a permission.':'- `{1}`、`{2}` 表示运行时填入的内容，例如字段名、数字或权限名称。');
 out.push(en?'- A status code appears when the message comes from the service. Messages without one are raised in the app or the desktop client.':'- 带状态码的提示来自服务端；没有状态码的提示由软件界面或桌面端直接给出。');
 out.push(en?'- If a message is not listed or the resolution does not help, note the time, the steps taken and the exact message, and report it.':'- 如果提示不在本页，或按解决办法处理后仍然出现，请记下发生时间、操作步骤和完整提示后反馈。','');
 out.push(en?'## HTTP status codes':'## HTTP 状态码','');
 out.push(en?'| Code | Meaning and what to do |':'| 状态码 | 含义与处理 |','| --- | --- |');
 for(const [c,zh,e] of HTTP_STATUSES)out.push('| '+c+' | '+cell(en?e:zh)+' |');
 out.push('');
 let number=0;
 for(const [area,zh,e] of AREAS){
  const rows=ERROR_CATALOG.filter(r=>r[2]===area);if(!rows.length)continue;
  out.push('## '+(en?e:zh),'');
  out.push(en?'| No. | Message | Status | Meaning | Resolution |':'| 编号 | 提示 | 状态码 | 含义 | 解决办法 |','| --- | --- | --- | --- | --- |');
  for(const r of rows){
   number++;const id='E'+String(number).padStart(3,'0');
   const status=[...(statuses.get(shape(r[0]))??[])].sort().join(' / ')||'—';
   const fix=r[5].startsWith('@')?FIXES[r[5]][en?1:0]:(en?r[6]:r[5]);
   out.push('| '+id+' | '+cell(code(en?r[1]:r[0]))+' | '+status+' | '+cell(en?r[4]:r[3])+' | '+cell(fix)+' |');
  }
  out.push('');
 }
 out.push(en?'This page is generated from `src/lib/error-catalog.ts` by `node scripts/generate-error-reference.cjs`. Do not edit it by hand.':'本页由 `node scripts/generate-error-reference.cjs` 根据 `src/lib/error-catalog.ts` 生成，请勿手动修改。','');
 return out.join('\n');
}
const targets=[['zh','docs/CN/错误与提示参考.md'],['en','docs/English/Error-reference.md']];
const check=process.argv.includes('--check');let stale=false;
for(const [lang,file] of targets){
 const target=path.join(root,file),next=render(lang);
 if(check){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==next){console.error(file+' is out of date; run node scripts/generate-error-reference.cjs');stale=true;}}
 else fs.writeFileSync(target,next);
}
if(stale)process.exitCode=1;else console.log((check?'Error references up to date: ':'Generated error references: ')+ERROR_CATALOG.length+' messages.');
