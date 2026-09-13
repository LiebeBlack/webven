# Guía de operación

Recetas concretas para las tareas que se repiten. Todas siguen el mismo orden:
**editar el fragmento, reensamblar, auditar, empaquetar**. Saltarse el paso de
auditoría no rompe el sitio: rompe la promesa del proyecto.

## 0. Preparación

```bash
git clone https://github.com/USUARIO/REPOSITORIO.git
cd REPOSITORIO
npm run serve          # abre http://localhost:5173/ (busca puerto libre)
```

No hay `npm install`: el proyecto no tiene dependencias.

## 1. Agregar un caso arbitral

1. Abrir `data/fragments/40-arbitration.json` y añadir el registro al arreglo
   `arbitration_cases`, con `id` único, `forum`, `award_mm`, `award_date`,
   `tier`, `source_ids` y nota. Si la fuente es nueva, primero se registra en
   `data/fragments/80-reference.json` y se usa su `id`.

2. Si el caso lleva interés acumulado, añadir el bloque de cálculo:
   el valor publicado va en el campo de destino y `calc.method` es
   `compound_accrual` con `target: "total_mm"` y `store_as` apuntando a ese
   campo. Se copian las fórmulas de `docs/METODOLOGIA.md`.

3. Reensamblar y auditar:

   ```bash
   npm run build:data
   npm run validate
   ```

4. Si el validador calcula un valor distinto al escrito, **no se ajusta el
   validador**: se corrige el valor o el supuesto, y se anota en `assumptions`
   por qué.

## 2. Corregir una cifra reportada

1. Cambiar el valor en su fragmento.
2. Buscar si alguna cifra derivada depende de ella:
   `grep -n "<valor>" data/fragments/*.json`. Los sumandos viven en
   `calc.params`, así que también conviene buscar por la etiqueta del ítem.
3. `npm run validate`: los derivados que queden desfasados se reportan con el
   valor guardado y el recalculado, con su desvío.
4. Anotar el cambio en `CHANGELOG.md` si afecta una cifra publicada.

## 3. Agregar un indicador (KPI)

En `data/fragments/10-kpis.json`: `id`, `group`, `label`, `sublabel`,
`value_mm`, `tier`, `as_of`, `source_ids`, `note` y, si es derivado, su bloque
`calc`. La rejilla del resumen se construye sola: no hay que tocar el HTML.

## 4. Agregar una sección al documento

1. `js/render/mi-seccion.js` con una función que **devuelva una cadena** de
   HTML, usando las piezas de `js/render/parts.js`.
2. Registrar el contenedor en `CONTAINERS` de `js/config.js`.
3. Añadir el `<section>` y su contenedor vacío en `index.html`, con `id`
   coincidente y un ancla en `SECTIONS` para la navegación y la paleta.
4. Montarla en `js/app.js` con `section("Etiqueta", "claveContenedor", ...)`.
5. `npm run build:bundle` y abrir `dist/observatorio-standalone.html` para
   comprobar que también monta en la distribución de archivo único.

## 5. Agregar un método de cálculo

1. Escribirlo en `js/calc/methods.js` como función pura: recibe `params` y un
   `target`, devuelve `{ value, outputs }`.
2. Registrarlo en el objeto `METHODS` del mismo archivo.
3. Usarlo en el dataset. El validador lo recoge sin cambios; la caja de cálculo
   de la interfaz muestra su fórmula si se declara en `calc.formula`.
4. Añadir un caso de prueba en `tests/` que verifique el método con un ejemplo
   resuelto a mano (una calculadora basta) y anotar el resultado esperado.

## 6. Publicar

```bash
npm run validate          # debe salir con código 0
npm run build             # reensambla y empaqueta
git add -A && git commit -m "Actualiza el stock tras la revisión de X"
git push
```

El flujo de GitHub Actions valida, regenera los artefactos, comprueba que lo
versionado sea reproducible y despliega. Si algo falla, el sitio anterior sigue
publicado.

## 7. Qué no hacer

- **No editar** `data/database.json` ni `data/database.embedded.js` a mano: son
  artefactos generados y el CI detecta la divergencia.
- **No añadir** una cifra sin `tier` ni `source_ids`.
- **No convertir** una cifra calculada en un número escrito a mano «porque ya lo
  calculé»: el bloque `calc` es lo que permite auditarla mañana.
- **No ajustar** la tolerancia del validador para que pase un cálculo: la
  tolerancia absorbe redondeo, no errores conceptuales.
