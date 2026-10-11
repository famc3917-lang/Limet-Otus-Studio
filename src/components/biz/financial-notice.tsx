// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';
import {useStudioText} from '@/lib/i18n';

export function FinancialNotice({className=''}:{className?:string}){
 const t=useStudioText();
 return <p className={`financial-notice ${className}`} role="note">{t('金额、结余和分成仅供工作室内部参考，可能因录入、退款、规则或计算差异而不准确。请核对原始交易与凭证；本软件不是会计或报税工具，结果不得作为记账、纳税申报或法定财务凭证。','Amounts, balances and shares are estimates for internal studio use and may be inaccurate. Verify transactions against original records. This software is not an accounting or tax tool; its figures must not be used for bookkeeping, tax filings or statutory financial evidence.')}</p>;
}
