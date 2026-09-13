# Historial de cambios

El proyecto usa versiones con fecha de dataset (`AAAA.MM`), porque lo que cambia
en un observatorio no es solo el código: casi siempre es el dato. Una versión
nueva del dataset implica revisar las cifras derivadas, y eso queda registrado
aquí.

## [1.0.0] — 2026-09-13 · dataset 2026.09

Primera entrega completa: sitio, dataset auditado y cadena de publicación.
Cifras de valuación al 2026-09-01.

**Datos**

- 20 bloques de primer nivel, 27 fuentes con editor y fecha de acceso, 545
  referencias a fuentes resueltas y 332 registros con capa de procedencia.
- Stock agregado, cinco bloques de instrumentos con sus tramos, 11 acreedores y
  sus comités, 14 casos arbitrales, 14 vías de ejecución, 27 mecanismos de
  recuperación evaluados, 16 instrumentos legales, 5 escenarios, 40 hechos en la
  cronología global, 14 medidas de sanción, 18 actores institucionales, 30
  entradas de glosario, 10 vigilancias y 10 vacíos declarados.
- Serie histórica 1990–2026 con 37 puntos anclados o interpolados, 15 eventos y
  tres administraciones (Caldera, Chávez, Maduro) ancladas a los mismos puntos.

**Modelo de procedencia**

- Cinco capas: `oficial`, `reportado`, `precedente`, `calculado`, `propuesta`.
  La capa `precedente` existe para no mezclar dos cosas distintas: un
  instrumento ya aplicado en otro país (Plan Brady, canje argentino de 2005) no
  es una cifra oficial venezolana, pero tampoco es una hipótesis teórica.

**Verificación**

- 33 comprobaciones automáticas, 54 de 54 cifras derivadas y 46 de 46
  sensibilidades recalculadas dentro de ±0,5 %, 0 fallas y 1 aviso (una fuente
  sin enlace directo).
- El dataset se mantiene en 10 fragmentos revisables y se ensambla de forma
  determinista; `-Check` verifica que lo publicado siga sincronizado con ellos.
- El respaldo embebido (`data/database.embedded.js`) se compara ruta por ruta
  contra `data/database.json`.

**Sitio**

- Documento único con 11 secciones, 13 visualizaciones (Chart.js más treemap,
  mapa de calor y gauge propios), 86 tarjetas expandibles accesibles, simulador
  de reestructuración con exportación a CSV, filtros por atributos de datos,
  paleta de comandos, citas por registro e informe de auditoría visible.
- Distribución de archivo único autocontenida, que ejecuta exactamente el mismo
  código que el sitio publicado.
- Entrega multiarchivo con rutas relativas, lista para un subdirectorio de
  GitHub Pages.

**Publicación**

- Flujo de trabajo que valida antes de desplegar, regenera los artefactos y
  comprueba que sigan siendo reproducibles; si algo no cuadra, el sitio anterior
  permanece publicado.
- Metadatos de repositorio: licencias (MIT para código, CC BY 4.0 para datos),
  cita académica, guía de contribución y canales para corregir cifras.

### Pendiente para 2026.12

- Cotejar el nominal exacto por tramo contra cada prospecto y escritura de
  emisión: hoy son estimaciones de trabajo, declaradas como tales.
- Añadir los casos arbitrales en curso que no tienen laudo firme, con su rango
  de reclamo, en una sección separada de las condenas ejecutables.
- Registrar la deuda interna en bolívares convertida, con el tipo de cambio
  declarado, para poder leerla junto al agregado externo.
