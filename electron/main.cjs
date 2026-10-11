// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';

// ============ 摄影工作室管理系统 · Electron 主进程 ============
// 以 Node 模式启动 Next standalone 服务器，再打开应用窗口（数据仍存本机）

const { app, BrowserWindow, shell, dialog, ipcMain,session } = require('electron');
const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
/** Interface language saved by the app, for dialogs shown before any window loads; falls back to the system language. */
function startupLanguage(){
  try{const saved=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'assistant-preferences.json'),'utf8'));if(saved.language==='en'||saved.language==='zh')return saved.language;}catch{}
  return /^zh/i.test(app.getLocale?.()??'')?'zh':'en';
}
const http = require('http');
// Keep the established data directory despite the product rename.
const oldDataCandidates=['摄影工作室管理系统','PhotoStudio','studio'].map(name=>path.join(app.getPath('appData'),name));
const oldData=oldDataCandidates.find(dir=>fs.existsSync(path.join(dir,'Local Storage'))||fs.existsSync(path.join(dir,'studio-v2.sqlite'))||fs.existsSync(path.join(dir,'business-state.json')));
app.setPath('userData',oldData||path.join(app.getPath('appData'),'Limet Otus Studio'));
const sessionToken = require('crypto').randomBytes(32).toString('hex');
let assistantHost = null;
let vaultKey;
const authorizeNative=(event,scope)=>require('./security.cjs').authorizeFactory(appOrigin)(event,scope);
function secureHandle(name,scope,handler){ipcMain.handle(name,async(event,...args)=>{await authorizeNative(event,scope);return handler(event,...args);});}

const HOST = '127.0.0.1';
const PORT = 38321; // 内部固定端口，仅本机访问
const START_TIMEOUT = 30000;
const appOrigin=`http://${HOST}:${PORT}`;

let mainWindow = null;
let serverProc = null;

function isDev() {
  return !app.isPackaged;
}

/** 以 ELECTRON_RUN_AS_NODE 模式启动 Next standalone 服务器 */
function startNextServer() {
  const serverDir = isDev()
    ? path.join(__dirname, '..', process.env.STUDIO_BUILD_DIR||'.next-upgrade', 'standalone')
    : path.join(process.resourcesPath, 'server');
  const serverJs = path.join(serverDir, 'server.js');
  const proc = spawn(process.execPath, [serverJs], {
    cwd: serverDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(PORT),
      HOSTNAME: HOST,
      NODE_ENV: 'production',
      STUDIO_DATA_DIR: app.getPath('userData'),
      STUDIO_SESSION_TOKEN: sessionToken,
      STUDIO_MASTER_KEY: vaultKey,
      STUDIO_DESKTOP: '1',
      STUDIO_SPEECH_RUNTIME:isDev()?path.join(__dirname,'..','speech'):path.join(process.resourcesPath,'speech'),
      STUDIO_SPEECH_MODELS:path.join(app.getPath('userData'),'speech','models'),
      STUDIO_TTS_HOME:path.join(app.getPath('userData'),'tts'),
      STUDIO_TTS_RESOURCES:isDev()?path.join(__dirname,'..','tts'):path.join(process.resourcesPath,'tts'),
      STUDIO_ORIGINS:appOrigin,
    },
    stdio: 'ignore',
    windowsHide: true,
  });
  proc.on('exit', () => {
    serverProc = null;
  });
  return proc;
}

