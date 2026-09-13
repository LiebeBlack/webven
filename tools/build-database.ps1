# =============================================================================
#  tools/build-database.ps1
#  Ensambla data/database.json y data/database.embedded.js a partir de los
#  fragmentos revisables de data/fragments/.
#
#  Por qué existe: el dataset completo es demasiado grande para editarlo a mano
#  en un solo archivo sin introducir errores. Se mantiene en fragmentos por
#  bloque temático y se ensambla de forma determinista.
#
#  Cómo se ensambla: concatenación textual de los fragmentos (cada uno es un
#  objeto JSON de claves de primer nivel). No se usa ConvertTo-Json a propósito,
#  porque reescribiría el texto y convertiría cada acento en una secuencia
#  \u00XX, dejando el archivo publicado ilegible para revisión humana.
#
#  Uso:
#     powershell -File tools/build-database.ps1            # ensambla
#     powershell -File tools/build-database.ps1 -Check      # solo verifica
# =============================================================================
[CmdletBinding()]
param(
  [switch]$Check
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root      = Split-Path -Parent $PSScriptRoot
$fragDir   = Join-Path $root "data/fragments"
$jsonPath  = Join-Path $root "data/database.json"
$embPath   = Join-Path $root "data/database.embedded.js"

# Nota de portabilidad: las barras inclinadas funcionan como separador de ruta
# tanto en Windows como en Linux/macOS, donde el script también corre (CI de
# GitHub Actions usa pwsh sobre Ubuntu). El separador "\" solo es válido en
# Windows y rompería la compilación en el runner.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path $fragDir)) {
  throw "No existe el directorio de fragmentos: $fragDir"
}

$fragments = Get-ChildItem -Path $fragDir -Filter "*.json" | Sort-Object Name
if ($fragments.Count -eq 0) {
  throw "No hay fragmentos en $fragDir"
}

Write-Host "Ensamblando $($fragments.Count) fragmentos..." -ForegroundColor Cyan

$parts = @()
$seenKeys = @{}
$report = @()

foreach ($file in $fragments) {
  $text = [System.IO.File]::ReadAllText($file.FullName, $utf8NoBom).Trim()

  if (-not $text.StartsWith("{")) { throw "$($file.Name): el fragmento debe ser un objeto JSON." }
  if (-not $text.EndsWith("}"))   { throw "$($file.Name): el fragmento debe cerrar con llave." }

  # Se valida que el fragmento sea JSON correcto antes de incorporarlo.
  try {
    $null = $text | ConvertFrom-Json
  } catch {
    throw "$($file.Name): JSON inválido. Detalle: $($_.Exception.Message)"
  }

  # Detección de claves de primer nivel duplicadas entre fragmentos.
  $keys = [regex]::Matches($text, '(?m)^  "([A-Za-z0-9_]+)":') | ForEach-Object { $_.Groups[1].Value }
  if ($keys.Count -eq 0) { throw "$($file.Name): no se detectaron claves de primer nivel." }
  foreach ($k in $keys) {
    if ($seenKeys.ContainsKey($k)) {
      throw "Clave duplicada '$k' en $($file.Name) (ya definida en $($seenKeys[$k]))."
    }
    $seenKeys[$k] = $file.Name
  }

  $inner = $text.Substring(1, $text.Length - 2).Trim()
  $parts += $inner
  $report += [pscustomobject]@{
    Fragmento = $file.Name
    Claves    = $keys.Count
    Lineas    = ($text -split "`n").Count
    KB        = [Math]::Round($file.Length / 1KB, 1)
  }
}

$json = "{`n" + ($parts -join ",`n") + "`n}`n"

# Verificación final: el documento ensamblado debe ser JSON válido.
try {
  $null = $json | ConvertFrom-Json
} catch {
  throw "El documento ensamblado no es JSON válido: $($_.Exception.Message)"
}

$report | Format-Table -AutoSize | Out-String | Write-Host

# Respaldo embebido: mismo contenido, como módulo ES. Sirve cuando el fetch del
# JSON falla (por ejemplo si alguien abre el sitio con file:// o si el archivo
# fue truncado en el despliegue).
$embedded = @"
/**
 * data/database.embedded.js
 * ARCHIVO GENERADO - no editar a mano. Solo se escribe con tools/build-database.ps1.
 * Se produce con: powershell -File tools/build-database.ps1
 *
 * Contiene exactamente el mismo contenido que data/database.json, como módulo ES.
 * Existe porque fetch() de un archivo local falla bajo file:// y porque en
 * GitHub Pages una caché intermedia puede servir una versión truncada. La
 * validación comprueba que este respaldo y el JSON sean idénticos.
 */
export const embeddedDatabase = $json;
export default embeddedDatabase;
"@

if ($Check) {
  # El modo de verificación cubre los dos artefactos derivados: si cualquiera
  # quedó atrás respecto a los fragmentos, la entrega es inconsistente.
  $stale = @()
  if (-not (Test-Path $jsonPath)) {
    $stale += "data/database.json (falta)"
  } elseif ([System.IO.File]::ReadAllText($jsonPath, $utf8NoBom) -ne $json) {
    $stale += "data/database.json (desactualizado)"
  }
  if (-not (Test-Path $embPath)) {
    $stale += "data/database.embedded.js (falta)"
  } elseif ([System.IO.File]::ReadAllText($embPath, $utf8NoBom) -ne $embedded) {
    $stale += "data/database.embedded.js (desactualizado)"
  }

  if ($stale.Count -eq 0) {
    Write-Host "OK: el dataset publicado está sincronizado con los fragmentos." -ForegroundColor Green
    exit 0
  }
  Write-Host ("DESACTUALIZADO: " + ($stale -join ", ") + ".") -ForegroundColor Yellow
  Write-Host "Regenera con: powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-database.ps1" -ForegroundColor Yellow
  exit 1
}

[System.IO.File]::WriteAllText($jsonPath, $json, $utf8NoBom)
Write-Host "Escrito: data/database.json ($([Math]::Round($json.Length / 1KB, 1)) KB)" -ForegroundColor Green
[System.IO.File]::WriteAllText($embPath, $embedded, $utf8NoBom)
Write-Host "Escrito: data/database.embedded.js ($([Math]::Round($embedded.Length / 1KB, 1)) KB)" -ForegroundColor Green
Write-Host "Listo." -ForegroundColor Green
