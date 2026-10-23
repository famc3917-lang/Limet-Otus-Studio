// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/**
 * Photographic light model shared by the equipment register and the lighting lab.
 *
 * Readings model a spherical (dome) incident meter. Exposure follows the incident-meter equation  N² / t = E · S / C
 * with C = 340, the calibration constant for a dome receptor (a flat receptor uses 250), so at ISO S the luminous
 * exposure a subject needs for aperture N is  H = C · N² / S  lux·seconds. A guide number GN (ISO 100, metres) means a
 * flash gives that exposure for N = GN / d at distance d, so its time-integrated axial intensity is  Q = (C/100) · GN²
 * cd·s. A continuous LED of far-field axial intensity I delivers  Q = I · t  cd·s during a shutter time t.
 */
export type LightKind='strobe'|'led';
export interface LightSpec {
 kind:LightKind;
 /** stored energy of a flash, watt-seconds */
 ws?:number;
 /** guide number at ISO 100 in metres with the standard reflector */
 gn?:number;
 /** electrical power of a continuous light, watts */
 watts?:number;
 /** far-field axial intensity with the standard reflector, expressed as illuminance at 1 m (lux) */
 lux1m?:number;
 /** lowest output the head can be set to, as a fraction of full power (e.g. 1/256) */
 minPower?:number;
 /** body style drawn in the lighting lab */
 head?:HeadKind;
 /** colour temperature in kelvin; bi-colour lights also give a range */
 cct?:number; cctMin?:number; cctMax?:number;
 cri?:number; tlci?:number;
 /** beam angle of the standard reflector, degrees */
 beam?:number;
 /** built-in library entry the values came from */
 preset?:string;
}
/** `head` picks the 3D body: a 600 Ws or 400 Ws battery head, a pocket flash, a speedlight or a COB LED. */
export type HeadKind='battery-600'|'battery-400'|'pocket'|'speedlite'|'cob'|'panel'|'monolight';
/** Body styles a light can be given in the register, so the lab draws a head of the right kind. */
export const HEAD_KINDS:{id:HeadKind;zh:string;en:string;led:boolean}[]=[
 {id:'panel',zh:'平板 LED',en:'LED panel',led:true},
 {id:'cob',zh:'LED 聚光灯（COB）',en:'COB LED monolight',led:true},
 {id:'pocket',zh:'方形口袋闪光灯',en:'Pocket flash (square body)',led:false},
 {id:'speedlite',zh:'机顶闪光灯',en:'Speedlight',led:false},
 {id:'monolight',zh:'室内影室闪光灯（交流电）',en:'Studio monolight (AC)',led:false},
 {id:'battery-400',zh:'室外闪光灯（电池，400 Ws 级）',en:'Battery strobe (400 Ws class)',led:false},
 {id:'battery-600',zh:'室外闪光灯（电池，600 Ws 级）',en:'Battery strobe (600 Ws class)',led:false},
];
export interface LightPreset extends LightSpec { id:string; brand:string; model:string; source:string; verified:boolean; note?:string; head:HeadKind }

/** Built-in light library: empty here; the lab uses the lights each studio enters in its equipment register. */
export const LIGHT_LIBRARY:LightPreset[]=[];
export const presetById=(id?:string)=>LIGHT_LIBRARY.find(p=>p.id===id);
/** Body style of a light: chosen in the register, else the library entry's, else by kind. */
export const headKindOf=(s:LightSpec):HeadKind=>s.head??presetById(s.preset)?.head??(s.kind==='led'?'cob':'battery-600');
/** Lowest output setting in stops below full: the head's own minimum, otherwise 1/256. */
export const minStops=(s:LightSpec)=>Math.log2(s.minPower??1/256);

/** Without a measured or published GN, estimate one from stored energy: GN ≈ 3.5 · √Ws for a typical standard reflector. */
export const estimateGN=(ws:number)=>Math.round(3.5*Math.sqrt(ws)*10)/10;
export const guideNumber=(s:LightSpec)=>s.gn??(s.ws?estimateGN(s.ws):undefined);

/** Light-shaping tools and the light they cost, in stops (editable per placement). The losses are typical published
    figures for such modifiers, not measurements of a particular product; measure your own and edit the placement. */
