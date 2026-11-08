# Petit serveur statique local (aucune dépendance, Windows PowerShell).
param(
    [int]$Port = 5173
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$prefix = "http://localhost:$Port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "RoK Build Lab -> $prefix"
Write-Host "Ctrl+C pour arrêter le serveur."

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.mjs'  = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.webp' = 'image/webp'
    '.ico'  = 'image/x-icon'
}

$utf8 = New-Object System.Text.UTF8Encoding($false)

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $path = $request.Url.AbsolutePath
            if ([string]::IsNullOrWhiteSpace($path) -or $path -eq '/') { $path = '/index.html' }

            $relative = [System.Uri]::UnescapeDataString($path).TrimStart('/').Replace('/', '\')
            $full = [System.IO.Path]::GetFullPath((Join-Path $root $relative))

            if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
                $response.StatusCode = 403
                $body = $utf8.GetBytes('403 - acces refuse')
                $response.ContentType = 'text/plain; charset=utf-8'
                $response.OutputStream.Write($body, 0, $body.Length)
            }
            elseif (Test-Path -LiteralPath $full -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($full)
                $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
                if ($mime.ContainsKey($ext)) { $response.ContentType = $mime[$ext] }
                else { $response.ContentType = 'application/octet-stream' }
                $response.Headers.Add('Cache-Control', 'no-store')
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            else {
                $response.StatusCode = 404
                $body = $utf8.GetBytes('404 - fichier introuvable')
                $response.ContentType = 'text/plain; charset=utf-8'
                $response.OutputStream.Write($body, 0, $body.Length)
            }
        }
        catch {
            try { $response.StatusCode = 500 } catch { }
        }
        finally {
            try { $context.Response.OutputStream.Close() } catch { }
        }
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}
