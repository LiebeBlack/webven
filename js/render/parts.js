/**
 * js/render/parts.js — Piezas de plantilla reutilizables
 *
 * Todo el HTML que se inyecta se construye aquí o pasa por `escapeHtml`.
 * Los datos del dataset se tratan como entrada externa: aunque es nuestro
 * archivo, un dataset corrupto no debe poder inyectar marcado en la página.
 */

import { escapeHtml, safeUrl, hostOf, dateShort, num, pct, usd, usdBn, slugify, citationFor } from "../format.js";
import { TIERS, CLASSES } from "../config.js";

/* ------------------------------------------------------------------ contexto --- */

let context = { sourceMap: new Map(), meta: {}, datasetVersion: "—" };

/** Registra fuentes y metadatos para las piezas que los necesitan. */
export function setRenderContext(next) {
  context = {
    sourceMap: next.sourceMap ?? new Map(),
    meta: next.meta ?? {},
    datasetVersion: next.meta?.dataset_version ?? "—",
  };
}

export function getRenderContext() {
  return context;
}

/* --------------------------------------------------------------- básicos --- */

export const esc = escapeHtml;

/** Capa de procedencia como insignia con etiqueta y punto de color. */
export function tierBadge(tier, { label } = {}) {
  const definition = TIERS[tier];
  if (!definition) {
    return `<span class="badge badge--propuesta"><span class="dot"></span>${esc(label ?? "sin capa")}</span>`;
  }
  return `<span class="badge badge--${definition.id}" title="${esc(definition.description)}">
    <span class="dot" aria-hidden="true"></span>${esc(label ?? definition.label)}
  </span>`;
}

/** Marca compacta de capa para tablas densas. */
export function tierMark(tier) {
  const definition = TIERS[tier];
  const label = definition ? definition.label : "sin capa";
  return `<span class="tier-mark tier-mark--${tier ?? "propuesta"}">${esc(label)}</span>`;
}

export function statusPill(status) {
  const map = [
    { test: /default|impago|moratoria/i, cls: "pill--alert" },
    { test: /ejecuci|litigio|disputa|bloquead|retenid/i, cls: "pill--warn" },
    { test: /servicio|operativo|acuerdo|resuelto|firme/i, cls: "pill--ok" },
  ];
  const found = map.find((entry) => entry.test.test(status ?? ""));
  const cls = found ? found.cls : "pill--info";
  return `<span class="pill ${cls}">${esc(status ?? "sin estado")}</span>`;
}