export interface Modifier { id:string; zh:string; en:string; loss:number; /** emitting surface in metres, 0 for a reflector */ w:number; h:number; beam:number;
 /** outline of the emitting surface: a rectangle, a regular octagon or a disc (drawn as a 24-gon) */ shape?:'rect'|'octa'|'disc' }
export const MODIFIERS:Modifier[]=[
 {id:'reflector',zh:'标准罩',en:'Standard reflector',loss:0,w:0,h:0,beam:55},
 {id:'bare',zh:'裸灯',en:'Bare bulb',loss:1,w:0,h:0,beam:120},
 {id:'softbox-6090',zh:'柔光箱 60×90',en:'Softbox 60×90',loss:1.5,w:.6,h:.9,beam:90,shape:'rect'},
 {id:'octa-90',zh:'八角柔光箱 Ø90',en:'Octabox Ø90',loss:1.5,w:.9,h:.9,beam:95,shape:'octa'},
 {id:'octa-120',zh:'八角柔光箱 Ø120',en:'Octabox Ø120',loss:1.8,w:1.2,h:1.2,beam:100,shape:'octa'},
 {id:'strip-30120',zh:'条形柔光箱 30×120',en:'Strip box 30×120',loss:1.7,w:.3,h:1.2,beam:80,shape:'rect'},
 {id:'umbrella-shoot',zh:'透射柔光伞',en:'Shoot-through umbrella',loss:1.3,w:1,h:1,beam:120,shape:'disc'},
 {id:'umbrella-reflect',zh:'反射伞',en:'Reflective umbrella',loss:1,w:1,h:1,beam:100,shape:'disc'},
 {id:'beauty-dish',zh:'雷达罩',en:'Beauty dish',loss:.7,w:.55,h:.55,beam:60,shape:'disc'},
 {id:'snoot',zh:'束光筒',en:'Snoot',loss:1.5,w:0,h:0,beam:15},
 {id:'softbox-90',zh:'方形柔光箱 90×90',en:'Square softbox 90×90',loss:1.6,w:.9,h:.9,beam:90,shape:'rect'},
 {id:'softbox-80120',zh:'柔光箱 80×120',en:'Softbox 80×120',loss:1.7,w:.8,h:1.2,beam:95,shape:'rect'},
 {id:'strip-35160',zh:'条形柔光箱 35×160',en:'Strip box 35×160',loss:1.8,w:.35,h:1.6,beam:80,shape:'rect'},
 {id:'octa-150',zh:'八角柔光箱 Ø150',en:'Octabox Ø150',loss:2,w:1.5,h:1.5,beam:105,shape:'octa'},
 {id:'umbrella-shoot-150',zh:'透射柔光伞 150cm',en:'Shoot-through umbrella 150 cm',loss:1.5,w:1.5,h:1.5,beam:125,shape:'disc'},
 {id:'umbrella-reflect-150',zh:'反射伞 150cm',en:'Reflective umbrella 150 cm',loss:1.1,w:1.5,h:1.5,beam:105,shape:'disc'},
 {id:'beauty-dish-sock',zh:'雷达罩 + 柔光布',en:'Beauty dish with diffusion sock',loss:1.3,w:.55,h:.55,beam:70,shape:'disc'},
 {id:'parabolic-90',zh:'深抛物面反光伞 Ø90',en:'Deep parabolic reflector Ø90',loss:.4,w:0,h:0,beam:40},
 {id:'grid-20',zh:'标准罩 + 20° 蜂窝',en:'Standard reflector with 20° grid',loss:1,w:0,h:0,beam:20},
];
export const modifierById=(id:string)=>MODIFIERS.find(m=>m.id===id)??MODIFIERS[0];

export interface Camera { iso:number; aperture:number; shutter:number }
/** X-sync speed of typical studio strobes, and the share of light high-speed sync keeps at that speed (an estimate:
    makers state a loss of about 2–3 stops). Faster than sync, the head pulses for the whole shutter time, so the light
    reaching the sensor falls with the shutter. */
