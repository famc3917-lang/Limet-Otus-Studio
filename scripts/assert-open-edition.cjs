// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
const fs=require('node:fs'),path=require('node:path');
const ts=require('typescript');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
let edition;try{edition=JSON.parse(fs.readFileSync(path.join(root,'edition.json'),'utf8'));}catch{throw Error('edition.json is missing. Refusing to export this source tree.');}
if(edition.edition!=='open-source'||edition.version!=='3.0.0')throw Error('edition.json does not match this V3.0.0 source tree.');
const problems=[];
const forbidden=new Set(['phone','wechat','mobile','socialaccount','social_account']);
function name(node){if(!node)return '';if(ts.isIdentifier(node)||ts.isStringLiteralLike(node))return node.text.toLowerCase();if(ts.isComputedPropertyName(node))return name(node.expression);return '';}
function inspect(file){const text=fs.readFileSync(file,'utf8'),relative=path.relative(root,file);if(/\.(?:ts|tsx|js|jsx|cjs|mjs)$/.test(file)){
 const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 function visit(node){
  const named=ts.isPropertyAssignment(node)||ts.isPropertySignature(node)||ts.isPropertyDeclaration(node)||ts.isShorthandPropertyAssignment(node)||ts.isParameter(node)||ts.isVariableDeclaration(node)||ts.isBindingElement(node);
  const access=ts.isPropertyAccessExpression(node)?name(node.name):ts.isElementAccessExpression(node)?name(node.argumentExpression):'';
  if(named&&forbidden.has(name(node.name))||forbidden.has(access))problems.push(relative+':'+(source.getLineAndCharacterOfPosition(node.getStart(source)).line+1)+' contact field');
  if(ts.isStringLiteralLike(node)&&/^(?:CREATE\s+TABLE|INSERT\s+INTO|ALTER\s+TABLE|SELECT|UPDATE)\b/i.test(node.text.trim())&&/\b(?:phone|wechat|mobile|social_account)\b/i.test(node.text.replace(/'[^']*'/g,'')))problems.push(relative+' contact column');
  ts.forEachChild(node,visit);
 }
 visit(source);
 }else if(/\b(?:phone|wechat|mobile|social_account)\b|手机号|微信号|社交账号/i.test(text))problems.push(relative);
}
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.(?:ts|tsx|js|jsx|cjs|mjs|py|sql)$/.test(entry.name))inspect(p);}}
for(const dir of ['src','electron'])walk(path.join(root,dir));
if(problems.length){console.error('Data-minimisation check failed; client contact fields found in:');for(const p of problems)console.error(p);process.exitCode=1;}
else console.log('Data-minimisation check passed.');
