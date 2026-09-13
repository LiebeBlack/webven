/**
 * js/render/awards.js — Laudos y arbitrajes
 *
 * Cada caso se presenta con capital de condena, valor acumulado calculado,
 * conciliación contra la cifra de prensa cuando existe, estado de anulación y
 * vía de ejecución. Es la sección donde el interés compuesto se ve operar:
 * un laudo de 2014 vale hoy bastante más que cuando se dictó.
 */

import {
  esc,
  tierBadge,
  tierMark,
  dataTable,
  calcBox,
  reconciliationBox,
  sourceListBlock,
  expandableHeader,
  expandableBody,
  panelSection,
  statusPill,
  anchorId,
} from "./parts.js";
import { num, pct, usd, dateShort, signed, deltaDirection, clamp } from "../format.js";
import { verifyCalc } from "../calc/index.js";

const FORUM_LABELS = {
  CIADI: "CIADI (Banco Mundial)",
  ICC: "Cámara de Comercio Internacional",
  "CIADI / ICC / ad hoc": "Foros varios",
  "ICC 20594/GR (referencia agregada)": "Cámara de Comercio Internacional",
};

/** Resumen del bloque arbitral: capital, valor acumulado y reparto por foro. */
export function renderAwardsSummary(data) {
  const cases = data.arbitration_cases ?? [];
  const principal = cases.reduce((acc, c) => acc + Number(c.award_mm || 0), 0);
  const accrued = cases.reduce((acc, c) => acc + Number(c.award_total_mm || 0), 0);
  const modeled = cases.filter((c) => c.interest_rate_assumed_pct).length;
  const byForum = cases.reduce((acc, c) => {
    const key = c.forum === "ICC" ? "ICC" : c.forum === "CIADI" ? "CIADI" : "Otros";
    acc[key] = (acc[key] ?? 0) + Number(c.award_mm || 0);
    return acc;
  }, {});

  return `<div class="sim__out">
    <div class="sim__stat">
      <span class="label">Capital de condenas</span>
      <span class="value">${esc(usd(principal))}</span>
    </div>
    <div class="sim__stat">
      <span class="label">Valor con intereses modelados</span>
      <span class="value">${esc(usd(accrued))}</span>
    </div>
    <div class="sim__stat">
      <span class="label">Casos documentados</span>
      <span class="value">${esc(num(cases.length))}</span>
      <span class="table__note">${esc(num(modeled))} con interés modelado</span>
    </div>
    <div class="sim__stat">
      <span class="label">Reparto por foro</span>
      <span class="value">${esc(num(byForum.CIADI ?? 0))} / ${esc(num(byForum.ICC ?? 0))}</span>
      <span class="table__note">CIADI / ICC, en millones</span>
    </div>
  </div>
  <p class="chart-note">
    El valor acumulado supera el capital en ${esc(pct(((accrued - principal) / principal) * 100, 1))}.
    La brecha crece cada año que pasa sin acuerdo: es el costo financiero del retraso, y lo paga el deudor.
  </p>`;
}

/** Ficha expandible de un caso. */
export function renderAwardCard(record) {
  const id = anchorId("award", record.id);
  const accrued = Number(record.award_total_mm || record.award_mm || 0);
  const principal = Number(record.award_mm || 0);
  const increase = principal ? ((accrued - principal) / principal) * 100 : 0;
  const direction = deltaDirection(increase);

  let recomputed = null;
  if (record.calc) {
    try {
      const result = verifyCalc(record);
      recomputed = { value: result.computed, deltaPct: result.deltaPct, tolerancePct: result.tolerancePct };
    } catch {
      recomputed = null;
    }
  }

  const annulment = record.annulment
    ? panelSection(
        "Anulación",
        `<ul class="indicator-list">
          <li><span class="k">Solicitada</span><span class="v">${record.annulment.requested ? "sí" : "no"}</span></li>
          <li><span class="k">Decisión</span><span class="v">${esc(
            record.annulment.decision_date ? dateShort(record.annulment.decision_date) : "sin fecha publicada"
          )}</span></li>
          <li><span class="k">Resultado</span><span class="v">${esc(record.annulment.outcome)}</span></li>
        </ul>
        <div class="prose" style="margin-top:var(--sp-3)"><p>${esc(record.annulment.note)}</p></div>`
      )
    : "";

  const content = [
    `<div class="prose"><p>${esc(record.note ?? "")}</p></div>`,
    `<div class="sim__out" style="margin-top:var(--sp-4)">
      <div class="sim__stat"><span class="label">Capital de condena</span><span class="value">${esc(usd(principal))}</span></div>
      <div class="sim__stat"><span class="label">Valor acumulado</span><span class="value">${esc(usd(accrued))}</span>
        <span class="delta delta--${direction}">${esc(signed(increase, 1))} sobre el capital</span></div>
      <div class="sim__stat"><span class="label">Tasa asumida</span><span class="value">${
        record.interest_rate_assumed_pct !== undefined && record.interest_rate_assumed_pct !== null
          ? esc(pct(record.interest_rate_assumed_pct, 2))
          : "sin modelar"
      }</span></div>
      <div class="sim__stat"><span class="label">Foro</span><span class="value" style="font-size:var(--fs-sm)">${esc(
        FORUM_LABELS[record.forum] ?? record.forum
      )}</span><span class="table__note">${esc(record.case_number ?? "")}</span></div>
    </div>`,
    calcBox(record.calc, { recomputed }),
    reconciliationBox(record.reconciliation),
    annulment,
    panelSection(
      "Estado y ejecución",
      `<ul class="indicator-list">
        <li><span class="k">Estado</span><span class="v">${statusPill(record.status)}</span></li>
        <li><span class="k">Sector</span><span class="v">${esc(record.sector)}</span></li>
        <li><span class="k">Fecha del laudo</span><span class="v">${esc(
          record.award_date ? dateShort(record.award_date) : "sin fecha individualizada"
        )}</span></li>
      </ul>`
    ),
    sourceListBlock(record.source_ids),
  ]
    .filter(Boolean)
    .join("");

  return `<article class="panel expandable" id="${esc(id)}" data-expandable data-expandable-group="laudos">
    ${expandableHeader({
      id,
      eyebrow: `${record.forum}${record.case_number ? ` · ${record.case_number}` : ""}`,
      title: record.claimant,
      subtitle: record.sector,
      value: esc(usd(accrued)),
      aside: `${tierBadge(record.tier)}
        <span style="display:block;margin-top:var(--sp-2)">${esc(
          record.award_date ? dateShort(record.award_date) : "sin fecha"
        )}</span>
        <span style="display:block;margin-top:var(--sp-2)">${esc(signed(increase, 1))}</span>`,
    })}
    ${expandableBody(id, { label: `Detalle del laudo de ${record.claimant}`, content })}
    <div class="panel__footer">
      <span>${statusPill(record.status)}</span>
      <span class="mono">${esc(record.id)}</span>
    </div>
  </article>`;
}

