/**
 * js/render/sources.js — Aparato probatorio
 *
 * El ledger de fuentes, el glosario, la lista de vigilancia y los vacíos de
 * información son parte del producto, no anexos. Un observatorio que declara
 * lo que no sabe es más confiable que uno que rellena huecos con estimaciones
 * silenciosas.
 */

import { esc, tierBadge, tierMark, dataTable, sourceRefs, panelSection, meter } from "./parts.js";
import { num, hostOf, safeUrl, dateShort, pct } from "../format.js";
import { VALIDATION } from "../config.js";

const KIND_LABELS = {
  oficial: "Fuente oficial",
  multilateral: "Organismo multilateral",
  tribunal: "Tribunal internacional",
  documento_legal: "Documento legal",
  observatorio: "Observatorio civil",
  prensa: "Prensa",
  banco: "Banco de inversión",
  analista: "Analista independiente",
  agregador: "Agregador (uso secundario)",
};

/** Ledger completo de fuentes, con recuento por tipo. */
export function renderSourcesLedger(data) {
  const sources = data.sources ?? [];
  if (!sources.length) return `<div class="empty">Sin fuentes declaradas.</div>`;

  const byKind = sources.reduce((acc, source) => {
    acc[source.kind] = (acc[source.kind] ?? 0) + 1;
    return acc;
  }, {});

  const rows = sources.map((source) => {
    const url = safeUrl(source.url);
    return [
      `<span class="source-item__id">${esc(source.id)}</span>`,
      `<span class="table__name">${esc(source.name)}</span>
       <span class="table__note">${esc(source.note)}</span>`,
      esc(source.publisher),
      esc(KIND_LABELS[source.kind] ?? source.kind),
      `${url ? `<a class="cite" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(url))}</a>` : `<span class="dim">sin URL pública</span>`}`,
      esc(dateShort(source.published_at)),
      esc(dateShort(source.accessed_at)),
      esc(source.reliability),
    ];
  });

  return `${dataTable({
    caption: "Ledger de fuentes: toda cifra del dataset remite a alguno de estos registros",
    compact: true,
    columns: [
      { label: "ID" },
      { label: "Título y nota" },
      { label: "Editor" },
      { label: "Tipo" },
      { label: "Enlace" },
      { label: "Publicado" },
      { label: "Consultado" },
      { label: "Fiabilidad" },
    ],
    rows,
  })}
  <div class="chart-legend">
    ${Object.entries(byKind)
      .map(
        ([kind, count]) =>
          `<span class="legend__item"><span class="legend__swatch" style="background:var(--ink-3)"></span>
          ${esc(KIND_LABELS[kind] ?? kind)}: ${esc(num(count))}</span>`
      )
      .join("")}
  </div>
  <p class="chart-note">
    Se declaran ${esc(num(sources.length))} fuentes, de las cuales
    ${esc(num(sources.filter((s) => s.reliability === "oficial").length))} son de naturaleza oficial o documental.
    Donde no existe URL estable se indica «sin URL pública» en lugar de forzar un enlace que no llevaría al documento.
  </p>`;
}

/** Glosario ordenado alfabéticamente. */
export function renderGlossary(data) {
  const terms = (data.glossary ?? []).slice().sort((a, b) => a.term.localeCompare(b.term, "es"));
  if (!terms.length) return `<div class="empty">Sin términos en el glosario.</div>`;
  return terms
    .map(
      (entry) => `<div class="glossary__item">
        <p class="glossary__term">${esc(entry.term)}</p>
        <p class="glossary__def">${esc(entry.definition)}</p>
      </div>`
    )
    .join("");
}

