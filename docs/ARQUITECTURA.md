# Arquitectura

Documento de referencia para quien vaya a modificar el observatorio. El README
explica qué es el proyecto; aquí se explica cómo está construido y por qué.

## 1. Principio rector

El proyecto tiene una sola obsesión y de ella se derivan todas las decisiones:
**que ninguna cifra publicada pueda quedar sin origen ni sin verificación**. La
estética, la separación de archivos y la cadena de publicación existen para
servir a esa idea, no al contrario.

De ahí tres reglas que no se negocian:

1. Ningún número se escribe dos veces. Si una cifra se puede derivar de otras,
   se declara con su fórmula y se recalcula.
2. Ningún número se muestra sin su capa de procedencia y su fuente.
3. Ningún fallo de una parte puede vaciar el documento entero.

## 2. Capas del sistema

```
        data/fragments/*.json          ← se edita aquí (10 fragmentos temáticos)
                  │
      tools/build-database.ps1         ← ensambla, valida forma, detecta claves duplicadas
                  │
        data/database.json  ──┬────────→ data/database.embedded.js (mismo contenido, módulo ES)
                              │
        js/data/loader.js ────┘          ← cadena de respaldo con origen declarado
                  │
        js/data/contract.js              ← auditoría del contrato de datos
                  │
   ┌──────────────┼───────────────────────────────┐
   │              │                               │
js/calc/     js/render/* + js/charts.js      tests/validate.html
(fórmulas)   (HTML y visualizaciones)        (auditoría visible)
   │              │
   └──────┬───────┘
          │
      js/app.js                      ← montaje aislado por sección
          │
      index.html                     ← contenedores vacíos, sin lógica
```

`tools/validate.mjs` recorre la misma ruta que el navegador —de `contract.js`
hacia abajo— pero desde Node, y es el portero del despliegue.

## 3. Mapa de módulos

| Módulo | Responsabilidad | No debe hacer |
| --- | --- | --- |
| `js/config.js` | Contenedores del DOM, capas, umbrales, paleta, supuestos del simulador | Tocar el DOM ni los datos |
| `js/format.js` | Formato es-VE, escapado de HTML, citas, CSV | Conocer el dataset |
| `js/calc/methods.js` | Fórmulas puras (suma, ratio, crecimiento, interés acumulado, VPN, rendimiento implícito) | Tocar el DOM o el dataset completo |
| `js/calc/index.js` | Recálculo y verificación de un bloque `calc` | Renderizar |
| `js/data/loader.js` | Carga con respaldo en cadena y origen declarado | Interpretar el contenido |
| `js/data/contract.js` | Contrato y auditoría del dataset | Depender del navegador |
| `js/render/parts.js` | Piezas reutilizables: insignias, tablas, cajas de cálculo, citas | Decidir qué se muestra |
| `js/render/*.js` | Una sección cada uno: devuelve HTML como cadena | Escribir en el DOM directamente |
| `js/charts*.js` | Definición y ciclo de vida de las visualizaciones | Calcular cifras propias |
| `js/app.js` | Orquesta la carga, el montaje y el arranque | Contener lógica de formato |

La separación se sostiene en un detalle práctico: los módulos de `render/`
**devuelven cadenas**, y solo `app.js` las escribe en el documento. Así un error
de un render se puede capturar sin que media página quede a medio construir.

## 4. Montaje aislado por sección

Cada sección se monta con `section(etiqueta, contenedor, productor)`. Si el
productor lanza una excepción, se registra y se dibuja un panel de error en su
lugar (`renderSectionError`), con el mensaje técnico a la vista. El resto del
documento sigue siendo válido y la barra de arranque informa cuántas secciones
fallaron. Un error de datos en los arbitrajes no puede dejar sin contenido el
mapa de acreedores.

## 5. Cadena de carga y procedencia del origen

`js/data/loader.js` intenta, en este orden, y **declara cuál usó**:

1. `window.__OBS_DATABASE__` — dataset embebido en la página (distribución de
   archivo único). Si está, no se hace ninguna petición de red.
2. `data/database.json` — la fuente normal del sitio publicado.
3. `data/database.embedded.js` — módulo ES con el mismo contenido, para cuando
   el `fetch` falla (caché intermedia, red corporativa que bloquea `.json`).
