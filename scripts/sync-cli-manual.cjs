// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
for(const [doc,output,symbol] of [['docs/CN/CLI语法手册.md','src/lib/cli-manual.ts','CLI_MANUAL'],['docs/English/CLI-syntax-manual.md','src/lib/cli-manual-en.ts','CLI_MANUAL_EN']]){
 const text=fs.readFileSync(path.join(root,doc),'utf8');
 fs.writeFileSync(path.join(root,output),"// SPDX-License-Identifier: GPL-3.0-only\n// Copyright (C) 2026 博成 · FMLC\n// Additional terms: see ADDITIONAL_TERMS.md\n"+'// Generated from '+doc+'\nexport const '+symbol+'='+JSON.stringify(text)+';\n');
}
console.log('Chinese and English CLI manuals synchronized.');
