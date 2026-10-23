// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
/* Unlock window: sends the account name and password to the main process. */
const $=id=>document.getElementById(id);
const go=$('go'),msg=$('msg');
async function submit(){const username=$('u').value.trim(),password=$('p').value;if(!username||!password){msg.textContent='请填写账户名和密码';return;}
 go.disabled=true;msg.className='msg';msg.textContent='正在解锁…（密码校验需要约 1 秒）';
 const r=await window.unlock.submit(username,password);if(!r.ok){go.disabled=false;msg.textContent=r.error||'无法解锁';$('p').select();}else{msg.className='msg ok';msg.textContent='已解锁，正在打开工作室…';}}
go.addEventListener('click',submit);$('p').addEventListener('keydown',e=>{if(e.key==='Enter')submit();});$('u').addEventListener('keydown',e=>{if(e.key==='Enter')$('p').focus();});
