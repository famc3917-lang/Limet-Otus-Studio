// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
/**
 * Lighting lab: place the studio's own lights around a subject, set modifiers, power and camera, and read what an
 * incident meter at the face would say before anyone moves a stand. Laid out like a pro inspector app: the light list
 * on the left, the viewport in the middle, the inspector and the meter on the right.
 */
import {StudioSelect} from '@/components/biz/select';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Armchair,Box,Camera as CameraIcon,Download,Eye,ImageDown,Lamp,Plus,RotateCcw,Save,Trash2,Upload,User} from 'lucide-react';
import {AppShell} from '@/components/biz/ui';
import {useStudio} from '@/lib/store';
import {useStudioLanguage,useStudioText} from '@/lib/i18n';
import {headDrop} from '@/lib/studio-gear';
import {RECIPE_GROUPS,RECIPES,buildRecipe,fromSheet,toSheet} from '@/lib/lighting-sheet';
import {headKindOf,HSS_EFFICIENCY,needsHSS,LIGHT_LIBRARY,MODIFIERS,meterReading,minStops,mixedColour,modifierById,type Camera,type LightSpec} from '@/lib/lighting';
import {forgetSubject,restoreSubject,saveSubject,subjectFiles} from '@/lib/subject-loader';
import type {Backdrop,CameraView,Histogram,LightingLab,Meter,Placement,PropKind,ViewMode} from '@/lib/lighting-lab';

/** Luminance and RGB histograms of the camera view, with the share of clipped pixels at either end. */
function HistogramPanel({data,t}:{data:Histogram;t:(zh:string,en:string)=>string}){
 const path=(bins:number[],top:number)=>{let d='M0,80';bins.forEach((v,i)=>{d+=` L${i},${80-Math.min(80,v/top*80)}`;});return d+' L255,80 Z';};
 const top=Math.max(1,...data.luma.slice(1,255),...data.r.slice(1,255),...data.g.slice(1,255),...data.b.slice(1,255));
 return <div className="lab-histograms">
  <figure><figcaption>{t('亮度直方图','Luminance histogram')}</figcaption><svg viewBox="0 0 256 80" preserveAspectRatio="none" role="img" aria-label={t('亮度直方图','Luminance histogram')}><path d={path(data.luma,top)} fill="currentColor" opacity=".75"/></svg></figure>
  <figure><figcaption>{t('RGB 直方图','RGB histogram')}</figcaption><svg viewBox="0 0 256 80" preserveAspectRatio="none" role="img" aria-label={t('RGB 直方图','RGB histogram')} className="lab-rgb"><path d={path(data.r,top)} fill="#ff453a"/><path d={path(data.g,top)} fill="#32d74b"/><path d={path(data.b,top)} fill="#0a84ff"/></svg></figure>
  <p className={data.clipHigh>.005||data.clipLow>.02?'lab-note lab-warn':'lab-note'}>{t(`画面高光占比 ${(data.clipHigh*100).toFixed(1)}% · 画面纯黑占比 ${(data.clipLow*100).toFixed(1)}%（按显示画面统计，不等于 RAW 溢出）`,`Display highlights ${(data.clipHigh*100).toFixed(1)}% · display black ${(data.clipLow*100).toFixed(1)}% (of the displayed image, not RAW clipping)`)}</p>
 </div>;
}
const metres=(m:number)=>Number.isFinite(m)?(m<10?m.toFixed(2):m.toFixed(1))+' m':'∞';

const SETUP_KEY='studio-lighting-setups',LAST_KEY='studio-lighting-last';
const ISOS=[50,64,80,100,125,160,200,320,400,640,800,1600,3200];
const APERTURES=[1.4,2,2.8,4,5.6,6.3,7.1,8,9,10,11,13,14,16,22];
const FOCALS=[35,50,85,105,135];
const SHUTTERS=[1/30,1/60,1/125,1/160,1/200,1/250,1/500,1/1000];
/* Classic starting positions around the subject: key 45° camera-left, fill camera-right, rim behind, then more. */
const SLOTS=[{x:-1.4,z:1.4,height:2.1},{x:1.8,z:1.6,height:1.7},{x:1.1,z:-1.4,height:2.2},{x:-1.2,z:-1.5,height:2.2},{x:0,z:2.2,height:2.6},{x:-2.3,z:.2,height:1.6}];
interface Setup { name:string; saved:string; backdrop:Backdrop; camera:Camera; lights:Placement[] }

