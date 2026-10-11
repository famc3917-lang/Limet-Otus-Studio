// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
export interface AIConfig {interfaceLanguage?:'zh'|'en';timeZone?:string;providerName?:string;modelDeveloper?:string;prefixGeneration?:string;prefixMode?:'expanded'|'compact';protocol:'openai'|'anthropic';baseUrl:string;model:string;apiKey:string;configured?:boolean;plugins?:import('./ai-plugins').AIPluginId[];searchApiKey?:string;searchConfigured?:boolean;voiceCatalog?:import("./assistant-identity").VoiceProfile[];voiceId?:string;allowedCommands?:string[];knowledge?:string}
export interface DesktopBridge {windowTheme?:(theme:'light'|'dark')=>Promise<string>;interfaceLanguage:(language?:'zh'|'en')=>Promise<'zh'|'en'|null>;assistantPanelState:()=>Promise<boolean>;closeAssistant:()=>Promise<void>;assistantSettings:()=>Promise<void>;ttsInstall:()=>Promise<TTSInstallStatus>;ttsInstallStatus:()=>Promise<TTSInstallStatus>;speechInstall?:()=>Promise<TTSInstallStatus>;speechInstallStatus?:()=>Promise<TTSInstallStatus>;apiSession:()=>Promise<{token:string}>;assistantPreferences:(p:{background:boolean;floating:boolean;authenticated?:boolean})=>Promise<void>;openAssistant:()=>Promise<void>;moveAssistant:(p:{phase:'start'|'move'|'end';pointer?:{x:number;y:number}})=>Promise<void>;readDraft:()=>Promise<{revision:number;data:import('./types').AppData}|null>;saveDraft:(p:{revision:number;data:import('./types').AppData})=>Promise<void>;clearDraft:()=>Promise<void>;hardwareVolumes:()=>Promise<{supported:boolean;volumes:{id:string;label:string;fileSystem:string;size:number;available:number}[]}>}
export const desktop=()=>typeof window==='undefined'?undefined:(window as unknown as {pstudio?:Partial<DesktopBridge>}).pstudio;
let session:Promise<{token:string}>|undefined;
export const apiSession=()=>session??=(desktop()?.apiSession?.()??Promise.resolve({token:''}));


export interface TTSInstallStatus {phase:string;progress:number;error:string;available:boolean}
