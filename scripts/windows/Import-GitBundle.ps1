#Requires -Version 5.1
<#
.SYNOPSIS
  Clone a local-only git repository from a bundle file (no remote server required).

.EXAMPLE
  .\scripts\windows\Import-GitBundle.ps1
  .\scripts\windows\Import-GitBundle.ps1 -BundlePath C:\Users\ALVIS.MC.TSAO\handovered_from_Justin.bundle
#>
param(
    [string]$BundlePath = "C:\Users\ALVIS.MC.TSAO\handovered_from_Justin.bundle",
    [string]$TargetRoot = "C:\Users\ALVIS.MC.TSAO\handovered_from_Justin"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BundlePath)) {
    throw @"
Bundle not found: $BundlePath

Create it from WSL first (fast, excludes node_modules by design):
  cd ~/handovered_from_Justin
  bash scripts/windows/export-git-bundle.sh
"@
}

if (Test-Path $TargetRoot) {
    throw "Target already exists: $TargetRoot`nRemove or rename it before importing."
}

Write-Host "Cloning bundle into $TargetRoot ..."
git clone $BundlePath $TargetRoot

Write-Host ""
Write-Host "Import complete. Next:"
Write-Host "  cd $TargetRoot"
Write-Host "  .\scripts\windows\Setup-HelpdeskDev.ps1"
Write-Host "  .\scripts\windows\Sync-LocalSecretsFromWsl.ps1"
Write-Host "  .\scripts\windows\Start-Dev.ps1"
