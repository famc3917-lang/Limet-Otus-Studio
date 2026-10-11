// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
// Writes SHA-256 checksums for the release artifacts: checksums.json and SHA256SUMS.txt (the sha256sum format).
// Only file names are recorded, never the build machine's folders.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),root=path.resolve(process.argv[2]);
const output=fs.readdirSync(root).filter(n=>/\.(exe|zip)$/.test(n)).sort().map(n=>{const file=path.join(root,n),hash=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),buf=Buffer.alloc(1024*1024);try{let size;while((size=fs.readSync(fd,buf,0,buf.length,null)))hash.update(buf.subarray(0,size));}finally{fs.closeSync(fd);}return {File:n,SHA256:hash.digest('hex'),Bytes:fs.statSync(file).size};});
fs.writeFileSync(path.join(root,'checksums.json'),JSON.stringify(output,null,2)+'\n');
fs.writeFileSync(path.join(root,'SHA256SUMS.txt'),output.map(o=>o.SHA256+'  '+o.File).join('\n')+'\n');
console.log('SHA-256 checksums: '+output.length+' artifacts');
