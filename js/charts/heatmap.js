/**
 * js/charts/heatmap.js — Mapa de calor de composición por año
 *
 * Se construye con DOM y CSS grid en lugar de canvas para que las celdas sean
 * elementos reales: accesibles por teclado, con título emergente nativo y
 * seleccionables en el navegador. Sin dependencias externas.
 *
 * Lectura: cada fila es un componente de la deuda, cada columna un año, y la
 * intensidad representa el peso de ese componente dentro del total de ese año.
 * La diagonal de intensidad que se forma es la historia del cambio de acreedor.
 */

import { esc } from "../render/parts.js";
import { num, pct } from "../format.js";

/** Máximo por componente, usado para normalizar el color de cada fila. */
function rowMaxima(points, keys) {
  const maxima = {};
  for (const key of keys) {
    maxima[key] = Math.max(...points.map((point) => Number(point[key]) || 0), 1);
  }
  return maxima;
}

/**
 * @param {object} data dataset completo
 * @returns {string} HTML del mapa de calor
 */
export function renderHeatmap(data) {
  const series = data.historical_series ?? {};
  const points = series.points ?? [];
  const definitions = series.series_definitions ?? [];
  if (!points.length || !definitions.length) {
    return `<div class="empty">Sin serie histórica suficiente para el mapa de calor.</div>`;
  }

  const keys = definitions.map((definition) => definition.key);
  const maxima = rowMaxima(points, keys);
  const years = points.map((point) => point.year);

  const header = [
    `<div class="heatmap__rowlabel" aria-hidden="true"></div>`,
    ...years.map((year) => `<div class="heatmap__head" aria-hidden="true">${esc(String(year).slice(2))}</div>`),
  ].join("");

  const rows = definitions
    .map((definition) => {
      const cells = points
        .map((point) => {
          const value = Number(point[definition.key]) || 0;
          const share = Number(point.total_mm) ? (value / Number(point.total_mm)) * 100 : 0;
          const intensity = Math.min(1, value / maxima[definition.key]);
          // Se eleva la intensidad a 0,65 para que los valores bajos no queden invisibles.
          const alpha = Number((intensity ** 0.65).toFixed(3));
          const label = `${definition.label} · ${point.year}: ${num(value)} MM (${pct(share, 1)} del total de ese año)`;
          return `<div class="heatmap__cell" style="--heat:${alpha}" title="${esc(label)}"
            role="img" aria-label="${esc(label)}" tabindex="0"></div>`;
        })
        .join("");
      return `<div class="heatmap__rowlabel" title="${esc(definition.label)}">${esc(definition.label)}</div>${cells}`;
    })
    .join("");

  return `<div class="heatmap" style="grid-template-columns:12rem repeat(${years.length}, minmax(8px, 1fr))">
      ${header}
      ${rows}
    </div>
    <div class="heatmap__scale">
      <span>0 %</span>
      <span class="heatmap__ramp" aria-hidden="true"></span>
      <span>máximo del componente</span>
    </div>
    <p class="chart-note">
      Columnas: años ${esc(String(years[0]))} a ${esc(String(years[years.length - 1]))}. La intensidad se normaliza por
      componente, así que una fila clara no significa ausencia de deuda sino peso bajo dentro de ese componente.
      Los años marcados como interpolados en el dataset aparecen con el mismo tratamiento visual; la distinción se
      declara en la nota de la serie.
    </p>`;
}

/** Versión tabular del mapa de calor, para lectores de pantalla y para impresión. */
export function renderHeatmapTable(data) {
  const points = data.historical_series?.points ?? [];
  const definitions = data.historical_series?.series_definitions ?? [];
  if (!points.length) return "";
  const head = `<tr><th scope="col">Componente</th>${points
    .map((point) => `<th scope="col">${esc(String(point.year))}</th>`)
    .join("")}</tr>`;
  const body = definitions
    .map(
      (definition) =>
        `<tr><th scope="row">${esc(definition.label)}</th>${points
          .map((point) => `<td class="table__num">${esc(num(point[definition.key]))}</td>`)
          .join("")}</tr>`
    )
    .join("");
  return `<div class="table-wrap">
    <table class="table table--compact">
      <caption>Composición anual de la deuda externa por componente (MM USD)</caption>
      <thead>${head}</thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}
