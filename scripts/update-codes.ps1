# Met à jour les codes cadeaux dans data/content.json, puis régénère data/content.js.
#
# Trois sources possibles :
#
# 1) Fichier texte (le plus simple, recommandé) :
#      .\scripts\update-codes.ps1 -File codes.txt
#    Un code par ligne (tu peux coller directement depuis Discord).
#
# 2) Discord (API officielle, avec un BOT — pas un token utilisateur) :
#      $env:DISCORD_BOT_TOKEN = "..."
#      $env:DISCORD_CHANNEL_ID = "..."
#      .\scripts\update-codes.ps1
#    Le bot doit être membre du serveur et avoir "Voir le salon" + "Lire l'historique".
#    Le salon #redeem-code du serveur officiel peut refuser les bots : dans ce cas,
#    utilise la source fichier (copier/coller manuel).
#
# 3) URL (page publique) :
#      .\scripts\update-codes.ps1 -Url "https://exemple.com/codes"
#
# Options :
#   -Limit N  nombre de messages Discord à parcourir (défaut 300)
#   -Reset    remplace toute la liste (sinon fusion)
#   -DryRun   affiche les codes trouvés sans rien écrire
#
# Note : l'usage d'un token utilisateur ("self-bot") est contraire aux règles de
# Discord. Ce script n'utilise que l'API bot officielle.

param(
    [string]$File,
    [string]$Url,
    [string]$DiscordToken = $env:DISCORD_BOT_TOKEN,
    [string]$ChannelId = $env:DISCORD_CHANNEL_ID,
    [int]$Limit = 300,
    [switch]$Reset,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$jsonPath = Join-Path $root 'data\content.json'
$buildScript = Join-Path $PSScriptRoot 'build-data.ps1'

# Charge les variables depuis .env (si présent) — évite de coller le token dans le terminal.
$envFile = Join-Path $root '.env'
if (Test-Path -LiteralPath $envFile) {
    foreach ($line in Get-Content -LiteralPath $envFile) {
        $trim = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trim) -or $trim.StartsWith('#')) { continue }
        $eq = $trim.IndexOf('=')
        if ($eq -lt 1) { continue }
        $key = $trim.Substring(0, $eq).Trim()
        $value = $trim.Substring($eq + 1).Trim().Trim('"', "'")
        if ($key -eq 'DISCORD_BOT_TOKEN' -and -not $DiscordToken) { $DiscordToken = $value }
        if ($key -eq 'DISCORD_CHANNEL_ID' -and -not $ChannelId) { $ChannelId = $value }
    }
}

if (-not (Test-Path $jsonPath)) {
    throw "data/content.json introuvable. Lance le script depuis le dossier du projet."
}

function Get-CodesFromTokens {
    param([string]$Text)
    $set = New-Object System.Collections.Generic.HashSet[string]
    foreach ($raw in ($Text -split '\s+')) {
        $token = $raw.Trim('`', '"', "'", ',', ';', '.', ':', '(', ')', '[', ']', '<', '>', '!', '?', '*')
        if ([string]::IsNullOrWhiteSpace($token)) { continue }
        if ($token -match '^[A-Za-z0-9]{4,20}$' -and $token -match '[A-Za-z]' -and $token -match '[0-9]') {
            [void]$set.Add($token)
        } elseif ($token -match '^(?i)(rok|lilith)[a-z0-9]{2,15}$') {
            [void]$set.Add($token)
        }
    }
    return @($set)
}

function Get-CodesFromText {
    param([string]$Text)
    $set = New-Object System.Collections.Generic.HashSet[string]
    # 6 à 16 caractères alphanumériques, avec au moins une lettre et un chiffre.
    $regex = '(?<![A-Za-z0-9])(?=[A-Za-z0-9]{6,16}(?![A-Za-z0-9]))(?=[A-Za-z0-9]*[0-9])(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{6,16}(?![A-Za-z0-9])'
    foreach ($match in [regex]::Matches($Text, $regex)) {
        [void]$set.Add($match.Value)
    }
    return @($set)
}

function Get-ExpiryFromText {
    param([string]$Text)

    # Format Discord : <t:1794153599:f> (timestamp Unix)
    $discordTs = [regex]::Match($Text, '<t:(\d{9,13})(?::[a-zA-Z])?>')
    if ($discordTs.Success) {
        $unix = [int64]$discordTs.Groups[1].Value
        if ($unix -gt 9999999999) { $unix = [int64]($unix / 1000) }
        $dt = [DateTimeOffset]::FromUnixTimeSeconds($unix).ToLocalTime()
        return $dt.ToString('yyyy-MM-ddTHH:mm')
    }

    $months = @{
        'janvier' = 1; 'février' = 2; 'fevrier' = 2; 'mars' = 3; 'avril' = 4; 'mai' = 5;
        'juin' = 6; 'juillet' = 7; 'août' = 8; 'aout' = 8; 'septembre' = 9;
        'octobre' = 10; 'novembre' = 11; 'décembre' = 12; 'decembre' = 12
    }
    $match = [regex]::Match($Text, '(?i)(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})\s+(\d{1,2}):(\d{2})')
    if (-not $match.Success) { return $null }
    $day = [int]$match.Groups[1].Value
    $month = $months[$match.Groups[2].Value.ToLower()]
    if (-not $month) { return $null }
    $year = [int]$match.Groups[3].Value
    $hour = [int]$match.Groups[4].Value
    $minute = [int]$match.Groups[5].Value
    return ('{0:D4}-{1:D2}-{2:D2}T{3:D2}:{4:D2}' -f $year, $month, $day, $hour, $minute)
}

