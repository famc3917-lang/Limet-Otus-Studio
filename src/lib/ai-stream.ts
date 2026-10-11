// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
interface ToolDelta {index?:number;id?:string;function?:{name?:string;arguments?:string}}
interface Chunk {type?:string;index?:number;error?:unknown;content_block?:{type:string;id?:string;name?:string;input?:Record<string,unknown>;text?:string};delta?:{type?:string;text?:string;partial_json?:string};choices?:Array<{index?:number;finish_reason?:string|null;delta?:{content?:string;tool_calls?:ToolDelta[]}}>}
export async function readAIStream(response:Response,protocol:string,onText:(text:string)=>void){
 if(!response.body)throw Error('AI 流为空');const reader=response.body.getReader(),decoder=new TextDecoder(),tools=new Map<number,{id:string;name:string;arguments:string;input?:Record<string,unknown>}>();let buffer='',text='',bytes=0,complete=false;
 const part=(index:number)=>{if(!Number.isInteger(index)||index<0||index>=32)throw Error('工具调用超过限制');let tool=tools.get(index);if(!tool){tool={id:'',name:'',arguments:''};tools.set(index,tool);}return tool;};
 const consume=(block:string)=>{const payload=block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(!payload)return;if(payload==='[DONE]'){complete=true;return;}const value=JSON.parse(payload) as Chunk;if(value.error||value.type==='error')throw Error('AI 流返回错误');if(protocol==='anthropic'){
  if(value.type==='message_stop')complete=true;
  if(value.type==='content_block_start'){const b=value.content_block;if(b?.type==='tool_use'){const t=part(value.index??0);t.id=b.id??'';t.name=b.name??'';t.input=b.input;}if(b?.type==='text'&&b.text){text+=b.text;onText(b.text);}}
  if(value.type==='content_block_delta'){if(value.delta?.type==='text_delta'&&value.delta.text){text+=value.delta.text;onText(value.delta.text);}else if(value.delta?.type==='input_json_delta')part(value.index??0).arguments+=value.delta.partial_json??'';}
 }else{const choice=value.choices?.find(c=>(c.index??0)===0);if(choice?.finish_reason)complete=true;const delta=choice?.delta;if(typeof delta?.content==='string'){text+=delta.content;onText(delta.content);}for(const t of delta?.tool_calls??[]){const tool=part(t.index??0);tool.id+=t.id??'';tool.name+=t.function?.name??'';tool.arguments+=t.function?.arguments??'';}}
 };
 try{for(;;){const value=await reader.read();if(value.done)break;bytes+=value.value.length;if(bytes>2*1024*1024)throw Error('AI 流超过限制');buffer+=decoder.decode(value.value,{stream:true});let boundary;while((boundary=/\r?\n\r?\n/.exec(buffer))){consume(buffer.slice(0,boundary.index));buffer=buffer.slice(boundary.index+boundary[0].length);}}buffer+=decoder.decode();if(buffer.trim())consume(buffer);if(!complete)throw Error('AI 流未完成');return {text,tools:[...tools.values()].map(t=>({id:t.id,name:t.name,input:t.arguments?JSON.parse(t.arguments):t.input??{}}))};}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
