# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 博成 · FMLC
# Additional terms: see ADDITIONAL_TERMS.md
# Builds and verifies the Windows installer and portable package; see docs/English/Developer-manual.md.
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
powershell -NoProfile -File scripts/package-release.ps1
if($LASTEXITCODE){throw 'Build or tests failed; see test-results'}
