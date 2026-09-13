/**
 * js/render/creditors.js — Mapa de acreedores
 *
 * Los acreedores no son un bloque homogéneo: cada clase tiene distinta
 * capacidad jurídica, distinta paciencia y distinta recuperación esperada.
 * La tabla ordena esa heterogeneidad y los filtros permiten aislar cada clase.
 */

import { esc, tierBadge, tierMark, dataTable, sourceListBlock, panelSection, meter } from "./parts.js";
import { num, pct, usd, dateShort } from "../format.js";
import { CATEGORY_LABELS, CATEGORY_COLORS, CLASSES } from "../config.js";

/** Chips de filtro por tipo de acreedor. */
export function renderCreditorFilters(data) {
  const creditors = data.creditors ?? [];
  const types = [...new Set(creditors.map((c) => c.type))];
  const chips = [
    `<button class="chip ${CLASSES.active}" type="button" data-filter-type="all" aria-pressed="true">
      Todos <span class="chip__count">${num(creditors.length)}</span>
    </button>`,
    ...types.map((type) => {
      const count = creditors.filter((c) => c.type === type).length;
      const exposure = creditors.filter((c) => c.type === type).reduce((acc, c) => acc + Number(c.exposure_mm || 0), 0);
      return `<button class="chip" type="button" data-filter-type="${esc(type)}" aria-pressed="false">
        ${esc(CATEGORY_LABELS[type] ?? type)} <span class="chip__count">${num(count)} · ${esc(usd(exposure))}</span>
      </button>`;
    }),
  ];

  const statuses = [...new Set(creditors.map((c) => c.status))].sort();
  const select = `<label class="field">
    <span class="filters__label">Estado de la acreencia</span>
    <select data-filter-status>
      <option value="all">Todos los estados</option>
      ${statuses.map((status) => `<option value="${esc(status)}">${esc(status)}</option>`).join("")}
    </select>
  </label>`;

  const order = `<label class="field">
    <span class="filters__label">Orden</span>
    <select data-filter-order>
      <option value="exposure">Mayor exposición</option>
      <option value="share">Mayor participación</option>
      <option value="name">Nombre</option>
      <option value="outlook">Recuperación estimada</option>
    </select>
  </label>`;

  return `<div class="filters__group">${chips.join("")}</div>
    <div class="filters__spacer"></div>
    ${select}
    ${order}`;
}

/** Fila de la tabla de acreedores. */
function creditorRow(creditor) {
  const color = CATEGORY_COLORS[creditor.type] ?? CATEGORY_COLORS.otro;
  const outlook = creditor.recovery_outlook ?? {};
  return [
    `<span class="table__name">${esc(creditor.name)}</span>
     <span class="table__note">${esc(creditor.jurisdiction ?? "")}</span>
     <span class="table__note" data-creditor-note>${esc(creditor.note ?? "")}</span>`,
    `<span class="tier-mark" style="color:${esc(color)}">${esc(CATEGORY_LABELS[creditor.type] ?? creditor.type)}</span>`,
    esc(num(creditor.exposure_mm)),
    esc(pct(creditor.share_pct, 2)),
    esc(creditor.status ?? "—"),
    esc(creditor.leverage ?? "—"),
    `${esc(outlook.label ?? "—")}
     <span class="table__note">${outlook.pct_estimate !== undefined ? `${esc(num(outlook.pct_estimate))} % estimado` : ""}</span>`,
    `<span class="tier-mark tier-mark--${esc(creditor.tier)}">${esc(creditor.tier)}</span>`,
  ];
}

/** Tabla completa, con el orden por defecto (mayor exposición). */
export function renderCreditorsTable(data) {
  const creditors = (data.creditors ?? []).slice().sort((a, b) => Number(b.exposure_mm) - Number(a.exposure_mm));
  if (!creditors.length) return `<div class="empty">Sin acreedores registrados.</div>`;
  const total = creditors.reduce((acc, c) => acc + Number(c.exposure_mm || 0), 0);
  const share = creditors.reduce((acc, c) => acc + Number(c.share_pct || 0), 0);

  return dataTable({
    caption: "Acreedores por exposición, participación y capacidad de negociación",
    columns: [
      { label: "Acreedor y nota de posición" },
      { label: "Clase" },
      { label: "Exposición (MM USD)", align: "num" },
      { label: "Participación", align: "num" },
      { label: "Estado" },
      { label: "Capacidad de presión" },
      { label: "Recuperación estimada" },
      { label: "Capa" },
    ],
    rows: creditors.map(creditorRow),
    rowValues: creditors,
    rowAttributes: (creditor) =>
      `data-creditor-row data-creditor-type="${esc(creditor.type)}" data-creditor-status="${esc(creditor.status)}"`,
    foot: [
      `<b>Total agregado</b>`,
      "",
      `<b>${esc(num(total))}</b>`,
      `<b>${esc(pct(share, 2))}</b>`,
      "",
      "",
      "",
      "",
    ],
  });
}

