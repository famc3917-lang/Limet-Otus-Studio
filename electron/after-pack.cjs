// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const fs = require('node:fs');
const path = require('node:path');

// electron-builder's default resource filters omit nested node_modules.
// Next's standalone server runs outside app.asar and needs its traced runtime here.
module.exports = async function afterPack(context) {
  const source = path.join(context.packager.projectDir, process.env.STUDIO_BUILD_DIR || '.next', 'standalone', 'node_modules');
  const destination = path.join(context.appOutDir, 'resources', 'server', 'node_modules');
  if (!fs.existsSync(path.join(source, 'next', 'package.json'))) throw new Error('Missing Next standalone runtime; run npm run build first.');
  fs.cpSync(source, destination, { recursive: true, dereference: true });
  if (!fs.existsSync(path.join(destination, 'next', 'dist', 'server', 'lib', 'start-server.js'))) throw new Error('Standalone runtime copy failed.');
  fs.cpSync(path.join(context.packager.projectDir,'speech','node_modules'),path.join(context.appOutDir,'resources','speech','node_modules'),{recursive:true,dereference:true});
  // Include the NSIS helper before hashing and before either archive is created.
  if(context.electronPlatformName==='win32'){const helper=await require('app-builder-lib/out/toolsets/windows').getNsisElevatePath(context.packager.config.toolsets?.nsis,context.packager.config.nsis?.customNsisBinary);fs.copyFileSync(helper,path.join(context.appOutDir,'resources','elevate.exe'));}
  require('../scripts/verify-package.cjs')(context.appOutDir);
};
