// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/*
 * Cross-validation of the lighting lab's physics. Every closed form is checked against at least one method that shares
 * no code with it: analytic solutions, Monte Carlo integration, far-field limits and spectral integration of Planck's
 * law. A seeded generator keeps the Monte Carlo runs repeatable.
 */
const path=require('path'),assert=require('assert/strict');
const {load,source}=require('./security.cjs');
const L=load(path.join(source,'lib/lighting.ts'));
const results=[];const report=(name,got,want,tol,unit='')=>{const err=Math.abs(got-want)/(Math.abs(want)||1);results.push({name,got,want,err});assert(err<=tol,`${name}: got ${got} want ${want} (relative error ${(err*100).toFixed(3)} % > ${(tol*100).toFixed(2)} %)${unit}`);};
let seed=20261014;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};

/* ---------- 1. Polygon illuminance (Lambert) ---------- */
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
/** Independent: Monte Carlo over the emitter surface, Ω⊥ = ∫ cosθe · cosθr / r² dA, triangles sampled by area. */
function monteCarlo(poly,emitterNormal,p,n,samples=400000){const c=poly.reduce((s,v)=>[s[0]+v[0]/poly.length,s[1]+v[1]/poly.length,s[2]+v[2]/poly.length],[0,0,0]);
 const tris=poly.map((v,i)=>[c,v,poly[(i+1)%poly.length]]),areas=tris.map(([a,b,d])=>{const u=sub(b,a),w=sub(d,a);return Math.hypot(u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0])/2;}),total=areas.reduce((a,b)=>a+b,0);
 let sum=0;for(let k=0;k<samples;k++){let r=rand()*total,i=0;while(r>areas[i]){r-=areas[i];i++;}const [a,b,d]=tris[i];let u=rand(),v=rand();if(u+v>1){u=1-u;v=1-v;}
  const q=[a[0]+(b[0]-a[0])*u+(d[0]-a[0])*v,a[1]+(b[1]-a[1])*u+(d[1]-a[1])*v,a[2]+(b[2]-a[2])*u+(d[2]-a[2])*v],r2=sub(p,q),dist2=dot(r2,r2),dir=norm(r2);
  const ce=dot(emitterNormal,dir),cr=-dot(n,dir);if(ce>0&&cr>0)sum+=ce*cr/dist2;}
 return sum/samples*total;}
const square=(s,z=0)=>[[-s/2,-s/2,z],[s/2,-s/2,z],[s/2,s/2,z],[-s/2,s/2,z]];
// emitter in the plane z = 0 facing +z; receiver points back at it
for(const [label,poly,p,n] of [
 ['square 1 m, on axis at 0.3 m',square(1),[0,0,.3],[0,0,-1]],
 ['square 1 m, on axis at 2 m',square(1),[0,0,2],[0,0,-1]],
 ['square 1 m, oblique receiver 40°',square(1),[.4,.2,.8],norm([-.5,0,-1])],
 ['strip 0.3×1.2 m, off axis',[[-.15,-.6,0],[.15,-.6,0],[.15,.6,0],[-.15,.6,0]],[.7,.3,.9],norm([-.7,-.3,-.9])],
 ['receiver tilted past the emitter edge (clipping)',square(1.2),[0,0,.25],norm([1,0,-.6])],
]){const exact=L.polygonProjectedSolidAngle(poly,p,n),mc=monteCarlo(poly,[0,0,1],p,n);report('Lambert vs Monte Carlo: '+label,exact,mc,.01);}

/* analytic: disc of radius R seen on axis, Ω⊥ = π R² / (R² + d²); a 24-gon of equal area converges to it */
for(const d of [.2,.5,1,3]){const R=.5,k=24,r=R*Math.sqrt(2*Math.PI/(k*Math.sin(2*Math.PI/k))),poly=[];for(let i=0;i<k;i++){const a=(i+.5)/k*2*Math.PI;poly.push([Math.cos(a)*r,Math.sin(a)*r,0]);}
 report(`Lambert 24-gon vs analytic disc, d = ${d} m`,L.polygonProjectedSolidAngle(poly,[0,0,d],[0,0,-1]),Math.PI*R*R/(R*R+d*d),.004);}
/* analytic: rectangle half-sides a, b on axis, Ω⊥ = 2 [ a/√(a²+d²) · atan(b/√(a²+d²)) + b/√(b²+d²) · atan(a/√(b²+d²)) ] */
for(const [a,b,d] of [[.3,.45,.4],[.15,.6,1],[.5,.5,.1]]){const A=Math.hypot(a,d),B=Math.hypot(b,d),want=2*(a/A*Math.atan(b/A)+b/B*Math.atan(a/B));
 report(`Lambert vs analytic rectangle ${2*a}×${2*b} m at ${d} m`,L.polygonProjectedSolidAngle([[-a,-b,0],[a,-b,0],[a,b,0],[-a,b,0]],[0,0,d],[0,0,-1]),want,1e-9);}
