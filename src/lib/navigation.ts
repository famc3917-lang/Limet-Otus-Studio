// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
export function parentRoute(pathname:string,query=new URLSearchParams()):string|undefined {
 if(pathname==='/'||pathname==='/login'||pathname==='/register')return undefined;
 if(/\/print(?:-summary)?$/.test(pathname))return pathname.replace(/\/print(?:-summary)?$/,'');
 const orderId=query.get('orderId');
 if((pathname==='/pre/new'||pathname==='/post/new')&&orderId)return '/orders/'+encodeURIComponent(orderId);
 const parts=pathname.split('/').filter(Boolean);
 return parts.length>1?'/'+parts.slice(0,-1).join('/'):'/';
}
