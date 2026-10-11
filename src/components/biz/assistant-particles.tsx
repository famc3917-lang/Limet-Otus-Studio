// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useEffect,useRef} from 'react';
import policy from '../../../tts/RESOURCE-POLICY.json';
export function AssistantParticles({active,busy}:{active:boolean;busy:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const surface=canvas.current,context=surface?.getContext('2d');if(!surface||!context||!active)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let frame=0,last=0,time=0;
  const draw=(now:number)=>{
   frame=requestAnimationFrame(draw);if(now-last<1000/policy.particleFramesPerSecond)return;
   const dt=Math.min(80,now-last||33);last=now;time+=dt/1000;
   const width=surface.clientWidth,height=surface.clientHeight,dpr=Math.min(devicePixelRatio,1.5);
   if(surface.width!==Math.round(width*dpr)||surface.height!==Math.round(height*dpr)){surface.width=Math.round(width*dpr);surface.height=Math.round(height*dpr);}
   context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);
   for(let i=0;i<policy.particleCount;i++){
    const p=(i/policy.particleCount+time*(busy?.19:.055))%1,x=p*width,y=height/2+Math.sin(p*Math.PI*4+i*2.399963)*height*.22,alpha=Math.sin(p*Math.PI)*.55;
    context.fillStyle=`rgba(88,208,158,${alpha})`;context.beginPath();context.arc(x,y,1+(i%3)*.55,0,Math.PI*2);context.fill();
    context.strokeStyle=`rgba(88,208,158,${alpha*.3})`;context.beginPath();context.moveTo(x-4-(busy?10:0),y);context.lineTo(x,y);context.stroke();
   }
  };
  const sync=()=>{cancelAnimationFrame(frame);context.clearRect(0,0,surface.width,surface.height);last=0;if(!document.hidden&&!reduced.matches&&document.documentElement.dataset.reduceMotion!=='true')frame=requestAnimationFrame(draw);};
  const observer=new MutationObserver(sync);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-reduce-motion']});
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);sync();
  return ()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync);};
 },[active,busy]);
 return <canvas ref={canvas} className="assistant-particle-field" aria-hidden="true"/>;
}
