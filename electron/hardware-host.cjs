// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';
const {ipcMain}=require('electron');
const {execFile}=require('child_process');
module.exports=function installHardware({authorize}){ipcMain.handle('studio-hardware-volumes',async event=>{await authorize(event,'business:read');if(process.platform!=='win32')return {volumes:[],supported:false};const script="Get-Volume | Where-Object { $_.DriveType -eq 'Removable' -and $_.DriveLetter } | Select-Object DriveLetter,FileSystemLabel,FileSystem,Size,SizeRemaining | ConvertTo-Json -Compress";const output=await new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:15000,maxBuffer:256000},(error,stdout)=>error?reject(new Error('无法读取可移动存储设备')):resolve(stdout)));const raw=JSON.parse(String(output)||'[]');return {supported:true,volumes:(Array.isArray(raw)?raw:[raw]).map(v=>({id:String(v.DriveLetter),label:String(v.FileSystemLabel||'可移动存储'),fileSystem:String(v.FileSystem),size:Number(v.Size),available:Number(v.SizeRemaining)}))};});};
