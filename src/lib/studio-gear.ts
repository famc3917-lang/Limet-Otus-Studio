// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/**
 * Studio gear modelled at real size, in metres, for the lighting lab.
 *
 * Reference sizes: a heavy light stand with a Ø35 mm base column, 1.2 m folded, about 95 cm across the feet and three
 * sections reaching 2.8 m; a 600 Ws battery head of 250 × 245 × 125 mm (Godox AD600Pro, with battery) with a Bowens
 * mount; a 60 × 90 cm softbox about 41 cm deep; an umbrella-frame octabox; umbrellas with eight ribs; a 55 cm dish.
 *
 * Head frame: +Z points at the subject and the origin is the tilt axis of the bracket. A modifier starts at the
 * mount plane and `front` is where light leaves it, so meter rays start from the real diffuser.
 */
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const M=(color:number,roughness:number,metalness=0,extra:Partial<THREE.MeshStandardMaterialParameters>={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
export const GEAR={
 anodised:M(0x141416,.42,.65),chrome:M(0xd9dbe0,.18,1),rubber:M(0x0b0b0c,.9),plastic:M(0x1c1c1f,.55),
 body:M(0x2a2b2e,.5,.15),bodyDark:M(0x161618,.6,.1),glass:M(0x0a0c10,.08,0,{envMapIntensity:1}),
 fabricOut:M(0x111112,.95,0,{side:THREE.FrontSide}),silver:M(0xcfd2d6,.32,.85,{side:THREE.FrontSide}),
 white:M(0xf3f3f1,.9,0),band:M(0x0d0d0e,.9),tube:M(0xffffff,.05,0,{transparent:true,opacity:.55}),
};
const shadowed=<T extends THREE.Object3D>(o:T)=>{o.traverse(c=>{const m=c as THREE.Mesh;if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});return o;};
/** A cylinder between two points. */
function rod(a:THREE.Vector3,b:THREE.Vector3,r:number,mat:THREE.Material,seg=10){const d=b.clone().sub(a),len=d.length();const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,seg),mat);
 m.position.copy(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
/** A flat bar between two points, `w` wide and `t` thick, its wide side facing `side`. */
function bar(a:THREE.Vector3,b:THREE.Vector3,w:number,t:number,mat:THREE.Material){const d=b.clone().sub(a),len=d.length();const m=new THREE.Mesh(new RoundedBoxGeometry(w,len,t,2,Math.min(w,t)*.45),mat);
 m.position.copy(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
function lathe(profile:[number,number][],mat:THREE.Material,seg=48){return new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),seg),mat);}
/** Lathe profiles run along +Y; turn them to run along +Z. */
const alongZ=<T extends THREE.Object3D>(o:T)=>{o.rotation.x=Math.PI/2;return o;};

/* ======================= light stand ======================= */
export interface Stand { group:THREE.Group; /** puts the spigot top at this height above the floor */ setTop(h:number):void; minTop:number; maxTop:number }
export function lightStand(f=1):Stand{
 const g=new THREE.Group(),A=GEAR.anodised;
 const HUB=.62*f,SLIDE=.36*f,FOOT=.47*Math.max(.55,f),BASE_BOTTOM=.3*f,BASE_TOP=1.1*f;
 /* base column with end cap, hub collar and sliding collar */
 g.add(alongYTube(.0175,BASE_BOTTOM,BASE_TOP,A));g.add(capAt(BASE_BOTTOM,.0185));
 g.add(collar(HUB,.03,.052));g.add(collar(SLIDE,.026,.04));
 for(let i=0;i<3;i++){const a=i/3*Math.PI*2+Math.PI/6,dir=new THREE.Vector3(Math.cos(a),0,Math.sin(a));
  const hinge=new THREE.Vector3().addScaledVector(dir,.03).setY(HUB),foot=new THREE.Vector3().addScaledVector(dir,FOOT).setY(.022);
  g.add(bar(hinge,foot,.024,.013,A));
  /* leg brace from the sliding collar to 45 % down the leg */
  const mid=hinge.clone().lerp(foot,.45),slide=new THREE.Vector3().addScaledVector(dir,.026).setY(SLIDE);g.add(bar(slide,mid,.014,.006,A));
  const pin=rod(mid.clone().addScaledVector(new THREE.Vector3(-dir.z,0,dir.x),.012),mid.clone().addScaledVector(new THREE.Vector3(-dir.z,0,dir.x),-.012),.004,GEAR.chrome,8);g.add(pin);
  const shoe=new THREE.Mesh(new RoundedBoxGeometry(.05,.025,.034,2,.01),GEAR.rubber);shoe.position.copy(foot).setY(.0125);shoe.rotation.y=-a;g.add(shoe);
  const hingeBlock=new THREE.Mesh(new RoundedBoxGeometry(.03,.04,.03,2,.006),GEAR.plastic);hingeBlock.position.copy(hinge).addScaledVector(dir,.012);hingeBlock.rotation.y=-a;g.add(hingeBlock);}
 /* telescoping sections with collar knobs */
 const s2=alongYTube(.015,0,1,A),s3=alongYTube(.0125,0,1,A),c1=collarKnob(.022),c2=collarKnob(.019),c3=collarKnob(.016);
 c1.position.y=BASE_TOP;g.add(s2,s3,c1,c2,c3);
 const spigot=new THREE.Group();spigot.add(lathe([[0,0],[.0105,0],[.0105,.035],[.008,.04],[.008,.085],[.0065,.09],[0,.09]],GEAR.chrome,24));g.add(spigot);
 const minTop=BASE_TOP+.1+.09,maxTop=3.0;
 function setTop(h:number){const top=THREE.MathUtils.clamp(h,minTop,maxTop),e=top-minTop,v2=.05+Math.min(e,.9),v3=.05+Math.max(0,e-.9);
  const s2top=BASE_TOP+v2,s3top=s2top+v3;s2.scale.y=v2+.25;s2.position.y=BASE_TOP-.25;s3.scale.y=v3+.25;s3.position.y=s2top-.25;
  c2.position.y=s2top;c3.position.y=s3top;spigot.position.y=s3top;}
 setTop(minTop);return {group:shadowed(g),setTop,minTop,maxTop};
 function alongYTube(r:number,y0:number,y1:number,mat:THREE.Material){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,1,20),mat);m.geometry.translate(0,.5,0);m.scale.y=y1-y0;m.position.y=y0;return m;}
 function capAt(y:number,r:number){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.9,.018,20),GEAR.rubber);m.position.y=y-.006;return m;}
 function collar(y:number,h:number,r:number){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),GEAR.plastic);m.position.y=y;return m;}
 function collarKnob(r:number){const k=new THREE.Group();const ring=new THREE.Mesh(new THREE.CylinderGeometry(r+.008,r+.01,.045,24),GEAR.plastic);ring.position.y=-.02;k.add(ring);
  const screw=new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,.03,10),GEAR.chrome);screw.rotation.z=Math.PI/2;screw.position.set(r+.022,-.02,0);k.add(screw);
  const t=new THREE.Mesh(new RoundedBoxGeometry(.012,.05,.016,2,.005),GEAR.plastic);t.position.set(r+.04,-.02,0);k.add(t);return k;}
}

