# Diccionario de datos

Estructura de `data/database.json`: 20 bloques de primer nivel. La fuente
autoritativa de las reglas es `js/data/contract.js` (qué se comprueba) y
`data/fragments/` (qué se edita). Los recuentos corresponden al dataset 2026.09.

## Convenciones generales

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | string | Único dentro de su colección; en minúsculas y con guiones |
| `tier` | string | Una de las cinco capas; obligatorio en todo registro con cifra |
| `source_ids` | string[] | Cada identificador debe existir en `sources` (el validador falla si no) |
| `as_of` | string (ISO) | Fecha de valuación del dato; por defecto la del dataset |
| `..._mm` | number | Millones de dólares, sin decimales salvo en cifras derivadas |
| `..._pct` | number | Porcentaje en base 100 (12 significa 12 %) |
| `note` | string | Por qué el dato es como es; el matiz que la cifra no dice |

Cualquier registro puede llevar un bloque `calc` (véase la sección final).

## 1. `meta` — objeto

Cabecera del dataset: `slug`, `title`, `short_title`, `subtitle`, `masthead`,
`version` (del cliente), `dataset_version` (con fecha), `generated_at`,
`valuation_date`, `currency`, `unit`, `locale`, `period`, `editorial_note`,
`disclaimer`, `methodology_summary`, `tiers` (catálogo de capas) y `scope_notes`
(reglas de perímetro y exclusiones).

## 2. `sources` — 27 registros

El ledger probatorio. `id` (S01…), `name`, `publisher`, `kind` (tribunal,
multilateral, medio, observatorio, oficial), `reliability`, `url`,
`published_at`, `accessed_at`, `note`. Una fuente sin URL directa se reporta
como aviso: es legible, pero no verificable con un clic.

## 3. `kpis` — 16 indicadores

`id`, `group` (stock, arbitral, macro, riesgo), `label`, `sublabel`, `value_mm`
o `unit` alternativo, `tier`, `as_of`, `source_ids`, `delta_yoy_pct`, `trend`,
`sparkline` (serie compacta para el gráfico en miniatura), `note`, `breakdown`
(composición de la tarjeta expandida) y, cuando corresponde, `calc`.

## 4. `debt_instruments` — objeto con 5 bloques

`basis_note`, `as_of`, `tier`, `source_ids` y `blocks`: bonos soberanos, PDVSA,
laudos, bilateral y proveedores. Cada bloque declara sus `tramos` (nominal
estimado por emisión o por acreedor), su capa y su nota. La suma de bloques debe
cuadrar con la serie histórica.

## 5. `creditors` — 11 acreedores

`id`, `name`, `type` (tenedor de bonos, fondo, litigante, Estado, multilateral),
`jurisdiction`, `exposure_mm`, `share_pct` (la suma debe dar 100), `status`,
`tier`, `leverage` (capacidad de bloqueo), `recovery_outlook` (`pct_estimate`,
`basis`), `instruments`, `source_ids`, `note`.

## 6. `creditor_committees` — 7 comités

`id`, `name`, `type`, `composition`, `agenda`, `status`, `leverage`, `tier`,
`source_ids`, `note`. Sirve para leer quién puede firmar un acuerdo y quién
puede bloquearlo.

## 7. `ratings_history` — 10 acciones

`id`, `date`, `agency`, `action` (degradación, retiro, cesación de pagos),
`rationale`, `tier`, `source_ids`.

## 8. `arbitration_cases` — 14 casos

`id`, `claimant`, `respondent`, `forum` (CIADI, CCI, tribunal ad hoc),
`case_number`, `sector`, `award_mm` (principal condenado), `award_date`,
`interest_rate_assumed_pct`, `award_total_mm` (**derivado**: principal más
interés acumulado, con `calc`), `tier`, `status`, `source_ids`, `annulment`
(estado del recurso), `calc` y `reconciliation` (contraste con las cifras
publicadas por otras fuentes).

## 9. `enforcement_map` — 14 vías de ejecución

`id`, `target` (activo o flujo perseguido), `claimant`, `type`, `jurisdiction`,
`value_mm`, `status`, `tier`, `source_ids`, `note`.

## 10. `historical_matrix` — objeto

`unit`, `note`, `dimensions` (5 ejes de comparación) y `administrations`
(Caldera 1994–1999, Chávez 1999–2013, Maduro 2013–presente). Cada
administración: `id`, `name`, `period`, `from`, `to`, `label`, `thesis`,
`context`, `debt_start_mm`, `debt_end_mm`, `growth_pct` (**derivado**, con
`calc` de método `growth`), `tier`, `indicators` (series comparables) y
`milestones`.

## 11. `historical_series` — objeto

