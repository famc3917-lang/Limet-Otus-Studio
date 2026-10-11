// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
// Every Chinese message the code raises must have an entry, with English, cause and resolution, in src/lib/error-catalog.ts.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),CJK=/[㐀-鿿]/;
function load(file){const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports,require);return m.exports;}
const {ERROR_CATALOG,FIXES,HTTP_STATUSES}=load(path.join(root,'src/lib/error-catalog.ts'));
const shape=s=>s.replace(/\{[^}]*\}/g,'{}');
const known=new Set(ERROR_CATALOG.map(e=>shape(e[0])));
// Entries are complete and unique.
const seen=new Set();
for(const [zh,en,area,causeZh,causeEn,fixZh,fixEn] of ERROR_CATALOG){
 assert.ok(!seen.has(zh),'duplicate entry: '+zh);seen.add(zh);
 for(const [label,value] of [['English',en],['area',area],['cause',causeZh],['English cause',causeEn],['resolution',fixZh]])assert.ok(value&&String(value).trim(),label+' missing for '+zh);
 assert.ok(!CJK.test(en)&&!CJK.test(causeEn),'English text contains Chinese: '+zh);
 if(fixZh.startsWith('@'))assert.ok(FIXES[fixZh],'unknown resolution token '+fixZh);else assert.ok(fixEn&&!CJK.test(fixEn),'English resolution missing for '+zh);
 assert.equal((zh.match(/\{\d+\}/g)??[]).length,(en.match(/\{\d+\}/g)??[]).length,'placeholder count differs: '+zh);
}
assert.ok(HTTP_STATUSES.length>=10);
// Collect messages raised in code: fail(), Error(), new Error() and aiFailure() with a Chinese first argument.
function text(node){
 if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;
 if(ts.isTemplateExpression(node))return node.head.text+node.templateSpans.map(s=>'{}'+s.literal.text).join('');
 if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.PlusToken){const a=text(node.left),b=text(node.right);return (a??'{}')+(b??'{}');}
 return null;
}
const missing=[];
function inspect(file){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const visit=node=>{
  if((ts.isCallExpression(node)||ts.isNewExpression(node))&&node.arguments?.length){
   const name=ts.isIdentifier(node.expression)?node.expression.text:ts.isPropertyAccessExpression(node.expression)?node.expression.name.text:'';
   if(['fail','Error','aiFailure','showErrorBox','notifyUser','confirmAction'].includes(name)){
    const message=text(node.arguments[0]);
    if(message&&CJK.test(message)){const key=shape(message).replace(/\{\}$/,'').replace(/\{\}\{\}/g,'{}');if(!known.has(shape(message))&&!known.has(key))missing.push(path.relative(root,file)+':'+(source.getLineAndCharacterOfPosition(node.getStart()).line+1)+'  '+message);}
   }
  }
  ts.forEachChild(node,visit);
 };visit(source);
}
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(tsx?|cjs)$/.test(e.name))inspect(p);}}
for(const dir of ['src','electron'])walk(path.join(root,dir));
assert.deepEqual(missing,[],'Messages without an error-catalog entry:\n'+missing.join('\n'));
console.log('PASS: '+ERROR_CATALOG.length+' error messages catalogued with English, cause and resolution; no uncatalogued messages in code.');
