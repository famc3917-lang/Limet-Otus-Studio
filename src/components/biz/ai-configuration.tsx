// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {StudioSelect} from '@/components/biz/select';
import {errorText} from '@/lib/interface-error';
import {useStudioLanguage as useInterfaceLanguage} from '@/lib/i18n';
import {interfaceText,interfaceNotice} from '@/lib/interface-text';
import {VoiceCatalog} from './voice-catalog';
import {useCallback,useEffect,useRef,useState} from 'react';
import {apiRequest} from '@/lib/api-client';
import {getSessionUser} from '@/lib/auth';
import type {AIConfig} from '@/lib/desktop';
import {normalizeAIConfig} from '@/lib/ai-provider';
import {AI_PRESETS,modelChoices,providerPreset} from '@/lib/ai-presets';
import {AI_PLUGINS,DEFAULT_AI_PLUGINS,normalizePlugins,type AIPluginId} from '@/lib/ai-plugins';
import {getStudioLanguage,useStudioLanguage} from '@/lib/i18n';

const tx=(zh:string,en:string)=>getStudioLanguage()==='en'?en:zh;
/** Service status text arrives in Chinese; localize known messages for display only. */
const serviceText=(message:string)=>getStudioLanguage()==='en'&&message.startsWith('连接成功 · ')?'Connected · '+message.slice(7):interfaceText(message,getStudioLanguage());

