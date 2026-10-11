// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {tx,type SQL} from './database';
import {seal,unseal,digest} from './crypto';
/** A queued deletion. Cache jobs record the file's identity at queue time so a replaced file is never erased. */
interface FileJob {base:string;relative:string;mtime?:number;mtimeNs?:string;bytes?:number;sha256?:string;ino?:string;dev?:string;external?:boolean;cache?:boolean}
interface FileIdentity {regular:boolean;bytes:number;mtimeNs:string;ino:string;dev:string}
async function identity(file:string):Promise<FileIdentity>{
 const stat=await fs.lstat(file,{bigint:true});
 return {regular:stat.isFile()&&!stat.isSymbolicLink(),bytes:Number(stat.size),mtimeNs:String(stat.mtimeNs),ino:String(stat.ino),dev:String(stat.dev)};
}
async function sha256(file:string){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
/** Throws unless the file still matches what was recorded when the job was queued. */
function assertSame(job:FileJob,now:FileIdentity){
 if(!now.regular)throw Error('Cleanup target is not a regular file');
 if(job.bytes!==undefined&&now.bytes!==job.bytes)throw Error('File size changed');
 if(job.mtimeNs!==undefined&&now.mtimeNs!==job.mtimeNs)throw Error('File modification time changed');
 if(job.mtimeNs===undefined&&job.mtime!==undefined&&Math.abs(Number(BigInt(now.mtimeNs)/BigInt(1000000))-job.mtime)>2000)throw Error('File modification time changed');
 if(job.ino!==undefined&&(now.ino!==job.ino||now.dev!==job.dev))throw Error('File was replaced');
}
function within(root:string,file:string){
 const relative=path.relative(path.resolve(root),path.resolve(file));
 return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));
}
const context=(id:string)=>'privacy-file:'+id;
const exists=(file:string)=>fs.lstat(file).then(()=>true,(error:NodeJS.ErrnoException)=>{if(error.code==='ENOENT')return false;throw error;});
/** Checks a moved-aside file against the queued identity and erases it; anything else is left for manual review. */
async function eraseHeld(job:FileJob,holding:string){
 const moved=await identity(holding);assertSame(job,moved);
 if(job.sha256&&await sha256(holding)!==job.sha256)throw Error('File content changed');
 await fs.unlink(holding);
}
/**
 * The file is moved to a holding name derived from the job ID before it is erased, so an interrupted run can be
 * resumed: a held file left behind is verified and erased, and the job only completes when neither path remains.
 */
