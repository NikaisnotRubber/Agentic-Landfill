#!/usr/bin/env bash
# Run inside WSL from the repository root (or any path inside the repo).
# Creates a portable git bundle on the Windows C: drive — no node_modules copy.
set -euo pipefail

REPO_ROOT="$(git -C "${BASH_SOURCE%/*}/../.." rev-parse --show-toplevel)"
BUNDLE_PATH="${1:-/mnt/c/Users/ALVIS.MC.TSAO/handovered_from_Justin.bundle}"

cd "$REPO_ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository: $REPO_ROOT" >&2
  exit 1
fi

echo "Repository: $REPO_ROOT"
echo "Bundle:     $BUNDLE_PATH"
echo ""

git bundle create "$BUNDLE_PATH" --all

echo ""
WIN_BUNDLE="$(wslpath -w "$BUNDLE_PATH" 2>/dev/null || echo "$BUNDLE_PATH")"
echo "Done. On Windows PowerShell:"
echo "  git clone \"$WIN_BUNDLE\" C:\\Users\\ALVIS.MC.TSAO\\handovered_from_Justin"
echo "  cd C:\\Users\\ALVIS.MC.TSAO\\handovered_from_Justin"
echo "  .\\scripts\\windows\\Setup-HelpdeskDev.ps1"
echo "  .\\scripts\\windows\\Sync-LocalSecretsFromWsl.ps1"