/** Floor plate with a short spigot, for lights 5-35 cm off the floor. */
export function floorPlate():Stand{const g=new THREE.Group();const plate=new THREE.Mesh(new RoundedBoxGeometry(.26,.012,.26,2,.004),GEAR.anodised);plate.position.y=.006;g.add(plate);
 for(const [x,z] of [[-.11,-.11],[.11,-.11],[-.11,.11],[.11,.11]]){const pad=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.004,12),GEAR.rubber);pad.position.set(x,.002,z);g.add(pad);}
 const post=new THREE.Mesh(new THREE.CylinderGeometry(.0105,.0105,1,16),GEAR.chrome);post.geometry.translate(0,.5,0);post.position.y=.012;g.add(post);
 const setTop=(h:number)=>{post.scale.y=Math.max(.03,h-.012);};setTop(.1);return {group:shadowed(g),setTop,minTop:.05,maxTop:.35};}
const FULL_MIN=1.1+.1+.09;
/** Which support suits a spigot height from 5 cm to 3 m: a floor plate, a shortened stand, or the full stand. */
export const standKey=(top:number)=>top<=.35?'plate':top>=FULL_MIN?'full':'low'+Math.round(top/FULL_MIN*20)/20;
export function standFor(top:number):{stand:Stand;key:string}{const key=standKey(top);
 const s=key==='plate'?floorPlate():key==='full'?lightStand(1):lightStand(Number(key.slice(3)));s.setTop(top);return {stand:s,key};}

