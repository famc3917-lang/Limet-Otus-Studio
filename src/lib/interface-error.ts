// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {getStudioLanguage} from './i18n';
import {interfaceText} from './interface-text';
import {catalogEnglish} from './error-catalog';
const ERROR_TEXT:Readonly<Record<string,string>>={
 '请求失败':'The request could not be completed.',
 '响应为空':'The service returned an empty response.',
 '响应超出限制':'The response exceeded the permitted size.',
 '助手请求失败':'The assistant request could not be completed.',
 '连接中断，请重试':'The connection was interrupted. Please retry.',
 '服务器暂不可用，请检查服务器端配置与运行日志。':'The service is temporarily unavailable. Contact your studio administrator.',
 '登录已过期，请重新登录':'Your session has expired. Sign in again.',
 '没有权限':'You do not have permission for this operation.',
 '请选择有效日期':'Select a valid date.',
};
/** Localize service errors only. Client notes and assistant responses are untouched. */
/** Localised text for an error thrown in the interface or returned by the service. */
export function errorText(error:unknown,fallback='请求失败'):string{
 const value=error instanceof Error?error.message:typeof error==='string'?error:'';
 return interfaceError(value||fallback,(error as {status?:number})?.status);
}
export function interfaceError(value:unknown,status?:number):string{
 const message=typeof value==='string'&&value?value:'请求失败';
 if(getStudioLanguage()!=='en')return message;
 if(Object.hasOwn(ERROR_TEXT,message))return ERROR_TEXT[message];
 const catalogued=catalogEnglish(message);if(catalogued!==undefined)return catalogued;
 const translated=interfaceText(message,'en');if(translated!==message)return translated;
 if(!/[\u3400-\u9fff]/.test(message))return message;
 if(status===401)return 'Your session has expired. Sign in again.';
 if(status===403)return 'You do not have permission for this operation.';
 if(status===409)return 'The record has changed or conflicts with an existing record. Refresh and retry.';
 if(status===429)return 'Too many requests. Please wait and retry.';
 if(status&&status>=500)return 'The service is temporarily unavailable. Contact your studio administrator.';
 return 'The request could not be completed. Check the entered details and retry.';
}
