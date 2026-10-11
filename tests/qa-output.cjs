// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const fs=require('node:fs'),path=require('node:path'),version=require('../package.json').version;
module.exports=function saveQA(name,result){if(path.basename(name)!==name)throw Error('Invalid evidence name');const root=process.env.STUDIO_QA_OUTPUT||path.join(__dirname,'../test-results',version);fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,name),JSON.stringify({...result,version},null,2));};
