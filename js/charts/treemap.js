/**
 * js/charts/treemap.js — Treemap de exposición por acreedor
 *
 * Implementación propia del algoritmo "squarified" (Bruls, Huizing y van Wijk),
 * sin dependencias. Se elige treemap y no un gráfico de torta porque las
 * magnitudes son muy dispares: el bloque mayor y el menor difieren en más de un
 * orden de magnitud, y un anillo haría ilegibles las clases pequeñas.
 */

import { esc } from "../render/parts.js";
import { num, pct } from "../format.js";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "../config.js";

/**
 * Reparte un rectángulo entre valores proporcionales buscando la peor relación
 * de aspecto posible y minimizándola (squarified).
 * @param {Array<{value:number}>} items
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 */
export function squarify(items, x, y, width, height) {
  const total = items.reduce((acc, item) => acc + (Number(item.value) || 0), 0) || 1;
  const scale = (width * height) / total;
  let remaining = items
    .map((item) => ({ ...item, area: (Number(item.value) || 0) * scale }))
    .filter((item) => item.area > 0)
    .sort((a, b) => b.area - a.area);

  const rects = [];
  let cx = x;
  let cy = y;
  let cw = width;
  let ch = height;

  const worst = (row, side) => {
    if (!row.length || side <= 0) return Infinity;
    const sum = row.reduce((acc, item) => acc + item.area, 0);
    if (sum <= 0) return Infinity;
    const max = Math.max(...row.map((item) => item.area));
    const min = Math.min(...row.map((item) => item.area));
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  while (remaining.length && cw > 0.5 && ch > 0.5) {
    const side = Math.min(cw, ch);
    const row = [];
    while (remaining.length) {
      const candidate = [...row, remaining[0]];
      if (!row.length || worst(candidate, side) <= worst(row, side)) {
        row.push(remaining.shift());
      } else {
        break;
      }
    }
    const rowSum = row.reduce((acc, item) => acc + item.area, 0);
    if (cw >= ch) {
      const rowWidth = rowSum / ch;
      let offsetY = cy;
      row.forEach((item) => {
        const itemHeight = (item.area / rowSum) * ch;
        rects.push({ ...item, x: cx, y: offsetY, w: rowWidth, h: itemHeight });
        offsetY += itemHeight;
      });
      cx += rowWidth;
      cw -= rowWidth;
    } else {
      const rowHeight = rowSum / cw;
      let offsetX = cx;
      row.forEach((item) => {
        const itemWidth = (item.area / rowSum) * cw;
        rects.push({ ...item, x: offsetX, y: cy, w: itemWidth, h: rowHeight });
        offsetX += itemWidth;
      });
      cy += rowHeight;
      ch -= rowHeight;
    }
  }
  return rects;
}

/**
 * Renderiza el treemap de acreedores como HTML posicionado en porcentajes.
 * Solo las celdas viven dentro de `.treemap`; la leyenda y la nota quedan
 * fuera, como hermanas del contenedor — antes se emitían dentro y el
 * contenedor de altura fija las apilaba sobre las celdas.
 * @param {object} data
 * @param {{width?:number, height?:number}} options
 */
export function renderTreemap(data, { width = 1000, height = 460 } = {}) {
  const creditors = (data.creditors ?? []).slice().sort((a, b) => Number(b.exposure_mm) - Number(a.exposure_mm));
  if (!creditors.length) return `<div class="empty">Sin acreedores para el treemap.</div>`;

  const items = creditors.map((creditor) => ({
    label: creditor.name,
    short: shortLabel(creditor.name),
    value: Number(creditor.exposure_mm) || 0,
    share: Number(creditor.share_pct) || 0,
    type: creditor.type,
    id: creditor.id,
  }));

  const rects = squarify(items, 0, 0, width, height);
  const total = items.reduce((acc, item) => acc + item.value, 0);

  const cells = rects
    .map((rect) => {
      const color = CATEGORY_COLORS[rect.type] ?? CATEGORY_COLORS.otro;
      const areaPct = (rect.w * rect.h) / (width * height);
      // Umbral de área para mostrar etiqueta y valor: con las medidas
      // porcentuales reales, no con proporciones adivinadas.
      const showLabel = areaPct > 0.012;
      const showValue = areaPct > 0.03;
      const label = `${rect.label}: ${num(rect.value)} millones de dólares, ${pct(rect.share, 2)} de la exposición agregada`;
      return `<div class="treemap__cell" style="left:${((rect.x / width) * 100).toFixed(3)}%;
        top:${((rect.y / height) * 100).toFixed(3)}%;
        width:${((rect.w / width) * 100).toFixed(3)}%;
        height:${((rect.h / height) * 100).toFixed(3)}%;
        background:${esc(color)}22;border-color:${esc(color)}55"
        title="${esc(label)}" role="img" aria-label="${esc(label)}" data-treemap-id="${esc(rect.id)}"
        tabindex="0">
        ${showLabel ? `<span class="treemap__label" style="color:${esc(color)}">${esc(rect.short)}</span>` : ""}
        ${showValue ? `<span class="treemap__value">${esc(num(rect.value))} MM · ${esc(pct(rect.share, 1))}</span>` : ""}
      </div>`;
    })
    .join("");

  const legend = [...new Set(items.map((item) => item.type))]
    .map(
      (type) =>
        `<span class="legend__item"><span class="legend__swatch"
          style="background:${esc(CATEGORY_COLORS[type] ?? CATEGORY_COLORS.otro)}"></span>
          ${esc(CATEGORY_LABELS[type] ?? type)}</span>`
    )
    .join("");

  return `<div class="treemap__canvas">${cells}</div>
  <div class="chart-legend">${legend}</div>
  <p class="chart-note">
    Área proporcional a la exposición en millones de dólares. Total representado: ${esc(usdText(total))}.
    Las clases pequeñas se etiquetan solo cuando el área permite lectura; el valor completo aparece al pasar el cursor
    o al enfocar la celda con la tecla Tab.
  </p>`;
}

function usdText(value) {
  return `US$ ${num(value)} MM`;
}

/** Abreviatura legible para etiquetas dentro de celdas estrechas. */
function shortLabel(name) {
  const dictionary = [
    [/Tenedores de bonos soberanos/i, "Bonos soberanos"],
    [/bono PDVSA 2020/i, "PDVSA 2020 (Citgo)"],
    [/PDVSA sin garantía/i, "PDVSA sin garantía"],
    [/arbitrales/i, "Arbitrales"],
    [/^China/i, "China"],
    [/^Rusia/i, "Rusia"],
    [/bilaterales/i, "Bilaterales"],
    [/multilaterales/i, "Multilaterales"],
    [/Club de París/i, "Club de París"],
    [/Proveedores/i, "Proveedores"],
    [/Otros pasivos/i, "Otros pasivos"],
  ];
  const found = dictionary.find(([pattern]) => pattern.test(name));
  return found ? found[1] : name.slice(0, 26);
}
