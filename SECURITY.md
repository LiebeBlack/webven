# Seguridad y reporte de errores

## Errores en las cifras

No es un problema de seguridad, pero es el reporte más importante que existe en
este repositorio. Abre un *issue* con la plantilla «Corrección de datos» e
incluye: el registro afectado (el `id` aparece en la tarjeta), el valor publicado,
el valor correcto, y la fuente con fecha de acceso.

Si el número está bien pero el lector puede malinterpretarlo, dilo también: un
dato correcto que induce a error es un error de este proyecto.

## Vulnerabilidades del sitio

El sitio es estático y no tiene servidor, base de datos, formularios ni
autenticación. La superficie real es pequeña y conviene acotarla:

- **Contenido inyectado.** Todo texto del dataset pasa por `escapeHtml` antes de
  llegar al DOM; no se usa `innerHTML` con datos sin escapar. Una cadena mal
  escapada en `data/database.json` es una vulnerabilidad, no un detalle
  cosmético.
- **Enlaces.** Las URL del dataset se validan con `safeUrl`, que rechaza
  esquemas ejecutables (`javascript:`, `data:`) antes de pintarlas.
- **Dependencias externas.** Solo dos CDN: Tailwind con versión fijada y Chart.js
  con integridad SRI verificada contra el archivo real. Si el CDN cambiara su
  contenido, el navegador bloquea el script y el sitio degrada a tablas.
- **Carga local.** El sitio no lee archivos del disco del visitante.
- **Flujo de despliegue.** Publica solo desde `main` y exige que la auditoría del
  dataset pase; un `push` que no valide no llega a producción.

Reporta cualquier cosa que contradiga lo anterior mediante un
[*issue* privado de seguridad](https://docs.github.com/es/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities)
o, si el repositorio lo tiene activado, por el canal de *Security → Report a
vulnerability*. Incluye los pasos para reproducirlo; si la reproducción depende
de un dato concreto del dataset, pega el registro, no una descripción.

Se responde en un plazo de días, no de horas: este proyecto lo mantiene un equipo
pequeño y sin guardia permanente.

## Fuera de alcance

- La exactitud de las cifras de terceros (se audita la trazabilidad, no el
  emisor).
- La disponibilidad de GitHub Pages.
- La interpretación financiera o legal del contenido: el documento no es
  asesoría, y así se advierte en cada página.
