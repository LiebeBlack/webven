/**
 * tests/validate-entry.js — Auditoría del dataset en el navegador
 *
 * Por qué existe además de tools/validate.mjs: el validador de CI comprueba el
 * JSON tal como está en el repositorio, pero no puede ver el documento tal como
 * lo ve una persona. Esta página ejecuta la misma función de contrato sobre el
 * mismo dataset dentro del navegador y publica el informe completo, de modo que
 * un fallo de carga, de codificación o de rutas relativas también se detecte.
 *
 * Se ejecuta en dos formatos:
 *   · como página servida (necesita un servidor estático por los módulos ES);
 *   · empaquetada en un único archivo por tools/bundle-standalone.ps1, que es
 *     la forma en que se puede abrir con doble clic.
 */

import { validateDatabase, compareDatasets, extractEmbedded } from "../js/data/contract.js";
import { loadDatabase } from "../js/data/loader.js";
import { num, pct, dateShort, escapeHtml as esc } from "../js/format.js";
import { APP_VERSION, TIER_ORDER, TIERS, VALIDATION, DATA_PATHS } from "../js/config.js";

const STATUS_LABEL = { pass: "conforme", warn: "aviso", fail: "falla" };

function checkRow(check) {
  return `<tr>
    <td>${esc(check.label)}</td>
    <td><span class="pill pill--${check.status === "pass" ? "ok" : check.status === "warn" ? "warn" : "alert"}">${esc(
    STATUS_LABEL[check.status] ?? check.status
  )}</span></td>
    <td>${esc(check.detail ?? "")}</td>
  </tr>`;
}

function sectionBlock(section) {
  return `<section class="card" style="margin-bottom:var(--sp-5)">
    <h2 class="card__title">${esc(section.label)}</h2>
    <div class="table-wrap"><table class="table table--compact">
      <caption>${esc(section.id)} · ${section.checks.length} comprobación(es)</caption>
      <thead><tr><th scope="col">Comprobación</th><th scope="col">Estado</th><th scope="col">Detalle</th></tr></thead>
      <tbody>${section.checks.map(checkRow).join("")}</tbody>
    </table></div>
  </section>`;
}

/** Recuento de registros por capa, caminando el documento completo. */
function tierCounts(node) {
  const counts = Object.fromEntries(TIER_ORDER.map((tier) => [tier, 0]));
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      if (typeof value.tier === "string" && value.tier in counts) counts[value.tier] += 1;
      Object.values(value).forEach(visit);
    }
  };
  visit(node);
  return counts;
}

function statCard(label, value, note = "") {
  return `<div class="sim__stat"><span class="label">${esc(label)}</span><span class="value">${esc(
    value
  )}</span>${note ? `<span class="table__note">${esc(note)}</span>` : ""}</div>`;
}

/**
 * Comprobación extra que solo puede hacerse en el navegador con un servidor:
 * que el respaldo embebido y el JSON publicado no hayan divergido.
 *
 * En la distribución de archivo único la comparación es imposible por diseño
 * (no hay JSON que pedir), así que se declara omitida en lugar de contarla como
 * incidencia: un aviso falso acaba enseñando a ignorar los avisos.
 */
async function checkEmbeddedTwin({ embedded }) {
  try {
    const response = await fetch(DATA_PATHS.json, { cache: "no-cache" });
    if (!response.ok) throw new Error(`el servidor respondió ${response.status}`);
    const fromJson = await response.json();
    const embeddedText = await fetch(DATA_PATHS.embedded, { cache: "no-cache" }).then((r) => r.text());
    const twin = extractEmbedded(embeddedText);
    const diff = compareDatasets(fromJson, twin);
    if (diff.length) {
      return {
        failures: [`El respaldo embebido difiere del JSON en ${diff.length} ruta(s): ${diff.slice(0, 5).join(", ")}`],
        note: "Comparación JSON ↔ respaldo embebido ejecutada.",
      };
    }
    return { failures: [], note: "El respaldo embebido coincide con data/database.json, cotejado ruta por ruta." };
  } catch (error) {
    return embedded
      ? {
          failures: [],
          note: `Comparación JSON ↔ respaldo embebido omitida: esta es la distribución de archivo único, donde el dataset viaja dentro del documento (${error.message}). En el repo la verifica tools/validate.mjs.`,
        }
      : { failures: [`No se pudo comparar el JSON con su respaldo embebido: ${error.message}`], note: "" };
  }
}

