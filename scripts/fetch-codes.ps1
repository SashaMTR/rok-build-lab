# Récupère automatiquement les codes depuis une page publique et les fusionne
# dans data/content.json, puis régénère data/content.js.
#
#   .\scripts\fetch-codes.ps1 -DryRun
#   .\scripts\fetch-codes.ps1
#   .\scripts\fetch-codes.ps1 -Status active -Max 15
#
# Par défaut les nouveaux codes sont importés en "unknown" (à tester), donc
# masqués sur le site. Utilise -Status active pour les afficher directement.

param(
    [string]$Url = 'https://riseofkingdomsguides.com/redeem-codes/',
    [int]$Max = 20,
    [ValidateSet('unknown', 'active')]
    [string]$Status = 'unknown',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$jsonPath = Join-Path $root 'data\content.json'
$buildScript = Join-Path $PSScriptRoot 'build-data.ps1'

if (-not (Test-Path $jsonPath)) { throw "data/content.json introuvable." }

Write-Host ("Source : " + $Url)
$tmp = [System.IO.Path]::GetTempFileName()
try {
    curl.exe --noproxy '*' -L -s -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' -o $tmp $Url
    $html = [System.IO.File]::ReadAllText($tmp, [System.Text.Encoding]::UTF8)
} finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
}

$start = $html.IndexOf('Active Rise Of Kingdoms codes')
if ($start -lt 0) { throw "Section « Active codes » introuvable sur la page." }
$end = $html.IndexOf('Each Rise Of Kingdoms redeem code')
$section = if ($end -gt $start) { $html.Substring($start, $end - $start) } else { $html.Substring($start) }

$items = [regex]::Matches($section, '<li[^>]*>(.*?)</li>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
$codes = @()
foreach ($item in $items) {
    $text = ($item.Groups[1].Value -replace '<[^>]+>', ' ').Trim()
    $token = ($text -split '\s+')[0].Trim('`', '"', "'", ',', ';', '.', ':', '(', ')', '[', ']', '<', '>')
    if ([string]::IsNullOrWhiteSpace($token)) { continue }
    if ($token -match '^[A-Za-z0-9]{4,20}$' -and $token -match '[A-Za-z]') {
        $codes += $token
    }
}
$codes = @($codes | Select-Object -Unique | Select-Object -First $Max)

Write-Host ("Codes trouvés sur la page : " + $codes.Count)
$codes | ForEach-Object { Write-Host (" - " + $_) }

$content = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$existing = @{}
foreach ($item in @($content.codes.items)) { $existing[$item.code.ToLower()] = $true }

$today = Get-Date -Format 'yyyy-MM-dd'
$added = @()
foreach ($code in $codes) {
    $key = $code.ToLower()
    if ($existing.ContainsKey($key)) { continue }
    $newItem = [pscustomobject]@{
        code    = $code
        rewards = 'Importé automatiquement — à vérifier'
        status  = $Status
        added   = $today
        expires = $null
    }
    $content.codes.items = @($content.codes.items) + $newItem
    $existing[$key] = $true
    $added += $code
}

Write-Host ("Nouveaux codes : " + $added.Count + " (statut : " + $Status + ")")
$added | ForEach-Object { Write-Host (" + " + $_) }

if ($DryRun) {
    Write-Host 'Mode -DryRun : content.json non modifié.'
    return
}

$content.codes.verifiedAt = $today
$json = $content | ConvertTo-Json -Depth 30
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($jsonPath, $json + "`n", $utf8)

& $buildScript
