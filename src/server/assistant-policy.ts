// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {ROLE_SCOPES,type Role} from '@/lib/permissions';
import {assistantPrincipal} from './ai-runtime-tools';
import type {SQL} from './database';
import type {Principal} from './security';
import {fail} from './crypto';

/** Re-check account and authentication at dispatch, including after a remote model wait. */
export async function currentAssistantPrincipal(sql:SQL,p:Principal):Promise<Principal>{
 const user=await sql.one<{role:Role;disabled:number}>('SELECT role,disabled FROM users WHERE id=? AND workspace_id=?',[p.id,p.workspaceId]);
 if(!user||user.disabled)fail('账户已停用',401);
 const now=new Date().toISOString();
 if(p.sessionHash&&!await sql.one('SELECT hash FROM sessions WHERE hash=? AND user_id=? AND expires_at>?',[p.sessionHash,p.id,now]))fail('登录已失效，请重新登录',401);
 let scopes=p.scopes.filter(scope=>ROLE_SCOPES[user!.role].includes(scope));
 if(p.apiKeyId){const key=await sql.one<{scopes:string}>('SELECT scopes FROM api_keys WHERE id=? AND user_id=? AND workspace_id=? AND revoked=0 AND expires_at>?',[p.apiKeyId,p.id,p.workspaceId,now]);if(!key)fail('API 密钥已失效',401);const granted=JSON.parse(key!.scopes) as string[];scopes=scopes.filter(scope=>granted.includes(scope));}
 if(!scopes.includes('ai:use'))fail('当前账户没有助手权限',403);
 return assistantPrincipal({...p,role:user!.role,scopes});
}