/* ======================= heads ======================= */
export interface HeadModel { body:THREE.Group; yoke:THREE.Group; /** z of the mount plane */ mount:number; /** pivot height above the spigot top */ drop:number; modellingLamp:THREE.Mesh }
/** Battery strobe with a bracket and Bowens mount. Default size is the 600 Ws class: 250 long × 245 tall × 125 wide. */
export function strobeHead(L=.25,H=.245,W=.125):HeadModel{
 const body=new THREE.Group(),yoke=new THREE.Group(),k=H/.245;
 const shell=new THREE.Mesh(new RoundedBoxGeometry(W,H*.67,L,4,.018*k),GEAR.body);shell.position.set(0,H*.49,-L/2+.065);body.add(shell);
 const battery=new THREE.Mesh(new RoundedBoxGeometry(W*.94,H*.33,L*.64,3,.012*k),GEAR.bodyDark);battery.position.set(0,H*.18,-L/2+.03);body.add(battery);
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(.075,.05),M(0x1f3a52,.2,0,{emissive:0x3b7fb5,emissiveIntensity:.0}));screen.position.set(0,H*.6,-L/2+.064);screen.scale.setScalar(k);screen.rotation.y=Math.PI;body.add(screen);
 const panel=new THREE.Mesh(new RoundedBoxGeometry(.105,.12,.006,2,.003),GEAR.glass);panel.position.set(0,H*.55,-L/2+.0645);panel.scale.setScalar(k);body.add(panel);
 for(let i=0;i<4;i++){const b=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.004,12),GEAR.plastic);b.rotation.x=Math.PI/2;b.position.set((-.03+i*.02)*k,H*.37,-L/2+.0625);body.add(b);}
 const dial=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.008,24),GEAR.plastic);dial.rotation.x=Math.PI/2;dial.position.set(.035*k,H*.37,-L/2+.061);body.add(dial);
 /* Bowens mount: collar, three bayonet tabs, flash tube and modelling lamp */
 const mountZ=.085,mount=alongZ(lathe([[.062,0],[.072,0],[.072,.012],[.066,.016],[.066,.02],[.05,.02]],GEAR.anodised));mount.position.set(0,H*.49,mountZ-.02);body.add(mount);
 for(let i=0;i<3;i++){const tab=new THREE.Mesh(new THREE.BoxGeometry(.024,.006,.008),GEAR.anodised);const a=i/3*Math.PI*2;tab.position.set(Math.cos(a)*.075,H*.49+Math.sin(a)*.075,mountZ-.008);tab.rotation.z=a+Math.PI/2;body.add(tab);}
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.018,20,14),M(0xfff4e0,.2,0,{emissive:0xffd9a0,emissiveIntensity:0}));lamp.position.set(0,H*.49,mountZ+.012);body.add(lamp);
 const tube=new THREE.Mesh(new THREE.TorusGeometry(.028,.005,10,40),GEAR.tube);tube.position.set(0,H*.49,mountZ+.004);body.add(tube);
 /* integrated bracket: two cheeks with the tilt knob, receiver socket and lock screw */
 for(const s of [-1,1]){const cheek=new THREE.Mesh(new RoundedBoxGeometry(.012,.07,.06,2,.004),GEAR.anodised);cheek.position.set(s*(W/2+.008),-.005,0);yoke.add(cheek);}
 const cross=new THREE.Mesh(new RoundedBoxGeometry(W+.027,.014,.05,2,.004),GEAR.anodised);cross.position.y=-.04;yoke.add(cross);
 const knob=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.018,20),GEAR.plastic);knob.rotation.z=Math.PI/2;knob.position.x=W/2+.024;yoke.add(knob);
 const socket=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.05,16),GEAR.anodised);socket.position.y=-.07;yoke.add(socket);
 const lock=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.03,12),GEAR.plastic);lock.rotation.x=Math.PI/2;lock.position.set(0,-.075,-.025);yoke.add(lock);
 /* the tilt axis sits under the mount so the modifier's weight balances over the stand */
 /* the light axis runs through the tilt pivot; the bracket hangs below the body */
 body.position.y=-H*.49;yoke.position.y=-H*.49+.012;
 return {body:shadowed(body),yoke:shadowed(yoke),mount:mountZ,drop:.083+H*.49,modellingLamp:lamp};}
/** Pocket flash (AD200 class) on an S-type Bowens bracket with an umbrella hole. */
export function pocketHead():HeadModel{const h=strobeHead(.17,.13,.08);
 /* S-bracket: Bowens ring plate in front of the flash */
 const plate=new THREE.Mesh(new RoundedBoxGeometry(.17,.17,.012,2,.01),GEAR.anodised);plate.position.set(0,0,h.mount-.03);h.body.add(plate);
 const hole=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.04,12),GEAR.chrome);hole.position.set(0,-.07,h.mount-.03);h.body.add(hole);return h;}
/** Speedlight (V1 class): round head on a body, sitting in a cold-shoe on an S-bracket. */
export function speedliteHead():HeadModel{const body=new THREE.Group(),yoke=new THREE.Group();
 const foot=new THREE.Mesh(new RoundedBoxGeometry(.076,.11,.06,3,.01),GEAR.body);foot.position.set(0,-.02,-.12);body.add(foot);
 const neck=new THREE.Mesh(new RoundedBoxGeometry(.07,.04,.05,3,.01),GEAR.bodyDark);neck.position.set(0,.05,-.12);body.add(neck);
 const head=alongZ(lathe([[0,0],[.038,0],[.04,.01],[.04,.075],[.036,.08],[0,.08]],GEAR.body,40));head.position.set(0,.11,-.13);body.add(head);
 const fresnel=new THREE.Mesh(new THREE.CircleGeometry(.034,40),M(0xf4f4f0,.15,0,{transparent:true,opacity:.9}));fresnel.position.set(0,.11,-.049);body.add(fresnel);
 const lamp=new THREE.Mesh(new THREE.CircleGeometry(.008,16),M(0xfff4e0,.2,0,{emissive:0xffd9a0,emissiveIntensity:0}));lamp.position.set(.02,.13,-.048);body.add(lamp);
 const plate=new THREE.Mesh(new RoundedBoxGeometry(.17,.17,.012,2,.01),GEAR.anodised);plate.position.set(0,.11,.0);body.add(plate);
 body.position.y=-.11;
 for(const s of [-1,1]){const cheek=new THREE.Mesh(new RoundedBoxGeometry(.012,.06,.05,2,.004),GEAR.anodised);cheek.position.set(s*.06,-.02,-.02);yoke.add(cheek);}
 const socket=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.05,16),GEAR.anodised);socket.position.y=-.07;yoke.add(socket);
 return {body:shadowed(body),yoke:shadowed(yoke),mount:.006,drop:.095,modellingLamp:lamp};}