4. Estructura mínima vacía, que no contiene ninguna cifra y explica el fallo en
   lugar de aparentar normalidad.

El origen elegido aparece en la cabecera, en el pie y en la sonda de arranque.
Una carga degradada se ve como degradada.

## 6. Contrato de datos

`js/data/contract.js` es el único archivo que conoce la forma completa del
dataset y no depende del navegador, de modo que el mismo código audita en la
página y en CI. Devuelve secciones con estado (`pass`/`warn`/`fail`), la lista
de errores y estadísticas de cobertura. Una `fail` hace que
`tools/validate.mjs` salga con código 1 y que el despliegue no avance.

## 7. Visualizaciones

Trece vistas sobre los mismos registros. Doce son fijas y una pertenece al
simulador. Todas comparten paleta, escalas declaradas y una versión tabular
accesible; tres no usan Chart.js —treemap, mapa de calor y gauge— porque la
librería no cubre bien esos casos y una dependencia menos es una excusa menos.

Si Chart.js no carga (CDN bloqueado, SRI que no cuadra), cada panel conserva su
tabla: no existe un gráfico que sea la única vía al dato.

## 8. Distribución de archivo único, sin bundler

`tools/bundle-standalone.ps1` produce dos artefactos autocontenidos: el sitio
(`dist/observatorio-standalone.html`) y la auditoría
(`dist/validate-standalone.html`). El método evita escribir un bundler propio
que pudiera divergir del código fuente: cada módulo viaja como texto dentro del
documento, y un cargador mínimo crea un Blob URL por módulo resolviendo el grafo
en profundidad y reescribiendo los especificadores relativos a su Blob URL. El
resultado ejecuta **el mismo código**, sin transformaciones.

## 9. Determinismo y artefactos

`data/database.json`, `data/database.embedded.js` y los bundles se regeneran y
se publican. Para que eso sea fiable:

- el ensamblado es concatenación textual determinista de los fragmentos (no se
  reserializa con `ConvertTo-Json`, que convertiría cada acento en `\u00XX` y
  dejaría el archivo publicado ilegible para revisión humana);
- todos los archivos de texto usan LF (`.gitattributes`), porque si el
  resultado dependiera del sistema donde se compila, la comparación en CI
  fallaría sin que nada cambiara;
- los scripts de PowerShell se guardan con BOM UTF-8: Windows PowerShell 5.1
  interpreta un `.ps1` sin BOM como ANSI, y ahí una raya o una comilla tipográfica
  puede romper el archivo entero;
- el CI regenera y compara: si lo versionado no coincide con lo reconstruido, la
  publicación se detiene.

## 10. Accesibilidad

- HTML semántico, un solo `h1`, jerarquía de encabezados coherente.
- Tarjetas expandibles con botón real, `aria-expanded`, `aria-controls` y
  contenido colapsado fuera del árbol de accesibilidad; funcionan sin
  JavaScript (abiertas por defecto y cerradas solo cuando el cliente arranca).
- Regiones `aria-live` para avisos y anuncios; foco visible con color propio.
- Las capas de procedencia nunca se distinguen solo por color: llevan etiqueta.
- Cada gráfico tiene su tabla equivalente con `caption` y cabeceras `scope`.

## 11. Rendimiento

- Sin dependencias de ejecución ni paso de compilación; dos CDN en total.
- Secciones largas con `content-visibility: auto`.
- Los gráficos se destruyen al salir del documento y se re-dimensionan en
  ráfagas de `requestAnimationFrame`, no en cada evento de scroll.
- `prefers-reduced-motion` desactiva animaciones y transiciones.

## 12. Checklist de publicación

Antes de publicar, sustituir el marcador `usuario.github.io/observatorio-deuda-soberana-ve`
por la dirección real. Aparece en cuatro sitios:

- `index.html` (`<link rel="canonical">` y metadatos `og:`/`twitter:`)
- `robots.txt` (línea `Sitemap`)
- `sitemap.xml` (dos `loc`)
- `package.json` (`homepage`) y `CITATION.cff` (`repository-code`, `url`)

Después: *Settings → Pages → Source: GitHub Actions* y hacer `push` a `main`. El
flujo valida, regenera y despliega. Si la auditoría falla, el sitio anterior
sigue publicado.
