// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/**
 * Loads a subject for the lighting lab from a folder the studio picks: a GLB/glTF, or an FBX with its textures and,
 * when present, Marmoset Toolbag materials (.tbmat). Toolbag packs channels its own way (metalness, roughness and
 * cavity share one map; occlusion sits in one channel), so maps are re-packed into three.js order: occlusion R,
 * roughness G, metalness B. Skinned meshes are baked into their bind pose so meter rays can test them cheaply.
 * Files stay on this computer; the folder is kept in the browser's own storage so the subject returns next time.
 */
import * as THREE from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface LoadedSubject { object:THREE.Object3D; height:number; face:THREE.Vector3; name:string }
interface TbMat { albedo?:string; color?:[number,number,number]; normal?:string; micro?:string; microChannel:number; gloss:boolean; metal?:string; metalChannel:number; ao?:string; aoChannel:number; alpha?:string; alphaChannel:number }

const base=(p:string)=>p.replace(/\\/g,'/').split('/').pop()!.toLowerCase();
const CH:Record<number,number>={0:0,1:1,2:2,3:3};

function parseTbmat(text:string):TbMat{const m:TbMat={microChannel:1,gloss:false,metalChannel:0,aoChannel:0,alphaChannel:0};
 const tex=(key:string)=>{const r=new RegExp(key+' = @Tex file "([^"]+)"').exec(text);return r?base(r[1]):undefined;};
 const section=(name:string)=>{const i=text.indexOf('@Sub '+name);if(i<0)return '';const j=text.indexOf('@End',i);return text.slice(i,j<0?undefined:j);};
 const num=(s:string,key:string)=>{const r=new RegExp('^\\s*'+key.replace(/[;]/g,'\\;')+' = (\\d+)','m').exec(s);return r?Number(r[1]):undefined;};
 m.albedo=tex('Albedo Map');const c=/Albedo Map[^\n]*\n\s*Color = ([\d.]+) ([\d.]+) ([\d.]+)/.exec(text);if(c)m.color=[+c[1],+c[2],+c[3]];
 m.normal=tex('Normal Map');
 const micro=section('SRMicrosurface');m.micro=/Microsurface Map = @Tex file "([^"]+)"/.exec(micro)?.[1];if(m.micro)m.micro=base(m.micro);m.microChannel=num(micro,'Channel')??1;m.gloss=(num(micro,'Mode')??0)===0&&!/RoughnessMap/.test(micro);
 const refl=section('SRReflectivity');m.metal=/Metalness Map = @Tex file "([^"]+)"/.exec(refl)?.[1];if(m.metal)m.metal=base(m.metal);m.metalChannel=num(refl,'Channel')??0;
 const occ=section('SROcclusion');m.ao=/Occlusion Map = @Tex file "([^"]+)"/.exec(occ)?.[1];if(m.ao)m.ao=base(m.ao);m.aoChannel=num(occ,'Channel;occlusion')??0;
 const tr=section('SRTransparency');m.alpha=/Alpha Map = @Tex file "([^"]+)"/.exec(tr)?.[1];if(m.alpha)m.alpha=base(m.alpha);m.alphaChannel=num(tr,'Channel')??0;
 return m;}

async function bitmap(file:File){return createImageBitmap(file,{imageOrientation:'flipY'});}
/** Draws channels from source images into one RGBA texture; each slot is [image, channel, invert] or a constant. */
async function pack(slots:([ImageBitmap,number,boolean]|number)[]){const imgs=slots.filter(s=>typeof s!=='number') as [ImageBitmap,number,boolean][];const w=imgs[0]?.[0].width??4,h=imgs[0]?.[0].height??4;
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d',{willReadFrequently:true})!;const out=ctx.createImageData(w,h);
 const reads=new Map<ImageBitmap,Uint8ClampedArray>();for(const [img] of imgs)if(!reads.has(img)){ctx.clearRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);reads.set(img,ctx.getImageData(0,0,w,h).data);}
 for(let k=0;k<4;k++){const s=slots[k]??255;if(typeof s==='number'){for(let i=k;i<out.data.length;i+=4)out.data[i]=s;continue;}const src=reads.get(s[0])!,c=CH[s[1]]??0;for(let i=0;i<out.data.length;i+=4)out.data[i+k]=s[2]?255-src[i+c]:src[i+c];}
 ctx.putImageData(out,0,0);const t=new THREE.CanvasTexture(cv);t.flipY=false;t.colorSpace=THREE.NoColorSpace;t.anisotropy=4;t.needsUpdate=true;return t;}