const DEFAULT:AIConfig={protocol:'openai',baseUrl:'https://api.openai.com/v1',model:'gpt-6-sol',apiKey:'',plugins:DEFAULT_AI_PLUGINS};
export function AIConfiguration(){
 const uiLanguage=useInterfaceLanguage();

 const language=useStudioLanguage(),t=(zh:string,en:string)=>language==='en'?en:zh;
 const [config,setConfig]=useState<AIConfig>(DEFAULT),[message,setMessage]=useState(()=>tx('正在读取配置…','Loading configuration…')),[loaded,setLoaded]=useState(false),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false);
 const [models,setModels]=useState<string[]>([]),[modelMessage,setModelMessage]=useState(()=>tx('填写密钥后自动更新模型','Models update after you enter a key')),[filter,setFilter]=useState(''),[catalogRevision,setCatalogRevision]=useState(0),[catalogBusy,setCatalogBusy]=useState(false);
 const latest=useRef(config),persisted=useRef(''),queue=useRef<Promise<boolean>>(Promise.resolve(true)),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;void apiRequest<AIConfig>('ai/provider').then(c=>{if(!mounted.current)return;const initial={...c,model:c.model||providerPreset(c)?.model||'',plugins:normalizePlugins(c.plugins)};latest.current=initial;setConfig(initial);persisted.current=JSON.stringify(initial);setLoaded(true);setMessage(c.configured?tx('已配置','Configured'):tx('选择服务并填写密钥','Select a service and enter its key'));}).catch(()=>{if(mounted.current)setMessage(tx('配置读取失败，请重新打开页面重试','The configuration could not be loaded. Reopen the page and retry.'));});return ()=>{mounted.current=false;};},[]);
 const save=useCallback(()=>{
  const job=queue.current.then(async()=>{
   const snapshot=latest.current,encoded=JSON.stringify(snapshot);if(encoded===persisted.current)return true;
   if(mounted.current)setMessage(tx('正在保存…','Saving…'));
   try{
    const normalized=normalizeAIConfig(snapshot),result=await apiRequest<{config:AIConfig}>('ai/provider',{method:'PUT',body:JSON.stringify(normalized)});
    const saved=result.config;persisted.current=JSON.stringify(saved);
    if(mounted.current){if(JSON.stringify(latest.current)===encoded){latest.current=saved;setConfig(saved);setDirty(false);}setMessage(tx('已保存','Saved'));if(snapshot.apiKey||snapshot.searchApiKey)setCatalogRevision(n=>n+1);}
    window.dispatchEvent(new Event('studio-ai-configured'));return true;
   }catch(e){if(mounted.current)setMessage(tx('未保存：','Not saved: ')+errorText(e));return false;}
  });queue.current=job;return job;
 },[]);
 useEffect(()=>{if(!loaded||!dirty)return;const timer=setTimeout(()=>void save(),1000);return ()=>clearTimeout(timer);},[config,loaded,dirty,save]);
 const update=useCallback((next:AIConfig)=>{
  const previous=latest.current;let changed=next.protocol!==previous.protocol;
  if(next.baseUrl!==previous.baseUrl){try{changed ||= new URL(next.baseUrl).origin!==new URL(previous.baseUrl).origin;}catch{changed=true;}}
  if(changed)next={...next,apiKey:'',configured:false};
  latest.current=next;setConfig(next);setDirty(true);setMessage(tx('待自动保存…','Saving shortly…'));
 },[]);
 const refreshModels=useCallback(async()=>{
  if(!await save())return;
  const snapshot=latest.current,authority=snapshot.protocol+':'+snapshot.baseUrl;
  if(!snapshot.configured){setModelMessage(tx('填写密钥后自动更新模型','Models update after you enter a key'));return;}
  setCatalogBusy(true);
  try{const result=await apiRequest<{models:string[];supported:boolean;message:string}>('ai/models');if(!mounted.current||latest.current.protocol+':'+latest.current.baseUrl!==authority)return;setModels(result.models);setModelMessage(serviceText(result.message));if(!latest.current.model&&result.models.length)update({...latest.current,model:result.models[0]});}
  catch(e){if(mounted.current)setModelMessage(errorText(e));}finally{if(mounted.current)setCatalogBusy(false);}
 },[save,update]);
 useEffect(()=>{if(!loaded||!config.configured)return;const timer=setTimeout(()=>void refreshModels(),1200);return ()=>clearTimeout(timer);},[loaded,config.protocol,config.baseUrl,config.configured,catalogRevision,refreshModels]);
 const test=async()=>{setBusy(true);try{if(!await save())return;const result=await apiRequest<{message:string}>('ai/test',{method:'POST',body:'{}',signal:AbortSignal.timeout(50000)});setMessage(serviceText(result.message));window.dispatchEvent(new Event('studio-ai-configured'));}catch(e){setMessage(errorText(e));}finally{setBusy(false);}};
 if(!getSessionUser()?.scopes.includes('ai:configure'))return <p>{t('AI 服务配置由管理员负责；已有配置可在助手中使用。','An administrator manages the AI service configuration. The existing configuration remains available in the assistant.')}</p>;
 const plugins=normalizePlugins(config.plugins),choices=modelChoices(config,models).filter(id=>id.toLowerCase().includes(filter.toLowerCase()));
 const choosePreset=(preset:typeof AI_PRESETS[number])=>{let same=false;try{same=preset.protocol===config.protocol&&new URL(preset.baseUrl).origin===new URL(config.baseUrl).origin;}catch{}setModels([]);setFilter('');setModelMessage(tx('填写密钥后自动更新模型','Models update after you enter a key'));update({...config,protocol:preset.protocol,baseUrl:preset.baseUrl,model:preset.model,providerName:preset.name,modelDeveloper:preset.developer,configured:same&&config.configured});};
 const togglePlugin=(id:AIPluginId)=>update({...config,plugins:normalizePlugins(plugins.includes(id)?plugins.filter(p=>p!==id):[...plugins,id])});
 return <div className="ai-configuration" onBlur={()=>{if(loaded&&dirty)void save();}}>
  <p>{t('选择服务，模型与接入地址自动填入。','Select a service to fill in its model and endpoint.')}</p>
  <div className="api-presets" aria-label={t('AI 服务','AI services')}>{AI_PRESETS.map(p=><button type="button" key={p.name} aria-pressed={!!p.baseUrl&&providerPreset(config)?.name===p.name} onClick={()=>choosePreset(p)}>{interfaceText(p.name,language)}</button>)}</div>
  <label>{t('协议','Protocol')}<StudioSelect value={config.protocol} onChange={e=>update({...config,protocol:e.target.value as AIConfig['protocol'],configured:false})}><option value="openai">{t('OpenAI Chat Completions 兼容','OpenAI Chat Completions compatible')}</option><option value="anthropic">Anthropic Messages</option></StudioSelect></label>
  <label>{t('API 基础地址','API base URL')}<input autoComplete="off" spellCheck={false} value={config.baseUrl} placeholder="https://your-provider.example/v1" onChange={e=>update({...config,baseUrl:e.target.value})}/></label>
  <label>{t('API 密钥','API key')}<input type="password" autoComplete="off" spellCheck={false} value={config.apiKey} placeholder={config.configured?t('已配置 · 留空保留','Configured · leave blank to keep'):t('填写服务密钥','Enter the service key')} onChange={e=>update({...config,apiKey:e.target.value})}/></label>
  <label>{t('模型开发方','Model developer')}<input maxLength={100} value={config.modelDeveloper??providerPreset(config)?.developer??''} placeholder={t('自定义或代理服务请填写模型的实际开发方','For custom or proxy services, enter the actual model developer')} onChange={e=>update({...config,modelDeveloper:e.target.value})}/></label>
  <label>{t('模型标识','Model ID')}<input autoComplete="off" spellCheck={false} value={config.model} placeholder={t('可输入其他模型标识','Or enter another model ID')} onChange={e=>update({...config,model:e.target.value})}/></label>
  <section className="ai-model-picker" aria-label={t('模型选择','Model selection')}><div className="ai-section-heading"><strong>{t('模型','Models')}</strong><button type="button" disabled={!loaded||catalogBusy} onClick={()=>void refreshModels()}>{catalogBusy?t('更新中…','Updating…'):t('刷新模型','Refresh models')}</button></div>{choices.length>8&&<input aria-label={t('筛选模型','Filter models')} placeholder={t('筛选模型…','Filter models…')} value={filter} onChange={e=>setFilter(e.target.value)}/>}<div className="ai-model-list">{choices.slice(0,24).map(id=><button type="button" key={id} aria-pressed={config.model===id} onClick={()=>update({...config,model:id})}>{id}</button>)}</div><small role="status">{interfaceNotice(modelMessage,uiLanguage)} · {t('保留自定义模型','Custom model IDs are kept')}</small></section>
  <fieldset className="ai-plugin-picker"><legend>{t('挂载能力','Enabled capabilities')}</legend><div className="ai-plugin-grid">{AI_PLUGINS.map(plugin=><label key={plugin.id}><input type="checkbox" checked={plugins.includes(plugin.id)} onChange={()=>togglePlugin(plugin.id)}/><span><strong>{language==='en'?plugin.nameEn:plugin.name}</strong><small>{language==='en'?plugin.descriptionEn:plugin.description}</small></span></label>)}</div></fieldset>
  {plugins.includes('web-search')&&<label>{t('Tavily 搜索密钥','Tavily search key')}<input type="password" autoComplete="off" spellCheck={false} value={config.searchApiKey??''} placeholder={config.searchConfigured?t('已配置 · 留空保留','Configured · leave blank to keep'):t('填写 Tavily API Key','Enter a Tavily API key')} onChange={e=>update({...config,searchApiKey:e.target.value})}/><small>{t('联网检索使用独立服务，可在助手中选择是否启用。','Web search uses a separate service. Turn it on or off in the assistant.')}</small></label>}
  <div className="flex gap-3"><button type="button" className="studio-btn studio-btn-outline px-4 py-2" disabled={busy||!loaded||!dirty} onClick={()=>void save()}>{t('重试保存','Retry save')}</button><button type="button" className="studio-btn studio-btn-outline px-4 py-2" disabled={busy||!loaded} onClick={()=>void test()}>{busy?t('检测中…','Testing…'):t('测试连接','Test connection')}</button></div>
  <VoiceCatalog/>
  <small role="status">{interfaceNotice(message,uiLanguage)}</small><small>{t('测试连接会产生少量 API 用量。业务修改需要确认后执行。','A connection test uses a small amount of API quota. Business changes run only after confirmation.')}</small>
 </div>;
}
