/**
 * js/render/shell.js — Armazón de la página
 *
 * Cabecera, cinta de eventos, leyenda de capas de procedencia, metadatos del
 * dataset y pie. Ninguna de estas piezas muestra cifras nuevas: todas citan
 * datos ya presentes en el dataset y su procedencia.
 */

import { esc, tierBadge, sourceRefs } from "./parts.js";
import { dateLong, dateShort, num, usd, pct, rangeLabel } from "../format.js";
import { TIER_ORDER, TIERS, DISCLAIMER, APP_VERSION } from "../config.js";

/** Líneas del registro de arranque (pantalla de carga tipo terminal). */
export function renderBootLog(lines) {
  return lines
    .map(
      (line) => `<div class="boot__line">
        <span>${esc(line.label)}</span>
        <span class="${line.status === "ok" ? "ok" : line.status === "fail" ? "fail" : "warn"}">${esc(line.detail)}</span>
      </div>`
    )
    .join("");
}

/**
 * Cinta de hechos verificables en movimiento continuo. Se duplica el contenido
 * una vez para que la animación de desplazamiento no muestre huecos.
 */
export function renderTicker(data) {
  const timeline = (data.global_timeline ?? []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const recent = timeline.slice(0, 8);
  const kpis = (data.kpis ?? []).slice(0, 4);

  // Cada elemento es un `listitem` real: el contenedor declara role="list",
  // así que los lectores de pantalla presentan la cinta como lista con nombre
  // en lugar de un flujo de texto anónimo.
  const items = [
    ...kpis.map(
      (kpi) => `<span class="ticker__item" role="listitem">
        <span class="t-date">${esc(kpi.label)}</span>
        <b>${esc(
          kpi.value_pct !== undefined
            ? pct(kpi.value_pct, 2)
            : kpi.value_times !== undefined
              ? `${num(kpi.value_times, 3)}x`
              : usd(kpi.value_mm ?? 0)
        )}</b>
        ${tierBadge(kpi.tier)}
      </span>`
    ),
    ...recent.map(
      (event) => `<span class="ticker__item" role="listitem">
        <span class="t-date">${esc(dateShort(event.date))}</span>
        <b>${esc(event.title)}</b>
      </span>`
    ),
  ].join("");

  return items + items;
}

/** Bloque de metadatos del dataset, visible bajo la cabecera. */
export function renderDatasetMeta(data, { source, validation }) {
  const meta = data.meta ?? {};
  const tierCounts = TIER_ORDER.map((tier) => {
    const count = countTier(data, tier);
    return `${TIERS[tier].label}: ${num(count)}`;
  }).join(" · ");

  return `
    <div class="row">
      <span class="label">Dataset</span>
      <span class="mono">v${esc(meta.dataset_version ?? "—")}</span>
      <span class="label">Valuación</span>
      <span class="mono">${esc(dateShort(meta.valuation_date))}</span>
      <span class="label">Período</span>
      <span class="mono">${esc(meta.period ?? "—")}</span>
      <span class="label">Unidad</span>
      <span class="mono">${esc(meta.unit ?? "—")}</span>
    </div>
    <div class="row" style="margin-top:var(--sp-3)">
      <span class="label">Capa</span>
      <span class="mono">${esc(tierCounts)}</span>
    </div>
    <div class="row" style="margin-top:var(--sp-3)">
      <span class="label">Origen de datos</span>
      <span class="mono">${esc(source?.label ?? "—")}</span>
      <span class="label">Auditoría</span>
      <span class="mono">${
        validation
          ? validation.ok
            ? `válida · ${num(validation.stats.calcVerified)} de ${num(validation.stats.calcValues)} cifras recalculadas`
            : `con ${validation.errors.length} incidencia(s)`
          : "no ejecutada"
      }</span>
    </div>`;
}

function countTier(node, tier) {
  let count = 0;
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      if (value.tier === tier) count += 1;
      Object.values(value).forEach(visit);
    }
  };
  visit(node);
  return count;
}

/** Leyenda de las capas de procedencia, en su orden jerárquico. */
export function renderTierLegend() {
  return TIER_ORDER.map(
    (tier) => `<div class="tier-legend__item">
      ${tierBadge(tier, { label: TIERS[tier].long })}
      <p>${esc(TIERS[tier].description)}</p>
    </div>`
  ).join("");
}

