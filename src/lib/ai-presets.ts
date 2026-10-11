// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import type {AIConfig} from './desktop';

// Verified against first-party API documentation on 2026-10-04.
// Live /models responses supplement these offline defaults; never change an existing choice.
export const AI_PRESETS = [
 {name:'DeepSeek',developer:'DeepSeek',protocol:'openai',baseUrl:'https://api.deepseek.com',model:'deepseek-flash',models:['deepseek-flash','deepseek-v4-pro','deepseek-v4-flash']},
 {name:'OpenAI',developer:'OpenAI',protocol:'openai',baseUrl:'https://api.openai.com/v1',model:'gpt-6-sol',models:['gpt-6-sol','gpt-6-luna','gpt-5.4-mini','gpt-4.1-mini']},
 {name:'Gemini 兼容',developer:'Google',protocol:'openai',baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',model:'gemini-3.8-flash',models:['gemini-3.8-flash']},
 {name:'Anthropic',developer:'Anthropic',protocol:'anthropic',baseUrl:'https://api.anthropic.com',model:'claude-sonnet-5-5',models:['claude-sonnet-5-5','claude-opus-5-5','claude-fable-5-1']},
 {name:'本机模型',developer:'',protocol:'openai',baseUrl:'http://localhost:11434/v1',model:'',models:[]},
 {name:'自定义兼容服务',developer:'',protocol:'openai',baseUrl:'',model:'',models:[]},
] as const;

export function providerPreset(config:Pick<AIConfig,'baseUrl'|'protocol'>){
 try {const url=new URL(config.baseUrl);return AI_PRESETS.find(p=>p.baseUrl&&p.protocol===config.protocol&&new URL(p.baseUrl).origin===url.origin);}catch{return undefined;}
}
export function usesOpenAINoneReasoning(config:Pick<AIConfig,'baseUrl'|'model'|'protocol'>){
 try{return config.protocol==='openai'&&new URL(config.baseUrl).hostname==='api.openai.com'&&/^gpt-6-(sol|luna)(-|$)/.test(config.model);}catch{return false;}
}
export function isCompatibleChatModel(config:Pick<AIConfig,'baseUrl'|'protocol'>,id:string){
 try {if(config.protocol!=='openai'||new URL(config.baseUrl).hostname!=='api.openai.com')return true;}catch{return true;}
 // GPT-6 Astra / 6.1 Sol require Responses for tool calling; this adapter is Chat Completions.
 return /^(gpt-|o[134](?:-|$))/.test(id)&&!/(?:embedding|moderation|audio|realtime|image|tts|transcribe|whisper|codex|search|deep-research|\bpro\b)/i.test(id)&&!/^gpt-6(?:\.\d+)-sol|^gpt-6-astra/.test(id);
}
export function modelChoices(config:Pick<AIConfig,'baseUrl'|'protocol'>,live:string[]=[]){
 const defaults=providerPreset(config)?.models??[];
 return [...new Set([...defaults,...live])].filter(id=>isCompatibleChatModel(config,id));
}
