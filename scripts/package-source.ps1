# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 博成 · FMLC
# Additional terms: see ADDITIONAL_TERMS.md
param([string]$OutputDirectory="release-v3.1.1")
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
node (Join-Path $projectRoot 'scripts/assert-open-edition.cjs')
if($LASTEXITCODE){throw 'Only the audited open-source edition may be exported as public source'}
node (Join-Path $projectRoot 'scripts/audit-public-docs.cjs')
if($LASTEXITCODE){throw 'Public documentation is not ready for export'}
$releaseRoot=[IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
if(-not $releaseRoot.StartsWith($projectRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Source output must stay within project'}
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
$exportRoot=Join-Path $releaseRoot ('.source-export-'+[guid]::NewGuid().ToString('N'))
$resolvedExport=[IO.Path]::GetFullPath($exportRoot)
if(-not $resolvedExport.StartsWith($releaseRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid source export directory'}
$archive=Join-Path $releaseRoot ('source-'+[guid]::NewGuid().ToString('N')+'.zip')
$destination=Join-Path $releaseRoot ('LimetOtusStudio-Source-'+(Get-Content (Join-Path $projectRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version+'.zip')
try {
 New-Item -ItemType Directory -Path $exportRoot | Out-Null
 $entries=@('src','packages','third-party','electron','scripts','tests','public','build','installer','edition.json','package.json','package-lock.json','next.config.ts','tsconfig.json','next-env.d.ts','eslint.config.mjs','postcss.config.mjs','tailwind.config.js','electron-builder.yml','Dockerfile','.dockerignore','.env.example','README.md','.gitignore','LICENSE','LICENSE-ASSETS.md','ADDITIONAL_TERMS.md','NOTICE-AS-IS.md','NOTICE-KEYS.md','build.ps1','CONTRIBUTING.md','SECURITY.md','.gitattributes','.editorconfig')
 foreach($entry in $entries){Copy-Item -LiteralPath (Join-Path $projectRoot $entry) -Destination $exportRoot -Recurse -Force}
 if(Test-Path -LiteralPath (Join-Path $projectRoot '.github')){Copy-Item -LiteralPath (Join-Path $projectRoot '.github') -Destination $exportRoot -Recurse -Force}
 $docsTarget=Join-Path $exportRoot 'docs'
 New-Item -ItemType Directory -Path $docsTarget | Out-Null
 foreach($name in @('CN','English','images')){Copy-Item -LiteralPath (Join-Path $projectRoot ('docs/'+$name)) -Destination $docsTarget -Recurse -Force}
 foreach($name in @('project-inventory.json','openapi.json')){if(Test-Path -LiteralPath (Join-Path $projectRoot ('docs/'+$name))){Copy-Item -LiteralPath (Join-Path $projectRoot ('docs/'+$name)) -Destination $docsTarget -Force}}
 $cloudTarget=Join-Path $exportRoot 'cloud'
 New-Item -ItemType Directory -Path $cloudTarget | Out-Null
 foreach($name in @('compose.yml','Caddyfile','.env.example')){Copy-Item -LiteralPath (Join-Path $projectRoot ('cloud/'+$name)) -Destination (Join-Path $cloudTarget $name) -Force}
 # Generated Next declarations are recreated by the recipient's own build.
 [IO.File]::WriteAllText((Join-Path $exportRoot 'next-env.d.ts'),"/// <reference types=""next"" />
/// <reference types=""next/image-types/global"" />
",[Text.UTF8Encoding]::new($false))
 $sourceConfig=[IO.File]::ReadAllText((Join-Path $exportRoot 'tsconfig.json')) | ConvertFrom-Json
 $sourceConfig.include=@($sourceConfig.include | Where-Object {-not $_.StartsWith('.next')})+@('.next/types/**/*.ts','.next/dev/types/**/*.ts')
 $sourceConfig.exclude=@($sourceConfig.exclude)+@('release-v*','test-results')
 [IO.File]::WriteAllText((Join-Path $exportRoot 'tsconfig.json'),($sourceConfig | ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
 $speechTarget=Join-Path $exportRoot 'speech'
 New-Item -ItemType Directory -Path $speechTarget | Out-Null
 foreach($entry in @('worker.cjs','package.json','package-lock.json','MODEL.json')){Copy-Item -LiteralPath (Join-Path $projectRoot ('speech/'+$entry)) -Destination $speechTarget -Recurse -Force}
 Copy-Item -LiteralPath (Join-Path $projectRoot 'speech/FunASR-MODEL-LICENSE.txt') -Destination $speechTarget -Force
 $ttsSource=Join-Path $projectRoot 'tts'
 $ttsTarget=Join-Path $exportRoot 'tts'
 New-Item -ItemType Directory -Path $ttsTarget | Out-Null
 Get-ChildItem -LiteralPath $ttsSource -Force | Where-Object { $_.Name -notin '.runtime','model','bin','vendor' } | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $ttsTarget -Recurse -Force}
 Get-ChildItem -LiteralPath $ttsTarget -Recurse -Force | Where-Object {$_.Name -in '.git','__pycache__'} | ForEach-Object {if($_.FullName.StartsWith($ttsTarget+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $_.FullName -Recurse -Force}}
 node scripts/audit-public-source.cjs $exportRoot
 if($LASTEXITCODE){throw 'Public source contains a forbidden file or sensitive pattern'}
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 Add-Type -AssemblyName System.IO.Compression
 $archiveStream=[IO.File]::Open($archive,[IO.FileMode]::CreateNew)
 $zip=$null
 try {
  $zip=[IO.Compression.ZipArchive]::new($archiveStream,[IO.Compression.ZipArchiveMode]::Create,$false,[Text.Encoding]::UTF8)
  foreach($sourceFile in Get-ChildItem -LiteralPath $exportRoot -File -Recurse -Force){
   $entryName=$sourceFile.FullName.Substring($exportRoot.Length+1).Replace('\','/')
   [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$sourceFile.FullName,$entryName,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
 } finally { if($zip){$zip.Dispose()}; $archiveStream.Dispose() }
 if(Test-Path -LiteralPath $destination){Remove-Item -LiteralPath $destination -Force}
 Move-Item -LiteralPath $archive -Destination $destination
 node scripts/checksums.cjs $releaseRoot
 if($LASTEXITCODE){throw 'Checksums failed'}
 Write-Output ('Source archive: '+$destination)
} finally {
 if((Test-Path -LiteralPath $resolvedExport) -and $resolvedExport.StartsWith($releaseRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $resolvedExport -Recurse -Force}
 if(Test-Path -LiteralPath $archive){Remove-Item -LiteralPath $archive -Force}
}
