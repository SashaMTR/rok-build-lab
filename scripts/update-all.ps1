# Met à jour toutes les données de jeu :
# 1. géométrie des arbres de talents + données de talents
# 2. commandants (builds officiels, grades, compétences, portraits)
# 3. regeneration de data/*.js
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node) {
    $candidate = Join-Path $env:LOCALAPPDATA 'nodejs\node.exe'
    if (Test-Path $candidate) { $node = $candidate }
}
if (-not $node) { throw 'Node.js introuvable (attendu dans %LOCALAPPDATA%\nodejs).' }

Write-Host '=== Talents (layout + donnees) ==='
& $node (Join-Path $root 'scripts\fetch-talents.mjs')
if ($LASTEXITCODE -ne 0) { throw 'fetch-talents.mjs a echoue.' }

Write-Host '=== Commandants ==='
& $node (Join-Path $root 'scripts\fetch-commander-data.mjs')
if ($LASTEXITCODE -ne 0) { throw 'fetch-commander-data.mjs a echoue.' }

Write-Host '=== Rebuild ==='
& (Join-Path $root 'scripts\build-data.ps1')
Write-Host 'Termine.'
