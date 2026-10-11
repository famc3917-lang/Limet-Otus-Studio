// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import ts from 'typescript';
/** Parse and interpret a pure business expression. No eval, globals, I/O or host shell. */
export function evaluateBusinessRule(source:string,input:Record<string,number>):Record<string,number>{
 if(typeof source!=='string'||source.length>20000)throw Error('业务脚本最多20000字符');
 const file=ts.createSourceFile('business.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 if(file.statements.length!==1||!ts.isFunctionDeclaration(file.statements[0]))throw Error('脚本须为一个函数：function 规则(输入) { return {...}; }');
 const fn=file.statements[0];if(fn.asteriskToken||!fn.body||fn.parameters.length!==1||!ts.isIdentifier(fn.parameters[0].name)||fn.modifiers?.some(m=>m.kind!==ts.SyntaxKind.ExportKeyword))throw Error('只支持单参数同步业务函数');
 const env=new Map<string,unknown>([[fn.parameters[0].name.text,Object.freeze({...input})]]);let steps=0;
 const tick=()=>{if(++steps>3000)throw Error('业务脚本超过计算限制');};
 const number=(value:unknown)=>{if(typeof value!=='number'||!Number.isFinite(value))throw Error('计算须为有限数值');return value;};
 const evalNode=(node:ts.Expression):unknown=>{tick();
  if(ts.isNumericLiteral(node))return Number(node.text);
  if(node.kind===ts.SyntaxKind.TrueKeyword)return true;if(node.kind===ts.SyntaxKind.FalseKeyword)return false;
  if(ts.isParenthesizedExpression(node)||ts.isAsExpression(node))return evalNode(node.expression);
  if(ts.isIdentifier(node)){if(!env.has(node.text))throw Error('不支持的变量：'+node.text);return env.get(node.text);}
  if(ts.isPropertyAccessExpression(node)){if(!ts.isIdentifier(node.expression)||node.expression.text!==fn.parameters[0].name.getText(file)||!Object.hasOwn(input,node.name.text))throw Error('只能读取输入中列出的数值');return input[node.name.text];}
  if(ts.isPrefixUnaryExpression(node)){const raw=evalNode(node.operand);if(node.operator===ts.SyntaxKind.ExclamationToken)return !raw;const n=number(raw);if(node.operator===ts.SyntaxKind.MinusToken)return -n;if(node.operator===ts.SyntaxKind.PlusToken)return n;}
  if(ts.isConditionalExpression(node))return evalNode(evalNode(node.condition)?node.whenTrue:node.whenFalse);
  if(ts.isBinaryExpression(node)){const op=node.operatorToken.kind,a=evalNode(node.left);if(op===ts.SyntaxKind.AmpersandAmpersandToken)return a&&evalNode(node.right);if(op===ts.SyntaxKind.BarBarToken)return a||evalNode(node.right);const b=evalNode(node.right);if(op===ts.SyntaxKind.EqualsEqualsEqualsToken)return a===b;if(op===ts.SyntaxKind.ExclamationEqualsEqualsToken)return a!==b;const x=number(a),y=number(b);switch(op){case ts.SyntaxKind.PlusToken:return x+y;case ts.SyntaxKind.MinusToken:return x-y;case ts.SyntaxKind.AsteriskToken:return x*y;case ts.SyntaxKind.SlashToken:return x/y;case ts.SyntaxKind.PercentToken:return x%y;case ts.SyntaxKind.LessThanToken:return x<y;case ts.SyntaxKind.LessThanEqualsToken:return x<=y;case ts.SyntaxKind.GreaterThanToken:return x>y;case ts.SyntaxKind.GreaterThanEqualsToken:return x>=y;}}
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&ts.isIdentifier(node.expression.expression)&&node.expression.expression.text==='Math'){
   const functions:Record<string,(...args:number[])=>number>={min:Math.min,max:Math.max,round:Math.round,floor:Math.floor,ceil:Math.ceil,abs:Math.abs};const f=functions[node.expression.name.text];if(!f||node.arguments.length>20)throw Error('只支持 Math.min/max/round/floor/ceil/abs');return f(...node.arguments.map(arg=>number(evalNode(arg))));
  }
  if(ts.isObjectLiteralExpression(node)){const result:Record<string,number>=Object.create(null);for(const property of node.properties){if(!ts.isPropertyAssignment(property)||!ts.isIdentifier(property.name)||Object.hasOwn(result,property.name.text))throw Error('返回值须为不重复的数值字段');result[property.name.text]=number(evalNode(property.initializer));}return result;}
  throw Error('业务脚本不支持该语法：'+ts.SyntaxKind[node.kind]);
 };
 const returned=Symbol('return');
 const statement=(node:ts.Statement):{[returned]:unknown}|undefined=>{tick();
  if(ts.isBlock(node)){for(const line of node.statements){const r=statement(line);if(r)return r;}return;}
  if(ts.isReturnStatement(node)&&node.expression)return {[returned]:evalNode(node.expression)};
  if(ts.isVariableStatement(node)&&node.declarationList.flags&ts.NodeFlags.Const){for(const variable of node.declarationList.declarations){if(!ts.isIdentifier(variable.name)||!variable.initializer||env.has(variable.name.text))throw Error('仅支持唯一命名的常量');env.set(variable.name.text,evalNode(variable.initializer));}return;}
  if(ts.isIfStatement(node))return statement(evalNode(node.expression)?node.thenStatement:node.elseStatement??ts.factory.createBlock([]));
  throw Error('业务脚本仅支持常量、条件与返回值');
 };
 const output=statement(fn.body)?.[returned];if(!output||typeof output!=='object'||Array.isArray(output))throw Error('业务函数须返回数值对象');return output as Record<string,number>;
}
