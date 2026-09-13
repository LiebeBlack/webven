# Observatorio Arquitectónico de la Deuda Soberana de Venezuela

Sitio de investigación financiera forense sobre la deuda externa venezolana:
la arquitectura de la acreencia (quién tiene qué, con qué garantía y en qué
tribunal), la reconstrucción de la serie histórica 1990–2026, el mapa de laudos
arbitrales, el ingenio de recuperación disponible y el estado de ejecución de
las sentencias.

El sitio es estático —HTML, CSS y módulos ES, sin paso de compilación y sin
dependencias en tiempo de ejecución— pero no es un folleto: cada cifra declara
su procedencia, y **toda cifra derivada se recalcula en una auditoría
automática** que cualquiera puede ejecutar. Si un insumo cambia y el resultado
no se actualiza, la auditoría falla y la publicación se detiene.

- Código: **MIT** (véase [`LICENSE`](LICENSE))
- Datos: **CC BY 4.0** (véase [`data/LICENSE.md`](data/LICENSE.md))
- Idioma del documento: español (es-VE)

---

## 1. Qué es y qué no es

**Es** un documento de trabajo reproducible. La distinción central es que el
proyecto no pide confianza: pide verificación. Cada registro lleva su fuente, su
fecha de acceso y su capa de procedencia, y las cifras que el observatorio
calcula por su cuenta vienen con la fórmula, los insumos y el resultado
recalculado por una segunda vía.

**No es** asesoría financiera, legal ni fiscal, y no es un boletín oficial. El
país está en cesación de pagos selectiva desde 2017 y no publica un agregado
consolidado de deuda externa, de modo que varios totales son reconstrucciones
con supuestos declarados. Los importes por tramo son estimaciones de nominal
pendiente, no saldos certificados: esa tarea exige cotejar cada prospecto o
escritura de emisión y está marcada como pendiente en la agenda de vacíos del
propio sitio.

---

## 2. Las cinco capas de procedencia

Es la decisión de arquitectura que ordena todo lo demás. Un número no es
«dato» sin más: se publica con la capa a la que pertenece.

| Capa | Significado | Ejemplo |
| --- | --- | --- |
| `oficial` | Documental: lo publica la entidad emisora, un tribunal o un organismo multilateral | Laudo del CIADI, acta de comité de acreedores, licencia de OFAC |
| `reportado` | Difundido por un tercero identificable, sin acto administrativo ni judicial | Estimación de un banco de inversión sobre el stock en default |
| `precedente` | Aplicado en otra reestructuración soberana verificable, no en Venezuela | Plan Brady de 1989, canje argentino de 2005, CAC agregada |
| `calculado` | Derivado por el observatorio con fórmula explícita y recalculable | Interés acumulado de un laudo, VPN de recuperación, ratio deuda/exportaciones |
| `propuesta` | Instrumento teórico, sin precedente aplicado en ningún país | Fideicomiso de recuperación con flujo petrolero pignorado |

La capa se comunica con **etiqueta y color**, nunca solo con color, y aparece
en la tarjeta, en la tabla y en la cita de cada registro. Un total no hereda la
capa de sus partes: se declara la suya.

---

## 3. Estructura del repositorio