export const SYNC=1/250,HSS_EFFICIENCY=.25;
/** Calibration constant of a dome incident meter (ISO 2720; a flat receptor uses 250). */
export const METER_C=340;
export const needsHSS=(c:Camera)=>c.shutter<SYNC-1e-6;
/** Luminous exposure (lux·s) that renders mid-grey at these camera settings. */
export const targetExposure=(c:Camera)=>METER_C*c.aperture*c.aperture/c.iso;
/** Aperture a meter would read for a given exposure at this ISO. */
export const apertureFor=(h:number,iso:number)=>Math.sqrt(Math.max(0,h)*iso/METER_C);
/**
 * Time-integrated axial intensity (cd·s) a placed light sends during one exposure.
 * `power` is the flash fraction (1 = full, 1/256 minimum) or the LED dimmer fraction.
 */
export function axisEnergy(s:LightSpec,power:number,lossStops:number,shutter:number){
 const p=Math.max(0,Math.min(1,power)),loss=Math.pow(2,-lossStops);
 if(s.kind==='strobe'){const gn=guideNumber(s)??0,hss=shutter<SYNC-1e-6?shutter/SYNC*HSS_EFFICIENCY:1;return METER_C/100*gn*gn*p*loss*hss;}
 return (s.lux1m??0)*p*loss*shutter;
}
/** Smooth beam falloff: full on axis, half at the edge of the beam angle, nothing beyond 1.6× the half-angle. */
export function beamFactor(offAxisDeg:number,beamDeg:number){const half=beamDeg/2,x=offAxisDeg/half;return x<=0?1:Math.max(0,Math.cos(Math.min(Math.PI/2,x*Math.PI/3.2)));}
/** Shows an aperture like a flash meter: f/8.0 with tenths of a stop above it. */
export function meterReading(n:number){if(!Number.isFinite(n)||n<=0)return {stop:'—',tenths:0};
 const full=[1,1.4,2,2.8,4,5.6,8,11,16,22,32,45,64,90,128],ev=Math.log2(n*n),base=Math.floor(ev+1e-9),tenths=Math.round((ev-base)*10);
 const idx=Math.max(0,Math.min(full.length-1,base+(tenths===10?1:0)));return {stop:'f/'+full[idx].toFixed(full[idx]<10?1:0),tenths:tenths===10?0:tenths};}
/**
 * Chromaticity (CIE 1931 x, y) of a Planckian radiator, using the cubic-spline fit of Kim et al. (2002), valid
 * 1667–25 000 K to about 1e-3; temperatures outside are clamped.
 */
export function planckianXY(kelvin:number):[number,number]{const T=Math.max(1667,Math.min(25000,kelvin)),t=1e3/T,t2=t*t,t3=t2*t;
 const x=T<=4000?-.2661239*t3-.2343589*t2+.8776956*t+.179910:-3.0258469*t3+2.1070379*t2+.2226347*t+.240390;
 const x2=x*x,x3=x2*x,y=T<=2222?-1.1063814*x3-1.34811020*x2+2.18555832*x-.20219683:T<=4000?-.9549476*x3-1.37418593*x2+2.09137015*x-.16748867:3.0817580*x3-5.87338670*x2+3.75112997*x-.37001483;
 return [x,y];}
/** Correlated colour temperature from chromaticity by McCamy (1992); about ±2 K between 2856 K and 6504 K. */
export function mccamyCCT(x:number,y:number){const n=(x-.3320)/(.1858-y);return 449*n*n*n+3525*n*n+6823.3*n+5520.33;}
/** Linear sRGB (IEC 61966-2-1 primaries, D65 white) of a black body at luminance Y = 1, so a change of colour
    temperature does not change brightness; channels above 1 are kept (lighting is in linear HDR). */
export function cctToRGB(k:number):[number,number,number]{const [x,y]=planckianXY(k),X=x/y,Z=(1-x-y)/y;
 const r=3.2404542*X-1.5371385-.4985314*Z,g=-.9692660*X+1.8760108+.0415560*Z,b=.0556434*X-.2040259+1.0572252*Z;
 return [Math.max(0,r),Math.max(0,g),Math.max(0,b)];}
