# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 博成 · FMLC
# Additional terms: see ADDITIONAL_TERMS.md
param([switch]$SkipBuild)
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
Set-Location -LiteralPath $projectRoot
$version=(Get-Content package.json -Raw -Encoding UTF8 | ConvertFrom-Json).version
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$release='release-v'+$version+'-test-'+$stamp
$env:STUDIO_BUILD_DIR='.next-package-'+$version
$env:STUDIO_QA_OUTPUT=Join-Path $projectRoot ('test-results/'+$version+'/'+$stamp)
New-Item -ItemType Directory -Force -Path $env:STUDIO_QA_OUTPUT | Out-Null
$log=Join-Path $env:STUDIO_QA_OUTPUT 'release.log'
Start-Transcript -Path $log
try {
 # npm does not run Electron's downloader automatically; fetch the runtime once if it is missing.
 if(-not (Test-Path -LiteralPath 'node_modules/electron/dist/electron.exe')){ node node_modules/electron/install.js; if($LASTEXITCODE){throw 'Electron runtime download failed'} }
 # Voice models are optional at build time; the speech runtime package is still bundled.
 if(Test-Path -LiteralPath 'speech/node_modules/sherpa-onnx-node/package.json'){powershell -NoProfile -File scripts/install-speech.ps1 -SkipInstall -OptionalModel}else{powershell -NoProfile -File scripts/install-speech.ps1 -OptionalModel}
 if($LASTEXITCODE){throw 'Speech model verification failed'}
 node scripts/fetch-tts-bootstrap.cjs
 if($LASTEXITCODE){throw 'TTS bootstrap fetch failed'}
 node scripts/prepare-tts-assets.cjs
 if($LASTEXITCODE){throw 'Local TTS model verification failed'}
 $testPython=Join-Path $projectRoot 'tts/.runtime/venv/Scripts/python.exe'
 if(Test-Path -LiteralPath $testPython){ & $testPython -I -B tests/tts-assets.py; if($LASTEXITCODE){throw 'Bundled TTS installation test failed'} }
 foreach($task in @('check','test:team','test:retention','test:v3-workflow')) {
  npm run $task
  if($LASTEXITCODE){throw ('Tests failed: '+$task)}
 }
 if(-not $SkipBuild){
  npm run build:api
  if($LASTEXITCODE){throw 'API build failed'}
  npm run build:desktop
  if($LASTEXITCODE){throw 'Frontend build failed'}
 }
 node scripts/prune-speech-trace.cjs
 if($LASTEXITCODE){throw 'Runtime trace pruning failed'}
 # Next's standalone trace drops licence files; ship the collected texts instead.
 node scripts/third-party-notices.cjs
 if($LASTEXITCODE){throw 'Third-party notices failed'}
 $config=Get-Content electron-builder.yml -Raw -Encoding UTF8
 $config=$config.Replace('.next-upgrade',$env:STUDIO_BUILD_DIR).Replace('output: release-v3.0.0','output: '+$release)
 $configFile=Join-Path $env:STUDIO_QA_OUTPUT 'builder.yml'
 [IO.File]::WriteAllText($configFile,$config,[Text.UTF8Encoding]::new($false))
 node node_modules/electron-builder/out/cli/cli.js --config $configFile --win --dir --x64
 if($LASTEXITCODE){throw 'Unpacked assembly failed'}
 $unpacked=Join-Path $projectRoot ($release+'/win-unpacked')
 node tests/package-runtime.cjs $unpacked
 if($LASTEXITCODE){throw 'Actual packaged runtime test failed; no EXE produced'}
 node tests/packaged-ui.cjs $unpacked
 if($LASTEXITCODE){throw 'Packaged UI test failed; no EXE produced'}
 node node_modules/electron-builder/out/cli/cli.js --config $configFile --win portable --x64 --prepackaged $unpacked
 if($LASTEXITCODE){throw 'Portable packaging failed'}
 # Installer: the International Typographic Style setup in installer/, with the unpacked app as its payload.
 powershell -NoProfile -File installer/build-installer.ps1 -Unpacked $unpacked -OutputDirectory $release
 if($LASTEXITCODE){throw 'Installer packaging failed'}
 # Source code is not packaged here: each release links to its Git tag, and the code host attaches the source archive.
 Write-Output ('Development test package: '+(Join-Path $projectRoot $release))
} finally { Stop-Transcript }
