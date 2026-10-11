// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {readModule} from './modules';
import type {SQL} from './database';
import type {Principal} from './security';
export interface WorkspacePolicy {mode:'personal'|'team';independentReview:boolean;retentionMonths:number;graceMonths:number;retentionStart:'delivery'|'created'|'shoot';autoDelete:boolean;elevationMinutes:number;elevationScopes:string[]}
export const DEFAULT_POLICY:WorkspacePolicy={mode:'personal',independentReview:false,retentionMonths:3,graceMonths:1,retentionStart:'delivery',autoDelete:true,elevationMinutes:15,elevationScopes:['retention:approve']};
export const workspacePolicy=(sql:SQL,p:Principal)=>readModule(sql,p,'policy',DEFAULT_POLICY);