/** CIE 1960 uv from CIE 1931 xy. */
export const xyToUV=(x:number,y:number):[number,number]=>{const d=-2*x+12*y+3;return [4*x/d,6*y/d];};
/**
 * Correlated colour temperature and Duv: the nearest point on the Planckian locus in the CIE 1960 uv plane, searched on
 * a 1-mired grid from 1667 K to 25 000 K and refined by golden-section search. Duv is the signed distance (positive
 * above the locus, towards green).
 */
export function cctDuv(x:number,y:number):{cct:number;duv:number}{const [u,v]=xyToUV(x,y),dist=(m:number)=>{const [px,py]=planckianXY(1e6/m),[pu,pv]=xyToUV(px,py);return Math.hypot(u-pu,v-pv);};
 let best=40,bd=Infinity;for(let m=40;m<=600;m+=1){const d=dist(m);if(d<bd){bd=d;best=m;}}
 let lo=Math.max(40,best-1),hi=Math.min(600,best+1);const g=(Math.sqrt(5)-1)/2;for(let i=0;i<40;i++){const a=hi-g*(hi-lo),b=lo+g*(hi-lo);if(dist(a)<dist(b))hi=b;else lo=a;}
 const m=(lo+hi)/2,[px,py]=planckianXY(1e6/m),[pu,pv]=xyToUV(px,py),[qx,qy]=planckianXY(1e6/(m+1)),[qu,qv]=xyToUV(qx,qy);
 /* sign from the side of the locus (tangent towards higher mired) */
 const side=Math.sign((qu-pu)*(v-pv)-(qv-pv)*(u-pu))||1;return {cct:1e6/m,duv:side*Math.hypot(u-pu,v-pv)};}
/** Colour of mixed light: each light's tristimulus values, scaled by its exposure, are summed; the result is given as
    correlated colour temperature (nearest Planckian point) with Duv, since mixed light leaves the locus. */
export function mixedColour(parts:{h:number;cct:number}[]):{cct:number;duv:number;x:number;y:number}|null{let X=0,Y=0,Z=0;for(const p of parts){if(!(p.h>0))continue;const [x,y]=planckianXY(p.cct);X+=p.h*x/y;Y+=p.h;Z+=p.h*(1-x-y)/y;}
 if(!Y)return null;const sum=X+Y+Z,x=X/sum,y=Y/sum,r=cctDuv(x,y);return {cct:r.cct,duv:r.duv,x,y};}
/** Mixed colour temperature rounded to 50 K, for display. */
export function mixedCCT(parts:{h:number;cct:number}[]){const c=mixedColour(parts);return c?Math.round(c.cct/50)*50:null;}
/**
 * Luminous energy a head sends into all directions, integrating its intensity profile over the sphere:
 * Φ = 2π ∫ I₀ · f(θ) · sin θ dθ, with f the beam profile below (Simpson's rule, 400 steps up to where f reaches 0).
 */
export function beamFlux(axis:number,beamDeg:number){/* the profile is zero beyond 1.6 half-angles, so integrate only up to there */
 const top=Math.min(Math.PI,beamDeg/2*1.6*Math.PI/180),n=400,hstep=top/n;let sum=0;for(let i=0;i<=n;i++){const th=i*hstep,w=i===0||i===n?1:i%2?4:2;sum+=w*beamFactor(th*180/Math.PI,beamDeg)*Math.sin(th);}return 2*Math.PI*axis*sum*hstep/3;}
type V3=[number,number,number];
const sub=(a:V3,b:V3):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=(a:V3)=>Math.hypot(a[0],a[1],a[2]);
/**
 * Projected solid angle Ω⊥ (sr) that a planar polygon subtends at point p for a receiver with unit normal n:
 * Lambert's formula Ω⊥ = ½ Σᵢ θᵢ (n · γᵢ), where θᵢ is the angle between the directions to consecutive vertices and γᵢ
 * the unit normal of the plane through p and that edge. The polygon is first clipped to the receiver's hemisphere.
 * A uniform Lambertian emitter of luminance L then gives illuminance E = L · Ω⊥ at p.
 */