/** COB LED with a fork yoke (LS 600d class): finned body, Bowens mount front. */
export function ledHead():HeadModel{
 const body=new THREE.Group(),yoke=new THREE.Group();
 const can=alongZ(lathe([[.0,-.17],[.1,-.17],[.11,-.15],[.11,.06],[.095,.08],[.0,.08]],GEAR.body,40));body.add(can);
 for(let i=0;i<9;i++){const fin=alongZ(new THREE.Mesh(new THREE.CylinderGeometry(.118,.118,.006,40),GEAR.bodyDark));fin.position.z=-.15+i*.016;body.add(fin);}
 const mountZ=.1,mount=alongZ(lathe([[.062,0],[.075,0],[.075,.02],[.05,.02]],GEAR.anodised));mount.position.z=.08;body.add(mount);
 const lamp=alongZ(new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.01,24),M(0xfff6e8,.3,0,{emissive:0xfff0d8,emissiveIntensity:0})));lamp.position.z=.095;body.add(lamp);
 for(const s of [-1,1]){const arm=new THREE.Mesh(new RoundedBoxGeometry(.016,.22,.05,2,.006),GEAR.anodised);arm.position.set(s*.13,-.08,0);yoke.add(arm);
  const k=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.02,20),GEAR.plastic);k.rotation.z=Math.PI/2;k.position.set(s*.145,0,0);yoke.add(k);}
 const base=new THREE.Mesh(new RoundedBoxGeometry(.276,.018,.05,2,.006),GEAR.anodised);base.position.y=-.19;yoke.add(base);
 const socket=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.06,16),GEAR.anodised);socket.position.y=-.215;yoke.add(socket);
 return {body:shadowed(body),yoke:shadowed(yoke),mount:mountZ,drop:.24,modellingLamp:lamp};}

/* ======================= camera on a tripod ======================= */
/**
 * A mirrorless body with an 85 mm lens on a four-section carbon tripod with a ball head and an Arca-type clamp.
 * Sizes: body 131 × 96 × 80 mm (Sony α7 IV class); lens Ø89.5 × 107.5 mm with a Ø100 × 48 mm hood (FE 85 mm F1.4 GM
 * class); legs Ø32.9 / 29 / 25.3 / 21.7 mm in four sections with twist locks, a Ø70 mm top casting and legs at 23°
 * (Gitzo Series 3 class), with a Ø28 mm centre column that rises up to 45 cm once the legs reach their 1.32 m limit,
 * locked by a collar on the casting and ending in a ballast hook. `setHeight` puts the lens axis at the given height.
 */
