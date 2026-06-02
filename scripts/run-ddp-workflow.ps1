param(
  [int]$Count = 25,
  [string]$Output = "",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $RepoRoot

$logDir = Join-Path $RepoRoot "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $logDir "ddp-workflow-$stamp.log"

if (-not $Output) {
  $Output = Join-Path $RepoRoot "ddp_ticket_maintain.xlsx"
}

Write-Host "[*] DDP workflow start -> $Output (log: $logFile)"

pnpm workflow:ddp -- --count=$Count --output="$Output" *>&1 | Tee-Object -FilePath $logFile

exit $LASTEXITCODE
