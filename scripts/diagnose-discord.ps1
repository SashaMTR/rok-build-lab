# Diagnostique l'accès du bot Discord à ton serveur et à ton salon.
# Lit .env (DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID) et n'affiche jamais le token.
#
#   .\scripts\diagnose-discord.ps1

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envFile = Join-Path $root '.env'
if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Fichier .env introuvable. Copie .env.example en .env et remplis le token + l'ID du salon."
}

$token = $null
$channelId = $null
foreach ($line in Get-Content -LiteralPath $envFile) {
    $trim = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trim) -or $trim.StartsWith('#')) { continue }
    $eq = $trim.IndexOf('=')
    if ($eq -lt 1) { continue }
    $key = $trim.Substring(0, $eq).Trim()
    $value = $trim.Substring($eq + 1).Trim().Trim('"', "'")
    if ($key -eq 'DISCORD_BOT_TOKEN') { $token = $value }
    if ($key -eq 'DISCORD_CHANNEL_ID') { $channelId = $value }
}

if (-not $token) { throw 'DISCORD_BOT_TOKEN manquant dans .env.' }
if (-not $channelId) { throw 'DISCORD_CHANNEL_ID manquant dans .env.' }

$headers = @{ Authorization = "Bot $token" }

function Invoke-Discord {
    param([string]$Url)

    # curl.exe renvoie 200 là où Invoke-RestMethod de PowerShell 5.1 se fait bloquer (403).
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
        $tmp = [System.IO.Path]::GetTempFileName()
        try {
            $code = & $curl.Source --noproxy '*' -s -S -o $tmp -w '%{http_code}' -H "Authorization: Bot $token" $Url 2>$null
            $status = 0
            [void][int]::TryParse(($code | Select-Object -Last 1), [ref]$status)
            $body = Get-Content -Raw -LiteralPath $tmp -ErrorAction SilentlyContinue
            if ($status -ge 200 -and $status -lt 300) {
                return @{ ok = $true; data = ($body | ConvertFrom-Json); status = $status }
            }
            return @{ ok = $false; status = $status }
        } finally {
            Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
        }
    }

    try {
        $data = Invoke-RestMethod -Uri $Url -Headers $headers -TimeoutSec 20
        return @{ ok = $true; data = $data }
    } catch {
        $status = $null
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        return @{ ok = $false; status = $status }
    }
}

Write-Host '=== Diagnostic Discord ==='
Write-Host ("Salon cible (ID) : " + $channelId)
Write-Host ''

Write-Host '1) Token'
$me = Invoke-Discord 'https://discord.com/api/v10/users/@me'
if ($me.ok) {
    Write-Host ("   OK — bot : " + $me.data.username + " (id " + $me.data.id + ")")
} else {
    Write-Host ("   ECHEC — HTTP " + $me.status + " (token invalide ou révoqué)")
    exit
}
Write-Host ''

Write-Host '2) Serveurs vus par le bot'
$guildsResult = Invoke-Discord 'https://discord.com/api/v10/users/@me/guilds'
if (-not $guildsResult.ok) {
    Write-Host ("   ECHEC — HTTP " + $guildsResult.status)
    exit
}
$guilds = @($guildsResult.data)
if ($guilds.Count -eq 0) {
    Write-Host '   Aucun serveur : le bot n’est membre d’aucun serveur.'
} else {
    foreach ($guild in $guilds) {
        $access = Invoke-Discord ("https://discord.com/api/v10/guilds/" + $guild.id)
        if ($access.ok) {
            Write-Host ("   - " + $guild.name + " (" + $guild.id + ") : ACCES OK")
        } else {
            Write-Host ("   - " + $guild.name + " (" + $guild.id + ") : HTTP " + $access.status + " (pas réellement membre)")
        }
    }
}
Write-Host ''

Write-Host '3) Salon cible'
$channel = Invoke-Discord ("https://discord.com/api/v10/channels/" + $channelId)
if ($channel.ok) {
    Write-Host ("   OK — #" + $channel.data.name + " (serveur " + $channel.data.guild_id + ")")
} else {
    Write-Host ("   ECHEC — HTTP " + $channel.status + " (mauvais ID ou bot sans accès)")
}
Write-Host ''

Write-Host '=== Conclusion ==='
if ($me.ok -and $channel.ok) {
    Write-Host 'Tout est bon : tu peux lancer .\scripts\update-codes.ps1 -DryRun'
} else {
    Write-Host 'Le bot doit être RÉELLEMENT membre du serveur (liste des membres),'
    Write-Host 'avec les scopes bot + View Channels + Read Message History,'
    Write-Host 'et l’ID du salon doit être celui de #codes.'
}
