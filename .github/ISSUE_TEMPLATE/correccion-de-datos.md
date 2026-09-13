---
name: Corrección de datos
about: Una cifra publicada es incorrecta, está desactualizada o le falta contexto
title: "[Dato] "
labels: ["datos", "por verificar"]
assignees: []
---

## Registro afectado

- **Identificador o título visible** (aparece en la tarjeta o en la tabla):
- **Sección del sitio:**
- **Valor publicado:**
- **Valor que debería figurar:**

## Fuente

- **Documento, enlace o expediente:**
- **Fecha de publicación:**
- **Fecha en que lo consultaste:**

> Una corrección sin fuente no puede verificarse, y lo que no se verifica no
> entra en el dataset. Si la fuente es un documento físico o un portal sin URL
> directa, dilo: el ledger admite fuentes sin enlace, pero lo marca como aviso.

## Por qué el valor actual es incorrecto

Describe el error lo más preciso posible: ¿es el monto, la fecha, el perímetro
(incluye o excluye algo que no corresponde), la capa de procedencia, o el
cálculo derivado?

## ¿Afecta cifras derivadas?

Marca lo que corresponda:

- [ ] Es un valor dentro de un bloque `calc` (un sumando, una tasa, un supuesto)
- [ ] Es el resultado de un cálculo derivado
- [ ] Afecta la serie histórica o el anclaje de una administración
- [ ] No lo sé

## Comprobaciones

- [ ] Ejecuté `npm test` tras mi cambio (si abrí un pull request)
- [ ] Verifiqué que ninguna cifra derivada quede desfasada
- [ ] Añadí o actualicé la fuente en el ledger si es nueva
