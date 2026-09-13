/**
 * js/render/mechanisms.js — Ingeniería de recuperación
 *
 * Un mecanismo no es una idea: es un conjunto de prerrequisitos, riesgos y
 * precedentes. La tarjeta abierta muestra exactamente eso, y el filtro de
 * estado separa lo que ya existe (operativo, precedente) de lo que solo está
 * propuesto, que es la distinción que más se confunde en el debate público.
 */

import {
  esc,
  tierBadge,
  tierMark,
  dataTable,
  sourceListBlock,
  expandableHeader,
  expandableBody,
  panelSection,
  meter,
  anchorId,
} from "./parts.js";
import { num, pct, usd } from "../format.js";
import { CLASSES } from "../config.js";

const CATEGORY_LABELS = {
  fideicomiso: "Fideicomiso y escrow",
  mercado: "Instrumentos de mercado",
  legal: "Ingeniería jurídica",
  colateral: "Colateral y flujos",
  multilateral: "Vía multilateral",
  fiscal: "Regla fiscal y fondo",
  regulatorio: "Régimen regulatorio",
};

const STATUS_LABELS = {
  operativo: "Operativo",
  precedente: "Con precedente",
  propuesta: "Propuesto",
  descartado: "Descartado",
  parcial: "Parcial",
};

/** Chips de filtro por categoría y estado. */
export function renderMechanismFilters(data) {
  const mechanisms = data.recovery_mechanisms ?? [];
  const categories = [...new Set(mechanisms.map((m) => m.category))];
  const statuses = [...new Set(mechanisms.map((m) => m.status))];

  return `<div class="filters__group">
      <span class="filters__label">Categoría</span>
      <button class="chip ${CLASSES.active}" type="button" data-filter-mechanism-category="all" aria-pressed="true">
        Todas <span class="chip__count">${num(mechanisms.length)}</span>
      </button>
      ${categories
        .map((category) => {
          const count = mechanisms.filter((m) => m.category === category).length;
          return `<button class="chip" type="button" data-filter-mechanism-category="${esc(category)}" aria-pressed="false">
            ${esc(CATEGORY_LABELS[category] ?? category)} <span class="chip__count">${num(count)}</span>
          </button>`;
        })
        .join("")}
    </div>
    <div class="filters__spacer"></div>
    <div class="filters__group">
      <span class="filters__label">Estado</span>
      <button class="chip ${CLASSES.active}" type="button" data-filter-mechanism-status="all" aria-pressed="true">Todos</button>
      ${statuses
        .map(
          (status) => `<button class="chip" type="button" data-filter-mechanism-status="${esc(status)}" aria-pressed="false">
            ${esc(STATUS_LABELS[status] ?? status)}
          </button>`
        )
        .join("")}
    </div>`;
}