```
.
├── index.html                  Estructura semántica del documento
├── css/
│   ├── tokens.css              Variables: color, tipografía, espacio, movimiento
│   ├── styles.css              Componentes, tarjetas expandibles, gráficos
│   └── print.css               Versión impresa (tarjetas abiertas, sin pantalla)
├── js/
│   ├── app.js                  Punto de entrada: carga, montaje aislado, arranque
│   ├── config.js               Contenedores, capas, umbrales, paleta, supuestos
│   ├── format.js               Formato es-VE, escapado, citas, CSV
│   ├── calc/                   Motor de cálculo (fórmulas auditables)
│   ├── data/                   Cargador con cadena de respaldo + contrato de datos
│   ├── render/                 Un módulo por sección del documento
│   ├── charts/                 Plugins de Chart.js, mapa de calor y treemap propios
│   ├── charts.js               Las diecinueve visualizaciones y su ciclo de vida
│   ├── expandable.js           Lógica de tarjetas expandibles (accesible)
│   ├── filters.js              Filtros por atributos de datos
│   ├── simulator.js            Simulador de reestructuración (gráfico + CSV)
│   └── ui.js                   Progreso, paleta de comandos, citas, avisos
├── data/
│   ├── database.json           Dataset publicado (el que consume el sitio)
│   ├── database.embedded.js    Mismo contenido como módulo ES (respaldo)
│   ├── fragments/              Fuente de verdad revisable, 10 archivos
│   └── LICENSE.md              Licencia de los datos y atribución sugerida
├── tests/
│   ├── validate.html           Auditoría visible en el navegador
│   └── validate-entry.js       Punto de entrada de esa auditoría
├── tools/
│   ├── build-database.ps1      Ensambla el dataset desde los fragmentos
│   ├── bundle-standalone.ps1   Empaqueta en un único .html autocontenido
│   ├── serve.ps1               Servidor estático local (HttpListener, sin dependencias)
│   └── validate.mjs            Portero de validación en CI (Node, sin npm install)
├── docs/
│   ├── ARQUITECTURA.md         Capas del sistema, módulos y decisiones de diseño
│   ├── METODOLOGIA.md          Fórmulas, perímetro del agregado y tolerancias
│   ├── DICCIONARIO-DE-DATOS.md Los 20 bloques y el patrón `calc`, campo por campo
│   └── GUIA-DE-OPERACION.md    Recetas: agregar un laudo, corregir una cifra, publicar
├── assets/
│   ├── favicon.svg             Marca vectorial (la misma del favicon embebido)
│   └── og-cover.svg            Tarjeta social de 1200×630
├── site.webmanifest            Manifiesto de aplicación web (en la raíz: las rutas
│                               del manifiesto se resuelven respecto a él mismo)
├── dist/                       Artefactos de archivo único (generados)
├── 404.html                    Página de error con raíz deducida
├── robots.txt · sitemap.xml    Rastreo e indexación
├── .github/                    Flujo de Pages, plantillas de issue y de PR
├── CONTRIBUTING.md · CODE_OF_CONDUCT.md · SECURITY.md
├── CITATION.cff · CHANGELOG.md Metadatos de cita e historial de versiones
└── package.json                Solo scripts: el proyecto no tiene dependencias
```

La documentación profunda vive en [`docs/`](docs): qué calcula el observatorio y
con qué fórmulas ([METODOLOGIA.md](docs/METODOLOGIA.md)), cómo está construido y
por qué ([ARQUITECTURA.md](docs/ARQUITECTURA.md)), qué significa cada campo
del dataset ([DICCIONARIO-DE-DATOS.md](docs/DICCIONARIO-DE-DATOS.md)) y cómo se
opera ([GUIA-DE-OPERACION.md](docs/GUIA-DE-OPERACION.md)).

---

## 4. Cómo se ejecuta

Tres formas, de la más cómoda a la más controlada.

