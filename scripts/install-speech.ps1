# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 博成 · FMLC
# Additional terms: see ADDITIONAL_TERMS.md
param([switch]$SkipInstall,[switch]$OptionalModel)
$ErrorActionPreference='Stop'
function Get-StudioFileHash([string]$LiteralPath,[string]$Algorithm='SHA256') {
 if($Algorithm -ne 'SHA256'){throw 'Unsupported integrity algorithm'}
 $stream=[IO.File]::OpenRead([IO.Path]::GetFullPath($LiteralPath))
 $hasher=[Security.Cryptography.SHA256]::Create()
 try { return @{Hash=([BitConverter]::ToString($hasher.ComputeHash($stream))).Replace('-','')} }
 finally { $stream.Dispose(); $hasher.Dispose() }
}
$speechProject=Split-Path $PSScriptRoot -Parent
Set-Location $speechProject
if(-not $SkipInstall){npm ci --prefix speech --omit=dev --registry=https://registry.npmjs.org;if($LASTEXITCODE){throw 'Speech runtime install failed'}}
$speechManifest=Get-Content -LiteralPath 'speech/MODEL.json' -Raw | ConvertFrom-Json
$missingSpeechModel=@($speechManifest.files | Where-Object {-not (Test-Path -LiteralPath "speech/models/$($_.name)")})
if($missingSpeechModel.Count -and $OptionalModel){Write-Output "SenseVoiceSmall model not bundled; users install it from the app.";exit 0}
if($missingSpeechModel.Count){
 if($speechManifest.origin -ne 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2'){throw 'Unexpected model origin'}
 $speechArchive=Join-Path ([IO.Path]::GetTempPath()) ("guanyu-asr-$([guid]::NewGuid()).tar.bz2")
 try{
  Invoke-WebRequest $speechManifest.origin -OutFile $speechArchive
  if((Get-StudioFileHash -LiteralPath $speechArchive -Algorithm SHA256).Hash -ne $speechManifest.archiveSha256){throw 'Model archive integrity mismatch'}
  New-Item -ItemType Directory -Path speech/models -Force | Out-Null
  tar -xf $speechArchive -C speech/models --strip-components=1 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17/model.int8.onnx' 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17/tokens.txt'
  if($LASTEXITCODE){throw 'Model extraction failed'}
 }finally{if(Test-Path -LiteralPath $speechArchive){Remove-Item -LiteralPath $speechArchive}}
}
foreach($speechFile in $speechManifest.files){if((Get-StudioFileHash -LiteralPath "speech/models/$($speechFile.name)" -Algorithm SHA256).Hash -ne $speechFile.Hash){throw "Model integrity mismatch: $($speechFile.name)"}}
Write-Output 'SenseVoiceSmall INT8 model integrity verified.'
