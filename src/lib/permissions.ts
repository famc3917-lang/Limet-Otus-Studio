// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
export const ROLES=['owner','admin','photographer','assistant','viewer'] as const;
export type Role=typeof ROLES[number];
export const ROLE_LABELS:Record<Role,string>={owner:'超级管理员 · 所有者',admin:'管理员',photographer:'受限管理员 · 摄影师',assistant:'受限管理员 · 业务助理',viewer:'普通用户 · 只读'};
export const ROLE_LABELS_EN:Record<Role,string>={owner:'Super Administrator · Owner',admin:'Administrator',photographer:'Restricted Administrator · Photographer',assistant:'Restricted Administrator · Assistant',viewer:'Standard User · Read-only'};
export const SCOPES=['business:read','contacts:read','orders:write','orders:delete','workflow:write','finance:read','finance:write','settings:write','members:manage','keys:manage','ai:use','ai:configure','audit:read','extensions:execute','retention:approve'] as const;
export type Scope=typeof SCOPES[number];
export const ROLE_SCOPES:Record<Role,readonly Scope[]>={owner:SCOPES,admin:SCOPES.filter(s=>!['members:manage','retention:approve'].includes(s)),photographer:['business:read','contacts:read','orders:write','workflow:write','finance:read','ai:use'],assistant:['business:read','contacts:read','orders:write','workflow:write','finance:read','ai:use'],viewer:['business:read']};
export interface SessionUser {id:string;workspaceId:string;username:string;nickname?:string;role:Role;scopes:readonly Scope[]}
