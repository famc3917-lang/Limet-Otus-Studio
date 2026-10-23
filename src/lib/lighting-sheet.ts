// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/**
 * Lighting sheets and lighting recipes.
 *
 * A lighting sheet (观隅布光单) is a plain-text file meant to be read on set: one block per light saying where its
 * stand goes relative to the subject, how high the stand and head are, where it points, which modifier, what output
 * and what the meter should read. The same file loads back into the lab.
 *
 * Conventions written into every sheet:
 *  · The subject stands on the mark facing the camera. Azimuth 0° is the camera side; positive is camera-left
 *    (the subject's right), negative camera-right; 180° is directly behind the subject.
 *  · Distance is measured on the floor from the subject's mark to the stand's centre column.
 *  · Stand height is to the top of the spigot; head height is to the centre of the light.
 *  · Tilt is the head's angle below (−) or above (+) level; pan offset is how far it is turned off the face.
 */
import {headKindOf,MODIFIERS,meterReading,mixedCCT,modifierById,targetExposure,axisEnergy,type Camera,type LightSpec} from './lighting';
import {headDrop} from './studio-gear';
import type {Backdrop,Meter,Placement} from './lighting-lab';

export const FACE_Y=1.6;
export interface SheetData { name:string; backdrop:Backdrop; camera:Camera; focal:number; subject?:{name:string;height:number;yaw:number}; lights:(Placement&{role?:string})[]; meter?:Meter|null }

const BACKDROP_ZH:Record<Backdrop,string>={white:'白棚',grey:'灰背景',black:'黑棚'};
const shutterText=(s:number)=>s>=1?`${s} s`:`1/${Math.round(1/s)} s`;
export function powerText(stops:number,kind:LightSpec['kind']){if(kind==='led')return `${Math.round(Math.pow(2,stops)*100)}%`;
 let base=Math.floor(stops+1e-9),tenths=Math.round((stops-base)*10);if(tenths===10){base++;tenths=0;}return (base===0?'1/1':`1/${Math.pow(2,-base)}`)+(tenths?` +0.${tenths}`:'');}
const deg=(r:number)=>Math.round(r*180/Math.PI);
/** Azimuth, floor distance and tilt of a placement, as a crew would measure them. */
export function where(l:Placement,faceY=FACE_Y){const az=Math.atan2(-l.x,l.z),dist=Math.hypot(l.x,l.z),tilt=Math.atan2(faceY-l.height,Math.max(.05,dist))+l.aimUp*Math.PI/180;return {az:deg(az),dist,tilt:deg(tilt)};}
const side=(a:number)=>a===0?'正对相机方向 0°':Math.abs(a)===180?'人物正后方 180°':a>0?`相机左 ${a}°`:`相机右 ${-a}°`;

export function toSheet(d:SheetData){const L:string[]=[];const m=d.meter;const date=new Date().toLocaleString('zh-CN',{hour12:false});
 L.push('观隅布光单 v1','='.repeat(28),`名称：${d.name||'未命名方案'}`,`导出：${date}`,`背景：${BACKDROP_ZH[d.backdrop]}`,
  `相机：ISO ${d.camera.iso} · f/${d.camera.aperture} · ${shutterText(d.camera.shutter)} · 焦距 ${d.focal} mm · 机位距人物 5.2 m、高 1.45 m`);
 if(d.subject)L.push(`人物：${d.subject.name} · 身高 ${d.subject.height.toFixed(2)} m · 朝向 ${d.subject.yaw}°`);
 if(m&&m.total>0){const r=meterReading(m.aperture);const parts=[...m.parts].sort((a,b)=>b.h-a.h);const ratio=parts.length>1&&parts[1].h>0?parts[0].h/parts[1].h:null;
  L.push(`测光：脸部入射 ${r.stop}${r.tenths?` +0.${r.tenths}`:''}（相对相机 ${m.deltaStops>=0?'+':''}${m.deltaStops.toFixed(1)} 档）`+(ratio?` · 光比 ${ratio.toFixed(1)}:1`:'')+(mixedCCT(m.parts)?` · 混合色温 ${mixedCCT(m.parts)} K`:'')+` · 棚内反射 ${Math.round(m.bounce/m.total*100)}%`);}
 L.push('','约定：方位 0° 为相机方向，正值为相机左（人物右手边），负值为相机右；距离为地面上人物站位到灯架中柱；','　　　灯架高度量到灯座顶端，灯头高度量到灯头中心；俯仰负值为向下。','');
 d.lights.forEach((l,i)=>{const w=where(l),mod=modifierById(l.modifier),drop=headDrop(headKindOf(l.spec),l.spec.kind==='led'),part=m?.parts.find(p=>p.id===l.id);
  L.push(`[灯 ${i+1}]${l.role?' '+l.role:''}`,`灯具：${l.name}`,`类型：${l.spec.kind==='strobe'?`闪光灯 ${l.spec.ws??'—'} Ws · GN ${l.spec.gn??'估算'}`:`常亮灯 ${l.spec.watts??'—'} W · ${l.spec.lux1m??'—'} lx@1m`}`,
   `附件：${mod.zh}（损失 ${l.loss} 档）`,`方位：${side(w.az)}`,`距离：${w.dist.toFixed(2)} m`,`灯架高度：${Math.round((l.height-drop)*100)} cm`,`灯头高度：${Math.round(l.height*100)} cm`,
   `俯仰：${w.tilt===0?'水平 0°':`${w.tilt<0?'向下':'向上'} ${Math.abs(w.tilt)}°`}`,`偏转：${l.aimSide===0?'对准脸部':l.aimSide>0?`向左偏 ${l.aimSide}°`:`向右偏 ${-l.aimSide}°`}`,
   `输出：${powerText(l.stops,l.spec.kind)}`,`色温：${l.cct??l.spec.cct??5600} K`,`开关：${l.on?'开':'关'}`);
  if(part)L.push(`读数：f/${part.aperture.toFixed(1)} · 占 ${Math.round(part.share*100)}%${part.visible<1?` · 被挡 ${Math.round((1-part.visible)*100)}%`:''}`);
  L.push(`坐标：x=${l.x.toFixed(3)} z=${l.z.toFixed(3)} h=${l.height.toFixed(3)} 俯仰补偿=${l.aimUp} 偏转=${l.aimSide} 档位=${l.stops.toFixed(2)} 附件=${l.modifier} 灯库=${l.spec.preset??''}`,'');});
 return L.join('\n');}

/** Reads a sheet back. Exact values come from each block's 坐标 line; the readable lines fill in the rest. */
export function fromSheet(text:string,resolve:(name:string,preset?:string)=>LightSpec|undefined):Omit<SheetData,'meter'>{
 if(!/^观隅布光单/.test(text.trim()))throw new Error('这不是观隅布光单');
 const val=(block:string,key:string)=>new RegExp('^'+key+'：(.*)$','m').exec(block)?.[1]?.trim();
 const head=text.split(/^\[灯 /m)[0];const bd=val(head,'背景');const backdrop=(Object.entries(BACKDROP_ZH).find(([,v])=>v===bd)?.[0]??'white') as Backdrop;
 const cam=val(head,'相机')??'';const iso=Number(/ISO (\d+)/.exec(cam)?.[1]??100),aperture=Number(/f\/([\d.]+)/.exec(cam)?.[1]??8),sh=/1\/(\d+) s/.exec(cam),focal=Number(/焦距 (\d+)/.exec(cam)?.[1]??85);
 const lights=text.split(/^\[灯 /m).slice(1).map((b,i)=>{const name=val(b,'灯具')??`灯 ${i+1}`,c=val(b,'坐标')??'';const num=(k:string,d:number)=>{const r=new RegExp(k+'=(-?[\\d.]+)').exec(c);return r?Number(r[1]):d;};
  const preset=/灯库=(\S*)/.exec(c)?.[1]||undefined,spec=resolve(name,preset)??{kind:'strobe' as const,ws:400};const modifier=/附件=(\S+)/.exec(c)?.[1]??MODIFIERS[0].id;
  const cct=Number(/(\d+) K/.exec(val(b,'色温')??'')?.[1]??spec.cct??5600);const loss=Number(/损失 ([\d.]+)/.exec(val(b,'附件')??'')?.[1]??modifierById(modifier).loss);
  return {id:`sheet-${i}-${Date.now().toString(36)}`,name,spec,modifier,loss,stops:num('档位',-3),x:num('x',0),z:num('z',1.5),height:num('h',2),aimUp:num('俯仰补偿',0),aimSide:num('偏转',0),cct,on:val(b,'开关')!=='关',role:/^\d+\]\s*(.*)$/m.exec(b)?.[1]||undefined};});
 return {name:val(head,'名称')??'',backdrop,camera:{iso,aperture,shutter:sh?1/Number(sh[1]):1/125},focal,lights};}

/* ======================= recipes ======================= */
export interface Role { role:string; az:number; dist:number; /** head height above the face, metres */ dh:number; mods:string[]; /** output relative to the key, stops */ rel:number; /** turn away from the face, degrees (background lights) */ aimSide?:number }
export type RecipeGroup='portrait'|'fashion'|'cinema'|'commercial';
export const RECIPE_GROUPS:{id:RecipeGroup;zh:string;en:string}[]=[{id:'portrait',zh:'人像经典',en:'Classic portrait'},{id:'fashion',zh:'时尚美妆',en:'Fashion & beauty'},{id:'cinema',zh:'电影氛围',en:'Cinematic'},{id:'commercial',zh:'商业与证件',en:'Commercial & ID'}];
export interface Recipe { id:string; group:RecipeGroup; zh:string; en:string; hint:string; backdrop?:Backdrop; roles:Role[] }
export const RECIPES:Recipe[]=[
 {id:'rembrandt',group:'portrait',zh:'伦勃朗光',en:'Rembrandt',hint:'主光 45° 偏高，暗侧脸颊留出三角光',roles:[{role:'主光',az:45,dist:1.5,dh:.6,mods:['octa-90','softbox-6090','beauty-dish'],rel:0},{role:'辅光',az:-35,dist:2.2,dh:0,mods:['umbrella-shoot','octa-120','softbox-6090'],rel:-2}]},
 {id:'loop',group:'portrait',zh:'环形光',en:'Loop',hint:'主光 30° 略高，鼻影落在嘴角上方',roles:[{role:'主光',az:30,dist:1.6,dh:.45,mods:['octa-90','softbox-6090'],rel:0},{role:'辅光',az:-30,dist:2.2,dh:0,mods:['umbrella-shoot','octa-120'],rel:-1.5}]},
 {id:'butterfly',group:'fashion',zh:'蝴蝶光',en:'Butterfly',hint:'主光正面高位，鼻下蝴蝶形阴影',roles:[{role:'主光',az:0,dist:1.3,dh:.7,mods:['beauty-dish','octa-90'],rel:0}]},
 {id:'clamshell',group:'fashion',zh:'蚌壳光',en:'Clamshell',hint:'上下两盏夹住脸部，阴影最浅，适合美妆',roles:[{role:'主光',az:0,dist:1.2,dh:.55,mods:['beauty-dish','octa-90','softbox-6090'],rel:0},{role:'下补光',az:0,dist:1,dh:-.6,mods:['strip-30120','softbox-6090','umbrella-shoot'],rel:-1.5}]},
 {id:'split',group:'cinema',zh:'分割光',en:'Split',hint:'主光 90° 与脸齐平，脸一半亮一半暗',roles:[{role:'主光',az:90,dist:1.4,dh:.1,mods:['strip-30120','softbox-6090','reflector'],rel:0}]},
 {id:'rim',group:'cinema',zh:'双侧轮廓光',en:'Twin rim',hint:'两盏条灯在人物后侧勾边，前方弱补光',backdrop:'black',roles:[{role:'左轮廓',az:135,dist:1.6,dh:.4,mods:['strip-30120','softbox-6090'],rel:0},{role:'右轮廓',az:-135,dist:1.6,dh:.4,mods:['strip-30120','softbox-6090'],rel:0},{role:'前补光',az:0,dist:2.5,dh:.3,mods:['octa-120','umbrella-shoot'],rel:-2}]},
 {id:'highkey',group:'commercial',zh:'高调',en:'High key',hint:'大面积柔光正面，背景再亮一档成纯白',backdrop:'white',roles:[{role:'主光',az:15,dist:2,dh:.5,mods:['octa-120','umbrella-shoot'],rel:0},{role:'背景左',az:150,dist:1.8,dh:-.4,mods:['reflector','umbrella-reflect'],rel:1,aimSide:150},{role:'背景右',az:-150,dist:1.8,dh:-.4,mods:['reflector','umbrella-reflect'],rel:1,aimSide:-150}]},
 {id:'lowkey',group:'cinema',zh:'低调',en:'Low key',hint:'黑棚，硬一些的主光侧打，大部分落在阴影里',backdrop:'black',roles:[{role:'主光',az:65,dist:1.4,dh:.5,mods:['snoot','beauty-dish','strip-30120'],rel:0},{role:'发光',az:160,dist:1.5,dh:.9,mods:['snoot','reflector'],rel:-1}]},
 {id:'three-point',group:'portrait',zh:'三点布光',en:'Three-point',hint:'主光 45°、辅光对侧低 1.5 档、轮廓光在后上方勾出发丝与肩线',roles:[{role:'主光',az:45,dist:1.6,dh:.5,mods:['octa-90','softbox-6090'],rel:0},{role:'辅光',az:-45,dist:2,dh:.1,mods:['umbrella-shoot','softbox-6090'],rel:-1.5},{role:'轮廓光',az:150,dist:1.6,dh:.8,mods:['strip-30120','snoot','reflector'],rel:-.5}]},
 {id:'short',group:'portrait',zh:'短光',en:'Short light',hint:'人物侧身，主光从远离镜头的一侧打来，脸显瘦、立体感强',roles:[{role:'主光',az:-55,dist:1.5,dh:.5,mods:['octa-90','softbox-6090'],rel:0},{role:'辅光',az:20,dist:2.4,dh:0,mods:['umbrella-shoot','octa-120'],rel:-2.5}]},
 {id:'broad',group:'portrait',zh:'宽光',en:'Broad light',hint:'主光照亮靠近镜头的半边脸，面部更饱满柔和',roles:[{role:'主光',az:55,dist:1.6,dh:.45,mods:['octa-120','umbrella-shoot'],rel:0},{role:'辅光',az:-25,dist:2.4,dh:0,mods:['umbrella-shoot'],rel:-2}]},
 {id:'window',group:'portrait',zh:'模拟窗光',en:'Window light',hint:'大八角箱贴近侧面、与眼同高略上，像北向窗户的柔和光，暗部只留很弱的反光',roles:[{role:'窗光',az:70,dist:1.2,dh:.25,mods:['octa-120','softbox-6090'],rel:0},{role:'反光补',az:-60,dist:1.4,dh:-.1,mods:['umbrella-reflect','umbrella-shoot'],rel:-2.5}]},
 {id:'paramount',group:'portrait',zh:'好莱坞经典',en:'Hollywood Paramount',hint:'雷达罩正上方蝴蝶光、发光与背景光点亮轮廓与后景，复刻黑白片厂肖像',backdrop:'grey',roles:[{role:'主光',az:0,dist:1.3,dh:.7,mods:['beauty-dish','snoot'],rel:0},{role:'发光',az:180,dist:1,dh:1,mods:['snoot','reflector'],rel:-.5},{role:'背景光',az:170,dist:1.6,dh:-.9,mods:['snoot','reflector'],rel:0,aimSide:170},{role:'下补光',az:0,dist:1.1,dh:-.6,mods:['strip-30120','softbox-6090'],rel:-2}]},
 {id:'fashion-hard',group:'fashion',zh:'时尚硬光',en:'Fashion hard light',hint:'标准罩高位正前方略偏，影子利落、皮肤反差高，适合杂志感造型',backdrop:'white',roles:[{role:'主光',az:15,dist:2.2,dh:.9,mods:['reflector','beauty-dish'],rel:0},{role:'背景光',az:160,dist:1.6,dh:-.5,mods:['umbrella-reflect','reflector'],rel:.7,aimSide:160}]},
 {id:'beauty-triangle',group:'fashion',zh:'美妆三角',en:'Beauty triangle',hint:'蚌壳光加两侧条灯勾边，眼神光完整、轮廓干净，适合特写与彩妆',roles:[{role:'主光',az:0,dist:1.1,dh:.5,mods:['beauty-dish','octa-90'],rel:0},{role:'下补光',az:0,dist:.9,dh:-.55,mods:['strip-30120','softbox-6090'],rel:-1.3},{role:'左侧条灯',az:120,dist:1.4,dh:.2,mods:['strip-30120'],rel:-.7},{role:'右侧条灯',az:-120,dist:1.4,dh:.2,mods:['strip-30120'],rel:-.7}]},
 {id:'cinematic',group:'cinema',zh:'电影感侧逆',en:'Cinematic side-back',hint:'主光在 70° 偏后，对侧逆光擦亮脸缘，补光压到 3 档以下，暗部浓郁',backdrop:'black',roles:[{role:'主光',az:70,dist:1.5,dh:.35,mods:['strip-30120','octa-90'],rel:0},{role:'逆光',az:-140,dist:1.7,dh:.4,mods:['strip-30120','reflector'],rel:-.3},{role:'补光',az:-20,dist:3,dh:0,mods:['octa-120','umbrella-shoot'],rel:-3.3}]},
 {id:'chiaroscuro',group:'cinema',zh:'明暗对照',en:'Chiaroscuro',hint:'单灯从 105° 侧后方压暗大半张脸，只留一道受光边，古典油画般的戏剧感',backdrop:'black',roles:[{role:'主光',az:105,dist:1.3,dh:.4,mods:['snoot','strip-30120','reflector'],rel:0}]},
 {id:'silhouette',group:'cinema',zh:'剪影',en:'Silhouette',hint:'只照亮背景、人物不受光，轮廓黑白分明',backdrop:'white',roles:[{role:'背景左',az:155,dist:1.5,dh:-.5,mods:['umbrella-reflect','reflector'],rel:1.5,aimSide:155},{role:'背景右',az:-155,dist:1.5,dh:-.5,mods:['umbrella-reflect','reflector'],rel:1.5,aimSide:-155}]},
 {id:'id-photo',group:'commercial',zh:'证件照',en:'ID photo',hint:'左右两盏等量柔光、背景再亮一些，阴影最少、肤色均匀',backdrop:'white',roles:[{role:'左主光',az:40,dist:1.5,dh:.2,mods:['softbox-6090','umbrella-shoot'],rel:0},{role:'右主光',az:-40,dist:1.5,dh:.2,mods:['softbox-6090','umbrella-shoot'],rel:0},{role:'背景光',az:180,dist:1.2,dh:-.8,mods:['reflector'],rel:1,aimSide:180}]},
 {id:'corporate',group:'commercial',zh:'商务形象',en:'Corporate headshot',hint:'八角箱 35° 主光、大面积辅光、轮廓光分离背景，稳重清爽',backdrop:'grey',roles:[{role:'主光',az:35,dist:1.6,dh:.45,mods:['octa-120','octa-90'],rel:0},{role:'辅光',az:-35,dist:2.2,dh:.1,mods:['umbrella-shoot','softbox-6090'],rel:-1.3},{role:'轮廓光',az:-150,dist:1.6,dh:.7,mods:['strip-30120'],rel:-.7}]},
];
/**
 * Builds a recipe from the lights the studio owns: the strongest goes to the key, the next to the other roles, and
 * each output is solved so the key meters the camera aperture and the others sit at their ratio.
 */
export function buildRecipe(r:Recipe,owned:{id:string;name:string;spec:LightSpec}[],camera:Camera,faceY=FACE_Y){
 const rank=(s:LightSpec)=>s.kind==='strobe'?2.5*Math.pow(s.gn??3.5*Math.sqrt(s.ws??100),2):(s.lux1m??0)*camera.shutter;
 const pool=[...owned].sort((a,b)=>rank(b.spec)-rank(a.spec));const target=targetExposure(camera),warnings:string[]=[];
 const lights=r.roles.slice(0,pool.length).map((role,i)=>{const src=pool[i],mod=role.mods.map(modifierById).find(Boolean)!,rad=role.az*Math.PI/180;
  const x=-Math.sin(rad)*role.dist,z=Math.cos(rad)*role.dist,height=Math.max(.2,faceY+role.dh);
  const d=Math.hypot(role.dist,role.dh),full=axisEnergy(src.spec,1,mod.loss,camera.shutter),dome=role.aimSide?1:(1+Math.cos(rad))/2||.15;
  let stops=Math.log2(target*Math.pow(2,role.rel)*d*d/Math.max(1e-6,full*dome));
  if(stops>0){warnings.push(`${role.role}（${src.name}）全功率仍差 ${stops.toFixed(1)} 档，可开大光圈或提高 ISO`);stops=0;}
  if(stops<-9){warnings.push(`${role.role}（${src.name}）降到最低 1/512 仍过曝 ${(-9-stops).toFixed(1)} 档，可收小光圈、降低 ISO 或拉远灯位`);stops=-9;}
  return {id:src.id,name:src.name,spec:src.spec,modifier:mod.id,loss:mod.loss,stops:Math.round(stops*10)/10,on:true,aimUp:0,aimSide:role.aimSide??0,cct:src.spec.cct,x,z,height,role:role.role} as Placement&{role:string};});
 if(pool.length<r.roles.length)warnings.push(`这个布光需要 ${r.roles.length} 盏灯，台账里只有 ${pool.length} 盏可用，已省略：${r.roles.slice(pool.length).map(x=>x.role).join('、')}`);
 return {lights,warnings,backdrop:r.backdrop};}