function Get-DiscordJson {
    param([string]$Url)

    # curl.exe contourne le 403 renvoyé à Invoke-RestMethod de PowerShell 5.1.
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
        $tmp = [System.IO.Path]::GetTempFileName()
        try {
            $code = & $curl.Source --noproxy '*' -s -S -o $tmp -w '%{http_code}' -H "Authorization: Bot $DiscordToken" $Url 2>$null
            $status = 0
            [void][int]::TryParse(($code | Select-Object -Last 1), [ref]$status)
            if ($status -lt 200 -or $status -ge 300) {
                $errBody = Get-Content -Raw -LiteralPath $tmp -ErrorAction SilentlyContinue
                throw "Discord a refusé la requête (HTTP $status) : $errBody"
            }
            $json = Get-Content -Raw -LiteralPath $tmp
            return ($json | ConvertFrom-Json)
        } finally {
            Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
        }
    }

    return Invoke-RestMethod -Uri $Url -Headers @{ Authorization = "Bot $DiscordToken" } -TimeoutSec 30
}

$codes = @()
$sourceLabel = ''
$expiryByCode = @{}

if ($File) {
    if (-not (Test-Path -LiteralPath $File)) {
        throw "Fichier introuvable : $File"
    }
    $text = Get-Content -Raw -LiteralPath $File
    $codes = @(Get-CodesFromTokens -Text $text)
    $sourceLabel = "fichier $File"
}
elseif ($DiscordToken -and $ChannelId) {
    $headers = @{ Authorization = "Bot $DiscordToken" }
    $messages = @()
    $before = $null
    $remaining = [Math]::Max(1, $Limit)

    while ($remaining -gt 0) {
        $take = [Math]::Min(100, $remaining)
        $uri = "https://discord.com/api/v10/channels/$ChannelId/messages?limit=$take"
        if ($before) { $uri += "&before=$before" }
        $page = @(Get-DiscordJson -Url $uri)
        if ($page.Count -eq 0) { break }
        $messages += $page
        $remaining -= $page.Count
        $before = $page[-1].id
        if ($page.Count -lt $take) { break }
    }

    $text = ($messages | ForEach-Object { $_.content }) -join "`n"
    $codes = @(Get-CodesFromText -Text $text) + @(Get-CodesFromTokens -Text $text)
    $codes = @($codes | Select-Object -Unique)

    foreach ($message in $messages) {
        $expiry = Get-ExpiryFromText -Text $message.content
        if (-not $expiry) { continue }
        $messageCodes = @(Get-CodesFromText -Text $message.content) + @(Get-CodesFromTokens -Text $message.content)
        foreach ($messageCode in $messageCodes) {
            $expiryByCode[$messageCode.ToLower()] = $expiry
        }
    }

    $sourceLabel = "Discord (salon $ChannelId, $($messages.Count) messages)"
}
elseif ($Url) {
    $html = (Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 30).Content
    $text = [System.Net.WebUtility]::HtmlDecode(($html -replace '<[^>]+>', ' '))
    $codes = @(Get-CodesFromText -Text $text)
    $sourceLabel = $Url
}
else {
    throw "Aucune source. Utilise -File, -DiscordToken/-ChannelId, ou -Url."
}

Write-Host "Source : $sourceLabel"
Write-Host ("Codes trouvés : " + $codes.Count)
$codes | ForEach-Object { Write-Host (" - " + $_) }

$content = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json

if ($Reset) {
    $content.codes.items = @()
}

$existing = @{}
foreach ($item in @($content.codes.items)) {
    $existing[$item.code.ToLower()] = $true
}

$today = Get-Date -Format 'yyyy-MM-dd'
$added = @()

foreach ($code in $codes) {
    $key = $code.ToLower()
    if ($existing.ContainsKey($key)) { continue }

    $expires = if ($expiryByCode.ContainsKey($key)) { $expiryByCode[$key] } else { $null }

    $newItem = [pscustomobject]@{
        code    = $code
        rewards = 'À compléter'
        status  = 'active'
        added   = $today
        expires = $expires
    }
    $content.codes.items = @($content.codes.items) + $newItem
    $existing[$key] = $true
    $added += $code
}

if ($added.Count -eq 0) {
    Write-Host 'Aucun nouveau code à ajouter.'
    if (-not $DryRun) {
        $content.codes.verifiedAt = $today
    }
}

if ($DryRun) {
    Write-Host ("Nouveaux codes : " + $added.Count)
    $added | ForEach-Object { Write-Host (" + " + $_) }
    Write-Host 'Mode -DryRun : content.json non modifié.'
    return
}

$content.codes.verifiedAt = $today
$json = $content | ConvertTo-Json -Depth 30
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($jsonPath, $json + "`n", $utf8)

Write-Host ("content.json mis à jour : " + $added.Count + " nouveau(x) code(s).")
& $buildScript
