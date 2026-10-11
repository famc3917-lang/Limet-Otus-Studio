// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
// Test speech generated at run time, so no recording is stored in the repository.
// On Windows a fixed Chinese sentence is synthesised with the built-in System.Speech voices; elsewhere,
// or when no Chinese voice is installed, a 16 kHz tone is written and only the recognition flow can be checked.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const SENTENCE='现在的时间是下午三点，我们准备开始拍摄。';
function wav(file,samples){
 const data=Buffer.alloc(samples.length*2);samples.forEach((v,i)=>data.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(v))),i*2));
 const header=Buffer.alloc(44);header.write('RIFF',0);header.writeUInt32LE(36+data.length,4);header.write('WAVE',8);header.write('fmt ',12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(16000,24);header.writeUInt32LE(32000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
 fs.writeFileSync(file,Buffer.concat([header,data]));
}
/** Returns {file, expected}: expected is a word the transcript must contain, or null when only a tone was available. */
function makeSpeechWav(dir){
 const file=path.join(dir,'synthetic-speech.wav');
 if(process.platform==='win32'){
  const script=`Add-Type -AssemblyName System.Speech;$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;$v=$s.GetInstalledVoices()|Where-Object{$_.Enabled -and $_.VoiceInfo.Culture.Name -like 'zh-*'}|Select-Object -First 1;if(-not $v){exit 3};$s.SelectVoice($v.VoiceInfo.Name);$f=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono);$s.SetOutputToWaveFile($env:STUDIO_SPEECH_OUT,$f);$s.Speak($env:STUDIO_SPEECH_TEXT);$s.Dispose()`;
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,STUDIO_SPEECH_OUT:file,STUDIO_SPEECH_TEXT:SENTENCE},timeout:60000});
  if(result.status===0&&fs.existsSync(file)&&fs.statSync(file).size>32000)return {file,expected:'时间'};
 }
 wav(file,Array.from({length:16000*6},(_,i)=>Math.sin(2*Math.PI*220*i/16000)*3000));
 return {file,expected:null};
}
module.exports={makeSpeechWav,SENTENCE};
