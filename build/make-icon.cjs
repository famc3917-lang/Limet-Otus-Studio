// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
const fs = require('node:fs/promises');
const sharp = require('sharp');

async function main() {
  const png = await sharp('build/icon.svg').resize(256, 256).png().toBuffer();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(0, 6); // 0 means 256 pixels in the ICO directory.
  header.writeUInt8(0, 7);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(header.length, 18);
  await fs.writeFile(process.argv[2] || 'build/icon.ico', Buffer.concat([header, png]));
  if (!process.argv[2]) await sharp('build/icon.svg').resize(512, 512).png().toFile('build/icon.png');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
