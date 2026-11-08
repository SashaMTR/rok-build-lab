# Synchronise les codes depuis Discord (scripts/fetch-discord-codes.mjs).
# Utilisé par la tâche planifiée Windows « RoK Codes Discord ».
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node) {
    $candidate = Join-Path $env:LOCALAPPDATA 'nodejs\node.exe'
    if (Test-Path $candidate) { $node = $candidate }
}
if (-not $node) { throw 'Node.js introuvable.' }

& $node (Join-Path $root 'scripts\fetch-discord-codes.mjs')
exit $LASTEXITCODE