/** Lista de vigilancia: qué observar y qué umbral marca un cambio. */
export function renderWatchlist(data) {
  const items = data.watchlist ?? [];
  if (!items.length) return `<div class="empty">Sin indicadores en vigilancia.</div>`;
  const content = items
    .map(
      (item) => `<article class="panel panel--static">
        <div class="panel__pad">
          <div class="between">
            <div>
              <span class="panel__eyebrow">Indicador en vigilancia</span>
              <h3 class="panel__title">${esc(item.indicator)}</h3>
            </div>
            ${tierBadge(item.tier)}
          </div>
          <ul class="indicator-list" style="margin-top:var(--sp-3)">
            <li><span class="k">Estado actual</span><span class="v">${esc(item.current)}</span></li>
            <li><span class="k">Umbral que marca cambio</span><span class="v">${esc(item.threshold)}</span></li>
            <li><span class="k">Por qué importa</span><span class="v" style="text-align:right">${esc(item.why)}</span></li>
          </ul>
        </div>
        <div class="panel__footer">
          <span>${esc(item.direction)}</span>
          <span class="mono">${esc(item.id)}</span>
        </div>
      </article>`
    )
    .join("");
  return `<div class="grid grid--2">${content}</div>`;
}

/** Agenda de vacíos: lo que este observatorio no puede responder todavía. */
export function renderDataGaps(data) {
  const gaps = data.data_gaps ?? [];
  if (!gaps.length) return `<div class="empty">Sin vacíos de información declarados.</div>`;
  return gaps
    .map(
      (gap, index) => `<article class="panel expandable" data-expandable data-expandable-group="vacios"
        id="vacio-${esc(gap.id)}">
        <button class="expandable__toggle" type="button" aria-expanded="false"
          aria-controls="vacio-${esc(gap.id)}-body" data-expandable-toggle>
          <span class="expandable__toggle-main">
            <span class="panel__eyebrow">Vacío ${num(index + 1)} de ${num(gaps.length)} · impacto: ${esc(gap.impact.length > 60 ? "alto" : "medio")}</span>
            <span class="panel__title" style="display:block">${esc(gap.question)}</span>
            <span class="panel__sub" style="display:block">${esc(gap.why_missing)}</span>
          </span>
          <span class="expandable__aside">${tierBadge(gap.tier)}</span>
          <span class="chev" aria-hidden="true">+</span>
        </button>
        <div class="expandable__body" id="vacio-${esc(gap.id)}-body" role="region"
          aria-label="Detalle del vacío ${esc(gap.id)}">
          <div class="expandable__inner">
            <div class="expandable__reveal">
              <ul class="indicator-list">
                <li><span class="k">Impacto analítico</span><span class="v">${esc(gap.impact)}</span></li>
                <li><span class="k">Mejor estimación disponible</span><span class="v">${esc(gap.best_available)}</span></li>
                <li><span class="k">Acción recomendada</span><span class="v">${esc(gap.recommended_action)}</span></li>
              </ul>
              <p class="expandable__section-title" style="margin-top:var(--sp-5)">Fuentes relacionadas</p>
              <p class="row">${sourceRefs(gap.source_ids, { compact: true })}</p>
            </div>
          </div>
        </div>
      </article>`
    )
    .join("");
}

/** Resumen del estado probatorio del dataset. */
export function renderEvidenceSummary(data, validation) {
  const sources = data.sources ?? [];
  const withUrl = sources.filter((s) => s.url).length;
  const official = sources.filter((s) => s.kind === "oficial" || s.kind === "tribunal" || s.kind === "multilateral").length;
  return `<div class="sim__out">
    <div class="sim__stat"><span class="label">Fuentes declaradas</span><span class="value">${esc(num(sources.length))}</span></div>
    <div class="sim__stat"><span class="label">Con enlace verificable</span><span class="value">${esc(num(withUrl))}</span>
      <span class="table__note">${esc(pct((withUrl / (sources.length || 1)) * 100, 0))}</span></div>
    <div class="sim__stat"><span class="label">Oficiales o documentales</span><span class="value">${esc(num(official))}</span></div>
    <div class="sim__stat"><span class="label">Cifras recalculadas</span><span class="value">${
      validation ? esc(`${num(validation.stats.calcVerified)} de ${num(validation.stats.calcValues)}`) : "—"
    }</span><span class="table__note">dentro de tolerancia en la auditoría automática</span></div>
  </div>`;
}

