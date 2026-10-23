// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {createCipheriv,createDecipheriv,createHmac,hkdfSync,randomBytes,scrypt,pbkdf2,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

export function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
export function masterKey(){const key=Buffer.from(process.env.STUDIO_MASTER_KEY??'','base64');if(key.length!==32)fail('服务端缺少有效的 STUDIO_MASTER_KEY（32 字节 Base64）',503);return key;}
export const opaque=()=>randomBytes(32).toString('base64url');
export const digest=(value:string)=>createHmac('sha256',masterKey()).update(value).digest('hex');
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&x.length>0&&timingSafeEqual(x,y);}
/** AAD binds ciphertext to a tenant and purpose; copying rows cannot cross that boundary. */
export function seal(value:unknown,context:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',masterKey(),iv);cipher.setAAD(Buffer.from(context));const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return ['gcm1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),bytes.toString('base64url')].join('.');}
export function unseal<T>(value:string,context:string):T{const [version,iv,tag,data]=value.split('.');if(version!=='gcm1')fail('加密数据格式不受支持',500);const cipher=createDecipheriv('aes-256-gcm',masterKey(),Buffer.from(iv,'base64url'));cipher.setAAD(Buffer.from(context));cipher.setAuthTag(Buffer.from(tag,'base64url'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data,'base64url')),cipher.final()]).toString('utf8'));}
/**
 * Passwords: scrypt with a per-account 32-byte salt at N=2^17, r=8, p=1 (128 MiB, OWASP's recommended setting), so each
 * guess costs memory as well as time. Hashes made at the earlier N=2^15 still verify and are upgraded at next sign-in.
 */
export const SCRYPT_N=131072;
const derive=(password:string,salt:Buffer,N=SCRYPT_N)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N,r:8,p:1,maxmem:256*1024*1024},(error,key)=>error?reject(error):resolve(key)));
const SCRYPT_FORMAT=/^scrypt\$(32768|131072)\$8\$1\$[a-f0-9]{64}\$[a-f0-9]{128}$/;
export const DUMMY_HASH=`scrypt$${SCRYPT_N}$8$1$${'0'.repeat(64)}$${'0'.repeat(128)}`;
async function makeHash(secret:string){const salt=randomBytes(32);return `scrypt$${SCRYPT_N}$8$1$${salt.toString('hex')}$${(await derive(secret,salt)).toString('hex')}`;}
export async function verifyPassword(password:string,saved:string){if(typeof password!=='string'||password.length>1024||typeof saved!=='string')return false;
 if(SCRYPT_FORMAT.test(saved)){const parts=saved.split('$');return equal((await derive(password,Buffer.from(parts[4],'hex'),Number(parts[1]))).toString('hex'),parts[5]);}
 const parts=saved.split('$');if(parts[0]==='pbkdf2'&&parts.length===4&&/^\d+$/.test(parts[1])&&/^[a-f0-9]{32}$/.test(parts[2])&&/^[a-f0-9]{64}$/.test(parts[3])){const count=Number(parts[1]);if(count<100000||count>1000000)return false;const key=await promisify(pbkdf2)(password,Buffer.from(parts[2],'hex'),count,32,'sha256');return equal(key.toString('hex'),parts[3]);}
 return false;
}
/** Hashes that should be recomputed at the current strength after a successful sign-in. */
export const needsRehash=(saved:string)=>!!saved&&!saved.startsWith(`scrypt$${SCRYPT_N}$`);
/** Recompute an older hash at the current strength. */
export const upgradeHash=(secret:string)=>makeHash(secret);

/**
 * Two passwords per account; either one signs in.
 *  · traditional password: 12–256 printable ASCII characters with at least one letter and one digit;
 *  · text password: 6–200 characters of any well-formed UTF-8 text (a line of Chinese, a verse, emoji), normalised
 *    to NFC so the same words typed with another input method still match.
 */
export function checkTraditionalPassword(password:string){if(typeof password!=='string'||password.length<12||password.length>256||!/^[\x21-\x7e]+$/.test(password)||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))fail('传统密码须为 12–256 位，包含字母和数字，可含符号，不含空格');return password;}
export const normalisePassphrase=(text:string)=>typeof text==='string'?text.normalize('NFC'):'';
const CONTROL=/[\p{Cc}]/u;
export function checkPassphrase(text:string){const t=normalisePassphrase(text),chars=[...t].length;
 if(!t||!t.isWellFormed()||chars<6||chars>200||CONTROL.test(t)||!t.trim())fail('文字密码须为 6–200 个字符，可以是任意文字，不能含控制字符');return t;}
export const passwordHash=(password:string)=>makeHash(checkTraditionalPassword(password));
export const passphraseHash=(text:string)=>makeHash(checkPassphrase(text));
/** Checks the input against both passwords; both always run, in parallel, so timing does not reveal which matched. */
export async function verifyEither(input:string,u:{password_hash:string;passphrase_hash?:string|null}):Promise<'password'|'passphrase'|null>{
 const [a,b]=await Promise.all([verifyPassword(input,u.password_hash),verifyPassword(normalisePassphrase(input),u.passphrase_hash||DUMMY_HASH)]);return a?'password':b&&u.passphrase_hash?'passphrase':null;}

/**
 * Credential seal. Each account row carries an HMAC, under a key derived from the master key, over everything that
 * decides who may sign in and with what power: id, workspace, user name, role, disabled flag and both password hashes.
 * A row changed by anything other than this server (a database edit, a swapped hash, a promoted role) no longer
 * matches its seal and is refused.
 */
export interface CredentialRow { id:string; workspace_id:string; username:string; role:string; disabled:number|boolean; password_hash:string; passphrase_hash?:string|null; credential_seal?:string|null }
let credentialKeyCache:{source:string;key:Buffer}|null=null;
function credentialKey(){const source=process.env.STUDIO_MASTER_KEY??'';if(credentialKeyCache?.source!==source)credentialKeyCache={source,key:Buffer.from(hkdfSync('sha256',masterKey(),Buffer.alloc(0),Buffer.from('limet-otus/credential-seal/v1'),32))};return credentialKeyCache.key;}
export function credentialSeal(u:CredentialRow){return 'cs1.'+createHmac('sha256',credentialKey()).update(JSON.stringify([u.id,u.workspace_id,u.username,u.role,u.disabled?1:0,u.password_hash,u.passphrase_hash??''])).digest('base64url');}
export const credentialIntact=(u:CredentialRow)=>typeof u.credential_seal==='string'&&equal(u.credential_seal,credentialSeal(u));
