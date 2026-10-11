// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import type {SQL} from './database';
import {tx} from './database';
import {readModule,writeModule} from './modules';
import {audit,requireScope,type Principal} from './security';
import {fail} from './crypto';
import {parseMemberProfile,type MemberProfile,type MemberSummary} from '@/lib/member-profile';
import type {AppData} from '@/lib/types';

export const readMemberProfiles=(sql:SQL,workspaceId:string)=>readModule<Record<string,MemberProfile>>(sql,{workspaceId},'profiles',{});
export async function memberProfile(sql:SQL,workspaceId:string,id:string,username:string){const profiles=await readMemberProfiles(sql,workspaceId);return profiles.data[id]??{nickname:username,realName:''};}
export async function saveMemberProfile(sql:SQL,workspaceId:string,id:string,profile:MemberProfile){const state=await readMemberProfiles(sql,workspaceId);state.data[id]=profile;state.revision++;await writeModule(sql,{workspaceId},'profiles',state);}
export async function memberDirectory(sql:SQL,p:Pick<Principal,'workspaceId'>):Promise<MemberSummary[]>{
 const users=await sql.all<{id:string;username:string;role:string;disabled:number}>('SELECT id,username,role,disabled FROM users WHERE workspace_id=? ORDER BY created_at,id',[p.workspaceId]),profiles=await readMemberProfiles(sql,p.workspaceId);
 return users.map(u=>({id:u.id,nickname:profiles.data[u.id]?.nickname??u.username,role:u.role,disabled:!!u.disabled}));
}
export async function teamProfile(p:Principal,body?:Record<string,unknown>){
 requireScope(p,'business:read');if(p.apiKeyId)fail('个人资料需要登录会话',403);
 return tx(async sql=>{if(body){await saveMemberProfile(sql,p.workspaceId,p.id,parseMemberProfile(body));await audit(sql,p,'profile.update',p.id);}return {profile:await memberProfile(sql,p.workspaceId,p.id,p.username)};});
}
/** Bind a stable account, not a name; later profile edits leave the order snapshot intact. */
export async function bindOrderMembers(sql:SQL,p:Principal,current:AppData,next:AppData){
 const members=new Map((await memberDirectory(sql,p)).map(m=>[m.id,m])),originals=new Map(current.orders.map(o=>[o.id,o]));
 for(const order of next.orders){
  const before=originals.get(order.id);if(!before)order.signatureMemberId??=p.id;
  if(!order.signatureMemberId){if(before?.signatureMemberId)fail('不能清除已绑定的署名账户');order.signatureMemberName=before?.signatureMemberName;continue;}
  const member=members.get(order.signatureMemberId),changed=order.signatureMemberId!==before?.signatureMemberId;
  if(!member||changed&&member.disabled)fail('署名成员不存在或已停用');
  if(changed||!before?.signatureMemberName)order.signatureMemberName=member!.nickname;
  else order.signatureMemberName=before.signatureMemberName;
 }
}
