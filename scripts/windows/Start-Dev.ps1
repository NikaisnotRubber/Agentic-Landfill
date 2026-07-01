#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $ProjectRoot

$AdEnvFile = Join-Path $ProjectRoot "config\ad-env.ps1"
if (Test-Path $AdEnvFile) {
    Write-Host "Loading AD environment from config\ad-env.ps1"
    . $AdEnvFile
} else {
    Write-Host "No config\ad-env.ps1 — using Windows integrated AD auth when on a domain PC."
    Write-Host "To add simple-bind fallback: Copy-Item config\ad-env.example.ps1 config\ad-env.ps1"
}

if ($env:AD_USER -and $env:AD_PASSWORD) {
    Write-Host "AD_USER is set (LDAP simple bind)."
} else {
    Write-Warning @"
AD_USER / AD_PASSWORD are not set.

- Domain-joined PC: integrated AD may work without ad-env.ps1.
- Non-domain PC (workgroup): integrated AD will FAIL — you MUST configure:
    Copy-Item config\ad-env.example.ps1 config\ad-env.ps1
  Then edit config\ad-env.ps1 with DELTA\account and password, and restart this script.
"@
}

Write-Host ""
Write-Host "Starting Vite dev server at $ProjectRoot"
Write-Host "Press Ctrl+C to stop."
Write-Host ""

pnpm dev
