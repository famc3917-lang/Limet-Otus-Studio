// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import fs from 'node:fs/promises';
import path from 'node:path';
import {fail,masterKey} from './crypto';
import type {SQLInputValue} from 'node:sqlite';
export type Row=Record<string,string|number|null>;
export interface SQL {all<T=Row>(sql:string,args?:unknown[]):Promise<T[]>;one<T=Row>(sql:string,args?:unknown[]):Promise<T|undefined>;run(sql:string,args?:unknown[]):Promise<number>}
const schema=[
 'CREATE TABLE IF NOT EXISTS privacy_deletions (workspace_id TEXT NOT NULL,order_id TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(workspace_id,order_id))',
 'CREATE TABLE IF NOT EXISTS privacy_files (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,order_id TEXT NOT NULL,body TEXT NOT NULL,state TEXT NOT NULL,updated_at TEXT NOT NULL)',
 'CREATE INDEX IF NOT EXISTS privacy_files_state ON privacy_files(state,updated_at)',
 'CREATE TABLE IF NOT EXISTS software_elevations (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,user_id TEXT NOT NULL,expires_at TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS studio_modules (workspace_id TEXT NOT NULL,name TEXT NOT NULL,revision INTEGER NOT NULL,body TEXT NOT NULL,PRIMARY KEY(workspace_id,name))',
 'CREATE TABLE IF NOT EXISTS ai_prefix_usage (id TEXT PRIMARY KEY,count INTEGER NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL,disabled INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),csrf_hash TEXT NOT NULL,expires_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,hash TEXT UNIQUE NOT NULL,prefix TEXT NOT NULL,secret TEXT NOT NULL DEFAULT \'\',scopes TEXT NOT NULL,expires_at TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS invitations (hash TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),role TEXT NOT NULL,expires_at TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS business_state (workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),revision INTEGER NOT NULL,body TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS state_history (workspace_id TEXT NOT NULL,revision INTEGER NOT NULL,body TEXT NOT NULL,PRIMARY KEY(workspace_id,revision))',
 'CREATE TABLE IF NOT EXISTS providers (workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),body TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,user_id TEXT NOT NULL,body TEXT NOT NULL,expires_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,resource TEXT NOT NULL,created_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS rate_limits (id TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS idempotency (id TEXT PRIMARY KEY,body TEXT NOT NULL,expires_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS leases (id TEXT PRIMARY KEY,holder TEXT NOT NULL,expires_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS hardware_cards (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,user_id TEXT NOT NULL,name TEXT NOT NULL,public_key TEXT NOT NULL,scopes TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS hardware_challenges (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,user_id TEXT NOT NULL,card_id TEXT NOT NULL,nonce TEXT NOT NULL,action TEXT NOT NULL,expires_at TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS elevations (hash TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,user_id TEXT NOT NULL,action TEXT NOT NULL,scopes TEXT NOT NULL,expires_at TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0)',
 'CREATE INDEX IF NOT EXISTS audit_workspace_time ON audit(workspace_id,created_at)',
 'CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)',
];
interface Database {transaction<T>(fn:(sql:SQL)=>Promise<T>):Promise<T>;close():Promise<void>;kind:'sqlite'|'postgres'}
const runtime=globalThis as typeof globalThis&{studioDatabase?:Promise<Database>};
export function database(){return runtime.studioDatabase??=(async()=>{
 masterKey();
 if(process.env.DATABASE_URL){const {Pool}=await import('pg');const pool=new Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:10000,ssl:process.env.STUDIO_DB_TLS==='true'?{rejectUnauthorized:true}:undefined});
  const adapter=(client:{query:(query:string,values?:unknown[])=>Promise<{rows:unknown[];rowCount:number|null}>}):SQL=>{const query=(s:string,a:unknown[]=[])=>{let i=0;return client.query(s.replace(/\?/g,()=>`$${++i}`),a);};return {all:async<T>(s:string,a?:unknown[])=> (await query(s,a)).rows as T[],one:async<T>(s:string,a?:unknown[])=> (await query(s,a)).rows[0] as T|undefined,run:async(s,a)=> (await query(s,a)).rowCount??0};};
  const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(721021)');for(const s of schema)await client.query(s);await client.query("ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS secret TEXT NOT NULL DEFAULT ''");await client.query('INSERT INTO schema_versions(version,applied_at) VALUES(1,$1) ON CONFLICT DO NOTHING',[new Date().toISOString()]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  return {kind:'postgres' as const,close:()=>pool.end(),transaction:async<T>(fn:(sql:SQL)=>Promise<T>)=>{for(let attempt=0;attempt<4;attempt++){const client=await pool.connect();try{await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const value=await fn(adapter(client));await client.query('COMMIT');return value;}catch(e){await client.query('ROLLBACK');if(attempt===3||!['40001','40P01'].includes(String((e as {code?:string}).code)))throw e;}finally{client.release();}}return fail('事务暂不可用，请重试',503);}};
 }
 if(!process.env.STUDIO_DATA_DIR)fail('请配置 DATABASE_URL 或 STUDIO_DATA_DIR',503);
 await fs.mkdir(process.env.STUDIO_DATA_DIR!,{recursive:true});
 // Node >=24 has a bundled SQLite engine; Electron uses the same ABI as its Node runtime.
 const sqlite=await import('node:sqlite');const db=new sqlite.DatabaseSync(path.join(process.env.STUDIO_DATA_DIR!,'studio-v2.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;');db.exec('BEGIN IMMEDIATE');try{for(const s of schema)db.exec(s);if(!db.prepare('PRAGMA table_info(api_keys)').all().some(column=>column.name==='secret'))db.exec("ALTER TABLE api_keys ADD COLUMN secret TEXT NOT NULL DEFAULT ''");db.prepare('INSERT OR IGNORE INTO schema_versions(version,applied_at) VALUES(1,?)').run(new Date().toISOString());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');db.close();throw e;}
 const sql:SQL={all:async<T>(s:string,a:unknown[]=[])=>db.prepare(s).all(...a as SQLInputValue[]) as T[],one:async<T>(s:string,a:unknown[]=[])=>db.prepare(s).get(...a as SQLInputValue[]) as T|undefined,run:async(s,a=[])=>Number(db.prepare(s).run(...a as SQLInputValue[]).changes)};
 let lock:Promise<unknown>=Promise.resolve();return {kind:'sqlite' as const,close:async()=>db.close(),transaction:<T>(fn:(sql:SQL)=>Promise<T>)=>{const task=lock.then(async()=>{db.exec('BEGIN IMMEDIATE');try{const result=await fn(sql);db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}});lock=task.catch(()=>{});return task;}};
})();}
export async function tx<T>(fn:(sql:SQL)=>Promise<T>){return (await database()).transaction(fn);}
