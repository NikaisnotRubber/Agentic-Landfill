#Requires -Version 5.1
<#
.SYNOPSIS
  Mirror the project from WSL to Windows, skipping heavy gitignored directories.

  For local-only git (no remote), prefer git bundle instead:
    WSL:  bash scripts/windows/export-git-bundle.sh
    Win:  .\scripts\windows\Import-GitBundle.ps1

.EXAMPLE
  .\scripts\windows\Copy-ProjectFromWsl.ps1
  .\scripts\windows\Copy-ProjectFromWsl.ps1 -WslDistro Debian -WslUser whitebleach
#>
param(
    [string]$TargetRoot = "C:\Users\ALVIS.MC.TSAO\handovered_from_Justin",
    [string]$WslDistro = "Debian",
    [string]$WslUser = "whitebleach",
    [string]$WslProjectName = "handovered_from_Justin",
    [switch]$IncludeGit
)

$ErrorActionPreference = "Stop"

$WslSource = "\\wsl$\$WslDistro\home\$WslUser\$WslProjectName"

if (-not (Test-Path $WslSource)) {
    throw @"
WSL source not found: $WslSource

Check distro name: wsl -l -v
Then rerun with -WslDistro <name>
"@
}

# Directory names to skip anywhere in the tree (aligned with .gitignore).
$excludeDirNames = @(
    "node_modules",
    "dist",
    ".vite",
    "coverage",
    "__pycache__",
    ".agents",
    ".claude",
    ".codex",
    ".playwright",
    ".playwright-cli",
    ".vscode",
    ".worktrees",
    "build"
)

if (-not $IncludeGit) {
    $excludeDirNames += ".git"
}

Write-Host "Source:      $WslSource"
Write-Host "Destination: $TargetRoot"
Write-Host "Excludes:    $($excludeDirNames -join ', ')"
Write-Host ""
Write-Host "Tip: local-only repo without remote -> use export-git-bundle.sh + Import-GitBundle.ps1"
Write-Host ""

New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null

$robocopyArgs = @(
    $WslSource,
    $TargetRoot,
    "/E",
    "/XD"
) + $excludeDirNames + @(
    "/XF", "*.log", "*.pyc", ".env", "google-chrome-stable_current_amd64.deb",
    "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np"
)

Write-Host "Running robocopy..."
& robocopy @robocopyArgs | Out-Host
$code = $LASTEXITCODE
if ($code -ge 8) {
    throw "robocopy failed with exit code $code"
}

Write-Host ""
Write-Host "Copy finished."
if (-not $IncludeGit) {
    Write-Host "  .git was skipped. Use -IncludeGit or prefer git bundle import."
}
Write-Host "  cd $TargetRoot"
Write-Host "  .\scripts\windows\Setup-HelpdeskDev.ps1"
Write-Host "  .\scripts\windows\Sync-LocalSecretsFromWsl.ps1"
