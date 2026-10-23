// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use client';

import {StudioSelect} from '@/components/biz/select';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect,useState } from "react";
import { AppShell, Btn, Card, Field, TextInput } from "@/components/biz/ui";
import { UserPlus } from "lucide-react";
import { registerAccount,getRegistrationMode,refreshRegistrationStatus } from "@/lib/auth";
import {useStudioText} from '@/lib/i18n';
import {LanguageSelect} from '@/components/biz/language-select';
import {useStudioLanguage} from '@/lib/i18n';
import {STUDIO_CURRENCIES,type StudioCurrency} from '@/lib/money';

function RegisterInner() {
  const t=useStudioText();
  const language=useStudioLanguage();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [nickname,setNickname]=useState("");
  const [realName,setRealName]=useState("");
  const [invitation,setInvitation]=useState('');
  const [setupToken,setSetupToken]=useState('');
  const [mode,setMode]=useState(getRegistrationMode);
  const firstRun=mode!=='invite';
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [currency,setCurrency]=useState<StudioCurrency>('CNY');
  useEffect(()=>{setCurrency(language==='en'?'USD':'CNY');},[language]);

  const handleRegister = async () => {
    if (busy) return;
    setErr("");
    setOk("");
    const name = username.trim();
    if (!name) return setErr(t('请填写账户名','Enter an account name'));
    if (!nickname.trim()) return setErr(t('请填写网名','Enter a display name'));
    if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || /\s/.test(password)) return setErr(t('传统密码至少 12 位，包含字母和数字，不含空格','Use at least 12 characters with letters and digits and no spaces'));
    if ([...passphrase.normalize('NFC')].length < 6) return setErr(t('文字密码至少 6 个字，任何文字都可以','The text password needs at least 6 characters of any kind'));
    if (password !== confirm) return setErr(t('两次输入的密码不一致','Passwords do not match'));
    if (mode==='invite'&&!invitation.trim()) return setErr(t('请填写工作室邀请代码','Enter your studio invitation code'));
    if (mode==='setup-token'&&!setupToken.trim()) return setErr(t('请填写首次开通授权','Enter the initial setup token'));

    setBusy(true);
    let res: Awaited<ReturnType<typeof registerAccount>>;
    try { res = await registerAccount(name, password,invitation,setupToken,nickname,realName,currency,passphrase); }
    catch { setBusy(false); return setErr(t('注册暂时不可用，请重试','Registration is temporarily unavailable. Please try again.')); }
    setBusy(false);
    setMode(getRegistrationMode());
    if (!res.ok) return setErr(res.msg);

    setOk(t(`账户「${name}」创建成功`,`Account “${name}” created`));
    router.replace("/");
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-md">
        <Card className="overflow-hidden">
          {/* 头部 */}
          <div className="auth-heading">
            <LanguageSelect/>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
              <UserPlus size={24} />
            </div>
            <h1 className="text-lg font-bold">{firstRun?t('创建工作室','Create a studio'):t('注册账户','Create an account')}</h1>
            <p className="mt-1 text-xs text-zinc-400">
              {firstRun?t('创建第一个账户，成为工作室超级管理员','The first account becomes the studio owner'):t('加入工作室，协作安排每一次拍摄','Join your studio and coordinate every shoot')}
            </p>
          </div>

          {/* 表单 */}
          <div className="space-y-4 p-6">
            {mode==='unavailable'?<><p role="status">{t('请在桌面应用中创建工作室，或联系此云实例的部署负责人完成首次开通。','Create the studio in the desktop app, or ask the instance administrator to complete initial setup.')}</p><Btn disabled={busy} onClick={async()=>{setBusy(true);setErr('');try{setMode(await refreshRegistrationStatus());}catch{setErr(t('暂时无法检查工作室状态，请重试','Could not check studio status. Please try again.'));}finally{setBusy(false);}}}>{t('重新检查','Check again')}</Btn></>:<>
            <Field label={t('登录账户名','Account name')} required hint={t('用于登录，网名用于工作室内显示','Used to sign in; your display name appears in the studio')}>
              <TextInput
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("例如：liming","e.g. alex.morgan")}
                maxLength={80}
                autoComplete="off"
              />
            </Field>
            <Field label={t('网名','Display name')} required><TextInput value={nickname} maxLength={80} onChange={e=>setNickname(e.target.value)} placeholder={t('工作室内使用的名字','Name shown to your team')} autoComplete="nickname"/></Field>
            <Field label={t('真名（选填）','Legal name (optional)')}><TextInput value={realName} maxLength={80} onChange={e=>setRealName(e.target.value)} autoComplete="name"/></Field>
            {firstRun&&<Field label={t('工作室记账币种','Studio currency')} required hint={t('订单与分成使用此币种。切换界面语言不会换算金额。','Orders and shares use this currency. Changing interface language will not convert recorded amounts.')}><StudioSelect className="studio-field w-full rounded-xl px-3 py-2" value={currency} onChange={e=>setCurrency(e.target.value as StudioCurrency)}>{STUDIO_CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code} · {language==='en'?c.en:c.zh}</option>)}</StudioSelect></Field>}
            {mode==='invite'&&<Field label={t('邀请代码','Invitation code')} required hint={t('由工作室超级管理员提供','Provided by the studio owner')}><TextInput value={invitation} onChange={e=>setInvitation(e.target.value)} autoComplete="off"/></Field>}
            {mode==='setup-token'&&<Field label={t('首次开通授权','Initial setup token')} required hint={t('由此云实例的部署负责人提供','Provided by the instance administrator')}><TextInput type="password" value={setupToken} onChange={e=>setSetupToken(e.target.value)} autoComplete="off"/></Field>}
            <Field label={t('传统密码','Password')} required hint={t('12–256 位，字母和数字','12–256 letters and digits')}>
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('设置登录密码','Choose a password')}
                autoComplete="new-password"
              />
            </Field>
            <Field label={t('确认密码','Confirm password')} required>
              <TextInput
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t('再次输入密码','Enter password again')}
                autoComplete="new-password"
              />
            </Field>
            <Field label={t('文字密码','Text password')} required hint={t('任意文字，6–200 个字：一句诗、一句话、表情都可以。登录时两个密码输入任意一个即可','Any text, 6–200 characters: a line of verse, a sentence, emoji. Either password signs you in')}>
              <TextInput
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder={t('例如：春风又绿江南岸','For example: a line you will remember')}
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRegister();
                }}
              />
            </Field>

            {ok && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-600">{ok}</p>
            )}

            <Btn className="w-full" onClick={handleRegister} disabled={busy}>
              {busy ? t('正在创建…','Creating…') : firstRun?t('创建并进入','Create studio'):t('注册并进入','Create account')}
            </Btn>
            </>}
            {err&&<p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{err}</p>}

            <div className="pt-1 text-center text-xs text-zinc-400">
              {t('已有账户？','Already have an account?')}{" "}
              <Link href="/login" className="text-amber-600 hover:underline">
                {t('直接登录','Sign in')}
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

export default function RegisterPage() {
  return <RegisterInner />;
}