const shutterLabel=(s:number)=>s>=1?`${s}s`:`1/${Math.round(1/s)}`;
function powerLabel(stops:number,kind:LightSpec['kind']){if(kind==='led')return `${Math.round(Math.pow(2,stops)*100)}%`;
 let base=Math.floor(stops+1e-9),tenths=Math.round((stops-base)*10);if(tenths===10){base++;tenths=0;}return (base===0?'1/1':`1/${Math.pow(2,-base)}`)+(tenths?` +0.${tenths}`:'');}

export default function LightingPage(){
 const t=useStudioText(),en=useStudioLanguage()==='en';const {data}=useStudio();
 const stage=useRef<HTMLDivElement>(null);const calib=useRef<{rel:Record<string,number>;rounds:number}|null>(null);const restored=useRef(false);const lab=useRef<LightingLab|null>(null);
 const [ready,setReady]=useState(false),[failed,setFailed]=useState('');
 const [lights,setLights]=useState<Placement[]>([]),[selected,setSelected]=useState<string|null>(null),[selectedProp,setSelectedProp]=useState<string|null>(null);
 const [backdrop,setBackdrop]=useState<Backdrop>('white'),[view,setView]=useState<ViewMode>('photo'),[angle,setAngle]=useState<CameraView>('overview'),[focal,setFocal]=useState(85),[camera,setCamera]=useState<Camera>({iso:100,aperture:8,shutter:1/125});
 const [meter,setMeter]=useState<Meter|null>(null),[setups,setSetups]=useState<Setup[]>([]),[model,setModel]=useState(''),[modelHeight,setModelHeight]=useState(0),[subjectBusy,setSubjectBusy]=useState(false),[yaw,setYaw]=useState(0),[notes,setNotes]=useState<string[]>([]),[recipe,setRecipe]=useState('');
 /* lights come from the equipment register; the library stands in when the register has none with specs */
 const owned=useMemo(()=>data.equipments.filter(e=>e.category==='灯光'&&e.light).map(e=>({id:e.id,name:`${e.code} · ${e.name}`,spec:e.light as LightSpec,owned:true})),[data.equipments]);
 const library=useMemo(()=>LIGHT_LIBRARY.map(p=>{const {id,brand:_b,model:_m,source:_s,verified:_v,note:_n,head:_h,...spec}=p;return {id:'lib-'+id,name:`${p.brand} ${p.model}`,spec:{...spec,preset:id} as LightSpec,owned:false};}),[]);
 const sources=owned.length?owned:library;
 useEffect(()=>{let alive=true;let made:LightingLab|null=null;
  /* each mount owns its canvas, so a disposed renderer never shares a WebGL context with the live one */
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',t('布光场景','Lighting set'));stage.current!.prepend(canvas);
  import('@/lib/lighting-lab').then(m=>m.createLightingLab(canvas,{onSelect:(id,kind)=>{if(kind==='light'){setSelected(id);setSelectedProp(null);}else if(kind==='prop'){setSelectedProp(id);setSelected(null);}else setSelectedProp(null);},
   onMove:(id,x,z)=>setLights(ls=>ls.map(l=>l.id===id?{...l,x,z}:l)),onPatch:(id,p)=>setLights(ls=>ls.map(l=>l.id===id?{...l,...p}:l)),onMeter:setMeter,onFocus:m=>setFocusAt(m)})).then(l=>{if(!alive){l.destroy();return;}made=l;lab.current=l;if(process.env.NODE_ENV!=='production')(window as unknown as {__lab?:LightingLab}).__lab=l;setReady(true);})
   .catch(e=>setFailed(String(e?.message||e)));
  if(!restored.current){restored.current=true;try{setSetups(JSON.parse(localStorage.getItem(SETUP_KEY)||'[]'));const last=JSON.parse(localStorage.getItem(LAST_KEY)||'null') as Setup|null;if(last){setLights(last.lights);setBackdrop(last.backdrop);setCamera(last.camera);}}catch{}}
  return ()=>{alive=false;made?.destroy();lab.current=null;setReady(false);canvas.remove();};},[]);
 useEffect(()=>{if(ready)lab.current?.setLights(lights);},[ready,lights]);
 useEffect(()=>{if(ready)lab.current?.setSubjectYaw(yaw);},[ready,yaw]);
 /** Loads a subject from files; a folder the studio picked is kept in this browser for next time. */
 const useFiles=async(files:File[],keep:boolean)=>{if(!files.length||!lab.current)return;setSubjectBusy(true);
  try{const {loadSubjectFolder}=await import('@/lib/subject-loader');const s=await loadSubjectFolder(files);lab.current?.setSubject(s);setModel(s.name);setModelHeight(s.height);if(keep)await saveSubject(files);}
  catch(e){setFailed(t('无法读取这个模型：','This model could not be read: ')+String((e as Error)?.message||e));}finally{setSubjectBusy(false);}};
 /* the subject: a folder the studio imported earlier, otherwise the mannequin */
 useEffect(()=>{if(!ready)return;let off=false;void (async()=>{const kept=await restoreSubject();if(!off&&kept)await useFiles(kept,false);})();return ()=>{off=true;};},[ready]);
 /* remember the working set, but only after the saved one has been read back */
 const persisted=useRef(false);useEffect(()=>{if(!persisted.current){persisted.current=true;return;}try{localStorage.setItem(LAST_KEY,JSON.stringify({name:'',saved:'',backdrop,camera,lights}));}catch{}},[lights,backdrop,camera]);
 useEffect(()=>{if(ready)lab.current?.setBackdrop(backdrop);},[ready,backdrop]);
 useEffect(()=>{if(ready)lab.current?.setCamera(camera);},[ready,camera]);
 useEffect(()=>{if(ready)lab.current?.setView(view);},[ready,view]);
 useEffect(()=>{if(ready)lab.current?.setFocal(focal);},[ready,focal]);
 useEffect(()=>{if(ready)lab.current?.setCameraView(angle);},[ready,angle]);
 const [dof,setDof]=useState(true),[focusAt,setFocusAt]=useState(0),[hist,setHist]=useState<Histogram|null>(null),[focusInfo,setFocusInfo]=useState<{focus:number;near:number;far:number;hyperfocal:number;min:number}|null>(null);
 useEffect(()=>{if(ready)lab.current?.setDepthOfField(dof);},[ready,dof]);
 useEffect(()=>{if(ready)lab.current?.setFocus(focusAt);},[ready,focusAt]);
 /* histograms and depth of field follow every change once the view has settled */
 useEffect(()=>{if(!ready||angle!=='camera')return;const id=window.setTimeout(()=>{const l=lab.current;if(!l)return;setHist(l.histogram());setFocusInfo(l.focusInfo());},280);return ()=>clearTimeout(id);},[ready,angle,meter,view,dof,focusAt,focal,camera,backdrop,lights]);
 useEffect(()=>{if(ready)lab.current?.select(selected??selectedProp);},[ready,selected,selectedProp]);
 const add=(src:{id:string;name:string;spec:LightSpec;owned:boolean})=>{const id=src.owned?src.id:`${src.id}-${Date.now().toString(36)}`;
  setLights(ls=>ls.some(l=>l.id===id)?ls:[...ls,{id,name:src.name,spec:src.spec,modifier:'softbox-6090',loss:modifierById('softbox-6090').loss,stops:src.spec.kind==='strobe'?-3:-1,on:true,aimUp:0,aimSide:0,cct:src.spec.cct,...SLOTS[ls.length%SLOTS.length]}]);setSelected(id);};
 const patch=(id:string,p:Partial<Placement>)=>setLights(ls=>ls.map(l=>l.id===id?{...l,...p}:l));
 const cur=lights.find(l=>l.id===selected);
 const saveSetup=()=>{const name=window.prompt(t('布光方案名称','Name this setup'),t('人像 · ','Portrait · ')+new Date().toLocaleDateString());if(!name)return;
  const next=[{name,saved:new Date().toISOString(),backdrop,camera,lights},...setups.filter(s=>s.name!==name)].slice(0,30);setSetups(next);try{localStorage.setItem(SETUP_KEY,JSON.stringify(next));}catch{}};
 const loadSetup=(s:Setup)=>{setLights(s.lights);setBackdrop(s.backdrop);setCamera(s.camera);setSelected(null);};
 /* after a recipe is laid out, correct each output from the meter so the key reads the camera aperture exactly */
 useEffect(()=>{const c=calib.current;if(!c||!meter||!c.rounds)return;c.rounds--;const target=meter.target;let moved=false;
  const next=lights.map(l=>{const part=meter.parts.find(p=>p.id===l.id),rel=c.rel[l.id];if(!part||rel===undefined||part.h<=0)return l;
   const want=target*Math.pow(2,rel),adj=Math.log2(want/part.h);if(Math.abs(adj)<.05)return l;moved=true;return {...l,stops:Math.max(minStops(l.spec),Math.min(0,Math.round((l.stops+adj)*10)/10))};});
  if(moved)setLights(next);else calib.current=null;
  const pinned=next.filter(l=>l.stops<=minStops(l.spec)+1e-6&&c.rel[l.id]!==undefined&&(meter.parts.find(p=>p.id===l.id)?.h??0)>target*Math.pow(2,c.rel[l.id])*1.2);
  if(!c.rounds&&pinned.length)setNotes(n=>[...n.filter(x=>!x.startsWith('⚠')),'⚠ '+pinned.map(l=>l.name).join('、')+t(' 已是最低输出仍过曝：收小光圈、降低 ISO 或把灯拉远',' are at minimum output and still too bright: stop down, lower ISO or move them back')]);},[meter]);
 const faceY=modelHeight?modelHeight*.935:1.6;
 /** Lays out a recipe with the studio's own lights and solves each output for the camera settings. */
 const applyRecipe=(id:string)=>{const r=RECIPES.find(x=>x.id===id);if(!r)return;const pool=owned.length?owned:library;
  const built=buildRecipe(r,pool,camera,faceY);setRecipe(id);setNotes([r.hint,...built.warnings]);calib.current={rel:Object.fromEntries(built.lights.map((l,i)=>[l.id,r.roles[i].rel])),rounds:2};setLights(built.lights);if(built.backdrop)setBackdrop(built.backdrop);setSelected(built.lights[0]?.id??null);};
 const download=(name:string,body:string,type:string)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
 const exportSheet=()=>{const name=RECIPES.find(r=>r.id===recipe)?.zh??t('布光方案','Lighting setup');
  download(`观隅布光单-${name}.txt`,'\ufeff'+toSheet({name,backdrop,camera,focal,subject:model?{name:model,height:modelHeight,yaw}:undefined,lights,meter}),'text/plain;charset=utf-8');};
 const importSheet=async(f:File)=>{try{const d=fromSheet(await f.text(),(name,preset)=>[...owned,...library].find(s=>s.name===name||(preset&&s.spec.preset===preset))?.spec);
   setLights(d.lights);setBackdrop(d.backdrop);setCamera(d.camera);setFocal(d.focal);setNotes([t(`已载入布光单：${d.name}`,`Loaded sheet: ${d.name}`)]);}catch(e){setNotes([String((e as Error).message||e)]);}};
 const parts=meter?.parts??[];const sorted=[...parts].sort((a,b)=>b.h-a.h);const ratio=sorted.length>1&&sorted[1].h>0?sorted[0].h/sorted[1].h:null;
 const colour=mixedColour(parts),cct=colour?Math.round(colour.cct/50)*50:null,minCri=parts.reduce<number|undefined>((m,p)=>p.cri===undefined?m:Math.min(m??100,p.cri),undefined);const read=meterReading(meter?.aperture??0);
 const delta=meter&&Number.isFinite(meter.deltaStops)?meter.deltaStops:null;
 const verdict=delta===null?t('没有光照到脸上','No light reaches the face'):Math.abs(delta)<=.3?t('曝光准确','Exposure on target'):delta>0?t(`过曝 ${delta.toFixed(1)} 档`,`${delta.toFixed(1)} stops over`):t(`欠曝 ${(-delta).toFixed(1)} 档`,`${(-delta).toFixed(1)} stops under`);
 const nameOf=(id:string)=>lights.find(l=>l.id===id)?.name??id;
 return <AppShell><div className="lab">
  <header className="lab-bar">
   <div><h1>{t('灯光测试','Lighting lab')}<span className="lab-experimental" title={t('实验性功能：计算模型仍在完善，读数仅供布光参考，请以测光表实测为准。','Experimental: the model is still being refined. Readings are a guide for setting up; confirm with a light meter.')}>{t('Experimental · 实验性功能','Experimental')}</span></h1><p>{t('按台账中的灯具与机位估算脸部的入射读数','Estimates the incident reading at the face from your own lights and positions')}</p></div>
   <div className="lab-bar-tools">
    <div className="segmented" role="tablist" aria-label={t('背景','Backdrop')}>{(['white','grey','black'] as Backdrop[]).map(b=><button key={b} type="button" role="tab" aria-selected={backdrop===b} className={backdrop===b?'on':''} onClick={()=>setBackdrop(b)}>{b==='white'?t('白棚','White'):b==='grey'?t('灰背景','Grey'):t('黑棚','Black')}</button>)}</div>
    <div className="segmented" role="tablist" aria-label={t('视图','View')}>{(['photo','false','zebra','clip'] as ViewMode[]).map(v=><button key={v} type="button" role="tab" aria-selected={view===v} className={view===v?'on':''} onClick={()=>setView(v)} title={v==='zebra'?t('斜条纹：高于中灰 2–2.5 档，接近过曝；红色：已过曝','Stripes: 2 to 2.5 stops over mid-grey, close to clipping; red: clipped'):v==='clip'?t('红色：高光溢出（≥ +2.5 档）；蓝色：暗部死黑（≤ −5 档）','Red: clipped highlights (≥ +2.5 stops); blue: crushed shadows (≤ −5 stops)'):undefined}>{v==='photo'?t('成片','Photo'):v==='false'?t('伪色','False colour'):v==='zebra'?t('斑马纹','Zebra'):t('溢出','Clipping')}</button>)}</div>
    <div className="segmented" role="tablist" aria-label={t('视角','Angle')}>{(['overview','camera'] as CameraView[]).map(v=><button key={v} type="button" role="tab" aria-selected={angle===v} className={angle===v?'on':''} onClick={()=>setAngle(v)}>{v==='overview'?t('全景','Overview'):t('机位','Camera')}</button>)}</div>
    <button type="button" className="lab-icon" title={t('重置视角','Reset the view')} onClick={()=>lab.current?.setCameraView(angle)}><RotateCcw size={16}/></button>
   </div>
  </header>
  <aside className="lab-side">
   <section className="lab-group"><h2>{t('想要的光','The look you want')}</h2>
    {RECIPE_GROUPS.map(g=><div key={g.id} className="lab-recipe-group"><span>{en?g.en:g.zh}</span><div className="lab-chips">{RECIPES.filter(r=>r.group===g.id).map(r=><button key={r.id} type="button" className={recipe===r.id?'on':''} title={r.hint} onClick={()=>applyRecipe(r.id)}>{en?r.en:r.zh}<small>{r.roles.length}</small></button>)}</div></div>)}
    {notes.length>0&&<ul className="lab-notes">{notes.map((n,i)=><li key={i}>{n}</li>)}</ul>}
    <p className="lab-note">{t('从台账里挑灯，按相机光圈算好每盏灯的输出，摆好后可再拖动微调。','Picks from your register and solves each output for the camera aperture; drag to fine-tune.')}</p>
   </section>
   <section className="lab-group"><h2>{t('场景中的灯','Lights in the set')}</h2>
    {lights.length?<ul className="lab-list">{lights.map(l=><li key={l.id}><button type="button" className={selected===l.id?'on':''} onClick={()=>{setSelected(l.id);setSelectedProp(null);}}>
     <span className="lab-dot" style={{opacity:l.on?1:.25}}/><span><strong>{l.name}</strong><small>{en?modifierById(l.modifier).en:modifierById(l.modifier).zh} · {powerLabel(l.stops,l.spec.kind)}</small></span>
     {meter&&<em>{Math.round((parts.find(p=>p.id===l.id)?.share??0)*100)}%</em>}</button></li>)}</ul>:<p className="lab-empty">{t('从下面加入一盏灯开始布光。','Add a light below to start.')}</p>}
   </section>
   <section className="lab-group"><h2>{t('台账灯具','From the register')}</h2>
    {!owned.length&&<p className="lab-empty">{t('还没有可用的灯。到“业务配置 → 设备台账”添加类别为“灯光”的设备，并填写闪光指数或 1 米照度等参数后，就能在这里布光。','No lights yet. In Business settings → Equipment, add items in the Lighting category with their guide number or illuminance at 1 m, then place them here.')}</p>}
    <ul className="lab-list">{sources.map(s=>{const used=s.owned&&lights.some(l=>l.id===s.id);return <li key={s.id}><button type="button" disabled={used} onClick={()=>add(s)}>
     <Lamp size={15} strokeWidth={1.6}/><span><strong>{s.name}</strong><small>{s.spec.kind==='strobe'?`${s.spec.ws??'—'} Ws · GN ${s.spec.gn??'—'}`:`${s.spec.watts??'—'} W · ${s.spec.lux1m?.toLocaleString()??'—'} lx`}</small></span>{used?<em>{t('已放置','Placed')}</em>:<Plus size={15}/>}</button></li>;})}</ul>
   </section>
   <section className="lab-group"><h2>{t('道具','Props')}</h2>
    <div className="lab-chips">{([['chair',t('椅子','Chair'),Armchair],['stool',t('高脚凳','Stool'),Armchair],['ladder',t('梯子','Ladder'),Box],['applebox',t('苹果箱','Apple box'),Box],['reflector',t('反光板','Reflector'),Box]] as [PropKind,string,typeof Box][]).map(([k,label,Icon])=><button key={k} type="button" disabled={!ready} onClick={()=>lab.current?.addProp(k)}><Icon size={14}/>{label}</button>)}</div>
    {selectedProp&&<button type="button" className="lab-danger" onClick={()=>{lab.current?.removeSelectedProp(selectedProp);setSelectedProp(null);}}><Trash2 size={14}/>{t('移除选中的道具','Remove the selected prop')}</button>}
    <p className="lab-note">{t('拖动灯架或道具即可移动，它们有真实体积，会相互推开。','Drag stands and props to move them. They have real volume and push each other aside.')}</p>
   </section>
   <section className="lab-group"><h2>{t('人物','Subject')}</h2>
    <div className="lab-chips">
     <label className="lab-file"><Upload size={14}/>{t('导入人物文件夹','Import a subject folder')}<input type="file" multiple {...{webkitdirectory:''}} onChange={e=>{const fs=subjectFiles([...(e.target.files??[])]);e.target.value='';void useFiles(fs,true);}}/></label>
     <button type="button" onClick={()=>{lab.current?.useMannequin();setModel('');void forgetSubject();}}><User size={14}/>{t('人台','Mannequin')}</button></div>
    <p className="lab-note">{subjectBusy?t('正在载入人物和贴图…','Loading the subject and its textures…'):model?`${model} · ${modelHeight.toFixed(2)} m`:t('支持 GLB/glTF，或 FBX 加贴图与 Marmoset 材质。','GLB/glTF, or FBX with textures and Marmoset materials.')}</p>
    <div className="lab-slider"><label>{t('人物朝向','Subject facing')}<b>{yaw}°</b></label><input type="range" min={-180} max={180} step={5} value={yaw} onChange={e=>setYaw(Number(e.target.value))}/></div>
   </section>
   <section className="lab-group"><h2>{t('方案','Setups')}</h2>
    <div className="lab-chips"><button type="button" onClick={saveSetup} disabled={!lights.length}><Save size={14}/>{t('保存','Save')}</button><button type="button" onClick={exportSheet} disabled={!lights.length}><Download size={14}/>{t('导出布光单','Export lighting sheet')}</button>
     <label className="lab-file"><Upload size={14}/>{t('导入布光单','Import a sheet')}<input type="file" accept=".txt,text/plain" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void importSheet(f);}}/></label><button type="button" disabled={!ready} onClick={()=>{const url=lab.current?.snapshot();if(!url)return;const a=document.createElement('a');a.href=url;a.download='lighting-setup.png';a.click();}}><ImageDown size={14}/>{t('导出图片','Export image')}</button></div>
    {setups.length>0&&<ul className="lab-list">{setups.map(s=><li key={s.name}><button type="button" onClick={()=>loadSetup(s)}><span><strong>{s.name}</strong><small>{s.lights.length} {t('盏灯','lights')} · ISO {s.camera.iso} · f/{s.camera.aperture}</small></span></button></li>)}</ul>}
   </section>
  </aside>
  <div className="lab-stage" ref={stage}>
   {!ready&&!failed&&<div className="lab-overlay">{t('正在准备影棚…','Setting up the studio…')}</div>}
   {failed&&<div className="lab-overlay">{t('影棚无法启动：','The studio could not start: ')}{failed}</div>}
   {view==='false'&&<div className="lab-legend">{[['#401a73','−3'],['#1a33bf','−2'],['#268ce6','−1'],['#738c99','−½'],['#33c759','0'],['#d9d9bf','+½'],['#ffbf33','+1'],['#ff7326','+2'],['#ff1f1f','+2½']].map(([c,l])=><span key={l}><i style={{background:c}}/>{l}</span>)}</div>}
  </div>
  <aside className="lab-inspector">
   <section className="lab-meter" aria-live="polite">
    <div className="lab-meter-head"><span>{t('脸部入射读数','Incident at the face')}</span><span>ISO {camera.iso} · {shutterLabel(camera.shutter)}</span></div>
    <div className="lab-meter-read"><b>{read.stop}</b>{read.tenths>0&&<sup>{read.tenths}</sup>}</div>
    <p className={`lab-verdict ${delta===null?'':Math.abs(delta)<=.3?'ok':delta>0?'over':'under'}`}>{verdict}{delta!==null&&<> · {t('相机','camera')} f/{camera.aperture}</>}</p>
    <dl>
     <div><dt>{t('棚内反射','Studio bounce')}</dt><dd>{meter&&meter.total>0?`${Math.round(meter.bounce/meter.total*100)}%`:'—'}</dd></div>
     <div><dt>{t('光比','Lighting ratio')}</dt><dd>{ratio?`${ratio.toFixed(1)} : 1 (${Math.log2(ratio).toFixed(1)} ${t('档','stops')})`:'—'}</dd></div>
     <div><dt>{t('混合色温','Mixed colour temperature')}</dt><dd>{cct&&colour?`${cct} K · Duv ${Math.abs(colour.duv)<5e-5?'0.0000':(colour.duv>0?'+':'')+colour.duv.toFixed(4)}`:'—'}</dd></div>
     <div><dt>{t('最低显色指数','Lowest CRI')}</dt><dd>{minCri===undefined?t('未填','Not entered'):`${minCri}${minCri<90?t(' · 肤色可能偏色',' · skin may shift'):''}`}</dd></div>
    </dl>
    {sorted.length>0&&<ul className="lab-share">{sorted.map(p=><li key={p.id}><span>{nameOf(p.id)}</span><i style={{width:`${Math.max(2,p.share*100)}%`}}/><em>f/{p.aperture.toFixed(1)}{p.visible<1&&` · ${t('遮挡','blocked')} ${Math.round((1-p.visible)*100)}%`}</em></li>)}</ul>}
   </section>
   <section className="lab-group"><h2><CameraIcon size={14}/>{t('相机','Camera')}</h2>
    <div className="lab-row"><label>{t('焦距（机位视角）','Focal length (camera view)')}</label><StudioSelect value={focal} onChange={e=>{setFocal(Number(e.target.value));setAngle('camera');}}>{FOCALS.map(v=><option key={v} value={v}>{v} mm</option>)}</StudioSelect></div>
    <div className="lab-row"><label>ISO</label><StudioSelect value={camera.iso} onChange={e=>setCamera(c=>({...c,iso:Number(e.target.value)}))}>{ISOS.map(v=><option key={v} value={v}>{v}</option>)}</StudioSelect></div>
    <div className="lab-row"><label>{t('光圈','Aperture')}</label><StudioSelect value={camera.aperture} onChange={e=>setCamera(c=>({...c,aperture:Number(e.target.value)}))}>{APERTURES.map(v=><option key={v} value={v}>f/{v}</option>)}</StudioSelect></div>
    <div className="lab-row"><label>{t('快门','Shutter')}</label><StudioSelect value={camera.shutter} onChange={e=>setCamera(c=>({...c,shutter:Number(e.target.value)}))}>{SHUTTERS.map(v=><option key={v} value={v}>{shutterLabel(v)}</option>)}</StudioSelect></div>
    {needsHSS(camera)&&lights.some(l=>l.on&&l.spec.kind==='strobe')&&<p className="lab-note lab-warn">{t(`快门 ${shutterLabel(camera.shutter)} 快于闪光同步 1/250：需开启高速同步，闪光有效出力按快门折算（比 1/250 时少 ${Math.log2(1/250/camera.shutter/HSS_EFFICIENCY).toFixed(1)} 档）。`,`${shutterLabel(camera.shutter)} is faster than the 1/250 flash sync: use high-speed sync; flash output falls with the shutter (${Math.log2(1/250/camera.shutter/HSS_EFFICIENCY).toFixed(1)} stops less than at 1/250).`)}</p>}
    {meter&&meter.total>0&&<button type="button" className="lab-link" onClick={()=>{const n=APERTURES.reduce((a,b)=>Math.abs(Math.log2(b/meter.aperture))<Math.abs(Math.log2(a/meter.aperture))?b:a);setCamera(c=>({...c,aperture:n}));}}><Eye size={14}/>{t('按读数设置光圈','Set the aperture from the reading')}</button>}
   </section>
   <section className="lab-group"><h2><Eye size={14}/>{t('对焦与直方图（机位视角）','Focus and histograms (camera view)')}</h2>
    {angle!=='camera'?<button type="button" className="lab-link" onClick={()=>setAngle('camera')}><CameraIcon size={14}/>{t('切换到机位视角查看虚化和直方图','Switch to the camera view for depth of field and histograms')}</button>:<>
    <label className="lab-check"><input type="checkbox" checked={dof} onChange={e=>setDof(e.target.checked)}/>{t('景深虚化（按焦距、光圈、对焦距离计算）','Depth of field (from focal length, aperture and focus distance)')}</label>
    <div className="lab-row"><label>{t('对焦距离','Focus distance')}</label><input type="range" min={Math.log10(focusInfo?.min??.25)} max={1.5} step={.01} aria-label={t('对焦距离','Focus distance')} value={Number.isFinite(focusAt)&&focusAt>0?Math.log10(focusAt):Number.isFinite(focusAt)?Math.log10(focusInfo?.focus??2):1.5} onChange={e=>setFocusAt(Math.pow(10,Number(e.target.value)))}/><span className="lab-value">{metres(focusInfo?.focus??focusAt)}</span></div>
    <div className="lab-buttons"><button type="button" className={focusAt===0?'on':''} onClick={()=>setFocusAt(0)}>{t('对焦脸部','Focus on the face')}</button><button type="button" className={focusAt===Infinity?'on':''} onClick={()=>setFocusAt(Infinity)}>{t('无限远 ∞','Infinity ∞')}</button></div>
    {focusInfo&&<p className="lab-note">{t(`清晰范围 ${metres(focusInfo.near)} – ${metres(focusInfo.far)} · 超焦距 ${metres(focusInfo.hyperfocal)}（弥散圆 0.03 mm）。双击画面可对焦到该处。`,`Sharp from ${metres(focusInfo.near)} to ${metres(focusInfo.far)} · hyperfocal ${metres(focusInfo.hyperfocal)} (0.03 mm circle of confusion). Double-click the view to focus there.`)}</p>}
    {hist&&<HistogramPanel data={hist} t={t}/>}</>}
   </section>
   {cur?<section className="lab-group"><h2><Lamp size={14}/>{cur.name}</h2>
    <div className="lab-row"><label>{t('开启','On')}</label><input type="checkbox" className="lab-switch" checked={cur.on} onChange={e=>patch(cur.id,{on:e.target.checked})}/></div>
    <div className="lab-row"><label>{t('附件','Modifier')}</label><StudioSelect value={cur.modifier} onChange={e=>patch(cur.id,{modifier:e.target.value,loss:modifierById(e.target.value).loss})}>{MODIFIERS.map(m=><option key={m.id} value={m.id}>{en?m.en:m.zh}</option>)}</StudioSelect></div>
    <div className="lab-row"><label>{t('附件损失','Modifier loss')}</label><input type="number" step={.1} min={0} max={6} value={cur.loss} onChange={e=>patch(cur.id,{loss:Math.max(0,Math.min(6,Number(e.target.value)||0))})}/><span className="lab-unit">{t('档','stops')}</span></div>
    <div className="lab-slider"><label>{cur.spec.kind==='strobe'?t('输出','Output'):t('亮度','Dimmer')}<b>{powerLabel(cur.stops,cur.spec.kind)}</b></label><input type="range" min={minStops(cur.spec)} max={0} step={.1} value={cur.stops} onChange={e=>patch(cur.id,{stops:Number(e.target.value)})}/></div>
    {(()=>{const drop=headDrop(headKindOf(cur.spec),cur.spec.kind==='led'),top=Math.round((cur.height-drop)*100);return <div className="lab-slider"><label>{t('灯架高度','Stand height')}<b>{top} cm · {t('灯头','head')} {Math.round(cur.height*100)} cm</b></label>
     <input type="range" min={5} max={300} step={1} value={top} onChange={e=>patch(cur.id,{height:Number(e.target.value)/100+drop})}/></div>;})()}
    <div className="lab-slider"><label>{t('俯仰偏移','Tilt offset')}<b>{cur.aimUp}°</b></label><input type="range" min={-40} max={40} step={1} value={cur.aimUp} onChange={e=>patch(cur.id,{aimUp:Number(e.target.value)})}/></div>
    <div className="lab-slider"><label>{t('羽化（水平偏移）','Feather (pan offset)')}<b>{cur.aimSide}°</b></label><input type="range" min={-180} max={180} step={1} value={cur.aimSide} onChange={e=>patch(cur.id,{aimSide:Number(e.target.value)})}/></div>
    {cur.spec.cctMin&&cur.spec.cctMax?<div className="lab-slider"><label>{t('色温','Colour temperature')}<b>{cur.cct??cur.spec.cct} K</b></label><input type="range" min={cur.spec.cctMin} max={cur.spec.cctMax} step={50} value={cur.cct??cur.spec.cct??5600} onChange={e=>patch(cur.id,{cct:Number(e.target.value)})}/></div>
     :<div className="lab-row"><label>{t('色温','Colour temperature')}</label><span className="lab-value">{cur.spec.cct??5600} K</span></div>}
    <p className="lab-note">{t('距脸部','To the face')} {(()=>{const dx=cur.x,dz=cur.z-.11,dy=cur.height-1.6;return Math.sqrt(dx*dx+dy*dy+dz*dz).toFixed(2);})()} m{cur.spec.kind==='strobe'&&!cur.spec.gn?t(' · GN 按能量估算',' · GN estimated from energy'):''}</p>
    <button type="button" className="lab-danger" onClick={()=>{setLights(ls=>ls.filter(l=>l.id!==cur.id));setSelected(null);}}><Trash2 size={14}/>{t('从场景移除','Remove from the set')}</button>
   </section>:<section className="lab-group"><p className="lab-empty">{t('选择一盏灯来调整附件、输出和位置。','Select a light to adjust its modifier, output and position.')}</p></section>}
   <p className="lab-footnote">{t('读数按 ISO 100 闪光指数、附件损失与平方反比估算，并对柔光面做遮挡采样；实际以测光表为准。','Readings are estimated from ISO 100 guide numbers, modifier losses and the inverse-square law, with occlusion sampled across soft faces. Confirm with a meter.')}</p>
  </aside>
 </div></AppShell>;
}
