# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 博成 · FMLC
# Additional terms: see ADDITIONAL_TERMS.md
# Builds the Windows installer from an unpacked application folder:
#   1. generates SetupConfig.cs from package.json and electron-builder.yml,
#   2. compiles installer/Setup.cs with the .NET Framework 4.8 compiler included in Windows,
#   3. compresses the application into a ZIP and appends it, followed by "LIMETPK1" and its length.
param(
  [Parameter(Mandatory = $true)][string]$Unpacked,
  [Parameter(Mandatory = $true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$package = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'package.json') | ConvertFrom-Json
$builder = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'electron-builder.yml')
function YamlValue($name) { if ($builder -match "(?m)^\s*$name\s*:\s*(.+)$") { return $Matches[1].Trim() } throw "electron-builder.yml has no $name" }
$productName = YamlValue 'productName'
$appId = YamlValue 'appId'
$version = $package.version
$exe = "$productName.exe"
if (-not (Test-Path -LiteralPath (Join-Path $Unpacked $exe))) { throw "Unpacked folder has no $exe" }

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$wpf = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\WPF'
if (-not (Test-Path -LiteralPath $csc)) { throw '.NET Framework 4.8 compiler not found' }
$work = Join-Path ([IO.Path]::GetTempPath()) ('limet-installer-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
try {
  function Literal($value) { '"' + ($value -replace '\\', '\\' -replace '"', '\"') + '"' }
  $config = @"
namespace LimetOtus.Setup {
  static class SetupConfig {
    public const string Version = $(Literal $version);
    public const string ExeName = $(Literal $exe);
    public const string DisplayName = $(Literal "$productName Limet Otus Studio");
    public const string ShortcutName = $(Literal "$productName Limet Otus Studio");
    public const string Publisher = $(Literal ($package.author));
    public const string AppUserModelId = $(Literal $appId);
    public const string RegistryName = "LimetOtusStudio";
    public const string FolderName = "LimetOtusStudio";
  }
}
"@
  [IO.File]::WriteAllText((Join-Path $work 'SetupConfig.cs'), $config, [Text.UTF8Encoding]::new($true))
  $stub = Join-Path $work 'setup-stub.exe'
  $references = @('System.dll', 'System.Core.dll', 'System.Drawing.dll', 'System.Windows.Forms.dll', 'System.Xaml.dll', 'System.IO.Compression.dll', 'System.IO.Compression.FileSystem.dll',
    (Join-Path $wpf 'PresentationFramework.dll'), (Join-Path $wpf 'PresentationCore.dll'), (Join-Path $wpf 'WindowsBase.dll')) | ForEach-Object { "/r:$_" }
  & $csc /nologo /target:winexe /platform:anycpu /optimize+ /codepage:65001 /langversion:5 `
    "/out:$stub" "/win32icon:$(Join-Path $root 'build\icon.ico')" "/win32manifest:$(Join-Path $PSScriptRoot 'app.manifest')" `
    @references (Join-Path $PSScriptRoot 'Setup.cs') (Join-Path $work 'SetupConfig.cs')
  if ($LASTEXITCODE) { throw 'Installer compilation failed' }

  $zip = Join-Path $work 'payload.zip'
  [IO.Compression.ZipFile]::CreateFromDirectory([IO.Path]::GetFullPath($Unpacked), $zip, [IO.Compression.CompressionLevel]::Optimal, $false)
  New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
  $output = Join-Path ([IO.Path]::GetFullPath($OutputDirectory)) "LimetOtusStudio-Setup-$version-x64.exe"
  $target = [IO.File]::Create($output)
  try {
    foreach ($part in @($stub, $zip)) { $source = [IO.File]::OpenRead($part); try { $source.CopyTo($target) } finally { $source.Dispose() } }
    $footer = [Text.Encoding]::ASCII.GetBytes('LIMETPK1') + [BitConverter]::GetBytes([long](Get-Item -LiteralPath $zip).Length)
    $target.Write($footer, 0, $footer.Length)
  } finally { $target.Dispose() }
  Write-Output ("Installer: $output ({0:N0} MB)" -f ((Get-Item -LiteralPath $output).Length / 1MB))
} finally { Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue }
