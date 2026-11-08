# Inspecte l'installation de Rise of Kingdoms (lecture seule).
# Affiche les exécutables, la taille des données et les fichiers lisibles.
#
#   .\scripts\inspect-rok.ps1
#
# À savoir : les données de jeu sont stockées dans des bundles Unity `.lb`
# (format propriétaire, ~4-5 Go). Ce script ne les décode pas : il sert à
# vérifier l'installation et à localiser les fichiers de configuration lisibles.

param(
    [string]$Path
)

$ErrorActionPreference = 'Stop'

function Find-RokRoot {
    $regPaths = @(
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    foreach ($regPath in $regPaths) {
        $item = Get-ItemProperty $regPath -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName -match 'Rise of Kingdoms' -and $_.InstallLocation } |
            Select-Object -First 1
        if ($item -and (Test-Path $item.InstallLocation)) {
            return $item.InstallLocation
        }
    }
    foreach ($candidate in @(
        'C:\Program Files (x86)\Rise of Kingdoms',
        'C:\Program Files\Rise of Kingdoms',
        (Join-Path $env:LOCALAPPDATA 'Programs\Rise of Kingdoms'),
        (Join-Path $env:LOCALAPPDATA 'Rise of Kingdoms')
    )) {
        if (Test-Path $candidate) { return $candidate }
    }
    return $null
}

$root = if ($Path) { $Path } else { Find-RokRoot }
if (-not $root) {
    throw "Rise of Kingdoms introuvable. Utilise -Path 'C:\Program Files (x86)\Rise of Kingdoms'."
}
$root = (Resolve-Path $root).Path

$launcher = Join-Path $root 'launcher.exe'
$gameDir = Join-Path $root 'Rise of Kingdoms Game'
$gameExe = Join-Path $gameDir 'MASS.exe'
$dataDir = Join-Path $gameDir 'MASS_Data'

Write-Host "=== Rise of Kingdoms ==="
Write-Host "Installation : $root"
Write-Host "Launcher     : $(if (Test-Path $launcher) { 'OK' } else { 'absent' }) ($launcher)"
Write-Host "Jeu          : $(if (Test-Path $gameExe) { 'OK' } else { 'absent' }) ($gameExe)"
Write-Host "Données      : $(if (Test-Path $dataDir) { 'OK' } else { 'absent' }) ($dataDir)"
Write-Host ''

if (Test-Path $dataDir) {
    $files = Get-ChildItem -Path $dataDir -Recurse -File -ErrorAction SilentlyContinue
    $measure = $files | Measure-Object -Property Length -Sum
    $bundles = @($files | Where-Object { $_.Extension -eq '.lb' })
    $readable = @($files | Where-Object { $_.Extension -match '^\.(json|xml|csv|txt|yaml|yml|ini|cfg|properties)$' })

    Write-Host '=== Données ==='
    Write-Host ("Fichiers      : " + $measure.Count)
    Write-Host ("Taille totale : " + [math]::Round($measure.Sum / 1MB) + " Mo")
    Write-Host ("Bundles .lb   : " + $bundles.Count)
    Write-Host ("Fichiers texte: " + $readable.Count)
    Write-Host ''

    if ($readable.Count -gt 0) {
        Write-Host '=== Fichiers de configuration lisibles ==='
        $readable | Select-Object -First 25 | ForEach-Object {
            Write-Host (" - " + $_.FullName.Replace($root + '\', '') + " (" + $_.Length + " o)")
        }
        Write-Host ''
    }

    Write-Host 'Note : les données de commandants sont dans les bundles .lb (format propriétaire).'
    Write-Host 'Le site utilise un dataset communautaire (data/commanders.json), pas une extraction du client.'
}
