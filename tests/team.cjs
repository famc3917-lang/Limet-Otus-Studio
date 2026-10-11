// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'limet-otus-team-test-')),output=path.join(temp,'probe.cjs');
require('esbuild').buildSync({entryPoints:[path.join(__dirname,'team.ts')],outfile:output,bundle:true,platform:'node',format:'cjs',target:'node24',packages:'external',tsconfig:path.join(root,'tsconfig.json'),alias:{'@':path.join(root,'src')}});
const result=spawnSync(process.execPath,[output],{cwd:root,env:{...process.env,NODE_PATH:path.join(root,'node_modules'),STUDIO_DATA_DIR:temp,STUDIO_MASTER_KEY:crypto.randomBytes(32).toString('base64'),DATABASE_URL:'',STUDIO_SETUP_TOKEN:'synthetic-setup',STUDIO_DESKTOP:'0',STUDIO_ORIGINS:'http://localhost',NODE_ENV:'test'},stdio:'inherit',timeout:60000});
console.log('Synthetic team probe:',temp);if(result.error)console.error(result.error.message);process.exit(result.status??1);
