// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {createCipheriv,createDecipheriv,createHmac,randomBytes,scrypt,pbkdf2,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

export function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
export function masterKey(){const key=Buffer.from(process.env.STUDIO_MASTER_KEY??'','base64');if(key.length!==32)fail('服务端缺少有效的 STUDIO_MASTER_KEY（32 字节 Base64）',503);return key;}
export const opaque=()=>randomBytes(32).toString('base64url');
export const digest=(value:string)=>createHmac('sha256',masterKey()).update(value).digest('hex');
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&x.length>0&&timingSafeEqual(x,y);}
/** AAD binds ciphertext to a tenant and purpose; copying rows cannot cross that boundary. */
export function seal(value:unknown,context:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',masterKey(),iv);cipher.setAAD(Buffer.from(context));const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return ['gcm1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),bytes.toString('base64url')].join('.');}
export function unseal<T>(value:string,context:string):T{const [version,iv,tag,data]=value.split('.');if(version!=='gcm1')fail('加密数据格式不受支持',500);const cipher=createDecipheriv('aes-256-gcm',masterKey(),Buffer.from(iv,'base64url'));cipher.setAAD(Buffer.from(context));cipher.setAuthTag(Buffer.from(tag,'base64url'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data,'base64url')),cipher.final()]).toString('utf8'));}
const derive=(password:string,salt:Buffer)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:128*1024*1024},(error,key)=>error?reject(error):resolve(key)));
export async function passwordHash(password:string){if(typeof password!=='string'||password.length<12||password.length>256)fail('新密码须为 12–256 位');const salt=randomBytes(32);return `scrypt$32768$8$1$${salt.toString('hex')}$${(await derive(password,salt)).toString('hex')}`;}
export async function verifyPassword(password:string,saved:string){if(typeof password!=='string'||password.length>256)return false;
 if(/^scrypt\$32768\$8\$1\$[a-f0-9]{64}\$[a-f0-9]{128}$/.test(saved)){const parts=saved.split('$');return equal((await derive(password,Buffer.from(parts[4],'hex'))).toString('hex'),parts[5]);}
 const parts=saved.split('$');if(parts[0]==='pbkdf2'&&parts.length===4&&/^\d+$/.test(parts[1])&&/^[a-f0-9]{32}$/.test(parts[2])&&/^[a-f0-9]{64}$/.test(parts[3])){const count=Number(parts[1]);if(count<100000||count>1000000)return false;const key=await promisify(pbkdf2)(password,Buffer.from(parts[2],'hex'),count,32,'sha256');return equal(key.toString('hex'),parts[3]);}
 let h=5381;for(let i=0;i<password.length;i++)h=((h<<5)+h+password.charCodeAt(i))|0;return /^h-?[a-z0-9]+$/.test(saved)&&equal(`h${h.toString(36)}`,saved);
}
/** Upgrade old short passwords without changing the user's credential on migration. */
export async function upgradeHash(password:string){const salt=randomBytes(32);return `scrypt$32768$8$1$${salt.toString('hex')}$${(await derive(password,salt)).toString('hex')}`;}