export interface CameraRig { group:THREE.Group; head:THREE.Group; setHeight(lensAxis:number):void }
export function cameraOnTripod():CameraRig{
 const g=new THREE.Group(),head=new THREE.Group(),legs=new THREE.Group();g.add(legs,head);
 const carbon=M(0x1b1b1d,.38,.15),alu=M(0x2b2c30,.35,.7),rubber=GEAR.rubber,body=M(0x1a1a1c,.55,.12),grip=M(0x101011,.85,0);
 /* camera, lens along +Z; the head's origin is the lens axis */
 const cam=new THREE.Group();head.add(cam);
 const main=new THREE.Mesh(new RoundedBoxGeometry(.131,.078,.048,4,.008),body);main.position.set(0,-.006,-.012);cam.add(main);
 const gripBlock=new THREE.Mesh(new RoundedBoxGeometry(.036,.086,.07,4,.014),grip);gripBlock.position.set(-.05,-.004,0);cam.add(gripBlock);
 const hump=new THREE.Mesh(new RoundedBoxGeometry(.058,.026,.05,3,.008),body);hump.position.set(0,.044,-.014);cam.add(hump);
 const eyecup=new THREE.Mesh(new RoundedBoxGeometry(.044,.03,.018,3,.008),rubber);eyecup.position.set(0,.04,-.044);cam.add(eyecup);
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(.075,.05),GEAR.glass);screen.position.set(.008,-.008,-.0365);screen.rotation.y=Math.PI;cam.add(screen);
 for(const [x,r] of [[.042,.012],[-.032,.011],[.026,.009]] as [number,number][]){const dial=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.008,28),alu);dial.position.set(x,.036,-.01);cam.add(dial);}
 const shutter=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,.004,20),alu);shutter.position.set(-.05,.042,.012);cam.add(shutter);
 const mountRing=alongZ(lathe([[.026,0],[.03,0],[.03,.006],[.026,.006]],GEAR.chrome,40));mountRing.position.z=.012;cam.add(mountRing);
 /* lens: mount, barrel with focus and aperture rings, hood */
 const lens=alongZ(lathe([[.03,0],[.036,0],[.04,.012],[.044,.03],[.0447,.105],[.042,.1075],[.035,.1075]],body,48));lens.position.z=.018;cam.add(lens);
 const focus=alongZ(lathe([[.0452,.05],[.0452,.088]],rubber,48));focus.position.z=.018;cam.add(focus);
 const aperture=alongZ(lathe([[.0452,.02],[.0452,.034]],grip,48));aperture.position.z=.018;cam.add(aperture);
 const hood=alongZ(lathe([[.044,0],[.046,0],[.05,.048],[.048,.048],[.0435,.004]],body,48));hood.position.z=.018+.1;cam.add(hood);
 const glass=new THREE.Mesh(new THREE.CircleGeometry(.035,40),GEAR.glass);glass.position.z=.018+.106;cam.add(glass);
 /* Arca plate and clamp, ball head */
 const plate=new THREE.Mesh(new RoundedBoxGeometry(.038,.01,.07,2,.003),alu);plate.position.set(0,-.05,0);cam.add(plate);
 const clamp=new THREE.Mesh(new RoundedBoxGeometry(.06,.016,.06,2,.004),alu);clamp.position.set(0,-.063,0);head.add(clamp);
 const clampKnob=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.016,16),alu);clampKnob.rotation.z=Math.PI/2;clampKnob.position.set(.038,-.063,0);head.add(clampKnob);
 const ball=new THREE.Mesh(new THREE.SphereGeometry(.024,32,20),GEAR.chrome);ball.position.set(0,-.085,0);head.add(ball);
 const socket=new THREE.Mesh(new THREE.CylinderGeometry(.028,.03,.04,32),alu);socket.position.set(0,-.112,0);head.add(socket);
 const lockKnob=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.02,20),alu);lockKnob.rotation.z=Math.PI/2;lockKnob.position.set(.038,-.105,0);head.add(lockKnob);
 /* top casting and legs */
 const SPLAY=THREE.MathUtils.degToRad(23),DIAM=[.0329,.029,.0253,.0217],HEAD_DROP=.135;
 const casting=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,.03,36),alu);g.add(casting);
 const LEG_TOP_MAX=1.32,COLUMN_LEN=.5,COLUMN_RISE=.45;
 const column=new THREE.Group();g.add(column);
 const tube=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,COLUMN_LEN,24),carbon);tube.position.y=-COLUMN_LEN/2;column.add(tube);
 const collar=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.026,28),rubber);g.add(collar);
 const plateTop=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,.012,28),alu);plateTop.position.y=-.006;column.add(plateTop);
 const hook=new THREE.Mesh(new THREE.TorusGeometry(.012,.003,8,20,Math.PI*1.4),GEAR.chrome);hook.position.y=-COLUMN_LEN-.012;hook.rotation.z=Math.PI*.8;column.add(hook);
 const build=(top:number)=>{legs.clear();casting.position.y=top;const len=Math.max(.15,top/Math.cos(SPLAY)-.02);
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2+Math.PI/6,dir=new THREE.Vector3(Math.sin(a)*Math.sin(SPLAY),-Math.cos(SPLAY),Math.cos(a)*Math.sin(SPLAY)),start=new THREE.Vector3(Math.sin(a)*.03,top-.01,Math.cos(a)*.03);
   const hinge=new THREE.Mesh(new RoundedBoxGeometry(.03,.04,.03,2,.006),alu);hinge.position.copy(start);legs.add(hinge);
   /* four sections, each a little more than a quarter so the tubes overlap inside the locks */
   const seg=len/4;for(let k=0;k<4;k++){const a0=start.clone().addScaledVector(dir,k*seg),a1=start.clone().addScaledVector(dir,(k+1)*seg+(k<3?.02:0));legs.add(rod(a0,a1,DIAM[k]/2,carbon,20));
    if(k<3){const lock=rod(start.clone().addScaledVector(dir,(k+1)*seg-.012),start.clone().addScaledVector(dir,(k+1)*seg+.03),DIAM[k]/2+.004,rubber,24);legs.add(lock);}}
   const foot=new THREE.Mesh(new THREE.SphereGeometry(.014,16,10),rubber);foot.position.copy(start).addScaledVector(dir,len);foot.position.y=Math.max(.012,foot.position.y);legs.add(foot);}
  shadowed(legs);};
 shadowed(head);shadowed(casting);
 return {group:g,head,setHeight:(axis:number)=>{
  /* legs first; above their limit the centre column rises */
  const want=Math.max(.2,axis-HEAD_DROP),top=Math.min(want-.04,LEG_TOP_MAX),rise=Math.min(COLUMN_RISE,Math.max(0,want-top)),columnTop=top+.04+Math.max(0,rise-.0);
  build(Math.max(.16,top));column.position.y=Math.min(columnTop,top+.04+COLUMN_RISE);collar.position.y=top+.025;head.position.y=column.position.y+HEAD_DROP;shadowed(column);shadowed(collar);}};
}

/* ======================= LED panel and AC monolight ======================= */
/** Bi-colour LED panel (30 × 30 cm class) in a U-yoke: a thin housing with a diffused face and a finned back. */
export function panelHead():HeadModel{const body=new THREE.Group(),yoke=new THREE.Group();
 const W=.31,H=.31,D=.045;
 const shell=new THREE.Mesh(new RoundedBoxGeometry(W,H,D,4,.012),GEAR.body);body.add(shell);
 const face=new THREE.Mesh(new THREE.PlaneGeometry(W-.03,H-.03),M(0xf6f6f2,.6,0,{emissive:0xfff4e4,emissiveIntensity:0}));face.position.z=D/2+.0005;body.add(face);
 for(let i=0;i<7;i++){const fin=new THREE.Mesh(new THREE.BoxGeometry(W-.06,.004,.012),GEAR.bodyDark);fin.position.set(0,-H/2+.05+i*.035,-D/2-.006);body.add(fin);}
 const ctrl=new THREE.Mesh(new RoundedBoxGeometry(.08,.05,.012,2,.004),GEAR.bodyDark);ctrl.position.set(W/2-.06,-H/2+.04,-D/2-.008);body.add(ctrl);
 for(const s of [-1,1]){const arm=new THREE.Mesh(new RoundedBoxGeometry(.014,H*.62,.03,2,.005),GEAR.anodised);arm.position.set(s*(W/2+.012),-H*.31,0);yoke.add(arm);
  const k=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.018,20),GEAR.plastic);k.rotation.z=Math.PI/2;k.position.set(s*(W/2+.026),0,0);yoke.add(k);}
 const base=new THREE.Mesh(new RoundedBoxGeometry(W+.04,.016,.04,2,.005),GEAR.anodised);base.position.y=-H*.62;yoke.add(base);
 const sock=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.06,16),GEAR.anodised);sock.position.y=-H*.62-.03;yoke.add(sock);
 return {body:shadowed(body),yoke:shadowed(yoke),mount:D/2+.002,drop:H*.62+.04,modellingLamp:face};}