/** Pie de página con alcance, licencias y aviso legal. */
export function renderFooter(data, { source, validation } = {}) {
  const meta = data.meta ?? {};
  const sources = data.sources ?? [];
  const gaps = (data.data_gaps ?? []).length;
  const mechanisms = (data.recovery_mechanisms ?? []).length;
  const awards = (data.arbitration_cases ?? []).length;

  return `
    <div class="footer__grid">
      <div class="footer__col">
        <h3>Alcance del dataset</h3>
        <p>${esc(meta.title ?? "")}</p>
        <ul>
          <li>Período: ${esc(rangeLabel(meta.period?.slice(0, 4) ?? 1990, meta.period?.slice(-4) ?? 2026))}</li>
          <li>Unidad monetaria: ${esc(meta.unit ?? "—")}</li>
          <li>Fecha de valuación: ${esc(dateLong(meta.valuation_date))}</li>
          <li>Generado: ${esc(dateLong(meta.generated_at))}</li>
        </ul>
      </div>
      <div class="footer__col">
        <h3>Contenido</h3>
        <ul>
          <li>${num(sources.length)} fuentes en el ledger</li>
          <li>${num(awards)} casos arbitrales documentados</li>
          <li>${num(mechanisms)} mecanismos de recuperación evaluados</li>
          <li>${num(gaps)} vacíos de información declarados</li>
        </ul>
      </div>
      <div class="footer__col">
        <h3>Verificación</h3>
        <ul>
          <li>Origen de datos: ${esc(source?.label ?? "—")}</li>
          <li>${
            validation
              ? `Cifras derivadas recalculadas: ${num(validation.stats.calcVerified)} de ${num(
                  validation.stats.calcValues
                )}`
              : "Auditoría no ejecutada"
          }</li>
          <li>${
            validation
              ? `Sensibilidades verificadas: ${num(validation.stats.sensitivityVerified)} de ${num(
                  validation.stats.sensitivityDeclared
                )}`
              : "—"
          }</li>
          <li>Cliente v${esc(APP_VERSION)}</li>
        </ul>
      </div>
      <div class="footer__col">
        <h3>Cómo leer este documento</h3>
        <ul>
          <li>Cada cifra declara su capa de procedencia.</li>
          <li>Las cifras calculadas son reproducibles con su fórmula.</li>
          <li>Los instrumentos propuestos no existen todavía.</li>
          <li>Los vacíos de información se declaran, no se rellenan.</li>
        </ul>
      </div>
    </div>
    <div class="footer__legal">
      <!-- Un solo aviso legal: el del dataset si existe, con el del cliente
           como respaldo. Renderizar ambos apilaba dos textos casi idénticos. -->
      <p>${esc(meta.disclaimer ?? DISCLAIMER)}</p>
      <p class="mono">
        Código bajo licencia MIT · Datos bajo CC BY 4.0 · Sin datos personales · Sin cookies · Sin rastreo
      </p>
    </div>`;
}

/** Panel de error localizado: una sección falla sin tumbar el resto. */
export function renderSectionError(sectionLabel, error) {
  const message = error?.message ?? String(error);
  return `<div class="error-panel" role="alert">
    <p class="error-panel__title">Fallo al renderizar: ${esc(sectionLabel)}</p>
    <p>Esta sección no pudo construirse con los datos disponibles. El resto del documento sigue siendo válido.</p>
    <pre>${esc(message)}</pre>
  </div>`;
}

/**
 * Aviso de origen de los datos.
 *
 * Distingue dos situaciones que no deben confundirse: que el dataset venga
 * dentro de la propia página (la distribución de archivo único, que es normal
 * y no implica ninguna pérdida) y que la carga haya degradado de verdad porque
 * el JSON no estaba disponible, en cuyo caso sí hay que advertirlo.
 */
export function renderSourceNotice({ source, attempts }) {
  if (!source || source.id === "json") return "";

  const detail = (attempts ?? [])
    .filter((attempt) => !attempt.ok)
    .map((attempt) => `${attempt.source}: ${attempt.error}`)
    .join(" · ");

  if (source.id === "page") {
    return `<div class="error-panel" role="status" style="border-color:var(--hairline-strong);background:var(--surface-1)">
      <p class="error-panel__title">Dataset embebido en el documento</p>
      <p>${esc(source.note ?? "")}</p>
      <p class="chart-note">El contenido es idéntico al de <span class="mono">data/database.json</span>: ambos se generan del mismo ensamblado, y el bundle se regenera junto con el dataset.</p>
    </div>`;
  }

  return `<div class="error-panel" role="status" style="border-color:var(--warn);background:var(--warn-soft)">
    <p class="error-panel__title" style="color:#dcae6d">Datos cargados desde el respaldo</p>
    <p>${esc(source.note ?? "Se usó una fuente alternativa.")}</p>
    ${detail ? `<pre>${esc(detail)}</pre>` : ""}
  </div>`;
}

/** Bloque de notas de alcance del dataset. */
export function renderScopeNotes(meta) {
  const notes = meta?.scope_notes ?? [];
  if (!notes.length) return "";
  return `<div class="stack">
    <p class="expandable__section-title">Alcance y exclusiones declaradas</p>
    <ul class="prose">${notes.map((note) => `<li>${esc(note)}</li>`).join("")}</ul>
    <p class="chart-note">${esc(meta.editorial_note ?? "")}</p>
  </div>`;
}

export function sourceRefsRow(ids) {
  return `<div class="row">${sourceRefs(ids, { compact: true })}</div>`;
}
