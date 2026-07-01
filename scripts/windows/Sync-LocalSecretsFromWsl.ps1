#Requires -Version 5.1
<#
.SYNOPSIS
  Copy gitignored local-only files (auth, session, AD env) from WSL to the Windows project.

.EXAMPLE
  .\scripts\windows\Sync-LocalSecretsFromWsl.ps1
#>
param(
    [string]$TargetRoot = "C:\Users\ALVIS.MC.TSAO\handovered_from_Justin",
    [string]$WslDistro = "Debian",
    [string]$WslUser = "whitebleach",
    [string]$WslProjectName = "handovered_from_Justin"
)

$ErrorActionPreference = "Stop"

$WslSource = "\\wsl$\$WslDistro\home\$WslUser\$WslProjectName"

if (-not (Test-Path $TargetRoot)) {
    throw "Windows project not found: $TargetRoot"
}
if (-not (Test-Path $WslSource)) {
    throw "WSL project not found: $WslSource"
}

$files = @(
    "config\helpdesk-auth.yaml",
    "config\ad-env.ps1",
    "IT工單(不可用，僅供參考)\delta_sso_state.json",
    "IT工單(不可用，僅供參考)\sp_state.json"
)

Write-Host "Syncing local secrets from WSL to $TargetRoot"
Write-Host ""

foreach ($relative in $files) {
    $source = Join-Path $WslSource $relative
    $dest = Join-Path $TargetRoot $relative
    if (-not (Test-Path $source)) {
        Write-Host "  skip (missing): $relative"
        continue
    }
    $destDir = Split-Path $dest -Parent
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    Copy-Item -Path $source -Destination $dest -Force
    Write-Host "  copied: $relative"
}

Write-Host ""
Write-Host "Done."
