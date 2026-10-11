// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {fail} from './crypto';
const unloaders=new Map<string,()=>void>();
let occupied=false;
export function registerInferenceEngine(name:string,unload:()=>void){unloaders.set(name,unload);}
export function acquireInference(name:string){if(occupied)fail('语音引擎正在处理，请稍后重试',429);occupied=true;for(const [other,unload] of unloaders)if(other!==name)unload();let released=false;return ()=>{if(!released){released=true;occupied=false;}};}
