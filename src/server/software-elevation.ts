// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {randomUUID} from 'node:crypto';
import {tx,type SQL} from './database';
import {sealedUser,audit,type Principal} from './security';
import {verifyEither,fail} from './crypto';
import {workspacePolicy} from './workspace-policy';
export async function mayApproveRetention(sql:SQL,p:Principal,now=Date.now()){
 if(p.apiKeyId)return false;if(p.role==='owner'||p.scopes.includes('retention:approve'))return true;
 const policy=(await workspacePolicy(sql,p)).data;if(!policy.elevationScopes.includes('retention:approve'))return false;
 return !!await sql.one('SELECT id FROM software_elevations WHERE workspace_id=? AND user_id=? AND revoked=0 AND expires_at>?',[p.workspaceId,p.id,new Date(now).toISOString()]);
}
export async function softwareElevation(p:Principal,method:string,body:Record<string,unknown>={}){
 if(p.apiKeyId)fail('提权需要登录会话',403);
 return tx(async sql=>{
  if(method==='GET'){const now=new Date().toISOString();return {canApprove:await mayApproveRetention(sql,p),grants:await sql.all('SELECT id,user_id AS "userId",expires_at AS "expiresAt",revoked FROM software_elevations WHERE workspace_id=?'+(p.role==='owner'?'':' AND user_id=?')+' AND expires_at>?',[p.workspaceId,...(p.role==='owner'?[]:[p.id]),now])};}
  if(p.role!=='owner')fail('只有超级管理员可以授予或撤销提权',403);
  const user=await sealedUser(sql,'id=? AND workspace_id=?',[p.id,p.workspaceId]);if(!user||!await verifyEither(String(body.password??''),user))fail('密码不正确',403);
  if(method==='DELETE'){await sql.run('UPDATE software_elevations SET revoked=1 WHERE id=? AND workspace_id=?',[String(body.id??''),p.workspaceId]);await audit(sql,p,'software.elevation.revoke',String(body.id??''));return {ok:true};}
  const target=await sql.one<{id:string}>('SELECT id FROM users WHERE id=? AND workspace_id=? AND disabled=0',[String(body.userId??''),p.workspaceId]);if(!target)fail('成员不存在或已停用');
  const policy=(await workspacePolicy(sql,p)).data;if(!policy.elevationScopes.includes('retention:approve'))fail('当前工作室不允许延期审批提权',403);
  const minutes=Number(body.minutes??policy.elevationMinutes);if(!Number.isInteger(minutes)||minutes<1||minutes>policy.elevationMinutes)fail('提权时长超过工作室设定');
  const id=randomUUID(),expiresAt=new Date(Date.now()+minutes*60000).toISOString();await sql.run('INSERT INTO software_elevations(id,workspace_id,user_id,expires_at,revoked) VALUES(?,?,?,?,0)',[id,p.workspaceId,target.id,expiresAt]);await audit(sql,p,'software.elevation.grant',target.id);return {id,userId:target.id,expiresAt,scope:'retention:approve'};
 });
}