/** Fichas de todos los casos. */
export function renderAwards(data) {
  const cases = data.arbitration_cases ?? [];
  if (!cases.length) return `<div class="empty">Sin casos arbitrales registrados.</div>`;
  const ordered = cases
    .slice()
    .sort((a, b) => Number(b.award_total_mm || b.award_mm || 0) - Number(a.award_total_mm || a.award_mm || 0));
  return ordered.map(renderAwardCard).join("");
}

/** Tabla de casos para lectura rápida y para impresión. */
export function renderAwardsTable(data) {
  const cases = data.arbitration_cases ?? [];
  if (!cases.length) return "";
  return panelSection(
    "Tabla consolidada de laudos",
    dataTable({
      caption: "Capital, valor acumulado y estado procesal de cada condena firme",
      compact: true,
      columns: [
        { label: "Demandante" },
        { label: "Foro" },
        { label: "Fecha" },
        { label: "Capital", align: "num" },
        { label: "Valor acumulado", align: "num" },
        { label: "Δ", align: "num" },
        { label: "Estado" },
        { label: "Capa" },
      ],
      rows: cases.map((record) => {
        const principal = Number(record.award_mm || 0);
        const accrued = Number(record.award_total_mm || principal);
        return [
          `<span class="table__name">${esc(record.claimant)}</span>
           <span class="table__note">${esc(record.case_number ?? "")}</span>`,
          esc(record.forum),
          esc(record.award_date ? dateShort(record.award_date) : "—"),
          esc(num(principal)),
          esc(num(accrued)),
          esc(pct(((accrued - principal) / (principal || 1)) * 100, 1)),
          esc(record.status),
          tierMark(record.tier),
        ];
      }),
      foot: [
        "<b>Total</b>",
        "",
        "",
        `<b>${esc(num(cases.reduce((acc, c) => acc + Number(c.award_mm || 0), 0)))}</b>`,
        `<b>${esc(num(cases.reduce((acc, c) => acc + Number(c.award_total_mm || c.award_mm || 0), 0)))}</b>`,
        "",
        "",
        "",
      ],
    }),
    { note: "Los porcentajes de crecimiento reflejan la capitalización de intereses con la tasa asumida declarada en cada ficha." }
  );
}

/** Barra visual comparando capital y valor acumulado, sin depender de Chart.js. */
export function renderAwardsBars(data) {
  const cases = (data.arbitration_cases ?? [])
    .slice()
    .sort((a, b) => Number(b.award_mm || 0) - Number(a.award_mm || 0))
    .slice(0, 8);
  const max = Math.max(...cases.map((c) => Number(c.award_total_mm || c.award_mm || 0)), 1);
  return `<div class="stack">${cases
    .map((record) => {
      const principal = Number(record.award_mm || 0);
      const accrued = Number(record.award_total_mm || principal);
      const principalPct = clamp((principal / max) * 100, 0, 100);
      const totalPct = clamp((accrued / max) * 100, 0, 100);
      return `<div>
        <div class="between">
          <span class="mono">${esc(record.claimant)}</span>
          <span class="mono">${esc(usd(accrued))}</span>
        </div>
        <div class="meter" style="height:10px" role="img"
          aria-label="${esc(record.claimant)}: capital ${esc(usd(principal))}, acumulado ${esc(usd(accrued))}">
          <div class="meter__fill" style="width:${totalPct.toFixed(1)}%;background:var(--tier-calculado)"></div>
          <div class="meter__fill" style="width:${principalPct.toFixed(1)}%;background:var(--accent)"></div>
        </div>
      </div>`;
    })
    .join("")}</div>
  <div class="chart-legend">
    <span class="legend__item"><span class="legend__swatch" style="background:var(--accent)"></span>Capital de condena</span>
    <span class="legend__item"><span class="legend__swatch" style="background:var(--tier-calculado)"></span>Valor con intereses modelados</span>
  </div>`;
}
