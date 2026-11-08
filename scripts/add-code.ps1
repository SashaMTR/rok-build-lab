# Ajoute ou met à jour un code dans data/content.json, puis régénère data/content.js.
# Ne nécessite ni bot ni Discord.
#
# Exemples :
#   .\scripts\add-code.ps1 -Code aqmxqk92hj -Expires "2026-11-08 16:59" -Rewards "Code Discord"
#   .\scripts\add-code.ps1 -Code Grab600gem -Rewards "600 gemmes"
#   .\scripts\add-code.ps1 -Code TEST123 -DryRun

param(
    [Parameter(Mandatory = $true)][string]$Code,
    [string]$Expires = '',
    [string]$Rewards = 'Code Discord',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$jsonPath = Join-Path $root 'data\content.json'
$buildScript = Join-Path $PSScriptRoot 'build-data.ps1'

if (-not (Test-Path $jsonPath)) {
    throw "data/content.json introuvable."
}

function Normalize-Expiry {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
    $v = $Value.Trim()
    if ($v -match '^\d{4}-\d{2}-\d{2}$') { return $v }
    if ($v -match '^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})$') {
        return ('{0}T{1:D2}:{2}' -f $matches[1], [int]$matches[2], $matches[3])
    }
    $parsed = [datetime]::MinValue
    $culture = [System.Globalization.CultureInfo]::GetCultureInfo('fr-FR')
    if ([datetime]::TryParse($v, $culture, [System.Globalization.DateTimeStyles]::None, [ref]$parsed)) {
        return $parsed.ToString('yyyy-MM-ddTHH:mm')
    }
    throw "Format d'expiration non reconnu : $Value (exemple : '2026-11-08 16:59')."
}

$expiry = Normalize-Expiry -Value $Expires
$content = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$existing = @($content.codes.items | Where-Object { $_.code.ToLower() -eq $Code.ToLower() })

if ($existing.Count -gt 0) {
    $item = $existing[0]
    $item.rewards = $Rewards
    $item.expires = $expiry
    $item.status = 'active'
    $action = 'mis à jour'
} else {
    $newItem = [pscustomobject]@{
        code    = $Code
        rewards = $Rewards
        status  = 'active'
        added   = (Get-Date -Format 'yyyy-MM-dd')
        expires = $expiry
    }
    $content.codes.items = @($content.codes.items) + $newItem
    $action = 'ajouté'
}

Write-Host ("Code « $Code » $action" + $(if ($expiry) { " (expire le $expiry)" } else { '' }))

if ($DryRun) {
    Write-Host 'Mode -DryRun : content.json non modifié.'
    return
}

$content.codes.verifiedAt = (Get-Date -Format 'yyyy-MM-dd')
$json = $content | ConvertTo-Json -Depth 30
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($jsonPath, $json + "`n", $utf8)

& $buildScript
