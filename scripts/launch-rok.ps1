# Lance Rise of Kingdoms (PC) et détecte automatiquement l'installation.
#
# Exemples :
#   .\scripts\launch-rok.ps1
#   .\scripts\launch-rok.ps1 -Game          # lance MASS.exe directement
#   .\scripts\launch-rok.ps1 -DryRun        # affiche seulement les chemins
#   .\scripts\launch-rok.ps1 -Screenshot    # capture l'écran après 10 s
#
# Aucune donnée du jeu n'est lue ni modifiée par ce script.

param(
    [switch]$Game,
    [switch]$Wait,
    [switch]$DryRun,
    [switch]$Screenshot,
    [int]$WaitSeconds = 10,
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

    $candidates = @(
        'C:\Program Files (x86)\Rise of Kingdoms',
        'C:\Program Files\Rise of Kingdoms',
        (Join-Path $env:LOCALAPPDATA 'Programs\Rise of Kingdoms'),
        (Join-Path $env:LOCALAPPDATA 'Rise of Kingdoms')
    )
    foreach ($candidate in $candidates) {
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
$gameExe = Join-Path $root 'Rise of Kingdoms Game\MASS.exe'
$exe = if ($Game) { $gameExe } else { $launcher }

Write-Host "Installation : $root"
Write-Host "Exécutable   : $exe"

if (-not (Test-Path $exe)) {
    throw "Exécutable introuvable : $exe"
}

if ($DryRun) {
    Write-Host 'Mode -DryRun : aucun lancement.'
    return
}

Start-Process -FilePath $exe -WorkingDirectory (Split-Path $exe) | Out-Null
Write-Host 'Rise of Kingdoms lancé.'

if ($Screenshot) {
    Write-Host "Capture dans $WaitSeconds secondes..."
    Start-Sleep -Seconds $WaitSeconds

    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

    $dir = Join-Path (Split-Path $PSScriptRoot -Parent) 'screenshots'
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $file = Join-Path $dir ('rok-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.png')
    $bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)

    $graphics.Dispose()
    $bitmap.Dispose()
    Write-Host "Capture : $file"
}

if ($Wait) {
    Write-Host 'Attente de la fermeture du jeu...'
    while (Get-Process -Name 'launcher', 'MASS' -ErrorAction SilentlyContinue) {
        Start-Sleep -Seconds 3
    }
    Write-Host 'Jeu fermé.'
}
