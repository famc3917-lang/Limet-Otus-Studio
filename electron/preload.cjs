// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
'use strict';

// ============ 摄影工作室管理系统 · preload 桥 ============
// 暴露最小安全 API 给渲染进程：付款/退款留痕截图保存与读取
// 截图文件存放：%APPDATA%\PhotoStudio\proofs\<orderId>\

const { contextBridge, ipcRenderer } = require('electron');
// Dispatch a DOM event without exposing ipcRenderer or business data to the orb.
ipcRenderer.on('studio-assistant-show',()=>{window.__studioAssistantRequested=true;window.dispatchEvent(new CustomEvent('studio-assistant-show'));});
ipcRenderer.on('studio-floating-change',(_event,value)=>window.dispatchEvent(new CustomEvent('studio-floating-change',{detail:value})));

ipcRenderer.on('studio-desktop-panel',(_event,value)=>window.dispatchEvent(new CustomEvent('studio-desktop-panel',{detail:value})));
ipcRenderer.on('studio-interface-language-changed',(_event,value)=>window.dispatchEvent(new CustomEvent('studio-interface-language-changed',{detail:value})));
ipcRenderer.on('studio-assistant-settings',()=>window.dispatchEvent(new Event('studio-assistant-settings')));
contextBridge.exposeInMainWorld('pstudio', {
  interfaceLanguage:language=>ipcRenderer.invoke('studio-interface-language',language),
  ttsInstall:()=>ipcRenderer.invoke('studio-tts-install'),
  ttsInstallStatus:()=>ipcRenderer.invoke('studio-tts-install-status'),
  speechInstall:()=>ipcRenderer.invoke('studio-speech-install'),
  speechInstallStatus:()=>ipcRenderer.invoke('studio-speech-install-status'),
  readDraft:()=>ipcRenderer.invoke('studio-draft-read'),
  saveDraft:p=>ipcRenderer.invoke('studio-draft-save',p),
  clearDraft:()=>ipcRenderer.invoke('studio-draft-clear'),
  hardwareVolumes:()=>ipcRenderer.invoke('studio-hardware-volumes'),
  apiSession: () => ipcRenderer.invoke('studio-api-session'),
  assistantPreferences: (payload) => ipcRenderer.invoke('studio-assistant-preferences', payload),
  openAssistant: () => ipcRenderer.invoke('studio-assistant-open'),
  assistantPanelState:()=>ipcRenderer.invoke('studio-assistant-panel-state'),
  closeAssistant:()=>ipcRenderer.invoke('studio-assistant-close'),
  assistantSettings:()=>ipcRenderer.invoke('studio-assistant-settings'),
  moveAssistant: (payload) => ipcRenderer.invoke('studio-assistant-move', payload),
  windowState:()=>ipcRenderer.invoke('studio-window-state'),
  onWindowState:callback=>{const listener=(_event,state)=>{if(typeof state?.maximized==='boolean')callback(state);};ipcRenderer.on('studio-window-state',listener);return()=>ipcRenderer.removeListener('studio-window-state',listener);},
  windowAction: (action) => ipcRenderer.invoke('studio-window-action', action),
  windowTheme: (theme) => ipcRenderer.invoke('studio-window-theme', theme),
  saveProof: (payload) => ipcRenderer.invoke('proof-save', payload),
  readProof: (payload) => ipcRenderer.invoke('proof-read', payload),
  runBackup: (payload) => ipcRenderer.invoke('backup-run', payload),
  backupStatus: () => ipcRenderer.invoke('backup-status'),
  getBackupConfig: () => ipcRenderer.invoke('backup-config-get'),
  setBackupConfig: (payload) => ipcRenderer.invoke('backup-config-set', payload),
  uploadSummary: (payload) => ipcRenderer.invoke('summary-upload', payload),
});