/** Textures larger than 2048 px are scaled down once on load: a lighting preview gains nothing from 4K maps, and they
    cost video memory and bandwidth on every frame. */
const MAX_TEXTURE=2048;
function limitTexture(t:THREE.Texture){const img=t.image as {width?:number;height?:number}|undefined;const w=img?.width??0,h=img?.height??0;if(Math.max(w,h)<=MAX_TEXTURE)return t;
 const k=MAX_TEXTURE/Math.max(w,h),cv=document.createElement('canvas');cv.width=Math.round(w*k);cv.height=Math.round(h*k);const ctx=cv.getContext('2d');if(!ctx)return t;
 ctx.imageSmoothingQuality='high';ctx.drawImage(t.image as CanvasImageSource,0,0,cv.width,cv.height);t.image=cv;t.needsUpdate=true;return t;}
/**
 * Draw-call batching for any imported model: meshes that share one material and the same vertex attributes are merged
 * into a single mesh (positions are already baked into the group's space). Detailed character exports often come as
 * hundreds of small pieces; every piece costs a draw call per frame and again per shadow-casting light.
 */
function batchByMaterial(group:THREE.Group){
 const buckets=new Map<string,THREE.Mesh[]>();
 for(const child of [...group.children]){const mesh=child as THREE.Mesh;if(!mesh.isMesh||Array.isArray(mesh.material))continue;
  const g=mesh.geometry,key=(mesh.material as THREE.Material).uuid+'|'+Object.keys(g.attributes).sort().join(',')+'|'+(g.index?'i':'n')+'|'+mesh.matrix.elements.join(',');
  const list=buckets.get(key);if(list)list.push(mesh);else buckets.set(key,[mesh]);}
 for(const list of buckets.values()){if(list.length<2)continue;
  const merged=mergeGeometries(list.map(m=>m.geometry),false);if(!merged)continue;
  const out=new THREE.Mesh(merged,list[0].material);out.castShadow=out.receiveShadow=true;out.name=list.map(m=>m.name).filter(Boolean).slice(0,3).join('+');out.matrix.copy(list[0].matrix);out.matrix.decompose(out.position,out.quaternion,out.scale);
  for(const m of list){group.remove(m);m.geometry.dispose();}group.add(out);}
}
export async function loadSubjectFolder(files:File[]):Promise<LoadedSubject>{
 const byName=new Map<string,File>();for(const f of files)byName.set(f.name.toLowerCase(),f);
 const find=(name?:string)=>{if(!name)return undefined;const hit=byName.get(name);if(hit)return hit;
  /* textures named after another character's sheet: fall back to a file with the same suffix */
  const suffix=name.replace(/^[a-z]+\d+_\d+_/,'');return [...byName.entries()].find(([k])=>k.endsWith('_'+suffix))?.[1];};
 const modelFile=files.find(f=>/\.(glb|gltf)$/i.test(f.name))??files.find(f=>/\.fbx$/i.test(f.name));
 if(!modelFile)throw new Error('没有找到人物模型文件');
 const urls=new Map<string,string>();const urlFor=(f:File)=>{let u=urls.get(f.name);if(!u){u=URL.createObjectURL(f);urls.set(f.name,u);}return u;};
 const manager=new THREE.LoadingManager();/* everything a model refers to must come from the chosen folder; anything else is replaced by an empty resource */
 manager.setURLModifier(u=>{if(u.startsWith('blob:')||u.startsWith('data:'))return u;const f=find(base(decodeURIComponent(u)));return f?urlFor(f):'data:application/octet-stream;base64,';});
 try{
  const root:THREE.Object3D=/\.fbx$/i.test(modelFile.name)?await new FBXLoader(manager).loadAsync(urlFor(modelFile)):(await new GLTFLoader(manager).loadAsync(urlFor(modelFile))).scene;
  const tbmats=new Map<string,TbMat>();for(const f of files)if(/\.tbmat$/i.test(f.name))tbmats.set(f.name.replace(/\.tbmat$/i,'').toLowerCase(),parseTbmat(await f.text()));
  const loader=new THREE.TextureLoader(manager);const texCache=new Map<string,Promise<THREE.Texture>>();const bmpCache=new Map<string,Promise<ImageBitmap>>();
  const colour=(f:File)=>{let p=texCache.get(f.name);if(!p){p=loader.loadAsync(urlFor(f)).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;t.flipY=true;return limitTexture(t);});texCache.set(f.name,p);}return p;};
  const linear=(f:File)=>{const key='lin:'+f.name;let p=texCache.get(key);if(!p){p=loader.loadAsync(urlFor(f)).then(t=>{t.colorSpace=THREE.NoColorSpace;t.anisotropy=4;t.flipY=true;return limitTexture(t);});texCache.set(key,p);}return p;};
  const bmp=(f:File)=>{let p=bmpCache.get(f.name);if(!p){p=bitmap(f);bmpCache.set(f.name,p);}return p;};
  async function material(name:string,fallback:THREE.Material):Promise<THREE.Material|null>{const key=name.toLowerCase().replace(/^.*[:|]/,'');if(key.startsWith('!'))return null;
   const tb=tbmats.get(key);const fb=fallback as THREE.MeshStandardMaterial&{map?:THREE.Texture};
   if(!tb){const m=new THREE.MeshStandardMaterial({map:fb.map??null,normalMap:(fb as THREE.MeshStandardMaterial).normalMap??null,roughness:.6,metalness:0,side:THREE.FrontSide});if(m.map)m.map.colorSpace=THREE.SRGBColorSpace;return m;}
   const m=new THREE.MeshStandardMaterial({roughness:1,metalness:1});const al=find(tb.albedo);if(al)m.map=await colour(al);else if(tb.color)m.color.setRGB(...tb.color);
   const nm=find(tb.normal);if(nm)m.normalMap=await linear(nm);
   const mi=find(tb.micro),me=find(tb.metal),ao=find(tb.ao);
   if(mi||me||ao){const orm=await pack([ao?[await bmp(ao),tb.aoChannel,false]:255,mi?[await bmp(mi),tb.microChannel,tb.gloss]:150,me?[await bmp(me),tb.metalChannel,false]:0,255]);orm.flipY=false;
    m.roughnessMap=orm;m.metalnessMap=orm;if(ao){m.aoMap=orm;m.aoMapIntensity=1;}}else{m.roughness=.55;m.metalness=0;}
   const a=find(tb.alpha);if(a){const am=await pack([[await bmp(a),tb.alphaChannel,false],[await bmp(a),tb.alphaChannel,false],[await bmp(a),tb.alphaChannel,false],255]);m.alphaMap=am;m.alphaTest=.45;m.side=THREE.DoubleSide;}
   if(/hair|lash|brow/.test(key)){m.side=THREE.DoubleSide;if(!m.alphaMap)m.alphaTest=.45;}
   m.name=name;return m;}
  /* bake skinned meshes in their pose; replace materials; drop helper meshes such as floors */
  root.updateMatrixWorld(true);const meshes:THREE.Mesh[]=[];root.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
  const group=new THREE.Group();const v=new THREE.Vector3();
  for(const mesh of meshes){let geo=mesh.geometry.clone();
   if((mesh as THREE.SkinnedMesh).isSkinnedMesh){const sk=mesh as THREE.SkinnedMesh;sk.skeleton.update();const pos=geo.attributes.position as THREE.BufferAttribute;const out=new Float32Array(pos.count*3);
    let moved=0;const o=new THREE.Vector3();
    for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);o.copy(v);sk.applyBoneTransform(i,v);moved=Math.max(moved,v.distanceToSquared(o));out[i*3]=v.x;out[i*3+1]=v.y;out[i*3+2]=v.z;}
    geo.deleteAttribute('skinIndex');geo.deleteAttribute('skinWeight');
    /* already in its bind pose: keep the authored smooth normals; otherwise weld seams before recomputing them */
    if(moved>1e-4){geo.setAttribute('position',new THREE.BufferAttribute(out,3));const n=geo.attributes.normal;geo.deleteAttribute('normal');geo=mergeVertices(geo,1e-4);geo.computeVertexNormals();if(!n)geo.computeVertexNormals();}
    geo.applyMatrix4(mesh.matrixWorld);}
   else geo.applyMatrix4(mesh.matrixWorld);
   const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];const made=await Promise.all(mats.map(mt=>material(mt.name||'',mt)));
   if(made.every(m=>m===null))continue;
   if(!geo.attributes.uv1&&geo.attributes.uv)geo.setAttribute('uv1',geo.attributes.uv);
   const out=new THREE.Mesh(geo,Array.isArray(mesh.material)?made.map(m=>m??new THREE.MeshBasicMaterial({visible:false})):made[0]!);out.castShadow=out.receiveShadow=true;out.name=mesh.name;group.add(out);}
  if(!group.children.length)throw new Error('模型里没有可显示的网格');
  batchByMaterial(group);
  /* units and up axis: game exports are often centimetres and Z-up */
  let box=new THREE.Box3().setFromObject(group),size=box.getSize(new THREE.Vector3());
  if(size.z>size.y*1.4&&size.z>size.x){group.rotation.x=-Math.PI/2;group.updateMatrixWorld(true);box=new THREE.Box3().setFromObject(group);size=box.getSize(new THREE.Vector3());}
  let s=1;if(size.y>20)s=.01;else if(size.y>3.5||size.y<.5)s=1.65/size.y;group.scale.multiplyScalar(s);group.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(group);size=box.getSize(new THREE.Vector3());
  const holder=new THREE.Group();holder.add(group);group.position.set(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2);
  const height=size.y;return {object:holder,height,face:new THREE.Vector3(0,height*.935,Math.min(.12,size.z/2)),name:modelFile.name.replace(/\.[^.]+$/,'')};
 }finally{/* textures stay referenced by the materials; blob URLs can be released once loaded */setTimeout(()=>{for(const u of urls.values())URL.revokeObjectURL(u);},30000);}
}

