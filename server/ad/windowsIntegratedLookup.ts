import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { normalizeAdEntry, type NormalizedAdEntry } from "./normalizeAdEntry";

const execFileAsync = promisify(execFile);

export type IntegratedLookupArgs = {
  account: string;
  dcHost: string;
  baseDn: string;
};

const POWERSHELL_SCRIPT = `
$ErrorActionPreference = 'Stop'
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

function Convert-LdapString([object]$value) {
  if ($null -eq $value) { return '' }
  return [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes([string]$value))
}

$data = [ordered]@{
  __encoding = 'utf16le-base64'
  sAMAccountName = if ($props['samaccountname'].Count -gt 0) { Convert-LdapString $props['samaccountname'][0] } else { '' }
  cn = if ($props['cn'].Count -gt 0) { Convert-LdapString $props['cn'][0] } else { '' }
  mail = if ($props['mail'].Count -gt 0) { Convert-LdapString $props['mail'][0] } else { '' }
  department = if ($props['department'].Count -gt 0) { Convert-LdapString $props['department'][0] } else { '' }
  manager = if ($props['manager'].Count -gt 0) { Convert-LdapString $props['manager'][0] } else { '' }
  extensionAttribute15 = if ($props['extensionattribute15'].Count -gt 0) { Convert-LdapString $props['extensionattribute15'][0] } else { '' }
  extensionAttribute1 = if ($props['extensionattribute1'].Count -gt 0) { Convert-LdapString $props['extensionattribute1'][0] } else { '' }
  extensionAttribute2 = if ($props['extensionattribute2'].Count -gt 0) { Convert-LdapString $props['extensionattribute2'][0] } else { '' }
}

$data | ConvertTo-Json -Compress
`;

function decodeIntegratedLookupPayload(parsed: Record<string, unknown>): Record<string, unknown> {
  if (parsed.__encoding !== "utf16le-base64") {
    return parsed;
  }

  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([key]) => key !== "__encoding")
      .map(([key, value]) => [
        key,
        typeof value === "string" && value
          ? Buffer.from(value, "base64").toString("utf16le")
          : "",
      ]),
  );
}

export function parseWindowsIntegratedLookupOutput(stdout: string): NormalizedAdEntry | null {
  const normalizedOutput = stdout.trim();
  if (!normalizedOutput || normalizedOutput === "{}") {
    return null;
  }

  const parsed = JSON.parse(normalizedOutput) as Record<string, unknown>;
  return normalizeAdEntry(decodeIntegratedLookupPayload(parsed));
}

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
    ["-NoProfile", "-NonInteractive", "-Command", POWERSHELL_SCRIPT],
    {
      env: {
        ...process.env,
        AD_LOOKUP_ACCOUNT: account,
        AD_LOOKUP_DC: dcHost,
        AD_LOOKUP_BASE_DN: baseDn,
      },
      maxBuffer: 1024 * 1024,
    },
  );

  return parseWindowsIntegratedLookupOutput(stdout);
}
