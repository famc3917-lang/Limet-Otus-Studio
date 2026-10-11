// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {DISPLAY_FACES} from './assistant-personality';
export const speechText=(text:string)=>DISPLAY_FACES.reduce((value,face)=>value.replaceAll(face,''),text).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').replace(/```[\s\S]*?```/g,'').replace(/https?:\/\/\S+/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*#`>|]/g,'').trim();
/** A bounded FIFO: one synthesis request, at most one prepared clip during playback. */
export class AutomaticSpeech {
 private queue:string[]=[];private running=false;private generation=0;private controller?:AbortController;private offset=0;private id='';
 constructor(private synthesize:(text:string,signal:AbortSignal)=>Promise<string>,private play:(audio:string,signal:AbortSignal)=>Promise<void>,private onError:(error:Error)=>void){}
 reset(id=''){this.generation++;this.controller?.abort();this.queue=[];this.running=false;this.offset=0;this.id=id;}
 skip(id:string,text:string){this.reset(id);this.offset=text.length;}
 feed(id:string,text:string,done:boolean){if(id!==this.id)this.reset(id);const rest=text.slice(this.offset);let count=0;for(const match of rest.matchAll(/[。！？!?\n]|\.(?=\s|$)/g)){const end=match.index!+match[0].length;this.append(rest.slice(count,end));count=end;}if(done&&count<rest.length){this.append(rest.slice(count));count=rest.length;}this.offset+=count;void this.drain();}
 private append(text:string){const clean=speechText(text);for(let i=0;i<clean.length;i+=180){if(this.queue.length>=64){this.onError(Error('语音内容较长，后续请查看文字。'));return;}this.queue.push(clean.slice(i,i+180));}}
 private async drain(){if(this.running||!this.queue.length)return;this.running=true;const generation=this.generation,controller=new AbortController();this.controller=controller;
  const next=async()=>{const text=this.queue.shift();if(!text)return;for(let attempt=0;;attempt++){try{return await this.synthesize(text,controller.signal);}catch(error){if(controller.signal.aborted)throw error;if(attempt>=15||![409,429].includes((error as {status?:number}).status??0))throw error;await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,2000);controller.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(Error('已取消'));},{once:true});});}}};
  try{let prepared=await next();while(prepared&&!controller.signal.aborted){const playing=this.play(prepared,controller.signal);const upcoming=next().then(value=>({value}),error=>({error}));await playing;const result=await upcoming;if('error' in result)throw result.error;prepared=result.value;}}catch(error){if(generation===this.generation&&!controller.signal.aborted){this.queue=[];this.onError(error as Error);}}finally{if(generation===this.generation){this.running=false;this.controller=undefined;if(this.queue.length)void this.drain();}}
 }
}
