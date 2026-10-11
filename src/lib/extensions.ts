// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import type {AppData} from './types';
export interface StudioCommand {type:string;payload:Record<string,unknown>}
export interface CommandResult {data:AppData;result:unknown}
export interface ExtensionContext {data:AppData;now:string}
export interface StudioExtension {id:string;navigation?:{href:string;label:string}[];commands?:Record<string,{description:string;write:boolean;schema:Record<string,unknown>;execute:(context:ExtensionContext,payload:Record<string,unknown>)=>CommandResult}>}
const extensions=new Map<string,StudioExtension>();
/** Source-level extensions only: no remote JavaScript execution, no undocumented private data access. */
export function registerStudioExtension(extension:StudioExtension){
 if(!/^[a-z][a-z0-9-]*$/.test(extension.id)||extensions.has(extension.id))throw new Error('扩展标识无效或已注册');
 for(const name of Object.keys(extension.commands??{}))if(!name.startsWith(extension.id+'.'))throw new Error('扩展命令须使用自身命名空间');
 extensions.set(extension.id,extension);return ()=>extensions.delete(extension.id);
}
export const getStudioExtensions=()=>Array.from(extensions.values());
export const getExtensionCommand=(name:string)=>getStudioExtensions().flatMap(e=>Object.entries(e.commands??{})).find(([id])=>id===name)?.[1];
