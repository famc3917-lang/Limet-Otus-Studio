// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/**
 * Occlusion proxy for the lighting lab's shadow tests, built the way games build collision volumes: the subject's
 * triangles are rasterised once into a coarse voxel grid in the subject's own space, and rays walk the grid cell by
 * cell (Amanatides & Woo, "A Fast Voxel Traversal Algorithm for Ray Tracing", 1987). A ray then costs a few hundred cell
 * reads instead of a test against every triangle of a detailed model.
 */
import * as THREE from 'three';

export interface OcclusionGrid { min:THREE.Vector3; cell:number; nx:number; ny:number; nz:number; cells:Uint8Array; toLocal:THREE.Matrix4 }

/** Rasterises every mesh under `root` (in root's local space) into cells of `cell` metres. */
export function buildOcclusionGrid(root:THREE.Object3D,cell=.03):OcclusionGrid{
 root.updateMatrixWorld(true);const toLocal=root.matrixWorld.clone().invert(),box=new THREE.Box3(),meshes:{geo:THREE.BufferGeometry;m:THREE.Matrix4}[]=[];
 root.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh||!mesh.visible)return;const m=toLocal.clone().multiply(mesh.matrixWorld);meshes.push({geo:mesh.geometry,m});
  const g=mesh.geometry;if(!g.boundingBox)g.computeBoundingBox();box.union(g.boundingBox!.clone().applyMatrix4(m));});
 const min=box.min.clone().addScalar(-cell),size=box.getSize(new THREE.Vector3()).addScalar(2*cell);
 const nx=Math.max(1,Math.ceil(size.x/cell)),ny=Math.max(1,Math.ceil(size.y/cell)),nz=Math.max(1,Math.ceil(size.z/cell)),cells=new Uint8Array(nx*ny*nz);
 const mark=(x:number,y:number,z:number)=>{const i=Math.floor((x-min.x)/cell),j=Math.floor((y-min.y)/cell),k=Math.floor((z-min.z)/cell);if(i>=0&&j>=0&&k>=0&&i<nx&&j<ny&&k<nz)cells[i+nx*(j+ny*k)]=1;};
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 for(const {geo,m} of meshes){const pos=geo.attributes.position as THREE.BufferAttribute;if(!pos)continue;const idx=geo.index,count=idx?idx.count:pos.count;
  for(let t=0;t+2<count;t+=3){const ia=idx?idx.getX(t):t,ib=idx?idx.getX(t+1):t+1,ic=idx?idx.getX(t+2):t+2;
   a.fromBufferAttribute(pos,ia).applyMatrix4(m);b.fromBufferAttribute(pos,ib).applyMatrix4(m);c.fromBufferAttribute(pos,ic).applyMatrix4(m);
   /* sample the triangle densely enough that no crossed cell is skipped */
   const n=Math.max(1,Math.ceil(Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))/(cell*.5)));
   for(let i=0;i<=n;i++)for(let j=0;i+j<=n;j++){const u=i/n,v=j/n;mark(a.x+(b.x-a.x)*u+(c.x-a.x)*v,a.y+(b.y-a.y)*u+(c.y-a.y)*v,a.z+(b.z-a.z)*u+(c.z-a.z)*v);}}}
 return {min,cell,nx,ny,nz,cells,toLocal};
}

const o=new THREE.Vector3(),e=new THREE.Vector3();
/** True when the segment from `from` to `to` (world space) passes through an occupied cell. `root` is the object the
    grid was built from, so its current transform (e.g. the subject's yaw) is honoured. */
export function gridBlocks(g:OcclusionGrid,root:THREE.Object3D,from:THREE.Vector3,to:THREE.Vector3){
 const inv=root.matrixWorld.clone().invert();o.copy(from).applyMatrix4(inv);e.copy(to).applyMatrix4(inv);
 const dx=e.x-o.x,dy=e.y-o.y,dz=e.z-o.z,len=Math.hypot(dx,dy,dz);if(len<1e-9)return false;
 /* clip the segment to the grid box */
 let t0=0,t1=1;const lo=[g.min.x,g.min.y,g.min.z],hi=[g.min.x+g.nx*g.cell,g.min.y+g.ny*g.cell,g.min.z+g.nz*g.cell],p=[o.x,o.y,o.z],d=[dx,dy,dz];
 for(let k=0;k<3;k++){if(Math.abs(d[k])<1e-12){if(p[k]<lo[k]||p[k]>hi[k])return false;continue;}let ta=(lo[k]-p[k])/d[k],tb=(hi[k]-p[k])/d[k];if(ta>tb)[ta,tb]=[tb,ta];t0=Math.max(t0,ta);t1=Math.min(t1,tb);if(t0>t1)return false;}
 const sx=p[0]+d[0]*t0,sy=p[1]+d[1]*t0,sz=p[2]+d[2]*t0;
 const i=Math.min(g.nx-1,Math.max(0,Math.floor((sx-g.min.x)/g.cell))),j=Math.min(g.ny-1,Math.max(0,Math.floor((sy-g.min.y)/g.cell))),k=Math.min(g.nz-1,Math.max(0,Math.floor((sz-g.min.z)/g.cell)));
 const step=[Math.sign(dx),Math.sign(dy),Math.sign(dz)],cur=[i,j,k],tMax=[0,0,0],tDelta=[0,0,0],start=[sx,sy,sz];
 for(let a=0;a<3;a++){if(step[a]===0){tMax[a]=Infinity;tDelta[a]=Infinity;continue;}const edge=g.min.getComponent(a)+(cur[a]+(step[a]>0?1:0))*g.cell;tMax[a]=t0+(edge-start[a])/d[a];tDelta[a]=g.cell/Math.abs(d[a]);}
 const dims=[g.nx,g.ny,g.nz];
 for(;;){if(g.cells[cur[0]+g.nx*(cur[1]+g.ny*cur[2])])return true;const a=tMax[0]<tMax[1]?(tMax[0]<tMax[2]?0:2):(tMax[1]<tMax[2]?1:2);if(tMax[a]>t1)return false;cur[a]+=step[a];if(cur[a]<0||cur[a]>=dims[a])return false;tMax[a]+=tDelta[a];}
}