/**
 * Informe completo de la auditoría automática.
 *
 * El recuento de incidencias no basta: un observatorio que exige procedencia a
 * cada cifra debe publicar también el resultado de las comprobaciones que hace
 * sobre sí mismo —incluidas las que pasan— para que cualquiera pueda discutir
 * un criterio concreto en lugar de la conclusión entera.
 */
export function renderAuditReport(validation) {
  if (!validation) {
    return panelSection(
      "Auditoría automática del dataset",
      `<div class="prose"><p>La auditoría no se ejecutó, así que ninguna cifra derivada de esta
      página ha sido recalculada. Trátese como documento sin verificar.</p></div>`
    );
  }

  const STATUS_LABEL = { pass: "conforme", warn: "aviso", fail: "falla" };
  const STATUS_CLASS = { pass: "pill--ok", warn: "pill--warn", fail: "pill--alert" };

  const checks = (validation.sections ?? []).flatMap((section) =>
    (section.checks ?? []).map((entry) => ({ section: section.label, ...entry }))
  );
  const count = (status) => checks.filter((entry) => entry.status === status).length;
  const fails = count("fail");
  const warns = count("warn");

  const head = `<div class="sim__out">
    <div class="sim__stat"><span class="label">Comprobaciones</span><span class="value">${esc(num(checks.length))}</span></div>
    <div class="sim__stat"><span class="label">Conformes</span><span class="value">${esc(num(count("pass")))}</span></div>
    <div class="sim__stat"><span class="label">Avisos</span><span class="value">${esc(num(warns))}</span></div>
    <div class="sim__stat"><span class="label">Fallas</span><span class="value">${esc(num(fails))}</span></div>
  </div>
  <div class="prose" style="margin-top:var(--sp-4)">
    <p>Las ${esc(num(validation.stats.calcValues))} cifras derivadas se recalculan con la misma función
    que usa la interfaz; se tolera un desvío del ${esc(pct(VALIDATION.tolerancePct, 1))} para absorber el redondeo
    a millones. Una diferencia mayor se reporta como falla y, en el repositorio, detiene la publicación: el
    despliegue no avanza con la auditoría en rojo.</p>
    ${warns ? `<p>Hay ${esc(num(warns))} aviso(s). Un aviso no invalida el dato: señala algo que conviene revisar
    (una fuente sin enlace directo, una sensibilidad declarada sin parámetro alterado). Se muestran abajo con su
    detalle.</p>` : ""}
  </div>`;

  const table = dataTable({
    caption: `Auditoría de contrato · ${checks.length} comprobaciones · ejecutada ${dateShort(
      validation.generatedAt
    )}`,
    compact: true,
    columns: [
      { label: "Bloque" },
      { label: "Comprobación" },
      { label: "Estado" },
      { label: "Detalle" },
    ],
    rows: checks.map((entry) => [
      `<span class="table__note">${esc(entry.section)}</span>`,
      esc(entry.label),
      `<span class="pill ${STATUS_CLASS[entry.status] ?? "pill--info"}">${esc(
        STATUS_LABEL[entry.status] ?? entry.status
      )}</span>`,
      esc(entry.detail || "—"),
    ]),
  });

  return panelSection("Auditoría automática del dataset", head + table);
}

/** Bloque de la agenda de vacíos, con su justificación de método. */
export function renderGapsIntro(data) {
  const gaps = data.data_gaps ?? [];
  const total = gaps.length;
  return panelSection(
    "Por qué se publican los vacíos",
    `<div class="prose">
      <p>Un informe forense se define tanto por lo que documenta como por lo que declara no poder documentar.
      Este observatorio identifica ${esc(num(total))} preguntas sin respuesta verificable y describe, en cada caso,
      la acción concreta que permitiría cerrarla.</p>
      <p>Ninguna de esas preguntas se responde con una estimación silenciosa. Cuando existe una estimación,
      aparece rotulada como tal y con su rango.</p>
    </div>`
  );
}

export { hostOf };
