// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/**
 * Lighting lab engine: a studio with a cyclorama, a subject, physical props and the studio's own lights.
 *
 * Light leaves each placed head as luminous energy Q (see lighting.ts). The incident reading at the meter point is
 * Σ Q · beam · dome / d², where visibility is sampled across the emitting face so a large, close softbox gives a soft
 * shadow edge and a partial reading behind an occluder. The picture is exposed from the camera settings: a grey card
 * receiving the target exposure renders as mid-grey. Props and stands are Rapier rigid bodies, so they push each other
 * aside while being dragged and never interpenetrate. The frame is only redrawn while something changes.
 */
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type RAPIER_NS from '@dimforge/rapier3d-compat';
import {buildOcclusionGrid,gridBlocks,type OcclusionGrid} from './occlusion-grid';
import {cameraOnTripod,GEAR,headFor,modifierModel,standFor,standKey,type HeadModel,type ModifierModel,type Stand} from './studio-gear';
import {depthOfField,headKindOf,apertureFor,axisEnergy,beamFactor,beamFlux,cctToRGB,modifierById,modifierOutline,polygonProjectedSolidAngle,targetExposure,type Camera,type LightSpec} from './lighting';

export type Backdrop='white'|'grey'|'black';
export type ViewMode='photo'|'false'|'zebra'|'clip';
/** 256-bin histograms of the photo view as displayed: luminance (Rec. 709 weights) and each channel. */
export interface Histogram { luma:number[]; r:number[]; g:number[]; b:number[]; clipHigh:number; clipLow:number }
export type CameraView='camera'|'overview';
/** Full-frame vertical field of view for a lens, landscape orientation (24 mm frame height). */
export const lensFov=(mm:number)=>2*Math.atan(12/mm)*180/Math.PI;
export type PropKind='chair'|'stool'|'ladder'|'applebox'|'reflector';
export interface Placement { id:string; spec:LightSpec; name:string; modifier:string; loss:number; stops:number; height:number; x:number; z:number; aimUp:number; aimSide:number; cct?:number; on:boolean }
export interface Reading { id:string; h:number; aperture:number; share:number; cct:number; cri?:number; visible:number }
export interface Meter { /** light bounced back by the cyclorama, lux·s */ bounce:number; total:number; aperture:number; target:number; deltaStops:number; parts:Reading[] }
export interface LabEvents { onSelect?(id:string|null,kind:'light'|'prop'|null):void; onMove?(id:string,x:number,z:number):void; /** height or aim changed by a viewport transform */ onPatch?(id:string,patch:{height?:number;aimSide?:number}):void; onMeter?(m:Meter):void; onReady?():void; /** focus distance set by double-clicking the camera view, metres */ onFocus?(m:number):void }

const STUDIO_W=20,FLOOR_FRONT=5,WALL_Z=-3,COVE=1.1,WALL_H=4.2,SUBJECT_H=1.72;
const ALBEDO:Record<Backdrop,number>={white:.82,grey:.18,black:.035};

/** Cyclorama: floor, coved corner and back wall swept across the studio width. */
function cyclorama(){const prof:[number,number][]=[];for(let i=0;i<=12;i++){const z=FLOOR_FRONT-(FLOOR_FRONT-(WALL_Z+COVE))*i/12;prof.push([0,z]);}
 for(let i=1;i<=16;i++){const a=i/16*Math.PI/2;prof.push([COVE-Math.cos(a)*COVE,WALL_Z+COVE-Math.sin(a)*COVE]);}for(let i=1;i<=8;i++)prof.push([COVE+(WALL_H-COVE)*i/8,WALL_Z]);
 const cols=40,pos:number[]=[],idx:number[]=[];for(let c=0;c<=cols;c++){const x=-STUDIO_W/2+STUDIO_W*c/cols;for(const [y,z] of prof)pos.push(x,y,z);}
 const rows=prof.length;for(let c=0;c<cols;c++)for(let r=0;r<rows-1;r++){const a=c*rows+r,b=a+rows;idx.push(a,b,a+1,b,b+1,a+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}

/** A jointed artist's mannequin, 1.72 m, in matte skin-toned material (albedo near real skin). */
function mannequin(){const g=new THREE.Group(),skin=new THREE.MeshStandardMaterial({color:0xc9a48d,roughness:.62,metalness:0}),cloth=new THREE.MeshStandardMaterial({color:0x3a3d42,roughness:.85});
 const part=(geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,rx=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,0,rz);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
 const head=part(new THREE.SphereGeometry(.105,48,32),skin,0,1.6,0);head.scale.set(.86,1.12,.95);
 part(new THREE.CylinderGeometry(.045,.055,.12,24),skin,0,1.47,0);
 part(new THREE.CapsuleGeometry(.16,.34,8,24),cloth,0,1.2,0).scale.set(1.08,1,.62);
 part(new THREE.CapsuleGeometry(.15,.12,8,24),cloth,0,.95,0).scale.set(1.12,1,.7);
 for(const s of [-1,1]){part(new THREE.CapsuleGeometry(.045,.26,6,16),skin,s*.22,1.24,0,0,s*.12);part(new THREE.CapsuleGeometry(.038,.24,6,16),skin,s*.255,.96,.03,-.1,s*.05);part(new THREE.SphereGeometry(.045,16,12),skin,s*.27,.8,.05);
  part(new THREE.CapsuleGeometry(.07,.36,6,16),cloth,s*.09,.62,0);part(new THREE.CapsuleGeometry(.055,.34,6,16),cloth,s*.09,.24,0);part(new THREE.BoxGeometry(.09,.05,.22),cloth,s*.09,.025,.05);}
 g.userData.face=new THREE.Vector3(0,1.6,.11);return g;}

function propMesh(kind:PropKind):{group:THREE.Group;half:[number,number,number]}{const g=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:0x8a6a4a,roughness:.7}),metal=new THREE.MeshStandardMaterial({color:0x9a9ea4,roughness:.35,metalness:.8}),white=new THREE.MeshStandardMaterial({color:0xf2f2f2,roughness:.9});
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);};
 if(kind==='chair'){box(.44,.04,.42,0,.45,0,wood);for(const [x,z] of [[-.19,-.18],[.19,-.18],[-.19,.18],[.19,.18]])box(.035,.45,.035,x,.225,z,wood);box(.44,.42,.035,0,.68,-.19,wood);return {group:g,half:[.23,.45,.22]};}
 if(kind==='stool'){const m=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.04,32),wood);m.position.y=.62;m.castShadow=true;g.add(m);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;box(.03,.62,.03,Math.cos(a)*.13,.31,Math.sin(a)*.13,metal);}return {group:g,half:[.18,.32,.18]};}
 if(kind==='ladder'){for(const s of [-1,1]){box(.04,1.5,.04,s*.22,.75,.15,metal);box(.04,1.5,.04,s*.22,.75,-.15,metal);}for(let i=1;i<=4;i++)box(.44,.03,.12,0,i*.3,.12,metal);return {group:g,half:[.25,.75,.22]};}
 if(kind==='reflector'){const m=new THREE.Mesh(new THREE.CircleGeometry(.4,48),white);m.position.y=.55;m.rotation.x=-.25;m.castShadow=m.receiveShadow=true;g.add(m);box(.03,.15,.03,0,.07,0,metal);return {group:g,half:[.4,.4,.08]};}
 box(.5,.2,.3,0,.1,0,wood);return {group:g,half:[.25,.1,.15]};}

