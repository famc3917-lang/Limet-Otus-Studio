// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell, Btn, Card, Field, TextInput } from "@/components/biz/ui";
import { LogIn } from "lucide-react";
import { login,hasAnyAccount } from "@/lib/auth";
import {useStudioText} from '@/lib/i18n';
import {LanguageSelect} from '@/components/biz/language-select';

function LoginInner() {
  const t=useStudioText();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    if (busy) return;
    setErr("");
    setOk("");
    const name = username.trim();
    if (!name) return setErr(t('请填写账户名','Enter your account name'));
    if (!password) return setErr(t('请填写密码','Enter your password'));

    setBusy(true);
    let res: Awaited<ReturnType<typeof login>>;
    try { res = await login(name, password); }
    catch { setBusy(false); return setErr(t('登录暂时不可用，请重试','Sign-in is temporarily unavailable. Please try again.')); }
    setBusy(false);
    if (!res.ok) return setErr(res.msg);

    setOk(t(`欢迎回来，${name}！`,`Welcome back, ${name}.`));
    router.replace("/");
  };

  if(!hasAnyAccount())return <AppShell><div className="mx-auto w-full max-w-md"><Card className="overflow-hidden"><div className="auth-heading"><LanguageSelect/><h1 className="text-lg font-bold">{t('开始使用观隅','Get started with Limet Otus')}</h1><p className="mt-2 text-sm">{t('创建您的工作室与第一个超级管理员账户','Create your studio and its first owner account')}</p></div><div className="space-y-4 p-6"><Btn className="w-full" onClick={()=>router.push('/register')}>{t('创建工作室','Create studio')}</Btn><div className="text-center text-xs"><Link href="/about">{t('软件介绍','About')}</Link></div></div></Card></div></AppShell>;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-md">
        <Card className="overflow-hidden">
          {/* 头部 */}
          <div className="auth-heading">
            <LanguageSelect/>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
              <LogIn size={24} />
            </div>
            <h1 className="text-lg font-bold">{t('登录账户','Sign in')}</h1>
            <p className="mt-1 text-xs text-zinc-400">{t('欢迎回来，继续你的工作室管理','Welcome back to your studio')}</p>
          </div>

          {/* 表单 */}
          <div className="space-y-4 p-6">
            <Field label={t('账户名','Account name')} required>
              <TextInput
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('注册时的账户名','Your account name')}
                autoComplete="username"
              />
            </Field>
            <Field label={t('密码','Password')} required>
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('输入密码','Enter password')}
                autoComplete="current-password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
              />
            </Field>

            {err && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{err}</p>
            )}
            {ok && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-600">{ok}</p>
            )}

            <Btn className="w-full" onClick={handleLogin} disabled={busy}>
              {busy ? t('正在验证…','Signing in…') : t('登录','Sign in')}
            </Btn>

            <div className="pt-1 text-center text-xs text-zinc-400">
              {t('还没有账户？','New to the studio?')}{" "}
              <Link href="/register" className="text-amber-600 hover:underline">
                {t('注册账户','Create account')}
              </Link>
              {" · "}
              <Link href="/about" className="text-amber-600 hover:underline">
                {t('软件介绍','About')}
              </Link>
            </div>

          </div>
        </Card>
      </div>
    </AppShell>
  );
}

export default function LoginPage() {
  return <LoginInner />;
}