/** AC studio monolight (400 Ws class): a round body with a carry handle, rear control panel and Bowens mount. */
export function monolightHead():HeadModel{const body=new THREE.Group(),yoke=new THREE.Group();
 const can=alongZ(lathe([[0,-.2],[.058,-.2],[.064,-.19],[.064,.05],[.07,.06],[.07,.07],[0,.07]],GEAR.body,48));body.add(can);
 const back=new THREE.Mesh(new THREE.CircleGeometry(.058,40),GEAR.glass);back.position.z=-.201;back.rotation.y=Math.PI;body.add(back);
 const handle=new THREE.Mesh(new THREE.TorusGeometry(.05,.008,10,24,Math.PI),GEAR.bodyDark);handle.rotation.y=Math.PI/2;handle.position.set(0,.064,-.07);body.add(handle);
 const mountZ=.085,mount=alongZ(lathe([[.062,0],[.072,0],[.072,.012],[.066,.016],[.066,.02],[.05,.02]],GEAR.anodised));mount.position.z=.065;body.add(mount);
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.018,20,14),M(0xfff4e0,.2,0,{emissive:0xffd9a0,emissiveIntensity:0}));lamp.position.z=mountZ+.008;body.add(lamp);
 const tube=new THREE.Mesh(new THREE.TorusGeometry(.028,.005,10,40),GEAR.tube);tube.position.z=mountZ;body.add(tube);
 const plug=new THREE.Mesh(new THREE.BoxGeometry(.03,.02,.02),GEAR.plastic);plug.position.set(0,-.05,-.19);body.add(plug);
 for(const s of [-1,1]){const cheek=new THREE.Mesh(new RoundedBoxGeometry(.012,.09,.06,2,.004),GEAR.anodised);cheek.position.set(s*.077,-.03,-.05);yoke.add(cheek);}
 const cross=new THREE.Mesh(new RoundedBoxGeometry(.165,.014,.05,2,.004),GEAR.anodised);cross.position.set(0,-.078,-.05);yoke.add(cross);
 const hole=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.05,12),GEAR.chrome);hole.position.set(0,-.06,-.05);yoke.add(hole);
 const knob=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.018,20),GEAR.plastic);knob.rotation.z=Math.PI/2;knob.position.set(.092,0,-.05);yoke.add(knob);
 const sock=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.05,16),GEAR.anodised);sock.position.set(0,-.1,-.05);yoke.add(sock);
 return {body:shadowed(body),yoke:shadowed(yoke),mount:mountZ,drop:.125,modellingLamp:lamp};}

/* ======================= modifiers ======================= */
export interface ModifierModel { group:THREE.Group; /** z where light leaves the modifier (centre of the diffuser) */ front:number; /** the glowing diffuser, if any */ face:THREE.Mesh|null; /** head faces away from the subject (reflective umbrella) */ reversed?:boolean }
/** A fabric panel between a back edge (a0→a1) and a front edge (b0→b1), sagging slightly toward the axis. */
function panel(a0:THREE.Vector3,a1:THREE.Vector3,b0:THREE.Vector3,b1:THREE.Vector3,sag:number,outside:THREE.Material,inside:THREE.Material){
 const nu=8,nv=8,pos:number[]=[],idx:number[]=[],p=new THREE.Vector3(),q=new THREE.Vector3(),r=new THREE.Vector3();
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const u=i/nu,v=j/nv;p.lerpVectors(a0,a1,u);q.lerpVectors(b0,b1,u);r.lerpVectors(p,q,v);
  const toAxis=new THREE.Vector3(-r.x,-r.y,0);const len=toAxis.length()||1;r.addScaledVector(toAxis,sag*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)/len);pos.push(r.x,r.y,r.z);}
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;idx.push(a,c,b,b,c,d);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
 const g=new THREE.Group(),o=new THREE.Mesh(geo,outside),inGeo=geo.clone();inGeo.index!.array.reverse?.();const arr=inGeo.index!.array as Uint16Array|Uint32Array;for(let k=0;k<arr.length;k+=3){const t=arr[k];arr[k]=arr[k+1];arr[k+1]=t;}inGeo.computeVertexNormals();
 g.add(o,new THREE.Mesh(inGeo,inside));
 /* make sure the black side faces out: flip materials if the first normal points at the axis */
 const n=new THREE.Vector3().fromBufferAttribute(geo.attributes.normal as THREE.BufferAttribute,Math.floor(pos.length/6));const c=new THREE.Vector3().fromBufferAttribute(geo.attributes.position as THREE.BufferAttribute,Math.floor(pos.length/6));
 if(n.x*c.x+n.y*c.y<0){(g.children[0] as THREE.Mesh).material=inside;(g.children[1] as THREE.Mesh).material=outside;}return g;}
