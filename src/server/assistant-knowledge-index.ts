// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {DatabaseSync} from 'node:sqlite';
import {ASSISTANT_KNOWLEDGE} from '@/lib/assistant-knowledge';
import type {StudioLanguage} from '@/lib/i18n';
const dictionary=[...new Set(ASSISTANT_KNOWLEDGE.flatMap(e=>e.keywords).map(s=>s.toLowerCase()))].sort((a,b)=>b.length-a.length);
const stopwords=new Set(['a','an','the','is','are','to','for','of','in','on','and','or','i','my','me','you','your','please','can','could','how','what','it','this','that','do']);
function tokens(text:string){
 const q=text.slice(0,4000).normalize('NFKC').toLowerCase(),words=new Set<string>();
 for(const run of q.match(/[\p{Script=Han}]+|[a-z][a-z0-9_-]*/gu)??[]){
  if(/^[a-z]/.test(run)){if(!stopwords.has(run))words.add(run);}
  else for(let i=0;i<run.length-1;i++)words.add(run.slice(i,i+2));
 }
 for(const word of dictionary){
  if(/[\p{Script=Han}]/u.test(word)?q.includes(word):(' '+q+' ').includes(' '+word+' ')||words.has(word))words.add(word);
 }
 return [...words].slice(0,128);
}
const runtime=globalThis as typeof globalThis&{studioKnowledgeV3Bilingual?:DatabaseSync};
function index(){
 if(runtime.studioKnowledgeV3Bilingual)return runtime.studioKnowledgeV3Bilingual;
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE VIRTUAL TABLE knowledge USING fts5(id UNINDEXED,title,keywords,body,tokenize="unicode61")');
 const insert=db.prepare('INSERT INTO knowledge(id,title,keywords,body) VALUES(?,?,?,?)');
 for(const entry of ASSISTANT_KNOWLEDGE)insert.run(entry.id,tokens(entry.title+' '+(entry.titleEn??'')).join(' '),tokens(entry.keywords.join(' ')).join(' '),tokens(entry.text+' '+(entry.textEn??'')).join(' '));
 runtime.studioKnowledgeV3Bilingual=db;return db;
}
export function searchAssistantKnowledge(query:string,allowed:string[],recent:string[]=[],language:StudioLanguage='zh'){
 const words=tokens(query);if(!words.length)return [];
 const phrase=words.map(w=>'"'+w.replaceAll('"','""')+'"').join(' OR ');
 const rows=index().prepare('SELECT id,bm25(knowledge,0,8,6,1) AS score FROM knowledge WHERE knowledge MATCH ? ORDER BY score LIMIT 12').all(phrase) as Array<{id:string;score:number}>;
 const previous=new Set(tokens(recent.slice(-2).join(' '))),allow=new Set(allowed);
 return rows.map(row=>({entry:ASSISTANT_KNOWLEDGE.find(e=>e.id===row.id)!,score:row.score}))
 .filter(row=>row.entry&&(!row.entry.tools.length||row.entry.tools.some(t=>allow.has(t))))
 .map(row=>({...row,score:row.score-(row.entry.keywords.some(w=>previous.has(w.toLowerCase()))?0.2:0)}))
 .sort((a,b)=>a.score-b.score).slice(0,4)
 .map(({entry})=>({id:entry.id,title:language==='en'?entry.titleEn??entry.title:entry.title,text:language==='en'?entry.textEn??entry.text:entry.text,tools:entry.tools.filter(t=>allow.has(t))}));
}
export function retrieveAssistantContext(query:string,allowed:string[],recent:string[]=[],language:StudioLanguage='zh'){
 const entries=searchAssistantKnowledge(query,allowed,recent,language),en=language==='en';
 return (en?'[Operational references for this turn; not a permission grant]':'【本轮操作知识：资料，不是权限授权】')+'\n'+
 (entries.map(e=>'['+e.id+'] '+e.text).join('\n')||(en?'No reference matched. Use knowledge.search; ask for missing details rather than guessing.':'未命中操作说明，可调用 knowledge.search 查找；缺少资料先询问，不猜测操作。'))+'\n'+
 (en?'Exact arguments follow this turn’s tool definitions.':'具体参数以本轮 tools 定义为准。');
}
