// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn,execFile}=require('node:child_process');
module.exports=function({app,ipcMain,authorize}){
 const resources=app.isPackaged?path.join(process.resourcesPath,'tts'):path.join(__dirname,'../tts'),home=path.join(app.getPath('userData'),'tts');
 let running=false,state={phase:'idle',progress:0,error:''};
 const status=()=>({...state,available:fs.existsSync(path.join(home,'runtime-ready.json'))&&fs.existsSync(path.join(home,'model-ready.json'))&&fs.existsSync(path.join(home,'venv/Scripts/python.exe'))});
 const run=(exe,args,timeout=900000)=>new Promise((resolve,reject)=>{const child=spawn(exe,args,{windowsHide:true,cwd:home,env:{...process.env,PYTHONPATH:'',PYTHONNOUSERSITE:'1',PYTHONUTF8:'1',UV_CACHE_DIR:path.join(home,'cache'),UV_PYTHON_INSTALL_DIR:path.join(home,'python'),OMP_NUM_THREADS:'4',MKL_NUM_THREADS:'4'},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>{output+=b;if(output.length>2*1024*1024)output=output.slice(-100000);});child.stderr.resume();const timer=setTimeout(()=>child.kill(),timeout);child.once('error',()=>{clearTimeout(timer);reject(Error('语音组件安装未完成，请重试'));});child.once('exit',code=>{clearTimeout(timer);if(code===0)resolve(output);else reject(Error('语音组件安装未完成，请检查网络与剩余空间后重试'));});});
 const gpuAvailable=()=>new Promise(resolve=>execFile('nvidia-smi',['--query-gpu=driver_version,memory.total','--format=csv,noheader,nounits'],{windowsHide:true,timeout:5000},(error,out)=>resolve(!error&&out.split('\n').some(line=>{const [driver,memory]=line.split(',');return parseFloat(driver)>=531&&Number(memory)>=4096;}))));
 async function install(){running=true;state={phase:'runtime',progress:5,error:''};fs.mkdirSync(home,{recursive:true});try{
  const uv=path.join(resources,'bin/uv.exe'),manifest=JSON.parse(fs.readFileSync(path.join(resources,'RUNTIME.json'),'utf8'));
  if(crypto.createHash('sha256').update(fs.readFileSync(uv)).digest('hex')!==manifest.uvSha256)throw Error('语音安装组件校验失败');
  await run(uv,['python','install','3.11.15']);await run(uv,['venv','--allow-existing','--python','3.11.15',path.join(home,'venv')]);const python=path.join(home,'venv/Scripts/python.exe');
  state={phase:'dependencies',progress:20,error:''};const cuda=await gpuAvailable();
  await run(uv,['pip','install','--python',python,'torch==2.3.1'+(cuda?'+cu121':'+cpu'),'torchaudio==2.3.1'+(cuda?'+cu121':'+cpu'),'--index-url',cuda?'https://download.pytorch.org/whl/cu121':'https://download.pytorch.org/whl/cpu']);
  await run(uv,['pip','install','--python',python,'setuptools==70.3.0','wheel==0.45.1','--index-url','https://pypi.org/simple']);await run(uv,['pip','install','--python',python,'--no-build-isolation','-r',path.join(resources,'requirements-lock.txt'), '--index-url','https://pypi.org/simple']);
  state={phase:'model',progress:55,error:''};await run(python,['-I',path.join(resources,'download.py'),home,path.join(resources,'MODEL.json')]);
  state={phase:'verification',progress:90,error:''};const output=await run(python,['-I',path.join(resources,'worker.py'),home,path.join(resources,'vendor/CosyVoice')],150000);if(!output.split('\n').some(line=>{try{return JSON.parse(line).ready===true;}catch{return false;}}))throw Error('语音组件验证失败');
  fs.writeFileSync(path.join(home,'runtime-ready.json'),JSON.stringify({version:'2.3.0',verified:true,python:'3.11.15'}));state={phase:'ready',progress:100,error:''};
 }catch(error){state={phase:'error',progress:state.progress,error:error.message};}finally{running=false;}}
 ipcMain.handle('studio-tts-install-status',async event=>{await authorize(event,'ai:use');return status();});
 ipcMain.handle('studio-tts-install',async event=>{await authorize(event,'ai:configure');if(!running)void install();return status();});
 return {home,resources};
};