function speedring(z:number,r:number,sockets:number){const g=new THREE.Group();const ring=alongZ(lathe([[r-.012,0],[r+.012,0],[r+.012,.03],[r-.012,.03]],GEAR.anodised,40));ring.position.z=z;g.add(ring);
 for(let i=0;i<sockets;i++){const a=i/sockets*Math.PI*2+Math.PI/sockets;const s=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,.03,10),GEAR.anodised);s.position.set(Math.cos(a)*(r+.014),Math.sin(a)*(r+.014),z+.02);s.rotation.x=Math.PI/2;g.add(s);}return g;}
/** Box-type softbox, rectangular (4 rods) or octagonal (8 rods), with a recessed white diffuser and black edge band. */
function softbox(mount:number,shape:'rect'|'octa',w:number,h:number,depth:number,glow:THREE.Material):ModifierModel{
 const g=new THREE.Group(),sides=shape==='rect'?4:8,back=.075,front=mount+depth;
 const corner=(i:number,R:number,isBack:boolean,zz:number)=>{if(shape==='rect'){const sx=[1,-1,-1,1][i],sy=[1,1,-1,-1][i];return isBack?new THREE.Vector3(sx*back*.75,sy*back*.75,zz):new THREE.Vector3(sx*w/2,sy*h/2,zz);}
  const a=i/8*Math.PI*2+Math.PI/8;return new THREE.Vector3(Math.cos(a)*R,Math.sin(a)*R,zz);};
 g.add(speedring(mount,back,sides));
 for(let i=0;i<sides;i++){const j=(i+1)%sides;const a0=corner(i,back,true,mount+.03),a1=corner(j,back,true,mount+.03),b0=corner(i,w/2,false,front),b1=corner(j,w/2,false,front);
  g.add(panel(a0,a1,b0,b1,.012,GEAR.fabricOut,GEAR.silver));g.add(rod(a0,b0,.0035,GEAR.anodised,6));}
 /* front: black band frame and the diffuser set 2 cm back */
 const outline=new THREE.Shape(),hole=new THREE.Path();for(let i=0;i<sides;i++){const c=corner(i,w/2,false,0),c2=c.clone().multiplyScalar(.965);if(i===0){outline.moveTo(c.x,c.y);hole.moveTo(c2.x,c2.y);}else{outline.lineTo(c.x,c.y);hole.lineTo(c2.x,c2.y);}}
 outline.closePath();hole.closePath();outline.holes.push(hole);const band=new THREE.Mesh(new THREE.ShapeGeometry(outline),GEAR.band);band.position.z=front;g.add(band);
 const diff=new THREE.Shape();for(let i=0;i<sides;i++){const c=corner(i,w/2,false,0).multiplyScalar(.965);if(i===0)diff.moveTo(c.x,c.y);else diff.lineTo(c.x,c.y);}diff.closePath();
 const face=new THREE.Mesh(new THREE.ShapeGeometry(diff),glow);face.position.z=front-.02;g.add(face);
 /* inner baffle, faintly visible through the diffuser */
 const baffle=new THREE.Mesh(shape==='rect'?new THREE.PlaneGeometry(w*.55,h*.55):new THREE.CircleGeometry(w*.3,8,Math.PI/8),GEAR.white);baffle.position.z=mount+depth*.45;g.add(baffle);
 return {group:shadowed(g),front:front-.02,face};}