/** 轮询等待本地服务就绪 */
function waitForServer(timeout = START_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    const attempt = () => {
      const req = http.get({ host: HOST, port: PORT, path: '/' }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', (err) => {
        req.destroy();
        if (Date.now() > deadline) reject(err);
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 820,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    backgroundColor: windowHost.background(), // Last theme the renderer reported, so the first paint does not flash.
    icon: isDev() ? undefined : path.join(process.resourcesPath, 'icon.png'),
    webPreferences: {
      autoplayPolicy: 'no-user-gesture-required',
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true,
    },
  });

  assistantHost?.attachMain(mainWindow);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(`http://${HOST}:${PORT}/`);

  // 外部链接交给系统默认浏览器，不在应用内开新窗口
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  windowHost.attach(mainWindow);
  mainWindow.webContents.on('will-navigate',(event,target)=>{if(new URL(target).origin!==appOrigin)event.preventDefault();});
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============ 留痕截图 IPC（付款/退款截图，存 %APPDATA%\PhotoStudio\proofs） ============
function proofRootDir() {
  return path.join(app.getPath('userData'), 'proofs');
}
function safeFileName(s) {
  return String(s).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'proof';
}

secureHandle('proof-save','finance:write', async (event, payload) => {
  try {
    const { orderId, kind, fileName, dataUrl } = payload || {};
    if (!orderId || !kind || !dataUrl) return { ok: false, error: '参数缺失' };
    await require('./order-privacy.cjs')(event,appOrigin,orderId);
    const dir = path.join(proofRootDir(), safeFileName(orderId));
    fs.mkdirSync(dir, { recursive: true });
    const finalName = `${safeFileName(kind)}-${Date.now()}-${safeFileName(fileName || 'proof.jpg')}`;
    const base64 = String(dataUrl).replace(/^data:image\/\w+;base64,/, '');
    if(!/^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(String(dataUrl))||base64.length>24*1024*1024)return {ok:false,error:'留痕图片格式或大小无效'};
    const iv=require('crypto').randomBytes(12),cipher=require('crypto').createCipheriv('aes-256-gcm',Buffer.from(vaultKey,'base64'),iv);cipher.setAAD(Buffer.from(String(orderId)));
    const encrypted=Buffer.concat([cipher.update(Buffer.from(base64,'base64')),cipher.final()]);fs.writeFileSync(path.join(dir,finalName),Buffer.concat([Buffer.from('GYP1'),iv,cipher.getAuthTag(),encrypted]));
    return { ok: true, fileName: finalName };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

secureHandle('proof-read','contacts:read', async (event, payload) => {
  try {
    const { orderId, fileName } = payload || {};
    if (!orderId || !fileName) return { ok: false, error: '参数缺失' };
    await require('./order-privacy.cjs')(event,appOrigin,orderId);
    const filePath = path.join(proofRootDir(), safeFileName(orderId), safeFileName(fileName));
    if (!fs.existsSync(filePath)) return { ok: false, error: '文件不存在' };
    let buf=fs.readFileSync(filePath);if(buf.subarray(0,4).toString()==='GYP1'){const decipher=require('crypto').createDecipheriv('aes-256-gcm',Buffer.from(vaultKey,'base64'),buf.subarray(4,16));decipher.setAAD(Buffer.from(String(orderId)));decipher.setAuthTag(buf.subarray(16,32));buf=Buffer.concat([decipher.update(buf.subarray(32)),decipher.final()]);}
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

// Same ID as the installer's shortcuts (electron-builder.yml appId), so taskbar grouping and notifications match.
if (process.platform === 'win32') app.setAppUserModelId('com.bocheng.photostudio');
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    require('./media-host.cjs')({session:session.defaultSession,getMain:()=>mainWindow,origin:appOrigin});
    try{vaultKey=require('./security.cjs').masterKey(app);}catch(e){const en=startupLanguage()==='en';dialog.showErrorBox(en?'Unable to open the encrypted studio':'无法打开加密工作室',en?'System secure storage is unavailable, so encrypted business storage cannot start. Sign in to Windows with your usual account and open the app again.':e.message);app.exit(1);return;}
    require('./hardware-host.cjs')({authorize:authorizeNative});
    require('./tts-host.cjs')({app,ipcMain,authorize:authorizeNative});
    require('./speech-host.cjs')({app,ipcMain,authorize:authorizeNative});
    require('./drafts-host.cjs')({app,url:appOrigin,key:vaultKey,authorize:authorizeNative});
    assistantHost = require('./assistant-host.cjs')({app,getMain:()=>mainWindow,url:`http://${HOST}:${PORT}`,sessionToken,authorize:authorizeNative,preload:path.join(__dirname,'preload.cjs')});
    serverProc = startNextServer();
    try {
      await waitForServer();
    } catch {
      const en=startupLanguage()==='en';
      dialog.showErrorBox(en?'Start-up failed':'启动失败', en?'The local service timed out while starting. Reopen the app.':'本地服务启动超时，请重新打开程序。');
      app.quit();
      return;
    }
    createWindow();

    // 开源说明保留在应用内的关于页面，不再阻断每次启动。

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (!assistantHost?.isBackground()) app.quit();
  });

  app.on('will-quit', () => {
    if (serverProc) {
      try {
        serverProc.kill();
      } catch {
        // 忽略
      }
    }
  });
}

// ============ Git 备份（订单数据 + 留痕截图 → Gitea，走 SSH） ============

function gitBinCandidates() {
  const list = ['git'];
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  list.push(path.join(pf, 'Git', 'cmd', 'git.exe'));
  list.push(path.join(pf86, 'Git', 'cmd', 'git.exe'));
  return list;
}
let cachedGitBin = null;
function findGitBin() {
  if (cachedGitBin) return cachedGitBin;
  for (const cand of gitBinCandidates()) {
    try {
      fs.accessSync(cand);
      cachedGitBin = cand;
      return cand;
    } catch {
      // 继续尝试下一个候选
    }
  }
  cachedGitBin = 'git';
  return cachedGitBin;
}

function gitBackupDir() {
  return path.join(app.getPath('userData'), 'git-backup');
}

/** 应用级配置（照片目录等），存 %APPDATA%\PhotoStudio\config.json */
function appConfigFile() {
  return path.join(app.getPath('userData'), 'config.json');
}
function readAppConfig() {
  try {
    return JSON.parse(fs.readFileSync(appConfigFile(), 'utf-8')) || {};
  } catch {
    return {};
  }
}
function writeAppConfig(patch) {
  const next = { ...readAppConfig(), ...patch };
  fs.writeFileSync(appConfigFile(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function runGit(args, opts = {}) {
  return new Promise((resolve) => {
    execFile(
      findGitBin(),
      args,
      {
        cwd: opts.cwd || gitBackupDir(),
        timeout: 120000,
        windowsHide: true,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        ...opts,
      },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          code: err ? err.code : 0,
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
          err: err ? String(err.message || err) : '',
        });
      },
    );
  });
}

/** Git writes are serialized; existing image files and history remain untouched. */
let gitBackupQueue=Promise.resolve();
function withGitBackup(task){const result=gitBackupQueue.then(task);gitBackupQueue=result.catch(()=>{});return result;}
function gitError(result){return String(result.stderr||result.err||result.stdout||'Git operation failed').trim();}
async function checkedGit(args,dir){const result=await runGit(args,{cwd:dir});if(!result.ok)throw new Error(gitError(result));return result;}
async function ensureGitRepo(){
 const dir=gitBackupDir(),remote=readAppConfig().backupRemote;
 if(!remote)throw new Error('Configure a Git backup repository first.');
 fs.mkdirSync(dir,{recursive:true});
 if(!fs.existsSync(path.join(dir,'.git'))){
  await checkedGit(['init','-b','main'],dir);
  await checkedGit(['config','user.name','PhotoStudio Backup'],dir);
  await checkedGit(['config','user.email','backup@photostudio.local'],dir);
 }
 const origin=await runGit(['remote','get-url','origin'],{cwd:dir});
 await checkedGit(origin.ok?['remote','set-url','origin',remote]:['remote','add','origin',remote],dir);
 return {ok:true,initialized:true,dir};
}
async function commitBackupPaths(dir,paths,message){
 const present=paths.filter(name=>fs.existsSync(path.join(dir,name)));
 if(!present.length)throw new Error('No backup content is available.');
 await checkedGit(['add','-A','--',...present],dir);
 const diff=await runGit(['diff','--cached','--quiet','--',...present],{cwd:dir});
 if(diff.ok)return {ok:true,hasCommit:false};
 if(Number(diff.code)!==1)throw new Error(gitError(diff));
 const commit=await checkedGit(['commit','--only','-m',message,'--',...present],dir);
 return {ok:true,hasCommit:true,stdout:commit.stdout};
}

secureHandle('backup-status','settings:write', async () => {
  try {
    const dir = gitBackupDir();
    if (!fs.existsSync(path.join(dir, '.git'))) {
      return { ok: true, initialized: false, lastBackup: '', pending: false };
    }
    const log = await runGit(['log', '-1', '--format=%cd', '--date=format:%Y-%m-%d %H:%M:%S'], { cwd: dir });
    const status = await runGit(['status', '--porcelain'], { cwd: dir });
    return {
      ok: true,
      initialized: true,
      lastBackup: log.ok ? String(log.stdout).trim() : '',
      pending: String(status.stdout).trim().length > 0,
    };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

secureHandle('backup-config-get','settings:write',async()=>({ok:true,backupRemote:readAppConfig().backupRemote||''}));
secureHandle('backup-config-set','settings:write',async(event,payload)=>{
 try{
  const {backupRemote}=payload||{};
  if(typeof backupRemote!=='string'||backupRemote.length>1000||!['ssh://','https://','git@'].some(prefix=>backupRemote.startsWith(prefix)))return {ok:false,error:'备份地址须使用 SSH 或 HTTPS'};
  if(!backupRemote.startsWith('git@')){
   const url=new URL(backupRemote);
   if(url.protocol==='https:'&&(url.username||url.password))return {ok:false,error:'请通过系统凭据管理器保存 Git 密钥'};
  }
  writeAppConfig({backupRemote});return {ok:true};
 }catch(error){return {ok:false,error:String(error.message||error)};}
});

secureHandle('backup-run','settings:write', async (event, payload) => withGitBackup(async () => {
  try {
    const { dataJson } = payload || {};
    if (typeof dataJson !== 'string' || !dataJson) {
      return { ok: false, error: '数据为空，无法备份' };
    }
    const init = await ensureGitRepo();
    const dir = init.dir || gitBackupDir();

    // 1) 订单数据（导出 JSON）
    fs.writeFileSync(path.join(dir,'data.encrypted.json'),require('./security.cjs').encryptJSON(vaultKey,JSON.parse(dataJson),'backup'), 'utf-8');

    // 2) 留痕截图（镜像同步 proofs）
    const srcProofs = proofRootDir();
    const dstProofs = path.join(dir, 'proofs');
    if (fs.existsSync(dstProofs)) {
      fs.rmSync(dstProofs, { recursive: true, force: true });
    }
    if (fs.existsSync(srcProofs)) {
      fs.cpSync(srcProofs, dstProofs, { recursive: true });
    }

    // 4) add + commit（无变更时 commit 会提示 nothing to commit，属正常）
    const commit=await commitBackupPaths(dir,['data.encrypted.json','proofs'],`Studio backup ${new Date().toISOString()}`);
    const hasCommit=commit.hasCommit;

    // 5) push（即使无新 commit 也 push，保证远端与本地一致）
    const push = await runGit(['push', '-u', 'origin', 'main'], { cwd: dir });
    return {
      ok: push.ok,
      hasCommit,
      message: push.ok ? '备份完成' : (push.stderr || push.err || '推送失败'),
      detail: {
        commit: String(commit.stdout || commit.stderr || '').trim(),
        push: String(push.stdout || push.stderr || '').trim(),
      },
    };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}));

secureHandle('summary-upload','finance:write', async (event, payload) => withGitBackup(async () => {
  // 订单结束结算单上传 Git（文本 HTML 形式，不走 LFS，避免仓库膨胀）
  try {
    const { orderNo, html } = payload || {};
    if (typeof orderNo !== 'string' || !orderNo) return { ok: false, error: '缺少订单号' };
    if (typeof html !== 'string' || !html) return { ok: false, error: '结算单内容为空' };
    const init = await ensureGitRepo();
    const dir = init.dir || gitBackupDir();
    const sumDir = path.join(dir, 'summaries');
    fs.mkdirSync(sumDir, { recursive: true });
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const fileName = `${safeFileName(orderNo)}-${ymd}.html`;
    fs.writeFileSync(path.join(sumDir, fileName), html, 'utf-8');
    const commit=await commitBackupPaths(dir,[path.join('summaries',fileName)],`Order summary ${orderNo} ${new Date().toISOString()}`);
    const hasCommit=commit.hasCommit;
    const push = await runGit(['push', '-u', 'origin', 'main'], { cwd: dir });
    return {
      ok: push.ok,
      hasCommit,
      fileName,
      message: push.ok ? '结算单已上传' : (push.stderr || push.err || '推送失败'),
    };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}));

const windowHost=require('./window-host.cjs')({ipcMain,getMain:()=>mainWindow,getOrigin:()=>appOrigin,themeFile:path.join(app.getPath('userData'),'window-theme.json')});

