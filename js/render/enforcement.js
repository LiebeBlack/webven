/**
 * js/render/enforcement.js — Ejecución, sanciones y actores
 *
 * Esta sección responde a la pregunta que no aparece en los agregados de deuda:
 * quién puede cobrar de hecho, sobre qué activo y con qué instrumento legal.
 */

import { esc, tierBadge, tierMark, dataTable, statusPill, panelSection } from "./parts.js";
import { num, usd, dateShort, pct } from "../format.js";

const TYPE_LABELS = {
  acciones: "Acciones y participaciones",
  colateral: "Garantía pignorada",
  cuenta: "Cuentas y depósitos",
  refineria: "Activos de refinación",
  maritimo: "Activos marítimos",
  sancion: "Restricción de sanciones",
  sentencia: "Sentencias locales",
  embargo: "Embargos varios",
  reserva: "Reservas internacionales",
  accion: "Acciones societarias",
};

/** Tabla del mapa de ejecución. */
export function renderEnforcement(data) {
  const rows = data.enforcement_map ?? [];
  if (!rows.length) return `<div class="empty">Sin medidas de ejecución registradas.</div>`;
  const ordered = rows.slice().sort((a, b) => Number(b.value_mm) - Number(a.value_mm));
  return dataTable({
    caption: "Activos perseguidos por acreedores y medidas vigentes sobre ellos",
    columns: [
      { label: "Activo objetivo" },
      { label: "Acreedor" },
      { label: "Tipo" },
      { label: "Jurisdicción" },
      { label: "Valor estimado (MM USD)", align: "num" },
      { label: "Estado" },
      { label: "Capa" },
    ],
    rows: ordered.map((row) => [
      `<span class="table__name">${esc(row.target)}</span>
       <span class="table__note">${esc(row.note)}</span>`,
      esc(row.claimant),
      esc(TYPE_LABELS[row.type] ?? row.type),
      esc(row.jurisdiction),
      esc(num(row.value_mm)),
      statusPill(row.status),
      tierMark(row.tier),
    ]),
    foot: [
      "<b>Valor agregado perseguido</b>",
      "",
      "",
      "",
      `<b>${esc(num(ordered.reduce((acc, row) => acc + Number(row.value_mm || 0), 0)))}</b>`,
      "",
      "",
    ],
  });
}

/** Resumen del mapa de ejecución. */
export function renderEnforcementSummary(data) {
  const rows = data.enforcement_map ?? [];
  const total = rows.reduce((acc, row) => acc + Number(row.value_mm || 0), 0);
  const byType = rows.reduce((acc, row) => {
    acc[TYPE_LABELS[row.type] ?? row.type] = (acc[TYPE_LABELS[row.type] ?? row.type] ?? 0) + Number(row.value_mm || 0);
    return acc;
  }, {});
  const top = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
  return `<div class="flow-note">
    <p>Valor agregado bajo alguna forma de persecución judicial o administrativa:
      <b class="num">${esc(usd(total))}</b>, equivalente al
      <b class="num">${esc(pct((total / 187730) * 100, 1))}</b> de la exposición agregada.</p>
    <p>La categoría con más valor es <b>${esc(top ? top[0] : "—")}</b>
      (${esc(top ? usd(top[1]) : "—")}). No todo monto perseguido se cobra: el valor aquí mide exposición, no recuperación.</p>
  </div>`;
}

/** Régimen de sanciones como cronología tabular. */
export function renderSanctions(data) {
  const rows = data.sanctions_regime ?? [];
  if (!rows.length) return `<div class="empty">Sin medidas de sanciones registradas.</div>`;
  return dataTable({
    caption: "Medidas de sanción, instrumento aplicado y efecto operativo",
    columns: [
      { label: "Fecha" },
      { label: "Actor" },
      { label: "Instrumento" },
      { label: "Efecto operativo" },
      { label: "Alcance" },
      { label: "Capa" },
    ],
    rows: rows.map((row) => [
      esc(dateShort(row.date)),
      esc(row.actor),
      `<span class="table__name">${esc(row.instrument)}</span>`,
      esc(row.effect),
      esc(row.scope),
      tierMark(row.tier),
    ]),
  });
}