export function polygonProjectedSolidAngle(poly:V3[],p:V3,n:V3){
 const rel=poly.map(v=>sub(v,p)),clipped:V3[]=[],eps=1e-6;
 for(let i=0;i<rel.length;i++){const a=rel[i],b=rel[(i+1)%rel.length],da=dot(a,n),db=dot(b,n);if(da>eps)clipped.push(a);if((da>eps)!==(db>eps)){const t=(eps-da)/(db-da);clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);}}
 if(clipped.length<3)return 0;let sum=0;
 for(let i=0;i<clipped.length;i++){const a=clipped[i],b=clipped[(i+1)%clipped.length],la=len(a),lb=len(b);if(la<eps||lb<eps)continue;const c=cross(a,b),lc=len(c);if(lc<eps)continue;
  const theta=Math.acos(Math.max(-1,Math.min(1,dot(a,b)/(la*lb))));sum+=theta*dot(c,n)/lc;}
 return Math.abs(sum)/2;}
/** Outline of a modifier's front face, centred on `c`, spanning `right` × `up` (unit vectors) — vertices and area. */
export function modifierOutline(m:Modifier,c:V3,right:V3,up:V3):{poly:V3[];area:number}{
 const at=(u:number,v:number):V3=>[c[0]+right[0]*u+up[0]*v,c[1]+right[1]*u+up[1]*v,c[2]+right[2]*u+up[2]*v];
 if(m.shape==='rect'||!m.shape){const w=m.w/2,h=m.h/2;return {poly:[at(-w,-h),at(w,-h),at(w,h),at(-w,h)],area:m.w*m.h};}
 const k=m.shape==='octa'?8:24,r=m.w/2,poly:V3[]=[];for(let i=0;i<k;i++){const a=(i+.5)/k*2*Math.PI;poly.push(at(Math.cos(a)*r,Math.sin(a)*r));}
 return {poly,area:k/2*r*r*Math.sin(2*Math.PI/k)};}
export function validLightSpec(v:unknown):v is LightSpec{if(!v||typeof v!=='object')return false;const s=v as Record<string,unknown>;
 if(s.kind!=='strobe'&&s.kind!=='led')return false;
 const num=(k:string,min:number,max:number)=>s[k]===undefined||typeof s[k]==='number'&&Number.isFinite(s[k] as number)&&(s[k] as number)>=min&&(s[k] as number)<=max;
 return (s.head===undefined||HEAD_KINDS.some(h=>h.id===s.head))&&num('minPower',1/4096,1)&&num('ws',1,20000)&&num('gn',1,500)&&num('watts',1,20000)&&num('lux1m',1,2e6)&&num('cct',1500,20000)&&num('cctMin',1500,20000)&&num('cctMax',1500,20000)&&num('cri',0,100)&&num('tlci',0,100)&&num('beam',1,180)&&(s.preset===undefined||typeof s.preset==='string'&&(s.preset as string).length<=60);}
/**
 * Depth of field for the thin-lens model. `focalMm` in mm, `focusM` in metres (Infinity allowed, must exceed the focal
 * length), `coc` the acceptable circle of confusion in mm. Hyperfocal H = f²/(N·c) + f; focused at s the sharp zone runs
 * from s(H − f)/(H + s − 2f) to s(H − f)/(H − s) (infinity once s ≥ H); focused at infinity it starts at H − f.
 */
export function depthOfField(focalMm:number,N:number,focusM:number,coc=.03){const f=focalMm/1000,c=coc/1000,H=f*f/(N*c)+f;
 if(!Number.isFinite(focusM))return {near:H-f,far:Infinity,hyperfocal:H};const s=Math.max(focusM,f*1.0001);
 return {near:s*(H-f)/(H+s-2*f),far:s>=H?Infinity:s*(H-f)/(H-s),hyperfocal:H};}
/** Circle of confusion diameter (mm) on the sensor for a point at `distM` with focus at `focusM` (Infinity allowed). */
export function circleOfConfusion(focalMm:number,N:number,focusM:number,distM:number){const f=focalMm,D=distM*1000,invS=Number.isFinite(focusM)?1/(focusM*1000):0;return f*f*Math.abs(1-D*invS)/(N*D*(1-f*invS));}
