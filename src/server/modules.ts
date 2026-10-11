// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {seal,unseal} from './crypto';
import type {SQL} from './database';
import type {Principal} from './security';
export async function readModule<T>(sql:SQL,p:Pick<Principal,'workspaceId'>,name:string,fallback:T){const row=await sql.one<{body:string;revision:number}>('SELECT body,revision FROM studio_modules WHERE workspace_id=? AND name=?',[p.workspaceId,name]);return {revision:row?.revision??0,data:row?unseal<T>(row.body,'module:'+p.workspaceId+':'+name):structuredClone(fallback)};}
export async function writeModule<T>(sql:SQL,p:Pick<Principal,'workspaceId'>,name:string,value:{revision:number;data:T}){await sql.run('INSERT INTO studio_modules(workspace_id,name,revision,body) VALUES(?,?,?,?) ON CONFLICT(workspace_id,name) DO UPDATE SET revision=excluded.revision,body=excluded.body',[p.workspaceId,name,value.revision,seal(value.data,'module:'+p.workspaceId+':'+name)]);}
