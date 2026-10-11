// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
export async function eraseRetainedFile(job:Record<string,unknown>):Promise<{ok?:boolean;error?:string}>{
 try{
  const root=await fs.realpath(String(job.root??'')),input=path.resolve(String(job.input??''));
  const inside=(file:string)=>{const rel=path.relative(root,file);return !!rel&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
  if(!inside(input))throw Error('File is outside the retained storage root');
  const stat=await fs.lstat(input).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return undefined;throw e;});
  if(!stat)return {ok:true};
  if(!stat.isFile()||stat.isSymbolicLink())throw Error('Deletion requires a regular file');
  if(!inside(await fs.realpath(input)))throw Error('Resolved file is outside the storage root');
  if(job.expectedSha256){const hash=createHash('sha256');for await(const chunk of createReadStream(input))hash.update(chunk);if(hash.digest('hex')!==job.expectedSha256)throw Error('File contents changed after deletion was scheduled');}
  const latest=await fs.lstat(input);if(latest.dev!==stat.dev||latest.ino!==stat.ino||latest.size!==stat.size||latest.mtimeMs!==stat.mtimeMs||latest.isSymbolicLink())throw Error('File changed during verification');
  await fs.unlink(input);return {ok:true};
 }catch(e){return {error:(e as Error).message};}
}