/** Tarjeta expandible de un mecanismo. */
export function renderMechanismCard(mechanism) {
  const id = anchorId("mecanismo", mechanism.id);
  const score = Number(mechanism.fit_score) || 0;

  const content = [
    `<div class="prose"><p>${esc(mechanism.description)}</p></div>`,
    panelSection(
      "Base jurídica",
      `<div class="prose"><p>${esc(mechanism.legal_basis)}</p></div>`
    ),
    panelSection(
      "Capacidad estimada de la acreencia que podría atender",
      `<div class="between">
        <span class="label">Alcance</span>
        <span class="value">${esc(usd(mechanism.capacity_mm))}</span>
      </div>
      ${meter(mechanism.capacity_mm, 187730, { variant: mechanism.capacity_mm > 100000 ? "meter--cool" : "" })}
      <p class="chart-note">Referencia: exposición agregada de ${esc(usd(187730))}. El alcance no implica que el instrumento resuelva ese monto,
      sino que a esa escala queda expuesto.</p>`
    ),
    panelSection(
      "Prerrequisitos",
      mechanism.prerequisites?.length
        ? `<ul class="prose">${mechanism.prerequisites.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
        : `<p class="muted">Sin prerrequisitos formales declarados.</p>`
    ),
    panelSection(
      "Riesgos",
      mechanism.risks?.length
        ? `<ul class="prose">${mechanism.risks.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
        : ""
    ),
    panelSection("Precedente", `<div class="prose"><p>${esc(mechanism.precedent ?? "Sin precedente documentado.")}</p></div>`),
    panelSection(
      "Encaje en el caso venezolano",
      `<div class="between">
        <span class="label">Puntaje de este observatorio</span>
        <span class="value">${esc(num(score))} / 5</span>
      </div>
      ${meter(score, 5, { variant: score >= 4 ? "meter--cool" : score <= 2 ? "meter--alert" : "" })}
      <p class="chart-note">El puntaje pondera viabilidad jurídica, disponibilidad de instrumento y coherencia con la estructura
      actual de la deuda. No es una recomendación de política.</p>`
    ),
    sourceListBlock(mechanism.source_ids),
  ]
    .filter(Boolean)
    .join("");

  return `<article class="panel expandable" id="${esc(id)}" data-expandable data-expandable-group="mecanismos"
    data-mechanism-category="${esc(mechanism.category)}" data-mechanism-status="${esc(mechanism.status)}">
    ${expandableHeader({
      id,
      eyebrow: `${CATEGORY_LABELS[mechanism.category] ?? mechanism.category} · ${STATUS_LABELS[mechanism.status] ?? mechanism.status}`,
      title: mechanism.name,
      subtitle: mechanism.summary,
      value: `<span class="num">${esc(usd(mechanism.capacity_mm))}</span>`,
      aside: `${tierBadge(mechanism.tier)}<span style="display:block;margin-top:var(--sp-2)">encaje ${esc(num(score))}/5</span>`,
    })}
    ${expandableBody(id, { label: `Detalle del mecanismo ${mechanism.name}`, content })}
    <div class="panel__footer">
      <span class="mono">${esc(mechanism.id)}</span>
      <span class="mono">${esc(STATUS_LABELS[mechanism.status] ?? mechanism.status)}</span>
    </div>
  </article>`;
}

export function renderMechanisms(data) {
  const mechanisms = data.recovery_mechanisms ?? [];
  if (!mechanisms.length) return `<div class="empty">Sin mecanismos registrados.</div>`;
  const ordered = mechanisms
    .slice()
    .sort((a, b) => Number(b.fit_score) - Number(a.fit_score) || Number(b.capacity_mm) - Number(a.capacity_mm));
  return ordered.map(renderMechanismCard).join("");
}

/** Tabla resumen de mecanismos. */
export function renderMechanismsTable(data) {
  const mechanisms = data.recovery_mechanisms ?? [];
  if (!mechanisms.length) return "";
  const rows = mechanisms.map((mechanism) => [
    `<span class="table__name">${esc(mechanism.name)}</span>
     <span class="table__note">${esc(mechanism.summary)}</span>`,
    esc(CATEGORY_LABELS[mechanism.category] ?? mechanism.category),
    esc(STATUS_LABELS[mechanism.status] ?? mechanism.status),
    esc(num(mechanism.capacity_mm)),
    esc(`${num(mechanism.fit_score)}/5`),
    `${mechanism.prerequisites?.length ?? 0} · ${mechanism.risks?.length ?? 0}`,
    tierMark(mechanism.tier),
  ]);
  return dataTable({
    caption: "Mecanismos evaluados: alcance, estado y encaje",
    columns: [
      { label: "Mecanismo" },
      { label: "Categoría" },
      { label: "Estado" },
      { label: "Alcance (MM USD)", align: "num" },
      { label: "Encaje", align: "num" },
      { label: "Prerreq. · riesgos", align: "num" },
      { label: "Capa" },
    ],
    rows,
    foot: [
      `<b>${esc(num(mechanisms.length))} mecanismos</b>`,
      "",
      "",
      `<b>${esc(num(mechanisms.reduce((acc, m) => acc + Number(m.capacity_mm || 0), 0)))}</b>`,
      "",
      "",
      "",
    ],
  });
}

/** Instrumentos jurídicos aplicables. */
export function renderLegalInstruments(data) {
  const instruments = data.legal_instruments ?? [];
  if (!instruments.length) return `<div class="empty">Sin instrumentos jurídicos registrados.</div>`;
  return dataTable({
    caption: "Instrumentos jurídicos que condicionan cualquier reestructuración",
    columns: [
      { label: "Instrumento" },
      { label: "Jurisdicción" },
      { label: "Familia" },
      { label: "Relevancia para el caso" },
      { label: "Dónde se aplica" },
      { label: "Capa" },
    ],
    rows: instruments.map((instrument) => [
      `<span class="table__name">${esc(instrument.name)}</span>
       <span class="table__note">${esc(instrument.description)}</span>`,
      esc(instrument.jurisdiction),
      esc(instrument.family),
      esc(instrument.relevance),
      esc(instrument.application),
      tierMark(instrument.tier),
    ]),
  });
}

/** Conteo por estado, para el encabezado de la sección. */
export function renderMechanismSummary(data) {
  const mechanisms = data.recovery_mechanisms ?? [];
  const byStatus = mechanisms.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1;
    return acc;
  }, {});
  return `<div class="row">
    ${Object.entries(byStatus)
      .map(([status, count]) => {
        const cls = status === "propuesta" ? "pill--info" : status === "operativo" ? "pill--ok" : "pill--warn";
        return `<span class="pill ${cls}">${esc(STATUS_LABELS[status] ?? status)} · ${num(count)}</span>`;
      })
      .join("")}
    <span class="muted mono">${esc(
      pct(
        (mechanisms.filter((m) => m.status === "propuesta").length / (mechanisms.length || 1)) * 100,
        0
      )
    )} del catálogo son propuestas, no instrumentos existentes</span>
  </div>`;
}