/** Loads a subject kept in this install's local assets (never committed): a folder listed in an index.json. */
export async function fetchLocalSubject(dir:string){const list=await fetch(dir+'/index.json').then(r=>r.ok?r.json() as Promise<string[]>:null).catch(()=>null);if(!list?.length)return null;
 const files=await Promise.all(list.map(async rel=>{const r=await fetch(dir+'/'+rel.split('/').map(encodeURIComponent).join('/'));return new File([await r.blob()],rel.split('/').pop()!);}));return files;}

/* ---------- keep the picked folder on this computer (IndexedDB) ---------- */
const DB='studio-lighting',STORE='subject';
function db(){return new Promise<IDBDatabase>((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
/** Keeps only files the subject needs: the model, its materials and images. */
export function subjectFiles(files:File[]){return files.filter(f=>/\.(fbx|glb|gltf|bin|tbmat|png|jpe?g|webp|tga)$/i.test(f.name));}
export async function saveSubject(files:File[]){const d=await db();await new Promise<void>((res,rej)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put(files.map(f=>new File([f],f.name,{type:f.type})),'files');tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});d.close();}
export async function restoreSubject():Promise<File[]|null>{try{const d=await db();const files=await new Promise<File[]|undefined>((res,rej)=>{const r=d.transaction(STORE).objectStore(STORE).get('files');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});d.close();return files?.length?files:null;}catch{return null;}}
export async function forgetSubject(){try{const d=await db();await new Promise<void>(res=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).delete('files');tx.oncomplete=()=>res();});d.close();}catch{}}
