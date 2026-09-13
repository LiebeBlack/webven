# =============================================================================
#  tools/serve.ps1 — Servidor estático local, sin dependencias
#
#  Por qué existe: el sitio usa módulos ES y fetch() del dataset. Abrir
#  index.html con doble clic (file://) no funciona por las reglas de origen del
#  navegador, y este equipo no tiene Node ni Python instalados. HttpListener de
#  .NET resuelve el problema sin instalar nada.
#
#  Uso:
#     powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1
#     powershell -File tools/serve.ps1 -Port 8080 -Open
# =============================================================================
[CmdletBinding()]
param(
  [int]$Port = 5173,
  [switch]$Open,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$mime = @{
  ".html"        = "text/html; charset=utf-8"
  ".htm"         = "text/html; charset=utf-8"
  ".css"         = "text/css; charset=utf-8"
  ".js"          = "text/javascript; charset=utf-8"
  ".mjs"         = "text/javascript; charset=utf-8"
  ".json"        = "application/json; charset=utf-8"
  ".svg"         = "image/svg+xml"
  ".png"         = "image/png"
  ".jpg"         = "image/jpeg"
  ".jpeg"        = "image/jpeg"
  ".webp"        = "image/webp"
  ".ico"         = "image/x-icon"
  ".woff"        = "font/woff"
  ".woff2"       = "font/woff2"
  ".txt"         = "text/plain; charset=utf-8"
  ".md"          = "text/markdown; charset=utf-8"
  ".csv"         = "text/csv; charset=utf-8"
  ".map"         = "application/json; charset=utf-8"
}

function Resolve-FreePort([int]$start) {
  for ($candidate = $start; $candidate -lt ($start + 25); $candidate++) {
    $busy = $false
    try {
      $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidate)
      $listener.Start()
      $listener.Stop()
    } catch {
      $busy = $true
    }
    if (-not $busy) { return $candidate }
  }
  throw "No hay puerto libre en el rango $start-$($start + 24)."
}

$port = Resolve-FreePort $Port
$prefix = "http://localhost:$port/"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host "No se pudo iniciar el servidor en $prefix" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host "Si el puerto está reservado por otro proceso, prueba con otro: -Port 8080" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "  Observatorio de Deuda Soberana VE" -ForegroundColor Cyan
Write-Host "  Sirviendo: $root"
Write-Host "  Dirección: $prefix" -ForegroundColor Green
Write-Host "  Detener:   Ctrl + C"
Write-Host ""

if ($Open) { Start-Process $prefix | Out-Null }

$rootFull = [System.IO.Path]::GetFullPath($root)

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
  } catch {
    break
  }

  $request = $context.Request
  $response = $context.Response

  try {
    $relative = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath).TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($relative)) { $relative = "index.html" }
    if ($relative.EndsWith("/")) { $relative += "index.html" }

    $candidate = [System.IO.Path]::GetFullPath((Join-Path $rootFull $relative))

    # Defensa contra traversal: nunca servir fuera de la raíz del proyecto.
    if (-not $candidate.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      $response.StatusCode = 403
      $payload = [System.Text.Encoding]::UTF8.GetBytes("403 — ruta fuera del proyecto")
    } elseif (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      $response.StatusCode = 404
      $payload = [System.Text.Encoding]::UTF8.GetBytes("404 — no encontrado: $relative")
    } else {
      $extension = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant()
      $contentType = if ($mime.ContainsKey($extension)) { $mime[$extension] } else { "application/octet-stream" }
      $response.ContentType = $contentType
      $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
      $response.Headers.Add("X-Content-Type-Options", "nosniff")
      $payload = [System.IO.File]::ReadAllBytes($candidate)
      if (-not $Quiet) {
        Write-Host ("  {0}  {1}" -f $response.StatusCode, $relative) -ForegroundColor DarkGray
      }
    }

    $response.ContentLength64 = $payload.Length
    $response.OutputStream.Write($payload, 0, $payload.Length)
  } catch {
    try { $response.StatusCode = 500 } catch { }
  } finally {
    $response.OutputStream.Close()
  }
}

$listener.Stop()
$listener.Close()
Write-Host "  Servidor detenido." -ForegroundColor Yellow