export async function createLightingLab(canvas:HTMLCanvasElement,ev:LabEvents){
 const RAPIER:typeof RAPIER_NS=(await import('@dimforge/rapier3d-compat')).default;await RAPIER.init();
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(1.5,window.devicePixelRatio||1));
 renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=THREE.VSMShadowMap;renderer.toneMapping=THREE.AgXToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x1c1c1e);
 const cam=new THREE.PerspectiveCamera(27,1,.05,60);const shooter=new THREE.Vector3(0,1.45,5.2),aim=new THREE.Vector3(0,1.3,0);cam.position.copy(shooter);
 const controls=new OrbitControls(cam,canvas);controls.target.copy(aim);controls.enableDamping=false;controls.screenSpacePanning=true;controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.PAN};controls.rotateSpeed=.6;controls.zoomSpeed=.8;controls.maxPolarAngle=Math.PI*.52;controls.minDistance=1.2;controls.maxDistance=10;controls.update();
 /* world: cyclorama and subject are fixed colliders; props and stands are dynamic */
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=1/60;
 world.createCollider(RAPIER.ColliderDesc.cuboid(STUDIO_W/2,.05,FLOOR_FRONT).setTranslation(0,-.05,0));
 world.createCollider(RAPIER.ColliderDesc.cuboid(STUDIO_W/2,WALL_H/2,.1).setTranslation(0,WALL_H/2,WALL_Z-.1));
 for(const s of [-1,1])world.createCollider(RAPIER.ColliderDesc.cuboid(.1,WALL_H/2,FLOOR_FRONT).setTranslation(s*(STUDIO_W/2+.1),WALL_H/2,0));
 world.createCollider(RAPIER.ColliderDesc.cylinder(SUBJECT_H/2,.24).setTranslation(0,SUBJECT_H/2,0));
 const cycMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92});const cyc=new THREE.Mesh(cyclorama(),cycMat);cyc.receiveShadow=true;scene.add(cyc);
 /* the room around the sweep shares the studio's finish: a white studio is white all round, a black one black */
 const roomMat=new THREE.MeshStandardMaterial({color:0x2c2c2e,roughness:.95,side:THREE.BackSide}),room=new THREE.Mesh(new THREE.BoxGeometry(20,6,18),roomMat);room.position.set(0,2.98,2.5);room.receiveShadow=true;scene.add(room);
 let subject:THREE.Object3D=mannequin();scene.add(subject);const face=new THREE.Vector3(0,1.6,.11),faceLocal=face.clone();let subjectYaw=0;
 const placeFace=()=>{face.copy(faceLocal).applyAxisAngle(new THREE.Vector3(0,1,0),subjectYaw);};
 /* inter-reflection from the cyclorama: white sweeps fill the shadows, black ones barely do */
 const hemi=new THREE.HemisphereLight(0xffffff,0xffffff,0);scene.add(hemi);
 /* shadow tests: the subject is checked against a voxel proxy built once per model, props (a few boxes) by raycast */
 let subjectGrid:OcclusionGrid|null=null;const gridFor=()=>subjectGrid??=buildOcclusionGrid(subject);
 const segEnd=new THREE.Vector3();
 /** True when something stands between `from` and the point `dist` metres along unit `dir`. */
 const blocked=(from:THREE.Vector3,dir:THREE.Vector3,dist:number)=>{if(dist<=0)return false;segEnd.copy(from).addScaledVector(dir,dist);
  if(gridBlocks(gridFor(),subject,from,segEnd))return true;if(!props.length)return false;ray.set(from,dir);ray.far=dist;return ray.intersectObjects(props.map(p=>p.group),true).length>0;};
 /* the shooting position: a camera on a tripod, dragged like a stand; hidden in the camera view */
 const camRig=cameraOnTripod(),rig=camRig.group;rig.userData.entity={kind:'camera',id:'camera'};rig.userData.head=camRig.head;scene.add(rig);let rigHeight=-1;
 const placeRig=()=>{rig.position.set(shooter.x,0,shooter.z);if(Math.abs(shooter.y-rigHeight)>1e-4){camRig.setHeight(shooter.y);rigHeight=shooter.y;}camRig.head.lookAt(aim.x+shooter.x*0,aim.y,aim.z);rig.visible=angleMode!=='camera';};
 /** Moves the shooting position; in the camera view the view moves with it. */
 const moveShooter=(x:number,y:number,z:number)=>{shooter.set(THREE.MathUtils.clamp(x,-STUDIO_W/2+.3,STUDIO_W/2-.3),THREE.MathUtils.clamp(y,.3,1.94),THREE.MathUtils.clamp(z,WALL_Z+.8,FLOOR_FRONT+3));if(angleMode==='camera'){cam.position.copy(shooter);controls.target.copy(aim);controls.update();}placeRig();changed();dirty=true;};
 /* selection: a bright frame drawn over everything around the chosen stand, prop or camera */
 let selectedId:string|null=null;const selBox=new THREE.Box3(),selHelper=new THREE.Box3Helper(selBox,0x6f93cc);(selHelper.material as THREE.LineBasicMaterial).depthTest=false;(selHelper.material as THREE.LineBasicMaterial).transparent=true;selHelper.renderOrder=999;selHelper.visible=false;scene.add(selHelper);
 const selParts=():THREE.Object3D[]=>{if(!selectedId)return [];if(selectedId==='camera')return rig.visible?[rig]:[];const h=heads.get(selectedId);if(h)return [h.base,h.yoke,h.head];const pr=props.find(x=>x.id===selectedId);return pr?[pr.group]:[];};
 const frameSelection=()=>{const parts=selParts();selHelper.visible=parts.length>0;if(!parts.length)return;selBox.makeEmpty();for(const o of parts)selBox.expandByObject(o);selBox.expandByScalar(.04);};
 /* entities */
 interface Head { p:Placement; body:RAPIER_NS.RigidBody; base:THREE.Group; standKey:string; stand:Stand; yoke:THREE.Group; head:THREE.Group; model:HeadModel|null; mod:ModifierModel|null; light:THREE.SpotLight; face:THREE.Mesh|null; target:THREE.Vector3|null; style:string }
 interface Prop { id:string; kind:PropKind; body:RAPIER_NS.RigidBody; group:THREE.Group; target:THREE.Vector3|null }
 const heads=new Map<string,Head>(),props:Prop[]=[];
 const shared=new Set<THREE.Material>(Object.values(GEAR));
 const disposeTree=(o:THREE.Object3D)=>o.traverse(c=>{const m=c as THREE.Mesh;if(m.isMesh){m.geometry.dispose();const mats=Array.isArray(m.material)?m.material:[m.material];for(const mt of mats)if(!shared.has(mt))mt.dispose();}});
 function makeHead(p:Placement):Head{const base=new THREE.Group(),yoke=new THREE.Group(),head=new THREE.Group();scene.add(base,yoke,head);
  const light=new THREE.SpotLight(0xffffff,0,0,Math.PI/4,.7,2);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.bias=-.0004;light.shadow.blurSamples=16;light.shadow.camera.near=.05;head.add(light);head.add(light.target);
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x,.5,p.z).lockRotations().setLinearDamping(12));world.createCollider(RAPIER.ColliderDesc.cylinder(.5,.26).setFriction(.9),body);
  const {stand,key}=standFor(1.6);base.add(stand.group);
  return {p,body,base,standKey:key,stand,yoke,head,model:null,mod:null,light,face:null,target:null,style:''};}
 /** Rebuilds the head and its modifier when the light, the modifier or its state changes. */
 function styleHead(h:Head){const p=h.p,mod=modifierById(p.modifier),kind=headKindOf(p.spec),style=[kind,p.spec.kind,mod.id,p.on,p.cct??p.spec.cct].join('|');
  if(style===h.style)return;h.style=style;
  if(h.model){h.head.remove(h.model.body);h.yoke.remove(h.model.yoke);disposeTree(h.model.body);disposeTree(h.model.yoke);}if(h.mod){h.head.remove(h.mod.group);disposeTree(h.mod.group);}
  const model=headFor(kind,p.spec.kind==='led');h.model=model;
  /* the diffuser glows in the light's own colour while it is on, like a modelling lamp */
  const glow=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,toneMapped:false});const [cr,cg,cb]=cctToRGB(p.cct??p.spec.cct??5600),peak=Math.max(cr,cg,cb);
  if(p.on)glow.color.setRGB(cr/peak,cg/peak,cb/peak);else glow.color.setRGB(.16,.16,.17);
  const m=modifierModel(mod.id,model.mount,mod.w,mod.h,glow);h.mod=m;
  if(m.reversed)model.body.rotation.y=Math.PI;
  h.head.add(model.body,m.group);h.yoke.add(model.yoke);h.face=m.face;
  (model.modellingLamp.material as THREE.MeshStandardMaterial).emissiveIntensity=p.on?2:0;
  h.light.position.set(0,0,m.front);h.light.target.position.set(0,0,m.front+1);
  const [r,g,b]=cctToRGB(p.cct??p.spec.cct??5600);h.light.color.setRGB(r,g,b);
  h.light.angle=Math.min(Math.PI/2.2,THREE.MathUtils.degToRad((p.spec.beam&&mod.id==='reflector'?p.spec.beam:mod.beam)/2)*1.25);h.light.penumbra=mod.w?1:.55;h.light.shadow.radius=2+(mod.w?Math.max(mod.w,mod.h)*14:1);h.light.visible=p.on;}
 let focal=85,angleMode:CameraView='overview',camSettings:Camera={iso:100,aperture:8,shutter:1/125},backdrop:Backdrop='white',view:ViewMode='photo',dirty=true;
 placeRig();
 /* false colour: render linear, then colour each pixel by its stops from mid-grey */
 const rt=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
 /*
  * Depth of field (camera view, photo): the scene is rendered with depth, then each pixel is blurred by its circle of
  * confusion from the thin-lens model for a full-frame sensor (24 mm image height):
  *   c = f² · |1 − D/s| / (N · D · (1 − f/s))      (s = focus distance, D = object distance, all in mm; s = ∞ → c = f²/(N·D))
  * The blur gathers samples on a golden-angle spiral (a circular aperture), letting a sample contribute when its own
  * circle reaches the pixel and limiting background samples behind a sharp foreground (Gustafsson 2018,
  * "Bokeh depth of field in a single pass"). Tone mapping matches the photo view.
  */
 const dofRt=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(1,1,THREE.UnsignedIntType)});
 let dofOn=true,focusDist=0;
 const dofMat=new THREE.ShaderMaterial({toneMapped:true,uniforms:{tex:{value:dofRt.texture},depth:{value:dofRt.depthTexture},near:{value:.05},far:{value:60},f:{value:85},N:{value:8},invS:{value:0},pxPerMm:{value:20},res:{value:new THREE.Vector2(1,1)},maxR:{value:28}},
  vertexShader:'varying vec2 vU;void main(){vU=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`#include <common>
#include <packing>
uniform sampler2D tex;uniform sampler2D depth;uniform float near,far,f,N,invS,pxPerMm,maxR;uniform vec2 res;varying vec2 vU;
float dist(vec2 uv){return -perspectiveDepthToViewZ(texture2D(depth,uv).x,near,far)*1000.;}
float coc(float D){return min(maxR,.5*pxPerMm*f*f*abs(1.-D*invS)/(N*D*max(1e-4,1.-f*invS)));}
void main(){float cd=dist(vU),cs=coc(cd);vec3 col=texture2D(tex,vU).rgb;float tot=1.,r=.5;
 for(float a=0.;a<400.;a+=2.39996323){if(r>=maxR)break;vec2 uv=vU+vec2(cos(a),sin(a))*r/res;float sd=dist(uv),ss=coc(sd);if(sd>cd)ss=clamp(ss,0.,cs*2.);
  float m=smoothstep(r-.5,r+.5,ss);col+=mix(col/tot,texture2D(tex,uv).rgb,m);tot+=1.;r+=.6/r*4.;}
 gl_FragColor=vec4(col/tot,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
 const dofScene=new THREE.Scene();dofScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),dofMat));const quadScene=new THREE.Scene(),quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 /*
  * Exposure views on the scene-linear frame, scaled so metered mid-grey is 0.18. False colour bands the stops around
  * mid-grey; zebra stripes mark +2 to +2.5 EV (near clipping); the clip view paints highlights at or above +2.5 EV red and
  * shadows at or below −5 EV blue over a neutral image.
  */
 const fcMat=new THREE.ShaderMaterial({uniforms:{tex:{value:rt.texture},k:{value:1},mode:{value:0},res:{value:new THREE.Vector2(1,1)}},vertexShader:'varying vec2 vU;void main(){vU=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform sampler2D tex;uniform float k;uniform int mode;uniform vec2 res;varying vec2 vU;void main(){vec3 c=texture2D(tex,vU).rgb*k;float L=dot(c,vec3(.2126,.7152,.0722));float ev=log2(max(L,1e-5)/.18);
   vec3 base=pow(c/(1.+c),vec3(1./2.2));
   if(mode==1){float s=step(.5,fract((gl_FragCoord.x+gl_FragCoord.y)/14.));gl_FragColor=vec4(ev>=2.&&ev<2.5?mix(base,vec3(s),.75):ev>=2.5?mix(base,vec3(1.,.15,.15),.85):base,1.);return;}
   if(mode==2){float g=pow(L/(1.+L),1./2.2);gl_FragColor=vec4(ev>=2.5?vec3(1.,.1,.1):ev<=-5.?vec3(.1,.35,1.):vec3(g),1.);return;}
   vec3 col=ev<-3.?vec3(.25,.1,.45):ev<-2.?vec3(.1,.2,.75):ev<-1.?vec3(.15,.55,.9):ev<-.34?vec3(.45,.6,.65):ev<=.34?vec3(.2,.78,.35):ev<1.?vec3(.85,.85,.75):ev<2.?vec3(1.,.75,.2):ev<2.5?vec3(1.,.45,.15):vec3(1.,.12,.12);
   gl_FragColor=vec4(mix(vec3(L/(1.+L)),col,.85),1.);}`});quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),fcMat));
 function exposureK(){return Math.PI/targetExposure(camSettings);}
 /* light energy and meter */
 const ray=new THREE.Raycaster(),tmp=new THREE.Vector3(),tmp2=new THREE.Vector3();
 function headPos(h:Head){const t=h.body.translation();return new THREE.Vector3(t.x,h.p.height,t.z);}
 /** Where light leaves the modifier: the diffuser centre, or the inside of a reflective umbrella. */
 function emitPos(h:Head){const from=headPos(h),dir=aimDir(h,from);return from.addScaledVector(dir,h.mod?.front??0);}
 function aimDir(h:Head,from:THREE.Vector3){const d=face.clone().sub(from).normalize(),side=new THREE.Vector3().crossVectors(d,new THREE.Vector3(0,1,0)).normalize();return d.applyAxisAngle(side,THREE.MathUtils.degToRad(h.p.aimUp)).applyAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(h.p.aimSide)).normalize();}
 function visibility(h:Head,from:THREE.Vector3,dir:THREE.Vector3){const mod=modifierById(h.p.modifier),samples:THREE.Vector3[]=[];
  if(!mod.w)samples.push(from);else{const right=new THREE.Vector3().crossVectors(dir,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(right,dir).normalize();for(const a of [-.4,0,.4])for(const b of [-.4,0,.4])samples.push(from.clone().addScaledVector(right,a*mod.w).addScaledVector(up,b*mod.h));}
  let seen=0;for(const s of samples){tmp.copy(face).sub(s);const dist=tmp.length();tmp.normalize();if(!blocked(s,tmp.clone(),dist-Math.min(.12,dist*.1)))seen++;}return seen/samples.length;}
 function meter():Meter{const parts:Reading[]=[];const toCam=shooter.clone().sub(face).normalize();
  for(const h of heads.values()){if(!h.p.on)continue;const dir=aimDir(h,headPos(h)),from=emitPos(h),mod=modifierById(h.p.modifier);tmp2.copy(face).sub(from);const d=Math.max(.2,tmp2.length());tmp2.normalize();
   const dome=Math.max(0,(1+toCam.dot(tmp2.clone().negate()))/2),vis=visibility(h,from,dir),q=axisEnergy(h.p.spec,Math.pow(2,h.p.stops),h.p.loss,camSettings.shutter);
   let hh:number;
   if(mod.w>0){/* diffused front: a Lambertian surface of luminance L = I₀ / A; E = L · Ω⊥ (exact at any distance) */
    const right=new THREE.Vector3().crossVectors(dir,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(right,dir).normalize(),{poly,area}=modifierOutline(mod,from.toArray() as [number,number,number],right.toArray() as [number,number,number],up.toArray() as [number,number,number]);
    /* exact projected solid angle for the geometry, then the meter's direction response and occlusion averaged over the
       emitter with the same weights (cos θe · cos θr / r²), sample by sample, so a half-hidden box counts where it is hidden */
    const facing=dir.dot(tmp2)>0;if(!facing)hh=0;else{const n=tmp2.clone().negate(),omega=polygonProjectedSolidAngle(poly,face.toArray() as [number,number,number],n.toArray() as [number,number,number]);
     let wsum=0,wdv=0;const k=8;for(let a=0;a<k;a++)for(let b=0;b<k;b++){const u=((a+.5)/k-.5)*mod.w,v=((b+.5)/k-.5)*mod.h;if(mod.shape&&mod.shape!=='rect'&&Math.hypot(u/(mod.w/2),v/(mod.h/2))>1)continue;
      const pt=from.clone().addScaledVector(right,u).addScaledVector(up,v);tmp.copy(face).sub(pt);const r=tmp.length();tmp.normalize();const ce=Math.max(0,dir.dot(tmp)),cr=Math.max(0,n.dot(tmp.clone().negate()));const w=ce*cr/(r*r);if(w<=0)continue;
      const dl=Math.max(0,(1+toCam.dot(tmp.clone().negate()))/2);const seen=blocked(pt,tmp.clone(),Math.max(.01,r-Math.min(.12,r*.1)))?0:1;wsum+=w;wdv+=w*(cr>0?dl/cr:0)*seen;}
     hh=wsum>0?q/area*omega*wdv/wsum:0;}}
   else{/* reflector or bare head: a point source with the reflector's beam profile, inverse-square */
    const off=THREE.MathUtils.radToDeg(dir.angleTo(tmp2)),beam=beamFactor(off,h.p.spec.beam&&mod.id==='reflector'?h.p.spec.beam:mod.beam);hh=q*beam*dome*vis/(d*d);}parts.push({id:h.p.id,h:hh,aperture:apertureFor(hh,camSettings.iso),share:0,cct:h.p.cct??h.p.spec.cct??5600,cri:h.p.spec.cri,visible:vis});}
  const bounce=parts.length?bounceExposure():0,total=parts.reduce((a,p)=>a+p.h,0)+bounce;for(const p of parts)p.share=total?p.h/total:0;const target=targetExposure(camSettings);
  return {bounce,total,aperture:apertureFor(total,camSettings.iso),target,deltaStops:total?Math.log2(total/target):-Infinity,parts};}
 /**
  * Average inter-reflected exposure, treating the studio as an integrating enclosure: the heads' total flux Φ first
  * lands mostly on the sweep (reflectance ρ₁), and repeated bounces over all surfaces (area A, area-weighted mean
  * reflectance ρ̄; walls and ceiling share the studio's finish at 0.94 ρ₁) build up E = Φ · ρ₁ / (A · (1 − ρ̄)). Φ integrates each head's intensity profile; a diffused front
  * is Lambertian, so Φ = π · I₀.
  */
 const SWEEP_AREA=STUDIO_W*(FLOOR_FRONT-WALL_Z+WALL_H),ROOM_AREA=2*(20*6+20*18+6*18);
 function bounceExposure(){let flux=0;for(const h of heads.values()){if(!h.p.on)continue;const mod=modifierById(h.p.modifier),q=axisEnergy(h.p.spec,Math.pow(2,h.p.stops),h.p.loss,camSettings.shutter);
   flux+=mod.w>0?Math.PI*q:beamFlux(q,h.p.spec.beam&&mod.id==='reflector'?h.p.spec.beam:mod.beam);}
  /* the integrating-sphere result is irradiance on a plane; a dome meter in a uniform field reads twice that (its
     response integrates to 2π over the sphere, a flat cosine receptor's to π) */
  const rho1=ALBEDO[backdrop],mean=(SWEEP_AREA*rho1+(ROOM_AREA-SWEEP_AREA)*rho1*.94)/ROOM_AREA;return 2*flux*rho1/(ROOM_AREA*(1-mean));}
 /* scene updates */
 function applyLights(){for(const h of heads.values()){const from=headPos(h),dir=aimDir(h,from),yaw=Math.atan2(dir.x,dir.z);h.head.position.copy(from);h.head.lookAt(from.clone().add(dir));
   h.yoke.position.copy(from);h.yoke.rotation.set(0,yaw,0);h.base.position.set(from.x,0,from.z);h.base.rotation.y=yaw;
   /* the stand under the head changes with height: floor plate, shortened stand or full stand */
   const top=Math.max(.05,from.y-(h.model?.drop??.1));if(standKey(top)!==h.standKey){h.base.remove(h.stand.group);disposeTree(h.stand.group);const n=standFor(top);h.stand=n.stand;h.standKey=n.key;h.base.add(n.stand.group);}else h.stand.setTop(top);
   const q=axisEnergy(h.p.spec,Math.pow(2,h.p.stops),h.p.loss,camSettings.shutter);h.light.intensity=h.p.on?q:0;h.light.visible=h.p.on;}
  hemi.intensity=bounceExposure();
  /* with no light switched on the set would render black; a neutral preview fill keeps the scene visible for placing
     things. It is display only: the meter never counts it. */
  if(![...heads.values()].some(h=>h.p.on))hemi.intensity=.35/exposureK();}
 let shadowDirty=true;
 let meterTimer=0;function changed(shadows=true){dirty=true;if(shadows)shadowDirty=true;clearTimeout(meterTimer);meterTimer=window.setTimeout(()=>{if(!dead)ev.onMeter?.(meter());},120);}
 /* dragging: pointer over the floor drives the body toward the pointer, so collisions resolve physically */
 let drag:{kind:'light'|'prop'|'camera';id:string}|null=null;const floor=new THREE.Plane(new THREE.Vector3(0,1,0),0),pointer=new THREE.Vector2();
 const pick=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,cam);ray.far=Infinity;};
 const down=(e:PointerEvent)=>{if(tf){e.preventDefault();e.stopPropagation();if(e.button===2)endTransform(false);else endTransform(true);return;}pick(e);const hits=ray.intersectObjects([...[...heads.values()].flatMap(h=>[h.base,h.head,h.yoke]),...props.map(p=>p.group),...(rig.visible?[rig]:[])],true);if(!hits.length){selectedId=null;dirty=true;ev.onSelect?.(null,null);return;}
  let o:THREE.Object3D|null=hits[0].object;while(o&&!o.userData.entity)o=o.parent;if(!o)return;drag=o.userData.entity;selectedId=drag!.id;dirty=true;controls.enabled=false;canvas.setPointerCapture(e.pointerId);ev.onSelect?.(drag!.kind==='camera'?null:drag!.id,drag!.kind==='camera'?null:drag!.kind as 'light'|'prop');};
 const move=(e:PointerEvent)=>{if(!drag)return;pick(e);const p=new THREE.Vector3();if(!ray.ray.intersectPlane(floor,p))return;p.x=THREE.MathUtils.clamp(p.x,-STUDIO_W/2+.3,STUDIO_W/2-.3);p.z=THREE.MathUtils.clamp(p.z,WALL_Z+.4,FLOOR_FRONT-.3);
  if(drag.kind==='camera'){p.z=Math.max(p.z,WALL_Z+.8);moveShooter(p.x,shooter.y,p.z);return;}
  /* the dragged body sits exactly under the pointer; the physics step afterwards only pushes overlapping objects apart */
  const body=drag.kind==='light'?heads.get(drag.id)?.body:props.find(x=>x.id===drag!.id)?.body;if(body){body.setTranslation({x:p.x,y:body.translation().y,z:p.z},true);body.setLinvel({x:0,y:0,z:0},true);}dirty=true;shadowDirty=true;};
 const up=()=>{if(!drag)return;const halt=(b:RAPIER_NS.RigidBody)=>{b.setLinvel({x:0,y:Math.min(0,b.linvel().y),z:0},true);b.setAngvel({x:0,y:0,z:0},true);};
  if(drag.kind==='light'){const h=heads.get(drag.id);if(h){h.target=null;halt(h.body);const t=h.body.translation();ev.onMove?.(h.p.id,t.x,t.z);}}else if(drag.kind==='prop'){const pr=props.find(x=>x.id===drag!.id);if(pr){pr.target=null;halt(pr.body);}}drag=null;controls.enabled=true;changed();};
 const dbl=(e:MouseEvent)=>{if(angleMode!=='camera')return;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,cam);ray.far=Infinity;
  const hit=ray.intersectObjects(scene.children.filter(o=>o!==selHelper&&o!==rig),true).find(x=>(x.object as THREE.Mesh).isMesh);if(!hit)return;const fwd=new THREE.Vector3();cam.getWorldDirection(fwd);focusDist=hit.point.clone().sub(cam.position).dot(fwd);dirty=true;ev.onFocus?.(focusDist);};
  /* dynamic resolution: render at a lower pixel ratio while the view is moving, full quality once it rests */
 const fullRatio=Math.min(1.5,window.devicePixelRatio||1),moveRatio=Math.max(.5,fullRatio*.55);let restTimer=0;
 const moving=()=>{clearTimeout(restTimer);if(renderer.getPixelRatio()!==moveRatio){renderer.setPixelRatio(moveRatio);dirty=true;}};
 const resting=()=>{clearTimeout(restTimer);restTimer=window.setTimeout(()=>{if(dead)return;renderer.setPixelRatio(fullRatio);dirty=true;},220);};
 controls.addEventListener('start',moving);controls.addEventListener('end',resting);
 canvas.addEventListener('dblclick',dbl);canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);controls.addEventListener('change',()=>{dirty=true;if(angleMode==='camera'&&!drag){shooter.copy(cam.position);aim.copy(controls.target);placeRig();changed(false);}});
 /*
  * Viewport transforms in the manner of Blender: with an object selected, G grabs it and R turns a light's aim. While a
  * transform runs, X / Y / Z lock the axis (Z is height, as in Blender), Shift moves finer, Ctrl snaps to 10 cm (1 cm
  * with Shift) or 5°, typed digits give an exact value, and Enter or a left click confirms; Esc or a right click puts
  * the object back. A line over the view states the operation.
  */
 type Tf={mode:'grab'|'rotate';kind:'light'|'prop'|'camera';id:string;axis:''|'x'|'y'|'z';typed:string;sx:number;sy:number;start:{x:number;y:number;z:number;aim:number};anchor:THREE.Vector3|null};
 let tf:Tf|null=null;const lastPointer={x:0,y:0};
 const hud=document.createElement('div');hud.className='lab-hud';hud.hidden=true;const host=canvas.parentElement;if(host){if(getComputedStyle(host).position==='static')host.style.position='relative';host.appendChild(hud);}
 const floorHit=(cx:number,cy:number)=>{const r=canvas.getBoundingClientRect();pointer.set((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1);ray.setFromCamera(pointer,cam);ray.far=Infinity;const p=new THREE.Vector3();return ray.ray.intersectPlane(floor,p)?p:null;};
 const stateOf=(kind:Tf['kind'],id:string)=>{if(kind==='camera')return {x:shooter.x,y:shooter.y,z:shooter.z,aim:0};
  if(kind==='light'){const h=heads.get(id)!,t=h.body.translation();return {x:t.x,y:h.p.height,z:t.z,aim:h.p.aimSide};}const b=props.find(p=>p.id===id)!.body.translation();return {x:b.x,y:b.y,z:b.z,aim:0};};
 const place=(kind:Tf['kind'],id:string,x:number,y:number,z:number,aim:number)=>{x=THREE.MathUtils.clamp(x,-STUDIO_W/2+.3,STUDIO_W/2-.3);z=THREE.MathUtils.clamp(z,WALL_Z+.4,FLOOR_FRONT+(kind==='camera'?3:-.3));
  if(kind==='camera'){moveShooter(x,y,z);return;}
  if(kind==='light'){const h=heads.get(id);if(!h)return;h.target=null;h.body.setTranslation({x,y:h.body.translation().y,z},true);h.body.setLinvel({x:0,y:0,z:0},true);h.p={...h.p,height:THREE.MathUtils.clamp(y,.15,3.2),aimSide:THREE.MathUtils.clamp(aim,-180,180)};applyLights();}
  else{const pr=props.find(p=>p.id===id);if(!pr)return;pr.target=null;pr.body.setTranslation({x,y:pr.body.translation().y,z},true);pr.body.setLinvel({x:0,y:0,z:0},true);}
  dirty=true;shadowDirty=true;};
 /* axis indicator in the top-right corner, as in Blender: X red, Y green (towards the backdrop), Z blue (up); the
    negative ends are faint dots. It turns with the view. */
 const gizmo=document.createElementNS('http://www.w3.org/2000/svg','svg');gizmo.setAttribute('class','lab-gizmo');gizmo.setAttribute('viewBox','-40 -40 80 80');host?.appendChild(gizmo);
 const AXES:[string,string,THREE.Vector3][]=[['X','#ff3352',new THREE.Vector3(1,0,0)],['Y','#8bdc00',new THREE.Vector3(0,0,-1)],['Z','#2890ff',new THREE.Vector3(0,1,0)]];
 const gq=new THREE.Quaternion(),gv=new THREE.Vector3();
 const drawGizmo=()=>{gq.copy(cam.quaternion).invert();const items:{z:number;svg:string}[]=[];
  for(const [name,color,axis] of AXES){for(const sign of [1,-1]){gv.copy(axis).multiplyScalar(sign).applyQuaternion(gq);const x=gv.x*26,y=-gv.y*26;
   items.push({z:gv.z,svg:sign>0?`<line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="${color}"/><text x="${x.toFixed(1)}" y="${(y+3.5).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#000">${name}</text>`:`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${color}" fill-opacity=".35" stroke="${color}" stroke-opacity=".7"/>`});}}
  items.sort((a,b)=>a.z-b.z);gizmo.innerHTML=items.map(i=>i.svg).join('');};
 const fmt=(v:number,unit:string)=>(v>=0?'+':'')+v.toFixed(unit==='°'?0:2)+' '+unit;
 const update=(cx:number,cy:number,fine:boolean,snap:boolean)=>{if(!tf)return;const t=tf,s0=t.start,typed=t.typed!==''&&t.typed!=='-'&&Number.isFinite(Number(t.typed))?Number(t.typed):null;
  let {x,y,z,aim}=s0,label='';
  if(t.mode==='rotate'){let d=typed??(cx-t.sx)*.4*(fine?.1:1);if(snap&&typed===null)d=Math.round(d/5)*5;aim=s0.aim+d;label=`旋转 · 水平朝向 ${fmt(d,'°')}`;}
  else if(t.axis==='z'){let d=typed??-(cy-t.sy)*.005*(fine?.1:1);if(snap&&typed===null)d=Math.round(d/(fine?.01:.1))*(fine?.01:.1);y=s0.y+d;label=`移动 · Z 轴（高度） ${fmt(d,'m')}`;}
  else{let dx=0,dz=0;if(typed!==null){if(t.axis==='y')dz=-typed;else dx=typed;}else{const p=floorHit(cx,cy);if(p&&t.anchor){dx=(p.x-t.anchor.x)*(fine?.1:1);dz=(p.z-t.anchor.z)*(fine?.1:1);}if(t.axis==='x')dz=0;if(t.axis==='y')dx=0;
    if(snap){const q=fine?.01:.1;dx=Math.round((s0.x+dx)/q)*q-s0.x;dz=Math.round((s0.z+dz)/q)*q-s0.z;}}
   x=s0.x+dx;z=s0.z+dz;label=t.axis?`移动 · ${t.axis.toUpperCase()} 轴 ${fmt(t.axis==='x'?dx:-dz,'m')}`:`移动 · X ${fmt(dx,'m')} · Y ${fmt(-dz,'m')}`;}
  place(t.kind,t.id,x,y,z,aim);
  hud.textContent=`${label}${t.typed?`　输入：${t.typed}`:''}　｜　X / Y / Z 锁定轴向 · Shift 精细 · Ctrl 吸附 · Enter 确认 · Esc 取消`;};
 const startTransform=(mode:Tf['mode'])=>{if(tf||!selectedId)return false;const kind:Tf['kind']=selectedId==='camera'?'camera':heads.has(selectedId)?'light':props.some(p=>p.id===selectedId)?'prop':'light';
  if(mode==='rotate'&&kind!=='light')return false;if(kind==='light'&&!heads.has(selectedId))return false;
  tf={mode,kind,id:selectedId,axis:'',typed:'',sx:lastPointer.x,sy:lastPointer.y,start:stateOf(kind,selectedId),anchor:floorHit(lastPointer.x,lastPointer.y)};controls.enabled=false;hud.hidden=false;update(lastPointer.x,lastPointer.y,false,false);return true;};
 const endTransform=(keep:boolean)=>{if(!tf)return;const t=tf;if(!keep)place(t.kind,t.id,t.start.x,t.start.y,t.start.z,t.start.aim);tf=null;hud.hidden=true;controls.enabled=true;
  if(t.kind==='light'){const h=heads.get(t.id);if(h){const b=h.body.translation();ev.onMove?.(t.id,b.x,b.z);ev.onPatch?.(t.id,{height:h.p.height,aimSide:h.p.aimSide});}}changed();};
 const transformKey=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();
  if(!tf){if(e.ctrlKey||e.altKey||e.metaKey)return false;if(k==='g'&&startTransform('grab')){e.preventDefault();return true;}if(k==='r'&&startTransform('rotate')){e.preventDefault();return true;}return false;}
  e.preventDefault();const t=tf;
  if(k==='escape'){endTransform(false);return true;}if(k==='enter'){endTransform(true);return true;}
  if(t.mode==='grab'&&(k==='x'||k==='y'||k==='z')){t.axis=t.axis===k?'':k;t.typed='';t.anchor=floorHit(lastPointer.x,lastPointer.y);t.sx=lastPointer.x;t.sy=lastPointer.y;place(t.kind,t.id,t.start.x,t.start.y,t.start.z,t.start.aim);}
  else if(/^[0-9.]$/.test(k))t.typed+=k;else if(k==='-')t.typed=t.typed.startsWith('-')?t.typed.slice(1):'-'+t.typed;else if(k==='backspace')t.typed=t.typed.slice(0,-1);
  update(lastPointer.x,lastPointer.y,e.shiftKey,e.ctrlKey);return true;};
 const track=(e:PointerEvent)=>{lastPointer.x=e.clientX;lastPointer.y=e.clientY;if(tf)update(e.clientX,e.clientY,e.shiftKey,e.ctrlKey);};
 const noMenu=(e:MouseEvent)=>{if(tf){e.preventDefault();endTransform(false);}};
 window.addEventListener('pointermove',track);canvas.addEventListener('contextmenu',noMenu);
 /* keyboard: W A S D or arrows move the shooting position on the floor, Q / E lower and raise it; Shift moves finer */
 canvas.tabIndex=0;const key=(e:KeyboardEvent)=>{if(transformKey(e))return;const k=e.key.toLowerCase(),step=e.shiftKey?.05:.2;const fwd=aim.clone().sub(shooter);fwd.y=0;if(fwd.lengthSq()<1e-6)fwd.set(0,0,-1);fwd.normalize();const right=new THREE.Vector3(-fwd.z,0,fwd.x);let d:THREE.Vector3|null=null,dy=0;
  if(k==='w'||k==='arrowup')d=fwd.multiplyScalar(step);else if(k==='s'||k==='arrowdown')d=fwd.multiplyScalar(-step);else if(k==='a'||k==='arrowleft')d=right.multiplyScalar(-step);else if(k==='d'||k==='arrowright')d=right.multiplyScalar(step);else if(k==='q')dy=-step/2;else if(k==='e')dy=step/2;else return;
  e.preventDefault();moveShooter(shooter.x+(d?.x??0),shooter.y+dy,shooter.z+(d?.z??0));};canvas.addEventListener('keydown',key);
 const fit=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;const pr=renderer.getPixelRatio();if(canvas.width===Math.round(w*pr)&&canvas.height===Math.round(h*pr))return;renderer.setSize(w,h,false);rt.setSize(Math.round(w*pr),Math.round(h*pr));dofRt.setSize(Math.round(w*pr),Math.round(h*pr));cam.aspect=w/h;cam.updateProjectionMatrix();dirty=true;};
 const ro=new ResizeObserver(fit);ro.observe(canvas);fit();
 /** First clear floor spot in front of the subject, scanning outward, so a new prop never spawns inside another. */
 function freeSpot(r:number):[number,number]{const taken=[...props.map(p=>{const t=p.body.translation();return [t.x,t.z,Math.hypot(p.group.userData.half[0],p.group.userData.half[2])];}),...[...heads.values()].map(h=>{const t=h.body.translation();return [t.x,t.z,.3];}),[0,0,.35]];
  for(let ring=0;ring<8;ring++)for(let i=0;i<12;i++){const a=i/12*Math.PI*2,d=1+ring*.45,x=Math.sin(a)*d,z=.6+Math.cos(a)*d*.8;if(z<WALL_Z+.6||z>FLOOR_FRONT-.5||Math.abs(x)>STUDIO_W/2-.6)continue;
   if(taken.every(([tx,tz,tr])=>Math.hypot(x-tx,z-tz)>r+tr+.08))return [x,z];}return [0,2.5];}
 let raf=0,settling=0,dead=false;
 const loop=()=>{raf=requestAnimationFrame(loop);if(document.hidden)return;fit();
  const moving=drag!==null||settling>0||[...heads.values()].some(h=>h.target)||props.some(p=>p.target);
  if(moving){for(const h of heads.values()){const t=h.body.translation();if(h.target){const dx=h.target.x-t.x,dz=h.target.z-t.z,near=Math.hypot(dx,dz)<.004,vx=near?0:THREE.MathUtils.clamp(dx*14,-5,5),vz=near?0:THREE.MathUtils.clamp(dz*14,-5,5);h.body.setLinvel({x:vx,y:h.body.linvel().y,z:vz},true);}}
   for(const p of props){const t=p.body.translation();if(p.target){const dx=p.target.x-t.x,dz=p.target.z-t.z,near=Math.hypot(dx,dz)<.004,vx=near?0:THREE.MathUtils.clamp(dx*14,-5,5),vz=near?0:THREE.MathUtils.clamp(dz*14,-5,5);p.body.setLinvel({x:vx,y:p.body.linvel().y,z:vz},true);}}
   world.step();for(const p of props){const t=p.body.translation(),r=p.body.rotation();p.group.position.set(t.x,t.y-p.group.userData.half[1],t.z);p.group.quaternion.set(r.x,r.y,r.z,r.w);}
   applyLights();dirty=true;shadowDirty=true;settling=drag?40:Math.max(0,settling-1);
   /* once things come to rest, report stands that were pushed aside so the page keeps the same positions */
   if(!drag&&settling===1){for(const h of heads.values()){const t=h.body.translation();if(Math.hypot(t.x-h.p.x,t.z-h.p.z)>.01)ev.onMove?.(h.p.id,t.x,t.z);}changed();}}
  controls.update();if(dirty)draw();};
 /** Distance from the shooting position to the face, metres: the default focus. */
 const faceDistance=()=>shooter.distanceTo(face);
 /** Focus distance in use, metres (Infinity for infinity focus). */
 const focusM=()=>{const s=focusDist===0?faceDistance():focusDist;return Number.isFinite(s)?Math.max(s,minFocus()):s;};
 /** closest focus allowed: never inside the focal length, and not closer than a typical lens of this focal length focuses */
 const minFocus=()=>Math.max(.25,focal/1000*8);
 function renderPhoto(){renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=exposureK();
  if(!(dofOn&&angleMode==='camera')){renderer.setRenderTarget(null);renderer.render(scene,cam);return;}
  renderer.setRenderTarget(dofRt);renderer.render(scene,cam);renderer.setRenderTarget(null);
  const u=dofMat.uniforms,s=focusM();u.near.value=cam.near;u.far.value=cam.far;u.f.value=focal;u.N.value=camSettings.aperture;u.invS.value=Number.isFinite(s)?1/(s*1000):0;
  u.res.value.set(dofRt.width,dofRt.height);u.pxPerMm.value=dofRt.height/24;u.maxR.value=Math.min(40,dofRt.height*.04);renderer.render(dofScene,quadCam);}
 function draw(){fit();dirty=false;frameSelection();drawGizmo();if(shadowDirty){renderer.shadowMap.needsUpdate=true;shadowDirty=false;}renderer.toneMappingExposure=exposureK();
  if(view==='photo')renderPhoto();
  else{renderer.toneMapping=THREE.NoToneMapping;renderer.setRenderTarget(rt);renderer.render(scene,cam);renderer.setRenderTarget(null);fcMat.uniforms.k.value=exposureK();fcMat.uniforms.mode.value=view==='zebra'?1:view==='clip'?2:0;renderer.render(quadScene,quadCam);}}
 loop();
 const api={
  setLights(list:Placement[]){if(dead)return undefined as never;for(const [id,h] of heads)if(!list.some(p=>p.id===id)){scene.remove(h.base,h.yoke,h.head);h.light.dispose();world.removeRigidBody(h.body);heads.delete(id);}
   for(const p of list){let h=heads.get(p.id);if(!h){h=makeHead(p);h.base.userData.entity=h.yoke.userData.entity=h.head.userData.entity={kind:'light',id:p.id};heads.set(p.id,h);}
    const prev=h.p;h.p=p;if(prev.x!==p.x||prev.z!==p.z)h.body.setTranslation({x:p.x,y:.5,z:p.z},true);styleHead(h);}
   applyLights();settling=2;changed();},
  addProp(kind:PropKind){if(dead)return undefined as never;const {group,half}=propMesh(kind),id='prop-'+Math.random().toString(36).slice(2,8);group.userData.entity={kind:'prop',id};group.userData.half=half;scene.add(group);
   const [x,z]=freeSpot(Math.hypot(half[0],half[2]));const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,half[1]+.02,z).setLinearDamping(12).setAngularDamping(12).enabledRotations(false,true,false));
   world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setFriction(.9).setDensity(kind==='ladder'?250:120),body);props.push({id,kind,body,group,target:null});settling=80;changed();return id;},
  removeSelectedProp(id:string){const i=props.findIndex(p=>p.id===id);if(i<0)return;scene.remove(props[i].group);world.removeRigidBody(props[i].body);props.splice(i,1);changed();},
  setBackdrop(b:Backdrop){if(dead)return undefined as never;backdrop=b;cycMat.color.setScalar(ALBEDO[b]);roomMat.color.setScalar(ALBEDO[b]*.94);applyLights();scene.background=new THREE.Color(b==='black'?0x050505:0x1c1c1e);changed();},
  setCamera(c:Camera){if(dead)return undefined as never;camSettings=c;applyLights();changed();},
  setView(v:ViewMode){view=v;dirty=true;},
  /** Histograms of the photo view exactly as it is displayed (after tone mapping), read back from the drawing buffer. */
  histogram():Histogram{const keep=view,sel=selHelper.visible;view='photo';selHelper.visible=false;renderPhoto();
   const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,px=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px);view=keep;selHelper.visible=sel;dirty=true;draw();
   const luma=new Array(256).fill(0),r=new Array(256).fill(0),g=new Array(256).fill(0),b=new Array(256).fill(0);let n=0,hi=0,lo=0;
   for(let i=0;i<px.length;i+=16){const R=px[i],G=px[i+1],B=px[i+2],Y=Math.round(.2126*R+.7152*G+.0722*B);r[R]++;g[G]++;b[B]++;luma[Y]++;n++;if(R>=254||G>=254||B>=254)hi++;if(Y<=1)lo++;}
   return {luma,r,g,b,clipHigh:n?hi/n:0,clipLow:n?lo/n:0};},
  /** Depth of field in the camera view. `distance` in metres, Infinity for infinity focus, 0 to focus on the face. */
  setFocus(distance:number){focusDist=distance;dirty=true;},
  setDepthOfField(on:boolean){dofOn=on;dirty=true;},
  /** Focus distance in use and the near / far limits of acceptable sharpness (circle of confusion 0.03 mm). */
  focusInfo(){const s=focusM(),d=depthOfField(focal,camSettings.aperture,s);return {focus:s,...d,min:minFocus()};},
  /** Frames a stand or prop chosen in the side list. */
  select(id:string|null){selectedId=id;dirty=true;},
  /** The photographer's position with a portrait lens, or a high three-quarter view that shows every stand. */
  setCameraView(v:CameraView){angleMode=v;rig.visible=v!=='camera';shadowDirty=true;if(v==='camera'){cam.fov=lensFov(focal);cam.position.copy(shooter);controls.target.copy(aim);}else{cam.fov=38;cam.position.set(2.6,2.9,7.4);controls.target.set(0,1,-.4);}cam.updateProjectionMatrix();controls.update();dirty=true;},
  resetView(){api.setCameraView('camera');},
  setFocal(mm:number){focal=mm;if(angleMode==='camera'){cam.fov=lensFov(mm);cam.updateProjectionMatrix();dirty=true;}},
  /** Puts a loaded subject on the mark, facing the camera; the meter point moves to its face. */
  setSubject(next:{object:THREE.Object3D;face:THREE.Vector3}){if(dead)return undefined as never;scene.remove(subject);subject=next.object;subjectGrid=null;subject.rotation.y=subjectYaw;scene.add(subject);faceLocal.copy(next.face);placeFace();changed();},
  /** Turns the subject on its mark (degrees, 0 faces the camera). */
  setSubjectYaw(deg:number){subjectYaw=THREE.MathUtils.degToRad(deg);subject.rotation.y=subjectYaw;placeFace();changed();},
  useMannequin(){api.setSubject({object:mannequin(),face:new THREE.Vector3(0,1.6,.11)});},
  meter,
  /** Runs the physics until props and stands come to rest (used after loading a setup, and by tests). */
  settle(steps=180){if(dead)return undefined as never;for(let i=0;i<steps;i++)world.step();for(const p of props){const t=p.body.translation(),r=p.body.rotation();p.group.position.set(t.x,t.y-p.group.userData.half[1],t.z);p.group.quaternion.set(r.x,r.y,r.z,r.w);}applyLights();changed();
   return props.map(p=>{const t=p.body.translation();return {kind:p.kind,x:+t.x.toFixed(2),y:+t.y.toFixed(2),z:+t.z.toFixed(2)};});},
  /** Renders the current view and returns it as a PNG data URL (for exports and contact sheets). */
  debug(){const gl=renderer.getContext();return {cam:cam.position.toArray().map(v=>+v.toFixed(2)),target:controls.target.toArray().map(v=>+v.toFixed(2)),fov:cam.fov,aspect:+cam.aspect.toFixed(2),lost:gl.isContextLost(),size:[canvas.width,canvas.height,canvas.clientWidth,canvas.clientHeight],calls:renderer.info.render.calls,tris:renderer.info.render.triangles,programs:renderer.info.programs?.length,exp:exposureK(),err:gl.getError()};},
  probe(points:[number,number][]){draw();const gl=renderer.getContext(),px=new Uint8Array(4);return points.map(([fx,fy])=>{gl.readPixels(Math.round(gl.drawingBufferWidth*fx),Math.round(gl.drawingBufferHeight*(1-fy)),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);return [...px].slice(0,3).join(',');});},
  snapshot(){dirty=true;draw();return canvas.toDataURL('image/png');},
  destroy(){if(dead)return;dead=true;cancelAnimationFrame(raf);clearTimeout(meterTimer);ro.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('keydown',key);window.removeEventListener('pointermove',track);canvas.removeEventListener('contextmenu',noMenu);hud.remove();gizmo.remove();canvas.removeEventListener('dblclick',dbl);clearTimeout(restTimer);controls.dispose();
   scene.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();const mat=m.material as THREE.Material|THREE.Material[]|undefined;if(Array.isArray(mat))mat.forEach(x=>x.dispose());else mat?.dispose();});dofRt.depthTexture?.dispose();dofRt.dispose();dofMat.dispose();rt.dispose();renderer.dispose();world.free();}};
 api.setBackdrop(backdrop);ev.onReady?.();return api;
}
export type LightingLab=Awaited<ReturnType<typeof createLightingLab>>;