async function eraseVerified(job:FileJob,jobId:string){
 const base=await fs.realpath(job.base),target=path.resolve(job.base,job.relative);
 if(!within(base,target)||target===base)throw Error('Unsafe cleanup path');
 if(job.cache&&(job.bytes===undefined||job.mtimeNs===undefined||job.ino===undefined||!job.sha256))throw Error('Queued file has no recorded identity; review it manually');
 const holding=path.join(path.dirname(target),'.cleanup-'+jobId.slice(0,40));
 if(!within(base,holding))throw Error('Unsafe cleanup path');
 // Resume a run interrupted after the move. Whatever now sits at the original path is a newer file and is not touched.
 if(await exists(holding))return eraseHeld(job,holding);
 let real:string;try{real=await fs.realpath(target);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
 if(!within(base,real)||real===base)throw Error('Unsafe cleanup path');
 const before=await identity(target);assertSame(job,before);
 // Move the verified file aside atomically, then check the moved file itself: a file written to the original path afterwards is never touched.
 await fs.rename(target,holding);
 try{
  const moved=await identity(holding);
  if(moved.ino!==before.ino||moved.dev!==before.dev)throw Error('File changed during cleanup');
  await eraseHeld(job,holding);
 }catch(error){
  // Restore only when nothing new occupies the original path; otherwise keep the held copy for manual review.
  const occupied=await fs.lstat(target).then(()=>true,()=>false);
  if(!occupied)await fs.rename(holding,target).catch(()=>{});
  throw error;
 }
}
export async function queuePrivateFiles(sql:SQL,workspaceId:string,orderId:string){
 const jobs:FileJob[]=[];
 const dataHome=process.env.STUDIO_DATA_DIR!;
 async function addFolder(folder:string,filter:(name:string)=>boolean){const names=await fs.readdir(folder).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return [];throw e;});for(const name of names){if(!filter(name)||name.startsWith('.cleanup-'))continue;const file=path.join(folder,name),now=await identity(file);if(!now.regular)continue;jobs.push({base:folder,relative:name,cache:true,bytes:now.bytes,mtimeNs:now.mtimeNs,ino:now.ino,dev:now.dev,sha256:await sha256(file)});}}
 const safeOrder=orderId.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120)||'proof';
 if(safeOrder!=='.'&&safeOrder!=='..'){
  await addFolder(path.join(dataHome,'proofs',safeOrder),()=>true);
  await addFolder(path.join(dataHome,'git-backup','proofs',safeOrder),()=>true);
 }
 const backup=path.join(dataHome,'git-backup');if(await fs.stat(path.join(backup,'.git')).catch(()=>null))jobs.push({base:backup,relative:'.git',external:true});
 const unique=new Map(jobs.map(job=>[digest(job.base+'\0'+job.relative),job]));
 let added=0;for(const [key,job] of unique){const id=digest(workspaceId+'\0'+orderId+'\0'+key);added+=await sql.run('INSERT INTO privacy_files(id,workspace_id,order_id,body,state,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',[id,workspaceId,orderId,seal(job,context(id)),job.external?'external':'pending',new Date().toISOString()]);}
 return added;
}
/** Claims a bounded batch of queued files under short leases, then erases each after re-verifying it. */
export async function cleanPrivacyFiles(limit=32){
 const setup=await tx(async sql=>{
  const jobs=await sql.all<{id:string;workspace_id:string;order_id:string;body:string}>('SELECT id,workspace_id,order_id,body FROM privacy_files WHERE state IN (?,?) ORDER BY updated_at LIMIT ?',['pending','blocked',limit]);if(!jobs.length)return {jobs};
  for(const row of jobs)await sql.run('UPDATE privacy_files SET updated_at=? WHERE id=?',[new Date().toISOString(),row.id]);const available=[];
  for(const row of jobs){const job=unseal<FileJob>(row.body,context(row.id)),id='privacy-path:'+digest(pathKey(path.resolve(job.base,job.relative)));const existing=await sql.one<{holder:string;expires_at:string}>('SELECT holder,expires_at FROM leases WHERE id=?',[id]);if(existing&&existing.expires_at>new Date().toISOString()&&existing.holder!==row.id)continue;await sql.run('INSERT INTO leases(id,holder,expires_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET holder=excluded.holder,expires_at=excluded.expires_at',[id,row.id,new Date(Date.now()+300000).toISOString()]);available.push(row);}
  return {jobs:available};
 });
 for(const row of setup.jobs){const job=unseal<FileJob>(row.body,context(row.id));let state='blocked';
  try{
   const target=path.resolve(job.base,job.relative);if(!job.base||target===path.resolve(job.base)||!within(job.base,target))throw Error('Unsafe cleanup path');
   await eraseVerified(job,row.id);state='done';
  }catch(e){console.error('[Privacy file]',row.id,e instanceof Error?e.message:'Cleanup failed');}
  await tx(async sql=>{await sql.run('DELETE FROM leases WHERE id=? AND holder=?',['privacy-path:'+digest(pathKey(path.resolve(job.base,job.relative))),row.id]);return state==='done'?sql.run('DELETE FROM privacy_files WHERE id=?',[row.id]):sql.run('UPDATE privacy_files SET state=?,updated_at=? WHERE id=?',[state,new Date().toISOString(),row.id]);});
 }
 return setup.jobs.length;
}
const pathKey=(value:string)=>process.platform==='win32'?value.toLowerCase():value;

