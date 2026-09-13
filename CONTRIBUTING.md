# Cómo contribuir

Gracias por tomarte el tiempo. En un proyecto de datos financieros, una
corrección vale más que una función nueva: si una cifra está mal, o está bien
pero sin fuente, eso es más importante que cualquier añadido.

## Lo que se agradece (en orden de utilidad)

1. **Correcciones de datos con fuente.** Un monto equivocado, una fecha mal
   puesta, un laudo anulado que sigue contando como firme. Adjunta el documento
   o el enlace: sin fuente no se puede verificar, y lo que no se verifica no
   entra.
2. **Fuentes nuevas para vacíos declarados.** El sitio publica 10 preguntas sin
   respuesta verificable en la sección «Agenda de vacíos». Cerrar una de ellas
   es la contribución más valiosa que existe aquí.
3. **Mejoras de accesibilidad y de lectura.** Contraste, navegación con teclado,
   etiquetado, claridad del texto.
4. **Corrección de errores del sitio.** Enlaces rotos, gráficos que no cuadran
   con su tabla, texto que se corta en pantalla angosta.

## Antes de abrir un pull request

```bash
npm test        # auditoría del dataset: debe salir con código 0
npm run build   # reensambla el dataset y los artefactos de dist/
```

Los tres puntos que el CI comprueba y que conviene tener presentes:

- ningún registro con cifra puede quedarse sin `tier` ni `source_ids`;
- toda cifra derivada debe traer su bloque `calc` con `params` y `store_as`, y
  el validador la recalcula (tolerancia ±0,5 %);
- los artefactos generados deben coincidir con los fragmentos:
  `data/database.json` y `data/database.embedded.js` se regeneran, nunca se
  editan a mano.

El detalle del procedimiento está en [`docs/GUIA-DE-OPERACION.md`](docs/GUIA-DE-OPERACION.md).

## Estilo del dato

- **Idioma**: español de Venezuela, con las cifras en formato local.
- **Idioma del código**: comentarios en español, nombres en inglés cuando son
  términos de programación (`store_as`, `tier`, `hash`).
- **Tono**: institucional, sobrio, sin adjetivos que vendan una conclusión. El
  observatorio describe y demuestra; no editorializa por encima de lo que las
  fuentes sostienen.
- **Nombres de archivo**: en minúsculas y con guiones.

## Firma de los cambios

Cada cifra nueva declara quién la introduce y cuándo se accedió a la fuente: eso
va en el registro (`source_ids`, `accessed_at`), no en el mensaje del commit. El
commit explica **por qué** cambia el dato, no el dato en sí.

## Licencias de lo que aportes

Al contribuir aceptas que el código quede bajo MIT y los datos bajo CC BY 4.0,
igual que el resto del repositorio.