`unit`, `tier`, `note`, `anchor_years` (años con cifra documentada),
`series_definitions`, `points` (37 años: `year`, `total_mm`, `tier`, `source_ids`
y `note` que indica si es ancla o interpolación) y `events` (15 shocks con
`date`, `label`, `severity`).

## 12. `recovery_mechanisms` — 27 mecanismos

`id`, `name`, `category` (legal, mercado, multilateral, activos), `status`,
`summary`, `description`, `legal_basis`, `capacity_mm` (techo estimado de
recuperación), `prerequisites`, `risks`, `precedent`, `fit_score` (1–5), `tier`
(normalmente `precedente` o `propuesta`), `source_ids`.

## 13. `legal_instruments` — 16 piezas

`id`, `name`, `jurisdiction`, `family`, `description`, `relevance`,
`application` (cómo se usaría en el caso venezolano), `tier`, `source_ids`.
Incluye cláusulas de acción colectiva, cláusula peruana, pari passu, doctrina
del acto soberano y fideicomisos extraterritoriales.

## 14. `scenarios` — objeto con 5 escenarios

`base_nominal_mm`, `valuation_date`, `unit`, `note` e `items`. Cada escenario:
`id`, `name`, `short`, `probability_pct` (suma 100), `haircut_pct`, `coupon_pct`,
`tenor_years`, `grace_years`, `discount_rate_pct`, `recovery_npv_mm`
(**derivado**), `recovery_pct_of_nominal` (**derivado**), `store_as`, `tier`,
`source_ids`, `rationale` y `calc` con su `schedule` de servicio anual.

## 15. `global_timeline` — 40 hechos

`id`, `date`, `category` (crisis, default, sanciones, legal, reestructuracion,
macroeconomia, dato), `title`, `detail`, `severity` (1–3), `tier`,
`source_ids`. Alimenta la cronología filtrable y la cinta de la cabecera.

## 16. `sanctions_regime` — 14 medidas

`id`, `date`, `actor` (OFAC, UE, Reino Unido, Canadá), `instrument`, `effect`,
`scope`, `tier`, `source_ids`. Se lee junto con el mapa de ejecución: una sanción
puede proteger un activo de un acreedor o impedirle cobrar.

## 17. `institutional_map` — 18 actores

`id`, `name`, `role`, `type`, `country`, `influence` (alta, media, baja), `tier`,
`source_ids`, `note`: quién decide, quién media y quién solo observa.

## 18. `glossary` — 30 términos

`term`, `category`, `definition`. Sin capa de procedencia: son definiciones, no
cifras.

## 19. `watchlist` — 10 indicadores

`id`, `indicator`, `current`, `threshold`, `direction`, `why`, `tier`,
`source_ids`: qué habría que ver para saber que algo está cambiando.

## 20. `data_gaps` — 10 vacíos declarados

`id`, `question`, `why_missing`, `impact`, `best_available`,
`recommended_action`, `tier`, `source_ids`. Un informe forense se define tanto
por lo que documenta como por lo que declara no poder documentar.

## El bloque `calc`

Convierte una cifra escrita en una cifra **auditable**:

```json
{
  "value_mm": 21401.73,
  "tier": "calculado",
  "calc": {
    "method": "compound_accrual",
    "target": "total_mm",
    "store_as": "value_mm",
    "formula": "A = P · (1 + r/n)^(n·t)",
    "params": { "principal_mm": 17370, "rate_pct": 6.5, "from": "2017-01-01", "to": "2026-09-01" },
    "assumptions": ["Tasa asumida por caso, declarada en su ficha"],
    "extra_outputs": [{ "target": "interest_mm", "store_as": "interest_mm" }],
    "sensitivity": [
      { "label": "Tasa del 4,5 %", "value_mm": 19600, "patch": { "rate_pct": 4.5 } }
    ]
  }
}
```

| Campo | Obligatorio | Regla |
| --- | --- | --- |
| `method` | sí | Uno de los registrados en `js/calc/methods.js` |
| `target` | sí | Salida del método que representa la cifra publicada |
| `store_as` | sí | Campo del registro donde vive el valor; sin esto el validador reporta el cálculo como no auditable |
| `params` | sí | Insumos exactos que usa la fórmula |
| `formula` | recomendado | Se muestra en la tarjeta expandible y en la caja de cálculo |
| `assumptions` | recomendado | Los supuestos que un lector necesita para disentir |
| `extra_outputs` | no | Otras salidas guardadas del mismo cálculo; se verifican igual |
| `sensitivity` | no | Alternativas con su `patch`; sin `patch` se reporta como no verificable |

El validador recalcula el método con `params` y compara contra el valor guardado
en `store_as` con tolerancia ±0,5 %. Si el resultado no cuadra, la publicación no
avanza.