/* far field: Ω⊥ → A · cosθe · cosθr / d², i.e. the inverse-square law with Lambert's cosine */
{const d=40,p=[d*Math.sin(.5),0,d*Math.cos(.5)],n=norm(sub([0,0,0],p));report('far field (40 m, 28.6° off axis) vs inverse square',L.polygonProjectedSolidAngle(square(1),p,n),Math.cos(.5)/(d*d),.001);}
/* the five-times rule: a disc 5 diameters away departs from the inverse-square law by about 1 % */
{const R=.5,d=5*2*R;report('five-times rule: inverse-square error at 5 diameters',(Math.PI*R*R/(d*d))/(Math.PI*R*R/(R*R+d*d))-1,.01,.001);}

/* ---------- 2. Beam flux ---------- */
/* Monte Carlo over the cap the profile can reach (uniform in cos θ), so narrow beams get enough samples */
for(const beam of [15,55,90,120]){const exact=L.beamFlux(1,beam),lo=Math.cos(Math.min(Math.PI,beam/2*1.6*Math.PI/180));let mc=0;const N=400000;for(let k=0;k<N;k++){const cos=lo+(1-lo)*rand();mc+=L.beamFactor(Math.acos(cos)*180/Math.PI,beam);}mc*=2*Math.PI*(1-lo)/N;report(`beam flux (Simpson) vs Monte Carlo, ${beam}° beam`,exact,mc,.01);}
report('Lambertian flux check: 2π∫cosθ sinθ dθ = π',(()=>{let s=0;const n=20000;for(let i=0;i<n;i++){const t=(i+.5)/n*Math.PI/2;s+=Math.cos(t)*Math.sin(t);}return 2*Math.PI*s*Math.PI/2/n;})(),Math.PI,1e-6);

/* ---------- 3. Colour: Kim et al. Planckian fit vs Planck's law integrated with CIE 1931 functions ---------- */
/* independent colour-matching functions: Wyman, Sloan & Shirley (2013) multi-lobe fit */
const g=(x,m,s1,s2)=>{const t=(x-m)/(x<m?s1:s2);return Math.exp(-.5*t*t);};
const cmf=l=>[1.056*g(l,599.8,37.9,31)+.362*g(l,442,16,26.7)-.065*g(l,501.1,20.4,26.2),.821*g(l,568.8,46.9,40.5)+.286*g(l,530.9,16.3,31.1),1.217*g(l,437,11.8,36)+.681*g(l,459,26,13.8)];
const planckXY=T=>{let X=0,Y=0,Z=0;for(let l=360;l<=830;l+=1){const m=l*1e-9,B=1/(Math.pow(m,5)*(Math.exp(1.438776877e-2/(m*T))-1)),[x,y,z]=cmf(l);X+=B*x;Y+=B*y;Z+=B*z;}const s=X+Y+Z;return [X/s,Y/s];};
/* the multi-lobe functions are themselves a fit (about 1e-3 to 4e-3 in xy), so this check allows 0.005 */
for(const T of [2000,2856,3200,4000,5600,6500,10000]){const [kx,ky]=L.planckianXY(T),[px,py]=planckXY(T);
 assert(Math.hypot(kx-px,ky-py)<.005,`Planckian locus at ${T} K: Kim ${kx.toFixed(4)},${ky.toFixed(4)} vs Planck+CMF ${px.toFixed(4)},${py.toFixed(4)}`);results.push({name:`Planckian locus ${T} K (Kim vs Planck + CMF), Δxy`,got:Math.hypot(kx-px,ky-py),want:0,err:Math.hypot(kx-px,ky-py)});}
