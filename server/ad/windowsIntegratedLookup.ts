import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { normalizeAdEntry, type NormalizedAdEntry } from "./normalizeAdEntry";

const execFileAsync = promisify(execFile);

export type IntegratedLookupArgs = {
  account: string;
  dcHost: string;
  baseDn: string;
};

/**
 * PowerShell must emit UTF-8 JSON. Windows consoles default to cp950/cp936, which
 * mojibakes Chinese `cn` / manager values when Node reads stdout as UTF-8.
 * See IT工單(不可用，僅供參考)/README.md and fetch_ad_info.py (sys.stdout UTF-8).
 */
const POWERSHELL_SCRIPT = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
Add-Type -AssemblyName System.DirectoryServices

$searchRoot = New-Object System.DirectoryServices.DirectoryEntry("LDAP://$env:AD_LOOKUP_DC/$env:AD_LOOKUP_BASE_DN")
$searcher = New-Object System.DirectoryServices.DirectorySearcher($searchRoot)
$searcher.SearchScope = [System.DirectoryServices.SearchScope]::Subtree
$searcher.Filter = "(sAMAccountName=$env:AD_LOOKUP_ACCOUNT)"

@(
  'sAMAccountName',
  'cn',
  'mail',
  'department',
  'manager',
  'extensionAttribute15',
  'extensionAttribute1',
  'extensionAttribute2'
) | ForEach-Object { [void]$searcher.PropertiesToLoad.Add($_) }

$result = $searcher.FindOne()
if ($null -eq $result) {
  Write-Output '{}'
  exit 0
}

$props = $result.Properties
$managerDn = if ($props['manager'].Count -gt 0) { [string]$props['manager'][0] } else { '' }
$managerSamAccountName = ''
if ($managerDn -like 'CN=*') {
  $mgrSearcher = New-Object System.DirectoryServices.DirectorySearcher($searchRoot)
  $mgrSearcher.SearchScope = [System.DirectoryServices.SearchScope]::Subtree
  $mgrSearcher.Filter = "(distinguishedName=$managerDn)"
  [void]$mgrSearcher.PropertiesToLoad.Add('sAMAccountName')
  $mgrResult = $mgrSearcher.FindOne()
  if ($null -ne $mgrResult -and $mgrResult.Properties['samaccountname'].Count -gt 0) {
    $managerSamAccountName = [string]$mgrResult.Properties['samaccountname'][0]
  }
}

$data = [ordered]@{
  sAMAccountName = if ($props['samaccountname'].Count -gt 0) { [string]$props['samaccountname'][0] } else { '' }
  cn = if ($props['cn'].Count -gt 0) { [string]$props['cn'][0] } else { '' }
  mail = if ($props['mail'].Count -gt 0) { [string]$props['mail'][0] } else { '' }
  department = if ($props['department'].Count -gt 0) { [string]$props['department'][0] } else { '' }
  manager = $managerDn
  managerSamAccountName = $managerSamAccountName
  extensionAttribute15 = if ($props['extensionattribute15'].Count -gt 0) { [string]$props['extensionattribute15'][0] } else { '' }
  extensionAttribute1 = if ($props['extensionattribute1'].Count -gt 0) { [string]$props['extensionattribute1'][0] } else { '' }
  extensionAttribute2 = if ($props['extensionattribute2'].Count -gt 0) { [string]$props['extensionattribute2'][0] } else { '' }
}

$data | ConvertTo-Json -Compress
`;

export async function runWindowsIntegratedLookup({
  account,
  dcHost,
  baseDn,
}: IntegratedLookupArgs): Promise<NormalizedAdEntry | null> {
  if (process.platform !== "win32") {
    throw new Error("Integrated lookup is only supported on win32.");
  }

  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-OutputEncoding", "UTF8", "-Command", POWERSHELL_SCRIPT],
    {
      env: {
        ...process.env,
        AD_LOOKUP_ACCOUNT: account,
        AD_LOOKUP_DC: dcHost,
        AD_LOOKUP_BASE_DN: baseDn,
      },
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    },
  );

  const normalizedOutput = stdout.trim();
  if (!normalizedOutput || normalizedOutput === "{}") {
    return null;
  }

  const parsed = JSON.parse(normalizedOutput) as Record<string, unknown>;
  return normalizeAdEntry(parsed);
}
