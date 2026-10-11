// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const path=require('path');
require('esbuild').build({entryPoints:[path.join(__dirname,'../src/server/main.ts')],outfile:path.join(__dirname,'../dist-api/server.cjs'),bundle:true,platform:'node',format:'cjs',target:'node24',packages:'external',alias:{'@':path.join(__dirname,'../src')},sourcemap:true,metafile:true}).then(result=>{require('fs').writeFileSync(path.join(__dirname,'../dist-api/meta.json'),JSON.stringify(result.metafile,null,2));console.log('Built standalone Studio API');}).catch(()=>process.exit(1));