/** Gráfico de línea en miniatura, sin dependencias. */
export function sparkline(values, { width = 140, height = 34 } = {}) {
  if (!Array.isArray(values) || values.length < 2) return "";
  const numbers = values.map(Number).filter(Number.isFinite);
  if (numbers.length < 2) return "";
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const span = max - min || 1;
  const step = width / (numbers.length - 1);
  const points = numbers.map((value, index) => {
    const x = index * step;
    const y = height - 3 - ((value - min) / span) * (height - 6);
    return [x, y];
  });
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img"
    aria-label="Serie de ${numbers.length} puntos, de ${num(min)} a ${num(max)}" focusable="false">
    <path class="area" d="${area}"></path>
    <path d="${line}"></path>
  </svg>`;
}

/** Barra de proporción simple. */
export function meter(value, max, { variant = "" } = {}) {
  const ratio = max ? Math.max(0, Math.min(1, Number(value) / Number(max))) : 0;
  return `<div class="meter ${variant}" role="img" aria-label="${esc(pct(ratio * 100))} del máximo">
    <div class="meter__fill" style="width:${(ratio * 100).toFixed(1)}%"></div>
  </div>`;
}

/* ---------------------------------------------------------------- fuentes --- */

/** Referencias de fuente como enlaces verificables. */
export function sourceRefs(ids, { compact = false } = {}) {
  const list = (ids ?? []).map((id) => context.sourceMap.get(id)).filter(Boolean);
  if (!list.length) return `<span class="dim mono">sin fuente declarada</span>`;
  if (compact) {
    return list
      .map((source) => {
        const url = safeUrl(source.url);
        const label = esc(source.id);
        return url
          ? `<a class="cite" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(source.name)}">${label}</a>`
          : `<span class="cite" title="${esc(source.name)} (sin URL directa)">${label}</span>`;
      })
      .join(" ");
  }
  return list
    .map((source) => {
      const url = safeUrl(source.url);
      const link = url
        ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(url))}</a>`
        : `<span class="dim">documento sin URL pública</span>`;
      return `<li class="source-item">
        <span class="source-item__id">${esc(source.id)}</span>
        <span class="source-item__body">
          ${esc(source.name)}
          <span class="source-item__meta">
            ${esc(source.publisher)}${source.kind ? ` · ${esc(source.kind)}` : ""} ·
            publicado ${esc(dateShort(source.published_at))} · consultado ${esc(dateShort(source.accessed_at))} ·
            ${link}
          </span>
        </span>
      </li>`;
    })
    .join("");
}

/** Lista de fuentes de un registro, en formato expandible. */
export function sourceListBlock(ids) {
  const list = (ids ?? []).map((id) => context.sourceMap.get(id)).filter(Boolean);
  if (!list.length) return "";
  return `<div class="expandable__section">
    <p class="expandable__section-title">Fuentes de este registro</p>
    <ul class="source-list">${sourceRefs(ids)}</ul>
  </div>`;
}

/* -------------------------------------------------------------- cálculo --- */

const PARAM_LABELS = {
  principal_mm: "Capital (MM USD)",
  rate_pct: "Tasa anual asumida (%)",
  from: "Desde",
  to: "Hasta",
  compounds_per_year: "Capitalizaciones por año",
  nominal_mm: "Nominal base (MM USD)",
  haircut_pct: "Quita (%)",
  coupon_pct: "Cupón (%)",
  tenor_years: "Plazo (años)",
  grace_years: "Gracia (años)",
  discount_rate_pct: "Tasa de descuento (%)",
  numerator_mm: "Numerador",
  denominator_mm: "Denominador",
  from_mm: "Valor inicial",
  to_mm: "Valor final",
  price_pct: "Precio de mercado (% del nominal)",
  redemption_pct: "Valor de rescate (%)",
  items: "Partidas sumadas",
  method: "Método",
  target: "Salida",
};

function formatParamValue(key, value) {
  if (Array.isArray(value)) return `${value.length} partidas`;
  if (typeof value === "number") {
    if (/_pct$/.test(key)) return pct(value, 2);
    if (/_mm$/.test(key)) return num(value, 2);
    if (/_years$/.test(key)) return `${num(value)} años`;
    return num(value, 2);
  }
  return String(value ?? "—");
}

/**
 * Caja de metodología: expone fórmula, insumos, supuestos y sensibilidad.
 * Es la pieza que convierte una cifra "calculada" en una cifra auditable.
 */
export function calcBox(calc, { recomputed } = {}) {
  if (!calc) return "";
  const params = Object.entries(calc.params ?? {})
    .filter(([key]) => key !== "items")
    .map(
      ([key, value]) => `<div>
        <dt>${esc(PARAM_LABELS[key] ?? key)}</dt>
        <dd>${esc(formatParamValue(key, value))}</dd>
      </div>`
    )
    .join("");

  const items = Array.isArray(calc.params?.items)
    ? `<div class="expandable__section">
        <p class="expandable__section-title">Partidas del cálculo</p>
        <ul class="indicator-list">
          ${calc.params.items
            .map(
              (item) => `<li><span class="k">${esc(item.label ?? "—")}</span>
              <span class="v">${esc(num(item.value_mm, 2))}</span></li>`
            )
            .join("")}
        </ul>
      </div>`
    : "";

  const assumptions = (calc.assumptions ?? []).length
    ? `<div class="expandable__section">
        <p class="expandable__section-title">Supuestos declarados</p>
        <ul class="prose">${calc.assumptions.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
      </div>`
    : "";

  const sensitivity = (calc.sensitivity ?? []).length
    ? `<div class="expandable__section">
        <p class="expandable__section-title">Sensibilidad</p>
        <ul class="indicator-list">
          ${calc.sensitivity
            .map((entry) => {
              const value =
                entry.value ?? entry.value_mm ?? entry.value_pct ?? entry.value_times ?? null;
              const suffix = entry.value_pct !== undefined ? "%" : entry.value_times !== undefined ? "x" : " MM";
              return `<li><span class="k">${esc(entry.label)}</span>
                <span class="v">${esc(num(value, 2))}${suffix}</span></li>`;
            })
            .join("")}
        </ul>
      </div>`
    : "";

  const recomputeNote = recomputed
    ? `<p class="muted" style="margin-top:var(--sp-3)">
        Recalculado en esta sesión: <b class="num">${esc(num(recomputed.value, 2))}</b>
        · desvío ${esc(num(recomputed.deltaPct, 4))} %
        · tolerancia ${esc(num(recomputed.tolerancePct, 2))} %
      </p>`
    : "";

  return `<div class="expandable__section">
    <p class="expandable__section-title">Cómo se calculó</p>
    <div class="calc-box">
      <div>Método: <b>${esc(calc.method)}</b> → salida <b>${esc(calc.target ?? "—")}</b></div>
      <code class="formula">${esc(calc.formula ?? "—")}</code>
      <dl class="calc-grid">${params}</dl>
      ${recomputeNote}
    </div>
    ${items}
    ${assumptions}
    ${sensitivity}
  </div>`;
}

/** Conciliación entre cifra reportada y cifra calculada. */
export function reconciliationBox(reconciliation) {
  if (!reconciliation) return "";
  const hasReported = reconciliation.reported_mm !== null && reconciliation.reported_mm !== undefined;
  const delta = Number(reconciliation.delta_pct);
  const direction = Number.isFinite(delta) ? (delta >= 0 ? "delta--up" : "delta--down") : "delta--flat";
  return `<div class="expandable__section">
    <p class="expandable__section-title">Conciliación con la cifra reportada</p>
    ${
      hasReported
        ? `<p class="row">
            <span class="label">Reportado</span>
            <span class="value">${esc(usd(reconciliation.reported_mm))}</span>
            <span class="delta ${direction}">${esc(
              Number.isFinite(delta) ? `${delta > 0 ? "+" : ""}${num(delta, 2)} %` : "sin comparación"
            )}</span>
          </p>`
        : `<p class="muted">Sin cifra reportada verificable en el período cubierto por este dataset.</p>`
    }
    ${reconciliation.note ? `<div class="prose"><p>${esc(reconciliation.note)}</p></div>` : ""}
    ${reconciliation.reported_source_ids ? `<p class="row">${sourceRefs(reconciliation.reported_source_ids, { compact: true })}</p>` : ""}
  </div>`;
}

/* --------------------------------------------------------------- tablas --- */

/**
 * Tabla institucional accesible: caption, cabeceras con scope y pie opcional.
 * @param {{caption:string, columns:Array<{label:string, align?:string, className?:string}>,
 *          rows:Array<Array<string>>, foot?:Array<string>, compact?:boolean,
 *          rowAttributes?:Function, rowValues?:Array<object>}} options
 */
export function dataTable({
  caption,
  columns = [],
  rows = [],
  foot = null,
  compact = false,
  rowAttributes = null,
  rowValues = null,
}) {
  if (!rows.length) return emptyState("Sin registros que cumplan el filtro actual.");
  const head = columns
    .map((column) => `<th scope="col" class="${column.align === "num" ? "table__num" : ""}">${esc(column.label)}</th>`)
    .join("");
  const body = rows
    .map(
      (row, rowIndex) =>
        `<tr${rowAttributes && rowValues?.[rowIndex] ? ` ${rowAttributes(rowValues[rowIndex], rowIndex)}` : ""}>${row
          .map((cell, index) => {
            const column = columns[index] ?? {};
            const cls = [column.align === "num" ? "table__num" : "", column.className ?? ""].join(" ").trim();
            return `<td${cls ? ` class="${cls}"` : ""}>${cell}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");
  const footer = foot
    ? `<tfoot><tr>${foot
        .map((cell, index) => {
          const column = columns[index] ?? {};
          return `<td class="${column.align === "num" ? "table__num" : ""}">${cell}</td>`;
        })
        .join("")}</tr></tfoot>`
    : "";
  return `<div class="table-wrap">
    <table class="table ${compact ? "table--compact" : ""}">
      <caption>${esc(caption)}</caption>
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
      ${footer}
    </table>
  </div>`;
}

export function emptyState(message, { id } = {}) {
  return `<div class="empty"${id ? ` id="${esc(id)}"` : ""}>${esc(message)}</div>`;
}

/* ---------------------------------------------------------------- botones --- */

/** Botón que copia una cita formal reproducible del registro. */
export function citeButton({ id, title, valueText, asOf, sourceIds, container = "figure" }) {
  const citation = citationFor({
    title,
    valueText,
    asOf,
    sourceNames: (sourceIds ?? []).map((sid) => context.sourceMap.get(sid)?.name).filter(Boolean),
    datasetVersion: context.datasetVersion,
  });
  return `<button class="cite" type="button" data-cite="${esc(citation)}" data-copy-target="${esc(id)}"
    aria-label="Copiar cita de ${esc(title)}">citar</button>`;
}

/** Fila de herramientas de un panel: capa, fuentes y cita. */
export function metaRow({ tier, sourceIds, cite }) {
  return `<div class="panel__footer">
    <span class="row">
      ${tier ? tierBadge(tier) : ""}
      ${sourceRefs(sourceIds, { compact: true })}
    </span>
    <span class="row">${cite ? citeButton(cite) : ""}</span>
  </div>`;
}

/** Encabezado de un panel expandible. */
export function expandableHeader({
  id,
  eyebrow,
  title,
  subtitle,
  value,
  aside,
  tier,
  open = false,
}) {
  return `<button class="expandable__toggle" type="button" aria-expanded="${open ? "true" : "false"}"
    aria-controls="${esc(id)}-body" data-expandable-toggle>
    <span class="expandable__toggle-main">
      ${eyebrow ? `<span class="panel__eyebrow">${esc(eyebrow)}</span>` : ""}
      ${title ? `<span class="panel__title" style="display:block">${esc(title)}</span>` : ""}
      ${value ? `<span class="value value--lg" style="display:block;margin-top:var(--sp-2)">${value}</span>` : ""}
      ${subtitle ? `<span class="panel__sub" style="display:block">${esc(subtitle)}</span>` : ""}
    </span>
    ${aside ? `<span class="expandable__aside">${aside}</span>` : ""}
    <span class="chev" aria-hidden="true">+</span>
  </button>`;
}

export function expandableBody(id, { label, content, open = false }) {
  // Sin atributo `hidden`: el estado cerrado lo gobierna el CSS
  // (grid-template-rows: 0fr + visibility: hidden), que además retira el
  // contenido del árbol de accesibilidad y del orden de tabulación.
  // Un atributo `hidden` aquí ganaría sobre la animación (`display:none
  // !important` en tokens.css) y la tarjeta no podría abrirse jamás.
  // La clase `is-open` inicial solo aplica cuando un renderizador pide
  // explícitamente la tarjeta abierta.
  return `<div class="expandable__body${open ? " is-open" : ""}" id="${esc(id)}-body" role="region"
    aria-label="${esc(label)}">
    <div class="expandable__inner">
      <div class="expandable__reveal">${content}</div>
    </div>
  </div>`;
}

/** Contenedor de sección de contenido dentro de una tarjeta abierta. */
export function sectionBlock(title, content) {
  if (!content) return "";
  return `<div class="expandable__section">
    ${title ? `<p class="expandable__section-title">${esc(title)}</p>` : ""}
    ${content}
  </div>`;
}

export function panelSection(title, content, { note } = {}) {
  return `<div class="expandable__section">
    ${title ? `<p class="expandable__section-title">${esc(title)}</p>` : ""}
    ${content}
    ${note ? `<p class="chart-note">${note}</p>` : ""}
  </div>`;
}

/** Identificador de ancla estable a partir de un prefijo y un texto. */
export function anchorId(prefix, value) {
  return `${prefix}-${slugify(value)}`;
}

/** Valores de tarjeta: formato según la unidad declarada. */
export function formatKpiValue(kpi) {
  if (kpi.value_times !== undefined && kpi.value_times !== null) return `${num(kpi.value_times, 3)}x`;
  if (kpi.value_pct !== undefined && kpi.value_pct !== null) return pct(kpi.value_pct, 2);
  if (kpi.unit && /habitante/i.test(kpi.unit)) return `US$ ${num(kpi.value_mm)}`;
  if (kpi.unit && /años/i.test(kpi.unit)) return `${num(kpi.value_mm)} años`;
  if (kpi.value_mm !== undefined && kpi.value_mm !== null) {
    return Math.abs(Number(kpi.value_mm)) >= 10000 ? usdBn(kpi.value_mm) : usd(kpi.value_mm);
  }
  return "—";
}

export { CLASSES };
