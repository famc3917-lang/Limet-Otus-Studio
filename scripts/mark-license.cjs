// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const targets=['src','electron','scripts','tests'];
function visit(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,item.name);if(item.isDirectory()){visit(file);continue;}
 if(!/\.(?:ts|tsx|js|jsx|cjs|mjs|css)$/.test(item.name))continue;
 const source=fs.readFileSync(file,'utf8');if(source.includes('SPDX-License-Identifier:')){if(!source.includes('ADDITIONAL_TERMS.md'))fs.writeFileSync(file,source.replace('Copyright (C) 2026 博成 · FMLC','Copyright (C) 2026 博成 · FMLC\n// Additional terms: see ADDITIONAL_TERMS.md'));continue;}
 const header=item.name.endsWith('.css')?'/* SPDX-License-Identifier: GPL-3.0-only\n   Copyright (C) 2026 博成 · FMLC\n   Additional terms: see ADDITIONAL_TERMS.md */\n':'// SPDX-License-Identifier: GPL-3.0-only\n// Copyright (C) 2026 博成 · FMLC\n// Additional terms: see ADDITIONAL_TERMS.md\n';
 fs.writeFileSync(file,header+source);
}}
for(const dir of targets)visit(path.join(root,dir));
for(const relative of ['speech/worker.cjs','tts/worker.py','tts/download.py','next.config.ts','tailwind.config.js','postcss.config.mjs','eslint.config.mjs']){
 const file=path.join(root,relative);if(!fs.existsSync(file))continue;const source=fs.readFileSync(file,'utf8');if(source.includes('SPDX-License-Identifier:')){if(!source.includes('ADDITIONAL_TERMS.md'))fs.writeFileSync(file,source.replace('Copyright (C) 2026 博成 · FMLC',`Copyright (C) 2026 博成 · FMLC\n${relative.endsWith('.py')?'#':'//'} Additional terms: see ADDITIONAL_TERMS.md`));continue;}
 const header=relative.endsWith('.py')?'# SPDX-License-Identifier: GPL-3.0-only\n# Copyright (C) 2026 博成 · FMLC\n# Additional terms: see ADDITIONAL_TERMS.md\n':'// SPDX-License-Identifier: GPL-3.0-only\n// Copyright (C) 2026 博成 · FMLC\n// Additional terms: see ADDITIONAL_TERMS.md\n';fs.writeFileSync(file,header+source);
}