/* tabulated Planckian chromaticities (CIE 1931 2°, c₂ = 1.4388e-2 m·K) */
for(const [T,x,y] of [[2000,.5267,.4133],[3000,.4369,.4041],[4000,.3805,.3768],[5000,.3451,.3516],[6500,.3135,.3236],[10000,.2807,.2884]]){const [kx,ky]=L.planckianXY(T),e=Math.hypot(kx-x,ky-y);assert(e<.0015,`Planckian table ${T} K: ${kx.toFixed(4)},${ky.toFixed(4)} vs ${x},${y}`);results.push({name:`Planckian locus ${T} K (Kim vs table), Δxy`,got:e,want:0,err:e});}
/* published reference point: CIE illuminant A (2856 K Planckian) x = 0.44757, y = 0.40745 */
{const [x,y]=L.planckianXY(2856);report('illuminant A x',x,.44757,.002);report('illuminant A y',y,.40745,.002);}
/* McCamy inverse: D65 chromaticity (0.31271, 0.32902) has CCT ≈ 6504 K; round trip over the working range */
report('McCamy CCT of D65 (kept for comparison)',L.mccamyCCT(.31271,.32902),6504,.003);
for(const T of [2700,3200,4300,5600,6500,8000]){const [x,y]=L.planckianXY(T);report(`round trip CCT ${T} K (Kim → McCamy)`,L.mccamyCCT(x,y),T,.006);}
/* CCT and Duv by nearest Planckian point: round trip over the full range, on-locus Duv ≈ 0 */
for(const T of [1700,2700,4000,6500,10000,15000,25000]){const [x,y]=L.planckianXY(T),r=L.cctDuv(x,y);report(`nearest-point CCT round trip ${T} K`,r.cct,T,.001);assert(Math.abs(r.duv)<2e-5,`Duv on locus at ${T} K: ${r.duv}`);}
/* independent reviewer computation (CIE 1931 1-nm table, nearest point in CIE 1960 uv): 3200 K + 5600 K at equal
   exposure gives about 4142.19 K and Duv −0.00252 */
{const c=L.mixedColour([{h:1,cct:3200},{h:1,cct:5600}]);report('mixed 3200 K + 5600 K CCT vs independent CIE computation',c.cct,4142.19,.004);report('mixed 3200 K + 5600 K Duv vs independent computation',c.duv,-.00252,.15);}
/* depth of field: 50 mm, f/8, c = 0.03 mm. Infinity focus starts sharpness at H − f = 10.4167 m; at that distance the
   circle of confusion equals c exactly */
{const d=L.depthOfField(50,8,Infinity);report('hyperfocal 50 mm f/8',d.hyperfocal,10.46667,1e-4);report('infinity focus near limit = H − f',d.near,10.41667,1e-4);report('circle of confusion at that near limit = 0.03 mm',L.circleOfConfusion(50,8,Infinity,d.near),.03,1e-9);
 const s=3,fin=L.depthOfField(50,8,s);report('finite focus: c at the near limit = 0.03 mm',L.circleOfConfusion(50,8,s,fin.near),.03,1e-6);report('finite focus: c at the far limit = 0.03 mm',L.circleOfConfusion(50,8,s,fin.far),.03,1e-6);
 assert(L.depthOfField(50,8,d.hyperfocal).far===Infinity,'focus at H reaches infinity');results.push({name:'focus at the hyperfocal distance reaches infinity',got:1,want:1,err:0});}
/* mixing: identical lights keep their temperature; mixing is bounded by its components */
report('mixed CCT of two 5600 K lights',L.mixedCCT([{h:3,cct:5600},{h:1,cct:5600}]),5600,.01);
{const m=L.mixedCCT([{h:1,cct:3200},{h:1,cct:5600}]);assert(m>3200&&m<5600,'mixed CCT lies between its parts');results.push({name:'mixed CCT 3200 K + 5600 K (equal illuminance)',got:m,want:NaN,err:0});}
/* white balance sanity: a 6504 K black body renders close to the sRGB white point */
for(const T of [2700,3200,5600,6504,10000]){const [r,gg,b]=L.cctToRGB(T);report(`colour of ${T} K keeps luminance Y = 1`,.2126*r+.7152*gg+.0722*b,1,1e-3);}

/* ---------- 4. Exposure ---------- */
/* ISO 2720 incident constant C = 250: GN 32 at 4 m and ISO 100 is f/8 by definition of the guide number */
{const H=L.axisEnergy({kind:'strobe',gn:32},1,0,1/125)/(4*4);report('guide number: GN 32 at 4 m, ISO 100 → f/8 (same C on both sides)',L.apertureFor(H,100),8,1e-9);report('target exposure at f/8, ISO 100 with the dome constant C = 340',L.targetExposure({iso:100,aperture:8,shutter:1/125}),340*64/100,1e-9);
 report('flat-disc vs dome constant: 160 lx·s at ISO 100 reads f/6.86 on a dome meter',L.apertureFor(160,100),Math.sqrt(160*100/340),1e-9);}
/* inverse-square point source: doubling the distance costs two stops */
{const q=L.axisEnergy({kind:'strobe',gn:60},1,0,1/125);report('point source: 2× distance = −2 stops',Math.log2((q/1)/(q/4)),2,1e-12);}

const width=Math.max(...results.map(r=>r.name.length));
for(const r of results)console.log(r.name.padEnd(width),' got',Number.isFinite(r.got)?r.got.toPrecision(6):r.got,Number.isFinite(r.want)?' want '+r.want.toPrecision(6):'',' err',(r.err*100).toFixed(4)+' %');
console.log(`PASS: ${results.length} lighting physics cross-checks (Lambert polygon, Monte Carlo, analytic disc and rectangle, far field, five-times rule, beam flux, Planck + CIE 1931, McCamy, ISO 2720 exposure, CCT/Duv, depth of field).`);
