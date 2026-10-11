// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {errorText} from '@/lib/interface-error';
import {useEffect,useRef,useState} from 'react';
import {getSessionUser} from '@/lib/auth';
import {apiRequest} from '@/lib/api-client';
import {cliSuggestions,cliHelp,cliModuleLabel} from '@/lib/cli';
import {useStudioLanguage,useStudioText} from '@/lib/i18n';
type Result={module?:string;messages?:unknown[];message?:string;draft?:string;proposal?:{id:string;previews:unknown[]}};
function Highlight({value}:{value:string}){return <>{value.split(/("[^"\n]*"|'[^'\n]*'|\b\d+(?:\.\d+)?\b|[|>()[\]{}])/g).map((part,i)=><span key={i} className={/^['"]/.test(part)?'cli-string':/^\d/.test(part)?'cli-number':/^[|>()[\]{}]$/.test(part)?'cli-symbol':'cli-word'}>{part}</span>)}</>;}
export function CLIPanel({onClose}:{onClose:()=>void}){
 const language=useStudioLanguage(),t=useStudioText();
 const [module,setModule]=useState('通用'),[input,setInput]=useState(''),[history,setHistory]=useState<Array<{type:'input'|'output'|'error';text:string}>>([]),[pending,setPending]=useState<Result['proposal']>(),[busy,setBusy]=useState(false),[index,setIndex]=useState(0),[suggest,setSuggest]=useState(false),[fold,setFold]=useState(false),[wide,setWide]=useState(false),[ai,setAI]=useState(''),[rule,setRule]=useState('');
 const editor=useRef<HTMLTextAreaElement>(null),mirror=useRef<HTMLPreElement>(null),end=useRef<HTMLDivElement>(null);
 const choices=cliSuggestions(input.split('\n').at(-1)??'',module,language),owner=getSessionUser()?.role==='owner',label=cliModuleLabel(module,language);
 useEffect(()=>{editor.current?.focus();},[]);
 useEffect(()=>{setSuggest(false);setIndex(0);},[language]);
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[history,pending]);
 const append=(type:'output'|'error',text:unknown)=>setHistory(h=>[...h,{type,text:typeof text==='string'?text:JSON.stringify(text,null,2)}].slice(-150));
 const request=async(body:Record<string,unknown>)=>{
  if(busy)return;setBusy(true);setSuggest(false);
  try{
   const result=await apiRequest<Result>('cli',{method:'POST',body:JSON.stringify({module,language,...body})});
   if(result.module)setModule(result.module);if(result.message)append('output',result.message);
   for(const m of result.messages??[]){if(m==='清屏')setHistory([]);else append('output',m);}
   if(result.proposal){setPending(result.proposal);append('output',result.proposal.previews);}
   if(body.action==='confirm'||body.action==='cancel')setPending(undefined);if(body.action==='confirm')window.dispatchEvent(new Event('studio-cli-applied'));
   if(result.draft){setInput(result.draft);append('output',t('AI 已起草。请核对命令，提交后仍需确认 Y。','AI draft prepared. Review the commands; submission still requires Confirm Y.'));}
  }catch(e){append('error',errorText(e));}finally{setBusy(false);}
 };
 const send=()=>{
  const text=input.trimEnd();if(!text.trim()||busy)return;
  setHistory(h=>[...h,{type:'input',text:label+' › '+text}]);setInput('');
  if(pending){
   if(['确认 Y','Confirm Y','Y'].includes(text))void request({action:'confirm',id:pending.id,answer:'Y'});
   else if(['取消','Cancel'].includes(text))void request({action:'cancel'});
   else append('error',t('先输入“确认 Y”执行方案，或输入“取消”。','Enter Confirm Y to execute the proposal, or Cancel to discard it.'));
   return;
  }
  if(text.startsWith('AI ')){void request({action:'ai',text:text.slice(3)});return;}
  void request({action:'command',text,rule});
 };
 const choose=(choice:string)=>{
  const lines=input.split('\n');lines[lines.length-1]=/^(引入|Import) /.test(choice)?choice:choice.split(' ')[0]+' ';
  setInput(lines.join('\n'));setSuggest(false);editor.current?.focus();
 };
 return !owner?<div className="v240-error">{t('命令面板仅供超级管理员使用。','The command panel is available to Super Administrators only.')}</div>:<div className={'studio-cli'+(wide?' cli-wide':'')}>
  <header className="cli-toolbar"><div className="cli-window-controls">
   <button type="button" onClick={onClose} aria-label={t('关闭命令面板','Close command panel')} className="cli-red"/>
   <button type="button" aria-label={fold?t('展开命令面板','Expand command panel'):t('收起命令面板','Collapse command panel')} className="cli-yellow" onClick={()=>setFold(!fold)}/>
   <button type="button" aria-label={wide?t('还原命令面板','Restore command panel'):t('放大命令面板','Enlarge command panel')} className="cli-green" onClick={()=>setWide(!wide)}/>
  </div><span>{t('观隅 · 超级管理员','Limet Otus · Super Administrator')}</span><span className="cli-module-label">{label}</span></header>
  {!fold&&<>
   <div className="cli-transcript" role="log" aria-label={t('命令记录','Command history')}>
    {!history.length&&<pre>{t('观隅 · 命令面板\n输入“帮助”查看语法，输入“引入 模块”进入业务模块。','Limet Otus · Command panel\nEnter Help for syntax, or Import module to select a module.')}</pre>}
    {history.map((item,i)=><pre key={i} className={'cli-'+item.type}>{item.type==='input'?<Highlight value={item.text}/>:item.text}</pre>)}
    {pending&&<div className="cli-confirmation"><strong>{t('确认执行','Confirm operation')}</strong><p>{t('上述方案五分钟内有效。输入“确认 Y”执行，输入“取消”放弃。','This proposal is valid for five minutes. Enter Confirm Y to execute it, or Cancel to discard it.')}</p></div>}<div ref={end}/>
   </div>
   <div className="cli-composer"><label htmlFor="cli-input">{label} ›</label><div className="cli-editor">
    <pre ref={mirror} aria-hidden="true"><Highlight value={input||' '}/>{'\n'}</pre>
    <textarea id="cli-input" ref={editor} value={input} spellCheck={false} autoCapitalize="off" autoCorrect="off" rows={3} disabled={busy} aria-label={t('中文固定语法命令','English fixed-syntax command')} aria-autocomplete="list" aria-activedescendant={suggest&&choices.length?'cli-option-'+index:undefined} aria-controls="cli-suggestions"
     onScroll={e=>{if(mirror.current){mirror.current.scrollTop=e.currentTarget.scrollTop;mirror.current.scrollLeft=e.currentTarget.scrollLeft;}}}
     onChange={e=>{setInput(e.target.value);setIndex(0);setSuggest(true);}}
     onKeyDown={e=>{
      if(e.nativeEvent.isComposing)return;
      if(suggest&&choices.length&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();setIndex(i=>(i+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length);return;}
      if((e.key==='Tab'||e.key==='Enter'&&!e.shiftKey)&&suggest&&choices.length){e.preventDefault();choose(choices[index%choices.length]);return;}
      if(e.key==='Escape'){setSuggest(false);return;}
      if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}
     }}/>
    {suggest&&choices.length>0&&<div id="cli-suggestions" className="cli-suggestions" role="listbox" aria-label={t('命令补全','Command completions')}>{choices.map((s,i)=><button type="button" key={s} id={'cli-option-'+i} role="option" aria-selected={i===index} onMouseDown={e=>{e.preventDefault();choose(s);}}>{s}</button>)}</div>}
   </div><button type="button" className="studio-btn studio-btn-primary" disabled={busy||!input.trim()} onClick={send}>{busy?t('处理中','Processing'):t('提交','Submit')}</button></div>
   <details className="cli-help"><summary>{t('语法参考与业务规则','Syntax and business rules')}</summary>
    <a href={'/api/v1/cli/manual?language='+language} target="_blank" rel="noreferrer" className="cli-manual-link">{t('完整中文语法手册 ↗','Complete English syntax manual ↗')}</a>
    <pre>{(cliHelp(language)[module]??cliHelp(language)['通用']).join('\n')}</pre>
    <label>{t('业务规则脚本（导入规则命令引用此草稿）','Business rule script (used by ImportRule)')}<textarea rows={5} value={rule} onChange={e=>setRule(e.target.value)} placeholder={language==='en'?'function rule(input) {\n  return { reservePoints: 2000 };\n}':'function 规则(输入) {\n  return { reservePoints: 2000 };\n}'}/></label>
    <p>{t('脚本金额使用最小货币单位；比例使用万分比。仅支持业务计算。','Script amounts use minor currency units; ratios use basis points. Scripts are limited to business calculations.')}</p>
   </details>
   <div className="cli-ai"><input className="studio-field" value={ai} onChange={e=>setAI(e.target.value)} aria-label={t('请AI起草命令','Ask AI to draft commands')} placeholder={t('描述需要调整的业务规则','Describe the business rule to adjust')}/><button type="button" className="studio-btn studio-btn-outline" disabled={busy||!ai.trim()} onClick={()=>void request({action:'ai',text:ai})}>{t('请 AI 起草','Draft with AI')}</button></div>
  </>}
 </div>;
}
