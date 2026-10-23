// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
/* Key ring: the server's wraps open in the desktop unlock code, wrong secrets do not, and nothing opens without one. */
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),assert=require('assert/strict');
const {load,source}=require('./security.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'limet-vault-'));const master=crypto.randomBytes(32).toString('base64');
 Object.assign(process.env,{STUDIO_DESKTOP:'1',STUDIO_DATA_DIR:dir,STUDIO_MASTER_KEY:master});
 const server=load(path.join(source,'server/vault.ts')),desktop=require('../electron/vault.cjs');
 assert.equal(desktop.hasSlots(dir),false);
 await server.vaultSetSecret('FMLC','password','Synthetic-vault-2026');await server.vaultSetSecret('FMLC','passphrase','春风又绿江南岸');
 assert.equal(await desktop.unlockWithPassword(dir,'FMLC','Synthetic-vault-2026'),master);
 /* the text password matches after Unicode normalisation (composed and decomposed forms of the same text) */
 await server.vaultSetSecret('Zoë','passphrase','café au lait 雨');assert.equal(await desktop.unlockWithPassword(dir,'Zoë','café au lait 雨'),master);
 assert.equal(await desktop.unlockWithPassword(dir,'FMLC','春风又绿江南岸'),master);
 assert.equal(await desktop.unlockWithPassword(dir,'FMLC','wrong-password-2026'),null);
 assert.equal(await desktop.unlockWithPassword(dir,'someone-else','Synthetic-vault-2026'),null);
 /* the file alone holds no usable key */
 const raw=fs.readFileSync(path.join(dir,'vault.json'),'utf8');assert(!raw.includes(master));
 /* tampering with a wrap breaks only that wrap */
 const v=JSON.parse(raw);v.slots[0].key=Buffer.from(crypto.randomBytes(48)).toString('base64');fs.writeFileSync(path.join(dir,'vault.json'),JSON.stringify(v));
 assert.equal(await desktop.unlockWithPassword(dir,'FMLC','Synthetic-vault-2026'),null);assert.equal(await desktop.unlockWithPassword(dir,'FMLC','春风又绿江南岸'),master);
 /* disabled accounts lose their wraps; the legacy Windows-protected key is retired once the ring has wraps */
 server.vaultForget('FMLC');assert.equal(await desktop.unlockWithPassword(dir,'FMLC','春风又绿江南岸'),null);
 fs.writeFileSync(path.join(dir,'vault-key.dpapi'),'legacy');desktop.retireLegacyKey(dir);assert.equal(fs.existsSync(path.join(dir,'vault-key.dpapi')),false);
 console.log('PASS: key ring wraps open only with the right password, text password (NFC) tampered wraps, disabled accounts and the legacy key file are handled.');
})().catch(e=>{console.error(e);process.exitCode=1;});