/** Umbrella of eight ribs: shoot-through (white, convex side to the subject) or reflective (silver inside, head turned away). */
function umbrella(mount:number,diameter:number,reflective:boolean,glow:THREE.Material):ModifierModel{
 const g=new THREE.Group(),R=diameter/2/Math.sin(1.0),cap=1.0,ribs=8;
 /* canopy as eight gores so the fabric droops slightly between ribs */
 const pos:number[]=[],idx:number[]=[],segU=8,segV=10;
 for(let k=0;k<ribs;k++){const base=pos.length/3;for(let j=0;j<=segV;j++)for(let i=0;i<=segU;i++){const th=(k+i/segU)/ribs*Math.PI*2,ph=j/segV*cap,sag=1-.03*Math.sin(Math.PI*i/segU)*Math.sin(ph/cap*Math.PI*.9);
   pos.push(Math.sin(ph)*Math.cos(th)*R*sag,Math.sin(ph)*Math.sin(th)*R*sag,R*Math.cos(ph));}
  for(let j=0;j<segV;j++)for(let i=0;i<segU;i++){const a=base+j*(segU+1)+i,b=a+1,c=a+segU+1,d=c+1;idx.push(a,b,c,b,d,c);}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
 const canopy=new THREE.Group();const inner=reflective?GEAR.silver:glow,outer=reflective?GEAR.fabricOut:glow;
 const outMesh=new THREE.Mesh(geo,outer);const inGeo=geo.clone();const arr=inGeo.index!.array as Uint16Array|Uint32Array;for(let k=0;k<arr.length;k+=3){const t=arr[k];arr[k]=arr[k+1];arr[k+1]=t;}inGeo.computeVertexNormals();
 canopy.add(outMesh,new THREE.Mesh(inGeo,inner));
 for(let k=0;k<ribs;k++){const th=k/ribs*Math.PI*2;const pts:THREE.Vector3[]=[];for(let j=0;j<=12;j++){const ph=j/12*cap;pts.push(new THREE.Vector3(Math.sin(ph)*Math.cos(th)*R*1.003,Math.sin(ph)*Math.sin(th)*R*1.003,R*Math.cos(ph)));}
  canopy.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),16,.0025,5),GEAR.anodised));
  const tip=new THREE.Mesh(new THREE.SphereGeometry(.006,8,6),GEAR.rubber);tip.position.copy(pts[12]);canopy.add(tip);}
 const rimBack=Math.cos(cap)*R;
 if(reflective){/* concave silver side toward the subject; the head turns round and fires into it */canopy.rotation.y=Math.PI;canopy.position.z=-(mount+.25)+rimBack;g.add(canopy);
  g.add(rod(new THREE.Vector3(0,-.05,.06),new THREE.Vector3(0,-.05,-(mount+.25)-(R-rimBack)),.004,GEAR.chrome,8));
  return {group:shadowed(g),front:-(mount+.25),face:null,reversed:true};}
 /* shoot-through: rim near the head, dome bulging toward the subject */
 canopy.position.z=mount+.25-rimBack;g.add(canopy);g.add(rod(new THREE.Vector3(0,-.05,-.2),new THREE.Vector3(0,-.05,mount+.25+(R-rimBack)),.004,GEAR.chrome,8));
 return {group:shadowed(g),front:mount+.25+(R-rimBack)*.6,face:outMesh};}

export function headFor(kind:string|undefined,led:boolean):HeadModel{if(kind==='panel')return panelHead();if(kind==='monolight')return monolightHead();if(led||kind==='cob')return ledHead();if(kind==='pocket')return pocketHead();if(kind==='speedlite')return speedliteHead();if(kind==='battery-400')return strobeHead(.211,.21,.11);return strobeHead();}
export function modifierModel(id:string,mount:number,w:number,h:number,glow:THREE.Material):ModifierModel{
 if(id.startsWith('softbox-'))return softbox(mount,'rect',w,h,.25+Math.max(w,h)*.18,glow);
 if(id.startsWith('strip-'))return softbox(mount,'rect',w,h,.3,glow);
 if(id.startsWith('octa-'))return softbox(mount,'octa',w,h,.2+w*.3,glow);
 if(id.startsWith('umbrella-shoot'))return umbrella(mount,w,false,glow);
 if(id.startsWith('umbrella-reflect'))return umbrella(mount,w,true,glow);
 if(id==='parabolic-90')return umbrella(mount,.9,true,glow);
 const g=new THREE.Group();
 if(id.startsWith('beauty-dish')){const shell=alongZ(lathe([[.075,0],[.09,.01],[.2,.07],[.265,.11],[.275,.125],[.27,.13]],GEAR.chrome,64));shell.position.z=mount;g.add(shell);
  const inner=alongZ(lathe([[.268,.128],[.26,.112],[.195,.075],[.088,.016]],GEAR.white,64));inner.position.z=mount;g.add(inner);
  const plate=alongZ(lathe([[0,0],[.085,.0],[.09,.008],[0,.008]],GEAR.chrome,40));plate.position.z=mount+.06;g.add(plate);
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2;g.add(rod(new THREE.Vector3(Math.cos(a)*.05,Math.sin(a)*.05,mount+.012),new THREE.Vector3(Math.cos(a)*.07,Math.sin(a)*.07,mount+.062),.002,GEAR.chrome,6));}
  return {group:shadowed(g),front:mount+.12,face:null};}
 if(id==='snoot'){const c=alongZ(lathe([[.07,0],[.072,0],[.04,.22],[.038,.22]],GEAR.anodised,40));c.position.z=mount;g.add(c);
  const inner=alongZ(lathe([[.068,0],[.036,.22]],GEAR.rubber,40));inner.position.z=mount;g.add(inner);return {group:shadowed(g),front:mount+.22,face:null};}
 if(id==='bare')return {group:g,front:mount+.02,face:null};
 /* standard 7-inch reflector */
 const refl=alongZ(lathe([[.07,0],[.075,.01],[.09,.08],[.1,.15],[.104,.158],[.101,.16]],GEAR.chrome,64));refl.position.z=mount;g.add(refl);
 const inside=alongZ(lathe([[.099,.156],[.088,.078],[.072,.01]],GEAR.silver,64));inside.position.z=mount;g.add(inside);
 return {group:shadowed(g),front:mount+.16,face:null};}
/** Height from the spigot top to the light axis for each head (matches the models above). */
export function headDrop(kind:string|undefined,led:boolean){if(kind==='panel')return .31*.62+.04;if(kind==='monolight')return .125;if(led||kind==='cob')return .24;if(kind==='pocket')return .083+.13*.49;if(kind==='speedlite')return .095;if(kind==='battery-400')return .083+.21*.49;return .083+.245*.49;}
