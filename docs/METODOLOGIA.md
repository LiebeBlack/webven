# Metodología

Qué se calcula, con qué fórmula, con qué supuesto y qué queda fuera. Este
documento existe para que cualquiera pueda discutir un criterio concreto en
lugar de la conclusión entera.

## 1. Criterio de procedencia

Antes de cualquier número hay una pregunta: ¿de dónde sale? El observatorio
admite cinco respuestas y ninguna más.

| Capa | Cuándo se usa | Qué NO permite hacer |
| --- | --- | --- |
| `oficial` | Acto de la entidad emisora, tribunal o multilateral: laudos, decisiones de anulación, licencias, actas de comités, boletines | No se extiende a un agregado que nadie publicó |
| `reportado` | Tercero identificable: prensa especializada, banca de inversión, observatorios, comités | No se presenta como acto administrativo ni judicial |
| `precedente` | Instrumento o doctrina ya aplicado en otra reestructuración soberana verificable | No se presenta como situación venezolana |
| `calculado` | Derivado por el observatorio con fórmula explícita y recalculable | No se presenta como valor oficial |
| `propuesta` | Diseño de política o instrumento sin aplicación consumada en ningún país | No se presenta como hecho observable |

Un total **no hereda** la capa de sus partes: declara la suya. Si un agregado se
construye sumando laudos, su capa es `calculado` aunque cada laudo sea `oficial`,
porque la suma y el perímetro son decisión del observatorio.

## 2. Fórmulas

Todas viven en `js/calc/methods.js` como funciones puras y se ejecutan dos
veces: al publicar la cifra y al auditarla.

**Interés acumulado de una condena** (`compound_accrual`). Base del tramo
arbitral: los laudos devengan intereses y ese devengo es la partida que más
presiona cualquier negociación.

```
A = P · (1 + r/n)^(n·t)
```

`P` principal de la condena · `r` tasa asumida declarada por caso · `n`
capitalizaciones por año (1 salvo indicación) · `t` años entre la fecha del
laudo y la de valuación, en base 365,25. El resultado expone `total_mm`,
`interest_mm` y `t_years`; la tasa asumida y su origen se declaran caso por caso
y el validador recalcula el acumulado con esa misma tasa.

**Valor presente de una recuperación** (`recovery_npv`). Es el modelo que
compara escenarios, y responde una sola pregunta: cuánto vale hoy, para un
acreedor, lo que se le ofrece.

```
Nominal reestructurado   R = N · (1 − h)
Cupón por período        C = R · c
VPN = Σ_{i=g+1}^{g+T} C/(1+d)^i  +  R/(1+d)^(g+T)
```

`N` nominal base · `h` quita · `c` cupón · `T` plazo · `g` años de gracia ·
`d` tasa de descuento. Devuelve además `recovery_pct_of_nominal` (VPN sobre
nominal original) y el calendario anual completo, que es lo que alimenta el
gráfico del simulador. La tasa de descuento (11–13 % en los escenarios) refleja
el costo de oportunidad de un acreedor que cobra en un país sin acceso a
mercados: **no es la tasa a la que el Estado podría financiarse, es la que exige
quien asume el riesgo de no cobrar**.

**Rendimiento implícito** (`implied_yield`). Para leer los precios de mercado de
los bonos en default: resuelve por bisección la tasa que iguala el valor presente
de los flujos prometidos al precio observado. Se usa bisección y no Newton porque
un precio bajo la par garantiza monotonía estricta y la bisección no diverge.

```
Σ C/(1+y)^i + 100/(1+y)^n = P
```

**Ratio** y **crecimiento** son divisiones y variaciones simples, pero se
declaran igual: por el numerador, el denominador y la fuente de cada uno.

## 3. Reconstrucción de la serie histórica 1990–2026

Venezuela no publica un agregado consolidado de deuda externa. La serie se
reconstruyó así:

1. **Anclas documentadas**: 1990–1998, 2013, 2024 y 2026 se fijan con cifras
   citadas a una fuente concreta y llevan su capa.
2. **Interpolación lineal** entre anclas para el resto de los años, marcada punto
   a punto como `calculado` y con la nota de que es interpolación, no medición.
3. **Consistencia obligatoria**: cada bloque de instrumentos debe cuadrar con la
   serie, y cada administración debe anclar su deuda inicial y final a los
   mismos puntos. El validador comprueba ambas cosas; una discrepancia se
   reporta como aviso con los dos valores a la vista.

La interpolación es un supuesto y se declara como tal: sirve para leer
trayectorias, no para citar el año exacto de un cambio.

## 4. Qué entra y qué no entra en el agregado

Reglas de perímetro, todas declaradas en `meta.scope_notes`:

- **No** se suman los intereses moratorios devengados y no capitalizados, ni las
  acreencias arbitrales dentro del agregado de deuda: se presentan aparte como
  exposición contingente, porque su reconocimiento depende de un proceso que
  puede terminar en anulación o acuerdo.
- **No** se incluye la deuda interna en bolívares, salvo el tramo reconocido en
  moneda extranjera.
- Las acreencias de proveedores entran por **valor de reclamo declarado**, no
  por valor de mercado.
- El nominal por tramo es una **estimación de trabajo**: el nominal exacto exige
  cotejar cada prospecto o escritura de emisión, y esa tarea está marcada como
  pendiente en la agenda de vacíos del sitio.

## 5. Sensibilidades

Cada escenario alternativo se declara con el parámetro que cambia (`patch`), de
modo que el validador lo recalcule solo. Una sensibilidad sin parámetro es
inútil: se reporta como no verificable en lugar de ignorarse, y aparece con su
aviso en el informe de auditoría.

## 6. Tolerancias

- **±0,5 %** en el recálculo de toda cifra derivada: absorbe el redondeo a
  millones sin tolerar un error conceptual.
- **±0,05 puntos** en los porcentajes que deben sumar 100 (participación de
  acreedores y probabilidad de escenarios).
- **±1 millón** al cotejar los anclajes de administraciones contra la serie.

## 7. Lo que este observatorio no verifica

Conviene decirlo sin rodeos: se audita la **trazabilidad**, no la veracidad de
la fuente. Si un tribunal publica un monto y aquí se transcribe bien, la
auditoría pasa —aunque la cifra publicada fuera discutible—. La auditoría
tampoco valida los importes que no tienen cálculo declarado: son cifras
reportadas, y así se presentan.

## 8. Cómo se discute un criterio

Si un supuesto parece equivocado (la tasa de un laudo, el perímetro del
agregado, la interpolación de un año), el camino es concreto: se cambia el
fragmento correspondiente en `data/fragments/`, se ejecuta `npm run build:data`
y `npm run validate`. Si la cifra derivada no se actualiza, la auditoría falla y
el cambio no se publica. Esa fricción es deliberada: es la que evita que un
supuesto viejo sobreviva a un insumo nuevo.