/** Resumen numérico del bloque de acreedores. */
export function renderCreditorsSummary(data) {
  const creditors = data.creditors ?? [];
  const total = creditors.reduce((acc, c) => acc + Number(c.exposure_mm || 0), 0);
  const state = creditors
    .filter((c) => c.type === "estado" || c.type === "multilateral")
    .reduce((acc, c) => acc + Number(c.exposure_mm || 0), 0);
  const market = creditors
    .filter((c) => c.type === "tenedor_bonos")
    .reduce((acc, c) => acc + Number(c.exposure_mm || 0), 0);
  const arbitral = creditors.filter((c) => c.type === "arbitral").reduce((acc, c) => acc + Number(c.exposure_mm || 0), 0);
  const commercial = creditors
    .filter((c) => c.type === "proveedor" || c.type === "otro")
    .reduce((acc, c) => acc + Number(c.exposure_mm || 0), 0);

  const blocks = [
    { label: "Mercado de capitales", value: market, note: "Reestructurable con mayorías y cláusulas de acción colectiva" },
    { label: "Acreedores de Estado", value: state, note: "Negociación política, plazos largos, cobro preferente" },
    { label: "Acreedores arbitrales", value: arbitral, note: "Títulos ejecutables, horizonte corto, presión judicial alta" },
    { label: "Comerciales y residuales", value: commercial, note: "Atomizados, sin coordinación, recuperación tardía" },
  ];

  return `<div class="stack">
    <div class="row">
      <span class="label">Exposición agregada</span>
      <span class="value">${esc(usd(total))}</span>
      <span class="muted">${esc(num(creditors.length))} clases de acreedor</span>
    </div>
    ${blocks
      .map(
        (block) => `<div>
          <div class="between">
            <span class="mono">${esc(block.label)}</span>
            <span class="mono">${esc(usd(block.value))} · ${esc(pct((block.value / total) * 100, 1))}</span>
          </div>
          ${meter(block.value, total, { variant: block.label.includes("arbitral") ? "meter--alert" : "meter--cool" })}
          <p class="chart-note">${esc(block.note)}</p>
        </div>`
      )
      .join("")}
  </div>`;
}

/** Comités y grupos organizados de acreedores. */
export function renderCreditorCommittees(data) {
  const committees = data.creditor_committees ?? [];
  if (!committees.length) return "";
  return committees
    .map(
      (committee) => `<article class="panel panel--static">
        <div class="panel__pad">
          <div class="between">
            <div>
              <span class="panel__eyebrow">${esc(committee.type)} · capacidad de presión ${esc(committee.leverage)}</span>
              <h3 class="panel__title">${esc(committee.name)}</h3>
            </div>
            ${tierBadge(committee.tier)}
          </div>
          <p class="prose" style="margin-top:var(--sp-3)">${esc(committee.note)}</p>
          <ul class="indicator-list">
            <li><span class="k">Composición</span><span class="v">${esc(committee.composition)}</span></li>
            <li><span class="k">Agenda</span><span class="v">${esc(committee.agenda)}</span></li>
            <li><span class="k">Estado</span><span class="v">${esc(committee.status)}</span></li>
          </ul>
        </div>
        <div class="panel__footer">
          <span>${committee.source_ids?.length ?? 0} fuente(s)</span>
          <span class="mono">${esc(committee.id)}</span>
        </div>
      </article>`
    )
    .join("");
}

/** Historial de calificaciones: cada acción de agencia, fechada. */
export function renderRatingsHistory(data) {
  const ratings = data.ratings_history ?? [];
  if (!ratings.length) return "";
  return panelSection(
    "Historial de calificaciones soberanas",
    dataTable({
      caption: "Acciones de calificación registradas y su justificación",
      compact: true,
      columns: [
        { label: "Fecha" },
        { label: "Agencia" },
        { label: "Acción" },
        { label: "Justificación" },
        { label: "Capa" },
      ],
      rows: ratings.map((entry) => [
        esc(dateShort(entry.date)),
        esc(entry.agency),
        esc(entry.action),
        esc(entry.rationale),
        tierMark(entry.tier),
      ]),
    }),
    {
      note: "Las calificaciones resumen la lectura del mercado sobre la probabilidad de pago; se incluyen porque marcan los momentos en que el costo de refinanciar cambió.",
    }
  );
}

/** Notas de posición de los acreedores, en formato expandible para lectura larga. */
export function renderCreditorNotes(data) {
  const creditors = data.creditors ?? [];
  return creditors
    .map(
      (creditor) => `<article class="panel expandable" data-expandable data-expandable-group="acreedores"
        id="acreedor-${esc(creditor.id)}">
        <button class="expandable__toggle" type="button" aria-expanded="false"
          aria-controls="acreedor-${esc(creditor.id)}-body" data-expandable-toggle>
          <span class="expandable__toggle-main">
            <span class="panel__eyebrow">${esc(CATEGORY_LABELS[creditor.type] ?? creditor.type)} · ${esc(creditor.status)}</span>
            <span class="panel__title" style="display:block">${esc(creditor.name)}</span>
            <span class="value value--lg" style="display:block">${esc(usd(creditor.exposure_mm))}</span>
            <span class="panel__sub" style="display:block">${esc(pct(creditor.share_pct, 2))} de la exposición agregada</span>
          </span>
          <span class="expandable__aside">${tierBadge(creditor.tier)}</span>
          <span class="chev" aria-hidden="true">+</span>
        </button>
        <div class="expandable__body" id="acreedor-${esc(creditor.id)}-body" role="region"
          aria-label="Detalle de ${esc(creditor.name)}">
          <div class="expandable__inner">
            <div class="expandable__reveal">
              <div class="prose"><p>${esc(creditor.note)}</p></div>
              <ul class="indicator-list">
                <li><span class="k">Jurisdicción</span><span class="v">${esc(creditor.jurisdiction)}</span></li>
                <li><span class="k">Instrumentos</span><span class="v">${esc((creditor.instruments ?? []).join(" · "))}</span></li>
                <li><span class="k">Capacidad de presión</span><span class="v">${esc(creditor.leverage)}</span></li>
                <li><span class="k">Recuperación estimada</span><span class="v">${esc(
                  creditor.recovery_outlook?.label ?? "—"
                )}${creditor.recovery_outlook?.pct_estimate !== undefined ? ` (${esc(num(creditor.recovery_outlook.pct_estimate))} %)` : ""}</span></li>
              </ul>
              ${sourceListBlock(creditor.source_ids)}
            </div>
          </div>
        </div>
      </article>`
    )
    .join("");
}