async function main() {
  const host = document.getElementById("report");
  const boot = document.getElementById("boot");
  const started = performance.now();

  let load;
  try {
    load = await loadDatabase({ validate: false });
  } catch (error) {
    host.innerHTML = `<div class="error-panel" role="alert"><p class="error-panel__title">No se pudo cargar el dataset</p><pre>${esc(
      error.message
    )}</pre></div>`;
    return;
  }

  const { data, source, attempts, degraded } = load;
  const report = validateDatabase(data);
  const environment = [
    `cliente v${APP_VERSION}`,
    `navegador ${navigator.userAgent.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim()}`,
    `protocolo ${location.protocol}`,
  ];
  const twin = await checkEmbeddedTwin({ embedded: source?.id === "page" });

  const errors = [...report.errors, ...twin.failures];
  const ok = report.ok && twin.failures.length === 0;
  const counts = tierCounts(data);

  document.title = `${ok ? "Auditoría correcta" : "Auditoría con incidencias"} · ${data.meta?.short_title ?? "Observatorio"}`;
  if (boot) boot.hidden = true;

  host.innerHTML = `
    <div class="error-panel" style="border-color:${ok ? "var(--ok)" : "var(--alert)"};background:${
      ok ? "var(--ok-soft)" : "var(--alert-soft)"
    }" role="status">
      <p class="error-panel__title">${ok ? "Auditoría correcta" : `Auditoría con ${errors.length} incidencia(s)`}</p>
      <p>Dataset ${esc(data.meta?.dataset_version ?? "—")} · valuación ${esc(
    dateShort(data.meta?.valuation_date)
  )} · origen «${esc(source?.label ?? "—")}»${degraded ? " (carga degradada)" : ""} · ${num(
    Math.round(performance.now() - started)
  )} ms</p>
      ${attempts.length ? `<pre>${esc(attempts.map((a) => `${a.ok ? "ok  " : "falla"}  ${a.source}${a.error ? ": " + a.error : ""}`).join("\n"))}</pre>` : ""}
      ${twin.note ? `<p class="chart-note">${esc(twin.note)}</p>` : ""}
    </div>

    <div class="sim__out" style="margin-bottom:var(--sp-5)">
      ${statCard("Comprobaciones", num(report.sections.reduce((acc, s) => acc + s.checks.length, 0)))}
      ${statCard("Cifras derivadas", `${num(report.stats.calcVerified)} de ${num(report.stats.calcValues)}`, `tolerancia ±${pct(VALIDATION.tolerancePct, 1)}`)}
      ${statCard("Sensibilidades", `${num(report.stats.sensitivityVerified)} de ${num(report.stats.sensitivityDeclared)}`, "verificables recalculadas")}
      ${statCard("Fuentes", num(report.stats.sources), `${num(report.stats.sourceRefs)} referencias resueltas`)}
    </div>

    <div class="sim__out" style="margin-bottom:var(--sp-5)">
      ${statCard("Registros con capa", num(report.stats.tierRecords))}
      ${statCard("Serie histórica", `${num(report.stats.seriesPoints)} años`, "puntos con capa declarada")}
      ${statCard("Colecciones", num(report.sections.length), "bloques auditados")}
      ${statCard("Entorno", environment[0], environment[2])}
    </div>

    ${
      errors.length
        ? `<section class="card" style="margin-bottom:var(--sp-5)">
            <h2 class="card__title">Incidencias</h2>
            <ul class="prose">${errors.map((error) => `<li>${esc(error)}</li>`).join("")}</ul>
          </section>`
        : ""
    }

    ${report.sections.map(sectionBlock).join("")}

    <section class="card">
      <h2 class="card__title">Capas de procedencia</h2>
      <div class="table-wrap"><table class="table table--compact">
        <caption>${TIER_ORDER.length} capas · orden jerárquico</caption>
        <thead><tr><th scope="col">Capa</th><th scope="col">Significado</th><th scope="col">Registros</th></tr></thead>
        <tbody>${TIER_ORDER.map(
          (tier) => `<tr><td>${esc(TIERS[tier].label)}</td><td>${esc(TIERS[tier].description)}</td><td class="table__num">${num(
            counts[tier]
          )}</td></tr>`
        ).join("")}</tbody>
      </table></div>
      <p class="chart-note">${esc(data.meta?.editorial_note ?? "")}</p>
    </section>

    <p class="chart-note">${esc(environment.join(" · "))} · informe generado ${esc(
    dateShort(report.generatedAt)
  )}</p>`;

  window.__validation = { report, ok, errors, source, degraded, data };
}

main().catch((error) => {
  const host = document.getElementById("report");
  if (host) {
    host.innerHTML = `<div class="error-panel" role="alert"><p class="error-panel__title">Fallo inesperado del validador</p><pre>${esc(
      error.stack ?? error.message
    )}</pre></div>`;
  }
});
