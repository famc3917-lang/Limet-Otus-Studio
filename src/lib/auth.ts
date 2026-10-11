// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {errorText} from './interface-error';
import {apiRequest,setCSRF} from './api-client';
import {apiSession,desktop} from './desktop';
import type {SessionUser} from './permissions';
import type {StudioCurrency} from './money';
import {buildSeedData} from './seed';
import {defaultSettings,deviceTimeZone} from './settings';
import {getStudioLanguage} from './i18n';
export const ACCOUNTS_KEY='photo-studio-accounts-v1',AUTH_KEY='photo-studio-auth-v1',FIRST_RUN_KEY='photo-studio-first-run-v1';
type SetupMode='desktop'|'setup-token'|'unavailable';
export type RegistrationMode='invite'|SetupMode;
let current:SessionUser|null=null,initialized=false,setupMode:SetupMode='unavailable',initialization:Promise<void>|undefined;
export const getSessionUser=()=>current;
export const getCurrentUser=()=>current?.nickname??current?.username??null;
export const isLoggedIn=()=>!!current;
export const hasAnyAccount=()=>initialized;
export const getRegistrationMode=():RegistrationMode=>initialized?'invite':setupMode==='desktop'&&!desktop()?.apiSession?'unavailable':setupMode;
export async function refreshRegistrationStatus(){const status=await apiRequest<{initialized:boolean;setupMode?:SetupMode}>('auth/status');initialized=status.initialized;setupMode=status.setupMode??(desktop()?.apiSession?'desktop':'setup-token');return getRegistrationMode();}
const change=()=>window.dispatchEvent(new Event('studio-auth-changed'));
function apply(value:{user:SessionUser;csrf:string}){current=value.user;setCSRF(value.csrf);initialized=true;change();}
export function initializeAuth(){return initialization??=(async()=>{await refreshRegistrationStatus();
 if(!initialized&&desktop()){const accounts=JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||'[]');if(Array.isArray(accounts)&&accounts.length){const {token}=await apiSession();await apiRequest('auth/bootstrap',{method:'POST',headers:{'X-Studio-Bootstrap':token},body:JSON.stringify({accounts:accounts.map((a:{username:string;passHash:string})=>({username:a.username,passHash:a.passHash}))})});initialized=true;}}
 try{apply(await apiRequest<{user:SessionUser;csrf:string}>('auth/me'));}catch(e){if((e as {status?:number}).status!==401)throw e;current=null;}
 })();}
export async function login(username:string,password:string):Promise<{ok:boolean;msg:string}>{try{apply(await apiRequest<{user:SessionUser;csrf:string}>('auth/login',{method:'POST',body:JSON.stringify({username,password})}));localStorage.removeItem(ACCOUNTS_KEY);localStorage.removeItem(AUTH_KEY);return {ok:true,msg:'登录成功'};}catch(e){return {ok:false,msg:errorText(e)};}}
export async function registerAccount(username:string,password:string,invitation='',setupToken='',nickname='',realName='',currency:StudioCurrency='CNY'):Promise<{ok:boolean;msg:string}>{try{const mode=await refreshRegistrationStatus();if(mode!=='invite'){if(mode==='unavailable')throw new Error('请在桌面应用中创建工作室，或联系此云实例的部署负责人');if(mode==='setup-token'&&!setupToken.trim())throw new Error('请填写首次开通授权');const {token}=mode==='desktop'?await apiSession():{token:''};await apiRequest('auth/bootstrap',{method:'POST',headers:token?{'X-Studio-Bootstrap':token}:{},body:JSON.stringify({username,password,setupToken,nickname,realName})});initialized=true;const signedIn=await login(username,password);if(!signedIn.ok)return signedIn;const language=getStudioLanguage(),seed=buildSeedData(language);if(currency!=='CNY'){seed.packageTiers=seed.packageTiers.map(item=>({...item,price:0}));seed.extraItems=(seed.extraItems??[]).map(item=>({...item,price:0}));}seed.settings={...defaultSettings(language),currency,timeZone:deviceTimeZone()};await apiRequest('state',{method:'PUT',body:JSON.stringify({revision:0,data:seed})});return signedIn;}if(!invitation.trim())throw new Error('请向工作室超级管理员获取邀请代码');apply(await apiRequest<{user:SessionUser;csrf:string}>('auth/register',{method:'POST',body:JSON.stringify({username,password,invitation,nickname,realName})}));return {ok:true,msg:'注册成功'};}catch(e){await refreshRegistrationStatus().catch(()=>{});return {ok:false,msg:errorText(e)};}}
export async function logout(){const flush=(window as unknown as {__studioFlush?:()=>Promise<boolean>}).__studioFlush;if(flush&&!await flush())throw new Error('修改尚未同步，请先导出或恢复连接');try{await apiRequest('auth/logout',{method:'POST',body:'{}'});}finally{current=null;setCSRF('');change();void desktop()?.assistantPreferences?.({background:false,floating:false,authenticated:false});}}
export function ensureFirstRun(){return false;}

export async function refreshSessionProfile(){apply(await apiRequest<{user:SessionUser;csrf:string}>('auth/me'));}
