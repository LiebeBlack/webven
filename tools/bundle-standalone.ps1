# =============================================================================
#  tools/bundle-standalone.ps1 — Empaquetador de archivo único
#
#  Por qué existe: además de la entrega multiarchivo (GitHub Pages), el
#  observatorio se distribuye como un único .html que funciona incluso desde
#  file:// — sin servidor, sin fetch y sin red salvo tipografías y Chart.js.
#  Sirve para dos artefactos: el sitio completo y la página de auditoría.
#
#  Cómo resuelve los módulos ES sin bundler de Node: cada módulo viaja como
#  texto dentro del documento; un cargador mínimo crea un Blob URL por módulo
#  (resolviendo el grafo en profundidad) y reescribe los especificadores
#  relativos a su Blob URL. Los navegadores aceptan blob: como especificador de
#  import, así que se ejecuta el mismo código, sin transformaciones.
#
#  Uso:
#     powershell -NoProfile -ExecutionPolicy Bypass -File tools/bundle-standalone.ps1
#     powershell -File tools/bundle-standalone.ps1 -Set todos
# =============================================================================
[CmdletBinding()]
param(
  # sitio | auditoria | todos
  [ValidateSet("sitio", "auditoria", "todos")]
  [string]$Set = "sitio",
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$targets = @{
  sitio = @{
    Template = "index.html"
    Entry    = "js/app.js"
    Output   = "dist/observatorio-standalone.html"
    Title    = "sitio completo"
  }
  auditoria = @{
    Template = "tests/validate.html"
    Entry    = "tests/validate-entry.js"
    Output   = "dist/validate-standalone.html"
    Title    = "auditoría del dataset"
  }
}

function Read-Text([string]$relative) {
  $path = Join-Path $root $relative
  if (-not (Test-Path -LiteralPath $path)) { throw "No existe: $relative" }
  return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

function Write-Text([string]$relative, [string]$content) {
  $path = Join-Path $root $relative
  $dir = Split-Path -Parent $path
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  [System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding($false)))
}

# Un </script> dentro de un bloque <script> cerraría el bloque antes de tiempo.
# Se escapa con \/ , que en JavaScript es un escape inocuo.
function Protect-ScriptText([string]$text) {
  return $text.Replace("</script", "<\/script").Replace("</Script", "<\/Script")
}

function New-Bundle([hashtable]$target) {
  $html = Read-Text $target.Template

  # --- 0. Referencias a archivos que el archivo único no lleva --------------
  # El favicon embebido viaja en el propio documento, pero el manifiesto y los
  # íconos enlazados no: en el bundle serían peticiones a rutas inexistentes.
  # Se retiran entre marcas, y si las marcas no están, no pasa nada.
  $inicio = "<!-- assets:inicio"
  $fin = "<!-- assets:fin -->"
  $i = $html.IndexOf($inicio)
  if ($i -ge 0) {
    $f = $html.IndexOf($fin, $i)
    if ($f -lt 0) { throw "$($target.Template): bloque de assets sin cerrar (falta $fin)." }
    $cierre = $f + $fin.Length
    $reemplazo = "<!-- Los íconos y el manifiesto externos no viajan en el archivo único: el documento ya lleva el favicon embebido. -->"
    $html = $html.Substring(0, $i) + $reemplazo + $html.Substring($cierre)
  }

  # --- 1. Hojas de estilo en línea -----------------------------------------
  # Cada hoja conserva su etiqueta: print.css mantiene media="print", de modo
  # que la versión impresa del bundle se comporta igual que la del sitio.
  # Las rutas de las hojas son relativas a la plantilla: index.html está en la
  # raíz, tests/validate.html un nivel más abajo.
  $templateDir = Split-Path -Parent $target.Template
  $prefix = ""
  if (-not [string]::IsNullOrEmpty($templateDir)) {
    $prefix = ("../" * $templateDir.Split("/").Count)
  }

  $hojas = @(
    @{ Tag = "<link rel=`"stylesheet`" href=`"$($prefix)css/tokens.css`" />"; Css = "css/tokens.css"; Media = "" },
    @{ Tag = "<link rel=`"stylesheet`" href=`"$($prefix)css/styles.css`" />"; Css = "css/styles.css"; Media = "" },
    @{ Tag = "<link rel=`"stylesheet`" href=`"$($prefix)css/print.css`" media=`"print`" />"; Css = "css/print.css"; Media = ' media="print"' }
  )
  foreach ($hoja in $hojas) {
    if ($html -notmatch [regex]::Escape($hoja.Tag)) {
      throw "$($target.Template): no se localizó la hoja $($hoja.Css) (¿cambió la maquetación?)"
    }
    $bloque = "<style$($hoja.Media)>" + (Protect-ScriptText (Read-Text $hoja.Css)) + "</style>"
    $html = $html.Replace($hoja.Tag, $bloque)
  }

  # --- 2. Dataset en línea --------------------------------------------------
  # La sonda de js/data/loader.js detecta window.__OBS_DATABASE__ antes de
  # intentar cualquier fetch, así que en esta distribución no hay red de datos.
  $json = Read-Text "data/database.json"
  $datasetBlock = @"
    <!-- Dataset embebido: idéntico a data/database.json, del que se genera. -->
    <script>
      window.__OBS_DATABASE__ = $($json.Replace("</", "<\/"));
    </script>

"@

  # --- 3. Módulos ES como texto ---------------------------------------------
  $entryRel = $target.Entry
  $moduleFiles = New-Object System.Collections.Generic.List[string]
  foreach ($file in Get-ChildItem -Path (Join-Path $root "js") -Recurse -Filter *.js |
      Where-Object { $_.FullName -notmatch "\\data\\database\.embedded\.js$" } |
      Sort-Object FullName) {
    $moduleFiles.Add($file.FullName.Substring($root.Length + 1).Replace("\", "/"))
  }
  if ($moduleFiles -notcontains $entryRel) { $moduleFiles.Add($entryRel) }

  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($rel in $moduleFiles) {
    $full = Join-Path $root $rel
    if (-not (Test-Path -LiteralPath $full)) { throw "Módulo declarado y no encontrado: $rel" }
    $code = Protect-ScriptText ([System.IO.File]::ReadAllText($full, [System.Text.Encoding]::UTF8))
    $parts.Add("  <script type=""text/observatorio-module"" data-path=""$rel"">$code</script>")
  }

  $loader = @'
  <script>
    /* Cargador de módulos en línea.
       Toma los módulos declarados como texto, resuelve el grafo en profundidad
       y publica cada uno como Blob URL, reescribiendo los especificadores
       relativos para que las importaciones estáticas funcionen sin servidor. */
    (function () {
      var nodes = Array.prototype.slice.call(
        document.querySelectorAll('script[type="text/observatorio-module"][data-path]')
      );
      if (!nodes.length) {
        console.error("[observatorio] la distribución de archivo único no contiene módulos.");
        return;
      }

      var sources = Object.create(null);
      nodes.forEach(function (node) {
        sources[node.getAttribute("data-path")] = node.textContent;
      });

      var published = Object.create(null);
      var pending = Object.create(null);

      function normalize(path) {
        var stack = [];
        path.split("/").forEach(function (part) {
          if (!part || part === ".") return;
          if (part === "..") stack.pop();
          else stack.push(part);
        });
        return stack.join("/");
      }

      function resolve(basePath, spec) {
        var baseDir = basePath.split("/").slice(0, -1).join("/");
        return normalize(baseDir + "/" + spec);
      }

      function rewrite(code, path) {
        return code
          .replace(/(\bfrom\s*)(["'])(\.[^"']*)\2/g, function (all, lead, quote, spec) {
            return lead + quote + url(resolve(path, spec)) + quote;
          })
          .replace(/(\bimport\s*\(\s*)(["'])(\.[^"']*)\2/g, function (all, lead, quote, spec) {
            return lead + quote + url(resolve(path, spec)) + quote;
          })
          .replace(/(\bimport\s+)(["'])(\.[^"']*)\2/g, function (all, lead, quote, spec) {
            return lead + quote + url(resolve(path, spec)) + quote;
          });
      }

      function url(path) {
        if (published[path]) return published[path];
        if (pending[path]) throw new Error("Ciclo de importaciones: " + path);
        var code = sources[path];
        if (code === undefined) {
          throw new Error("El módulo no está en el bundle: " + path);
        }
        pending[path] = true;
        var rewritten = rewrite(code, path);
        delete pending[path];
        var blob = new Blob([rewritten], { type: "text/javascript" });
        published[path] = URL.createObjectURL(blob);
        return published[path];
      }

      import(url("__ENTRY__")).catch(function (error) {
        console.error("[observatorio] fallo al arrancar desde el bundle en línea:", error);
        var boot = document.getElementById("boot-log");
        if (boot) {
          boot.insertAdjacentHTML(
            "beforeend",
            '<p class="boot__line is-fail">no se pudo inicializar el bundle: ' +
              String(error && error.message) +
              "</p>"
          );
        }
        var screen = document.getElementById("boot-screen");
        if (screen) screen.classList.add("is-done");
      });
    })();
  </script>
'@
  $loader = $loader.Replace("__ENTRY__", $entryRel)

  # El tag del módulo declara su ruta relativa a la plantilla, que es la que
  # resuelve el navegador cuando la página se sirve por HTTP.
  $tagSrc = if ([string]::IsNullOrEmpty($templateDir)) { $entryRel } else { $entryRel.Substring($templateDir.Length + 1) }
  $referencia = "<script type=""module"" src=""$tagSrc""></script>"
  if ($html -notmatch [regex]::Escape($referencia)) {
    throw "$($target.Template): no se encontró la referencia al módulo $tagSrc."
  }

  $inline = ($datasetBlock + ($parts -join "`n") + "`n`n" + $loader).TrimEnd()
  $html = $html.Replace($referencia, $inline + "`n")
  $html = $html.Replace(
    "<head>",
    "<head>`n    <!-- Distribución de archivo único, generada por tools/bundle-standalone.ps1 -->"
  )

  # Los finales de línea se normalizan a LF. El bundle se regenera y se compara
  # byte a byte en CI (y con el modo -Check del ensamblador): si el resultado
  # dependiera del sistema donde se compila, la comprobación fallaría en Linux
  # sin que nada hubiera cambiado de verdad.
  $html = $html.Replace("`r`n", "`n")

  Write-Text $target.Output $html

  if (-not $Quiet) {
    $size = [System.IO.File]::ReadAllBytes((Join-Path $root $target.Output)).Length
    Write-Host "  $($target.Title.PadRight(22)) $($target.Output.PadRight(42)) $($moduleFiles.Count) módulos · $([math]::Round($size / 1KB, 1)) KB"
  }

  return [pscustomobject]@{ Output = $target.Output; Modules = $moduleFiles.Count; Bytes = [System.IO.File]::ReadAllBytes((Join-Path $root $target.Output)).Length }
}

$selected = if ($Set -eq "todos") { @("sitio", "auditoria") } else { @($Set) }

if (-not $Quiet) { Write-Host ""; Write-Host "  Empaquetado de archivo único" -ForegroundColor Cyan }

$built = foreach ($name in $selected) { New-Bundle $targets[$name] }

if (-not $Quiet) {
  Write-Host ""
  Write-Host "  Listo. Cada artefacto es autónomo: se puede abrir con doble clic." -ForegroundColor Green
  Write-Host ""
}

$built
