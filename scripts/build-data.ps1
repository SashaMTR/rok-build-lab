# Régénère data/commanders.js depuis data/commanders.json (aucune dépendance).
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$jsonPath = Join-Path $root 'data\commanders.json'
$jsPath = Join-Path $root 'data\commanders.js'

$json = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
$data = $json | ConvertFrom-Json

if (-not $data.commanders) {
    throw "data/commanders.json ne contient pas de tableau 'commanders'."
}

$content = "window.ROK_DATA = " + $json.Trim() + ";`n"
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($jsPath, $content, $utf8)

Write-Host ("OK - data/commanders.js régénéré (" + $data.commanders.Count + " commandants).")

# Contenu additionnel (codes, offres, techno, plans de base)
$contentPath = Join-Path $root 'data\content.json'
if (Test-Path $contentPath) {
    # Normalise le JSON en UTF-8 propre si Node est disponible (évite les \uXXXX).
    $nodePath = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
    if (-not $nodePath) {
        $candidate = Join-Path $env:LOCALAPPDATA 'nodejs\node.exe'
        if (Test-Path $candidate) { $nodePath = $candidate }
    }
    $normalizer = Join-Path $root 'scripts\normalize-json.mjs'
    if ($nodePath -and (Test-Path $normalizer)) {
        & $nodePath $normalizer $contentPath | Out-Null
    }

    $contentJson = [System.IO.File]::ReadAllText($contentPath, [System.Text.Encoding]::UTF8)
    $null = $contentJson | ConvertFrom-Json
    $contentOut = "window.ROK_CONTENT = " + $contentJson.Trim() + ";`n"
    [System.IO.File]::WriteAllText((Join-Path $root 'data\content.js'), $contentOut, $utf8)
    Write-Host "OK - data/content.js régénéré."
}