/** Nota sobre por qué las sanciones son un capítulo de deuda y no un anexo. */
export function renderSanctionsNote() {
  return `<div class="flow-note">
    <p>Una sanción no crea deuda, pero determina qué pagos son legales. Ninguna estructura de canje con tenedores
    estadounidenses puede ejecutarse sin un marco de licencias estable: por eso este observatorio trata el régimen
    de sanciones como parte de la ingeniería de recuperación y no como un apéndice político.</p>
  </div>`;
}

/** Mapa institucional. */
export function renderInstitutional(data) {
  const rows = data.institutional_map ?? [];
  if (!rows.length) return `<div class="empty">Sin actores institucionales registrados.</div>`;
  const order = { deudor: 0, acreedor: 1, tribunal: 2, regulador: 3, multilateral: 4, litigante: 5, custodio: 6, observatorio: 7 };
  const ordered = rows
    .slice()
    .sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9) || a.name.localeCompare(b.name, "es"));
  return dataTable({
    caption: "Actores con capacidad de decisión o de bloqueo sobre el proceso",
    columns: [
      { label: "Actor" },
      { label: "Rol" },
      { label: "Tipo" },
      { label: "País o ámbito" },
      { label: "Influencia" },
      { label: "Capa" },
    ],
    rows: ordered.map((row) => [
      `<span class="table__name">${esc(row.name)}</span>
       <span class="table__note">${esc(row.note)}</span>`,
      esc(row.role),
      esc(row.type),
      esc(row.country),
      esc(row.influence),
      tierMark(row.tier),
    ]),
  });
}

/** Distribución de influencia, para el gráfico de barras del mapa institucional. */
export function renderInstitutionalBars(data) {
  const rows = data.institutional_map ?? [];
  const weights = { alta: 3, media: 2, baja: 1 };
  const grouped = rows.reduce((acc, row) => {
    const key = row.influence ?? "baja";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  return `<div class="stack">${["alta", "media", "baja"]
    .map(
      (level) => `<div>
        <div class="between">
          <span class="mono">Influencia ${esc(level)}</span>
          <span class="mono">${esc(num(grouped[level] ?? 0))} actores</span>
        </div>
        <div class="meter" role="img" aria-label="${esc(num(grouped[level] ?? 0))} actores con influencia ${esc(level)}">
          <div class="meter__fill" style="width:${(((grouped[level] ?? 0) / (rows.length || 1)) * 100).toFixed(1)}%;
            background:${level === "alta" ? "var(--accent)" : level === "media" ? "var(--accent-cool)" : "var(--ink-3)"}"></div>
        </div>
      </div>`
    )
    .join("")}</div>
  <div class="chart-legend">
    <span class="legend__item"><span class="legend__swatch" style="background:var(--accent)"></span>Puede bloquear</span>
    <span class="legend__item"><span class="legend__swatch" style="background:var(--accent-cool)"></span>Puede condicionar</span>
    <span class="legend__item"><span class="legend__swatch" style="background:var(--ink-3)"></span>Puede informar</span>
  </div>
  <p class="chart-note">Ponderación cualitativa: ${esc(num((weights.alta * (grouped.alta ?? 0) + weights.media * (grouped.media ?? 0) + weights.baja * (grouped.baja ?? 0))))} puntos de influencia sobre ${esc(num(rows.length))} actores.</p>`;
}

/** Comités de acreedores como tabla compacta para impresión. */
export function renderCommitteesTable(data) {
  const rows = data.creditor_committees ?? [];
  if (!rows.length) return "";
  return panelSection(
    "Grupos organizados",
    dataTable({
      caption: "Grupos de acreedores y foros con capacidad de negociación",
      compact: true,
      columns: [
        { label: "Grupo" },
        { label: "Tipo" },
        { label: "Estado" },
        { label: "Presión" },
        { label: "Capa" },
      ],
      rows: rows.map((row) => [
        `<span class="table__name">${esc(row.name)}</span>
         <span class="table__note">${esc(row.agenda)}</span>`,
        esc(row.type),
        esc(row.status),
        esc(row.leverage),
        tierMark(row.tier),
      ]),
    })
  );
}

/** Aviso de lectura de la sección. */
export function renderEnforcementNote() {
  return `<div class="flow-note">
    <p>Los importes de esta sección no son deuda adicional: son medidas sobre activos que podrían materializarse
    o no. Se documentan porque su existencia cambia el orden de prelación y el valor disponible para una
    negociación voluntaria.</p>
  </div>`;
}

export { tierBadge };
