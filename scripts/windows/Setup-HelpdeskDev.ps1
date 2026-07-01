#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $ProjectRoot

function Test-NodeVersion {
    $versionText = (node -v) -replace "^v", ""
    $version = [version]($versionText.Split("-")[0])
    $minimum = [version]"20.19.0"
    if ($version -lt $minimum) {
        throw "Node.js $versionText is too old. Install Node 20.19+ or 22.12+ (see docs/windows-setup.md)."
    }
    Write-Host "Node.js $versionText OK"
}

function Ensure-Pnpm {
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-Host "Enabling Corepack and pnpm 11.1.2..."
        corepack enable
        corepack prepare pnpm@11.1.2 --activate
    }
    Write-Host "pnpm $(pnpm -v) OK"
}

Write-Host "Project: $ProjectRoot"
Write-Host "Platform: $($PSVersionTable.OS) / Node platform will be win32 when running node on Windows"
Write-Host ""

Test-NodeVersion
Ensure-Pnpm

Write-Host ""
Write-Host "Installing dependencies..."
pnpm install

Write-Host ""
Write-Host "Installing Playwright Chromium..."
pnpm exec playwright install chromium

Write-Host ""
if (-not (Test-Path "config\helpdesk-auth.yaml")) {
    Write-Host "NOTE: config\helpdesk-auth.yaml not found."
    Write-Host "  Copy-Item config\helpdesk-auth.example.yaml config\helpdesk-auth.yaml"
}

if (-not (Test-Path "IT工單(不可用，僅供參考)\delta_sso_state.json")) {
    Write-Host "NOTE: Helpdesk session file missing."
    Write-Host "  pnpm auth:login -- --config config/helpdesk-auth.yaml"
}

Write-Host ""
Write-Host "Setup complete. Start the app with:"
Write-Host "  .\scripts\windows\Start-Dev.ps1"