**a) Servidor local (recomendado para desarrollar).** El sitio usa módulos ES y
`fetch()` del dataset; abrir `index.html` con doble clic no funciona por las
reglas de origen del navegador. `tools/serve.ps1` levanta un servidor estático
sin instalar nada (usa `HttpListener` de .NET):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1 -Open
# abre http://localhost:5173/ (busca el primer puerto libre si está ocupado)
```

**b) Archivo único, sin servidor ni red de datos.**
`dist/observatorio-standalone.html` lleva dentro el CSS, el dataset y **los 26
módulos**: no hace ni una sola petición de datos (solo las tipografías y
Chart.js vienen de CDN). En navegadores basados en Chromium se abre con doble
clic; si el navegador bloquea los módulos ES bajo `file://` (Firefox), sirve el
archivo con `tools/serve.ps1` o publícalo en Pages — la propia página lo detecta
y lo explica en lugar de quedarse en la pantalla de carga. Se regenera con:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/bundle-standalone.ps1 -Set todos
```

**c) GitHub Pages.** Véase la sección 8.

---

## 5. Cómo se valida

La validación es el corazón del proyecto, no un extra. Hay tres formas de
ejecutarla y las tres llaman a la misma función de contrato
(`js/data/contract.js`).

```bash
node tools/validate.mjs        # informe en terminal; código de salida 1 si hay fallas
npm test                       # equivalente
```

En el navegador: `tests/validate.html` (necesita servidor, para revisar el
cambio en curso) o `dist/validate-standalone.html` (archivo único, se puede
compartir y abrir sin montar nada).

Qué comprueba:

1. **Estructura** — bloques obligatorios y arreglos con contenido.
2. **Fuentes** — identificadores únicos, editor y fecha de acceso; aviso si una
   fuente no tiene enlace directo.
3. **Trazabilidad** — cada referencia `source_ids` del documento resuelve a una
   fuente existente.
4. **Capas** — solo las cinco declaradas en el catálogo, con su distribución.
5. **Identificadores** — sin duplicados dentro de cada colección.
6. **Porcentajes** — participación de acreedores y probabilidad de escenarios
   suman 100.
7. **Bloques de deuda** — cada bloque cuadra con sus tramos y con la serie.
8. **Cálculo derivado** — cada cifra `calculado` se recalcula con su fórmula y
   se compara con el valor publicado (tolerancia ±0,5 % para absorber el
   redondeo a millones).
9. **Sensibilidades** — cada escenario alternativo declarado se recalcula
   alterando el parámetro que declara; los que no declaran parámetro se
   reportan como no verificables en lugar de ignorarse.
10. **Escenarios e historial** — recuperación sobre nominal coherente y
    administraciones ancladas a los mismos puntos de la serie.
11. **Respaldo** — `data/database.embedded.js` idéntico a `data/database.json`.

Estado actual: **33 comprobaciones, 0 fallas, 1 aviso** (una fuente sin enlace
directo), con 54 de 54 cifras derivadas y 46 de 46 sensibilidades recalculadas
dentro de tolerancia.

---

## 6. El modelo de datos

`data/database.json` (≈219 KB, 20 bloques de primer nivel). Un registro típico:

```json
{
  "id": "conocophillips-ciadi",
  "tier": "oficial",
  "as_of": "2026-09-01",
  "source_ids": ["S05", "S13"],
  "principal_mm": 8366,
  "note": "Laudo del CIADI con intereses compuestos…"
}
```

Una cifra derivada no se escribe: se **declara con su método** y el validador la
recalcula. Este es el patrón que sostiene la capa `calculado`:

```json
{
  "value_mm": 17370,
  "tier": "calculado",
  "calc": {
    "method": "sum",
    "target": "total_mm",
    "store_as": "value_mm",
    "formula": "Principal = Σ principal de cada laudo firme",
    "params": { "items": [ { "label": "ConocoPhillips (CIADI)", "value_mm": 8366 } ] },
    "assumptions": ["Se toma el valor de condena tal como fue dictado…"],
    "sensitivity": [
      { "label": "Solo casos ICC", "value_mm": 2907, "patch": { "items": [ { "label": "ConocoPhillips (ICC)", "value_mm": 2000 } ] } }
    ]
  }
}
```

Métodos disponibles (`js/calc/methods.js`): `sum`, `ratio`, `growth`,
`compound_accrual` (interés acumulado), `recovery_npv` (VPN de recuperación) e
`implied_yield` (rendimiento implícito). Añadir un método es escribir la función
pura, registrarla y usar su nombre en el dataset: el validador la recoge sola.

### La ruta segura para agregar o corregir datos

```bash
# 1. Editar el fragmento correspondiente (data/fragments/*.json)
# 2. Reensamblar el dataset publicado y su respaldo embebido
npm run build:data
# 3. Auditar (esto es lo que bloquea la publicación)
npm run validate
# 4. Regenerar los archivos únicos de dist/
npm run build:bundle
```

El ensamblado es determinista y verifica dos cosas antes de escribir: que cada
fragmento sea JSON válido y que no haya claves de primer nivel duplicadas entre
fragmentos. `npm run build:data:check` comprueba que lo publicado esté
sincronizado con los fragmentos, que es lo que exige el CI.

---

## 7. Decisiones de arquitectura

**Separación estricta de responsabilidades.** Datos, estilos y lógica viven en
archivos distintos; dentro de la lógica, `calc/` no conoce el DOM, `data/` no
conoce la interfaz, `render/` produce cadenas de HTML y nadie más las produce.
`js/config.js` centraliza contenedores, umbrales y capas, de modo que cambiar la
maquetación no obliga a tocar la lógica.

**Montaje aislado por sección.** Cada sección se monta dentro de un
`try/catch`; si una falla, muestra su error en su sitio y el resto del documento
sigue en pie. Un error de datos en el apartado arbitral no puede vaciar la
página.

**Cadena de carga con procedencia declarada.** `js/data/loader.js` intenta, en
orden: dataset embebido en la página (`window.__OBS_DATABASE__`), JSON publicado,
módulo ES embebido y, como último recurso, una estructura vacía que explica el
fallo. En todos los casos la interfaz dice de dónde salieron los datos.

**Sin dependencias en tiempo de ejecución.** Tailwind se carga como utilidades
fijadas a una versión concreta y Chart.js con integridad verificada por SRI
(calculada sobre el archivo real del CDN). Si Chart.js no carga, cada
visualización conserva su tabla: no hay gráfico que sea la única vía al dato.

**Empaquetado sin bundler.** `tools/bundle-standalone.ps1` publica cada módulo
como texto dentro del documento y un cargador mínimo los registra como Blob URLs
reescribiendo los especificadores relativos. Así el archivo único ejecuta
**el mismo código** que el sitio publicado, sin transformaciones ni duplicados
que puedan divergir.

---

## 8. Publicar en GitHub Pages

1. **Crear el repositorio y subir el contenido** (rama `main`):

   ```bash
   git init
   git add .
   git commit -m "Observatorio de la deuda soberana de Venezuela"
   git branch -M main
   git remote add origin https://github.com/USUARIO/REPOSITORIO.git
   git push -u origin main
   ```

2. **Activar Pages**: *Settings → Pages → Build and deployment → Source:
   GitHub Actions*. El flujo de [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
   se encarga del resto en cada `push`: valida el dataset, verifica que los
   artefactos versionados sean reproducibles y despliega la raíz del
   repositorio. Si la validación falla, no se publica y el sitio anterior
   permanece en línea.

3. **Sustituir el dominio de marcador.** El proyecto publica rutas relativas,
   así que funciona igual en `usuario.github.io/repositorio/` que en un dominio
   propio, pero hay cuatro archivos donde vive la dirección absoluta: `index.html`
   (`canonical` y `og:`), `robots.txt`, `sitemap.xml`, y `package.json` con
   `CITATION.cff`. Está listado en el
   [checklist de publicación](docs/ARQUITECTURA.md#12-checklist-de-publicación).

4. **Páginas auxiliares**: `404.html` deduce la raíz del sitio por sí sola (sirve
   para un sitio de proyecto y para un dominio propio), `robots.txt` y
   `sitemap.xml` ordenan la indexación y `assets/` reúne la marca. La tarjeta
   social es el SVG de `assets/og-cover.svg`; algunas redes sociales solo
   aceptan PNG o JPEG, así que conviene exportarla una vez y apuntar ahí la
   etiqueta `og:image`.

No se necesita `npm install`: el runner ya trae Node para la validación y
PowerShell Core (`pwsh`) para regenerar los artefactos.

---

## 9. Accesibilidad, impresión y rendimiento

- HTML semántico, `aria-expanded`/`aria-controls` en las tarjetas, regiones
  `aria-live` para los avisos, foco visible y enlace de salto al contenido.
- La distinción de capas no depende del color; las tablas son la versión
  accesible de cada gráfico y todas tienen `caption` y cabeceras con `scope`.
- Impresión: `css/print.css` abre las tarjetas, oculta la navegación y los
  controles, y evita cortar tablas por la mitad. El resultado es un informe
  legible en papel.
- Rendimiento: las secciones largas usan `content-visibility: auto`, los
  gráficos se destruyen al salir del documento y `Chart.js` solo se inicializa
  una vez; no hay fuentes de bloqueo ni imágenes pesadas.

---

## 10. Cómo citar

Cada cifra del sitio tiene un botón de cita que copia una referencia con la
fecha de valuación, la versión del dataset y las fuentes concretas de ese
registro. Para el documento completo:

> Observatorio Arquitectónico de la Deuda Soberana de Venezuela. *Dataset
> 2026.09: arquitectura de la acreencia, laudos arbitrales y mecanismos de
> recuperación*. Información del Mercantil Venezolano, 2026. CC BY 4.0.

Se cita un registro, no un agregado: atribuir un total sin sus insumos impide
reproducirlo, que es justamente lo que este observatorio existe para permitir.
