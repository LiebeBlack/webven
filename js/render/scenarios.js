/**
 * js/render/scenarios.js — Escenarios de recuperación y simulador
 *
 * Los escenarios están precalculados y verificados. El simulador permite mover
 * los supuestos en vivo: comparte la misma función de cálculo, así que lo que
 * muestra la interfaz y lo que valida el auditor son exactamente lo mismo.
 */

import {
  esc,
  tierBadge,
  dataTable,
  sourceListBlock,
  expandableHeader,
  expandableBody,
  panelSection,
  meter,
  anchorId,
} from "./parts.js";
import { num, pct, usd } from "../format.js";
import { SIMULATOR_DEFAULTS, SIMULATOR_LIMITS, THRESHOLDS } from "../config.js";

/** Nominal base compartido por todos los escenarios (scenarios.base_nominal_mm).
 *  Constante de respaldo por si el dataset llegara sin el bloque scenarios. */
const BASE_NOMINAL_MM = 75000;

/** Tarjeta expandible de un escenario precalculado. */
export function renderScenarioCard(scenario) {
  const id = anchorId("escenario", scenario.id);
  const probability = Number(scenario.probability_pct) || 0;
  const focused = probability >= THRESHOLDS.scenarioProbabilityFocusPct;

  const content = [
    `<div class="prose"><p>${esc(scenario.rationale)}</p></div>`,
    `<div class="sim__out" style="margin-top:var(--sp-4)">
      <div class="sim__stat"><span class="label">Quita</span><span class="value">${esc(pct(scenario.haircut_pct, 0))}</span></div>
      <div class="sim__stat"><span class="label">Cupón</span><span class="value">${esc(pct(scenario.coupon_pct, 2))}</span></div>
      <div class="sim__stat"><span class="label">Plazo</span><span class="value">${esc(num(scenario.tenor_years))} años</span>
        <span class="table__note">gracia ${esc(num(scenario.grace_years))} años</span></div>
      <div class="sim__stat"><span class="label">Descuento</span><span class="value">${esc(pct(scenario.discount_rate_pct, 2))}</span></div>
      <div class="sim__stat"><span class="label">VPN de la recuperación</span><span class="value">${esc(usd(scenario.recovery_npv_mm))}</span></div>
      <div class="sim__stat"><span class="label">Sobre el nominal</span><span class="value">${esc(pct(scenario.recovery_pct_of_nominal, 2))}</span></div>
      <div class="sim__stat"><span class="label">Pagos sin descontar</span><span class="value">${esc(usd(scenario.undiscounted_mm))}</span></div>
      <div class="sim__stat"><span class="label">Nominal reestructurado</span><span class="value">${esc(usd(scenario.nominal_restructured_mm))}</span></div>
    </div>`,
    panelSection(
      "Supuestos",
      `<ul class="prose">${(scenario.assumptions ?? []).map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
    ),
    panelSection(
      "Riesgos",
      (scenario.risks ?? []).length
        ? `<ul class="prose">${scenario.risks.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
        : ""
    ),
    panelSection(
      "Fórmula aplicada",
      `<div class="calc-box">
        <code class="formula">${esc(scenario.calc?.formula ?? "—")}</code>
        <dl class="calc-grid">
          <div><dt>Nominal base</dt><dd>${esc(usd(BASE_NOMINAL_MM))}</dd></div>
          <div><dt>Cupón por período</dt><dd>${esc(usd(scenario.coupon_mm_per_period))}</dd></div>
          <div><dt>Períodos totales</dt><dd>${esc(num(Number(scenario.tenor_years) + Number(scenario.grace_years)))}</dd></div>
        </dl>
        <p class="muted" style="margin-top:var(--sp-3)">
          El servicio anual completo se genera en el simulador con esta misma fórmula, año por año.
        </p>
      </div>`
    ),
    sourceListBlock(scenario.source_ids),
  ]
    .filter(Boolean)
    .join("");

  return `<article class="panel expandable ${focused ? "panel--accent" : ""}" id="${esc(id)}"
    data-expandable data-expandable-group="escenarios">
    ${expandableHeader({
      id,
      eyebrow: `Escenario · probabilidad asignada ${pct(probability, 0)}`,
      title: scenario.name,
      subtitle: scenario.short,
      value: `<span class="num">${esc(pct(scenario.recovery_pct_of_nominal, 2))}</span>
        <span class="muted mono">del nominal recuperado</span>`,
      aside: `${tierBadge(scenario.tier)}<span style="display:block;margin-top:var(--sp-2)">${esc(
        usd(scenario.recovery_npv_mm)
      )}</span>`,
    })}
    ${expandableBody(id, { label: `Detalle del escenario ${scenario.name}`, content })}
    <div class="panel__pad" style="padding-top:0">
      ${meter(probability, 100, { variant: focused ? "meter--cool" : "" })}
      <p class="chart-note">Probabilidad asignada por este observatorio: ${esc(pct(probability, 0))}.
      Suma de probabilidades de todos los escenarios: 100 %.</p>
    </div>
    <div class="panel__footer">
      <span class="mono">${esc(scenario.id)}</span>
      <span class="mono">${esc(pct(scenario.haircut_pct, 0))} de quita</span>
    </div>
  </article>`;
}

export function renderScenarios(data) {
  const scenarios = data.scenarios?.items ?? [];
  if (!scenarios.length) return `<div class="empty">Sin escenarios definidos.</div>`;
  return scenarios
    .slice()
    .sort((a, b) => Number(b.probability_pct) - Number(a.probability_pct))
    .map(renderScenarioCard)
    .join("");
}

/** Tabla comparativa de escenarios. */
export function renderScenariosTable(data) {
  const scenarios = data.scenarios?.items ?? [];
  if (!scenarios.length) return "";
  return dataTable({
    caption: "Comparación de escenarios: quita, cupón, plazo y recuperación efectiva",
    columns: [
      { label: "Escenario" },
      { label: "Prob.", align: "num" },
      { label: "Quita", align: "num" },
      { label: "Cupón", align: "num" },
      { label: "Plazo", align: "num" },
      { label: "Gracia", align: "num" },
      { label: "Descuento", align: "num" },
      { label: "VPN (MM USD)", align: "num" },
      { label: "Recuperación", align: "num" },
    ],
    rows: scenarios.map((scenario) => [
      `<span class="table__name">${esc(scenario.name)}</span>
       <span class="table__note">${esc(scenario.short)}</span>`,
      esc(pct(scenario.probability_pct, 0)),
      esc(pct(scenario.haircut_pct, 0)),
      esc(pct(scenario.coupon_pct, 2)),
      esc(num(scenario.tenor_years)),
      esc(num(scenario.grace_years)),
      esc(pct(scenario.discount_rate_pct, 2)),
      esc(num(scenario.recovery_npv_mm, 2)),
      esc(pct(scenario.recovery_pct_of_nominal, 2)),
    ]),
    foot: [
      "<b>Promedio ponderado por probabilidad</b>",
      `<b>${esc(pct(scenarios.reduce((acc, s) => acc + Number(s.probability_pct), 0), 0))}</b>`,
      "",
      "",
      "",
      "",
      "",
      `<b>${esc(
        num(
          scenarios.reduce((acc, s) => acc + (Number(s.probability_pct) / 100) * Number(s.recovery_npv_mm), 0),
          2
        )
      )}</b>`,
      `<b>${esc(
        pct(
          scenarios.reduce((acc, s) => acc + (Number(s.probability_pct) / 100) * Number(s.recovery_pct_of_nominal), 0),
          2
        )
      )}</b>`,
    ],
  });
}

/** Controles del simulador. */
export function renderSimulatorControls() {
  const field = (id, label, key, unit = "", decimals = 0) => {
    const limits = SIMULATOR_LIMITS[key];
    return `<div class="sim__field">
      <div class="sim__field-head">
        <label class="sim__field-label" for="${id}">${esc(label)}</label>
        <output class="sim__value" for="${id}" data-sim-output="${key}">
          ${esc(num(SIMULATOR_DEFAULTS[key], decimals))}${esc(unit)}
        </output>
      </div>
      <input class="range" type="range" id="${id}" data-sim-input="${key}"
        min="${limits.min}" max="${limits.max}" step="${limits.step}"
        value="${SIMULATOR_DEFAULTS[key]}" aria-describedby="${id}-help" />
      <p class="chart-note" id="${id}-help">
        Rango admitido: ${esc(num(limits.min))} a ${esc(num(limits.max))}${esc(unit)}.
      </p>
    </div>`;
  };

  return `${field("sim-haircut", "Quita sobre el nominal", "haircutPct", " %")}
    ${field("sim-coupon", "Cupón anual", "couponPct", " %", 2)}
    ${field("sim-tenor", "Plazo", "tenorYears", " años")}
    ${field("sim-grace", "Período de gracia", "graceYears", " años")}
    ${field("sim-discount", "Tasa de descuento", "discountRatePct", " %", 2)}
    <div class="row">
      <button class="chip" type="button" data-sim-reset>Restablecer supuestos</button>
      <button class="chip" type="button" data-sim-export>Descargar servicio proyectado (CSV)</button>
    </div>`;
}

/** Salidas del simulador (se rellenan en vivo). */
export function renderSimulatorOutputs() {
  const stat = (label, key) =>
    `<div class="sim__stat">
      <span class="label">${esc(label)}</span>
      <span class="value" data-sim-result="${key}">—</span>
    </div>`;
  return `${stat("Nominal reestructurado", "nominal")}
    ${stat("Cupón anual", "coupon")}
    ${stat("VPN de la recuperación", "npv")}
    ${stat("Recuperación sobre el nominal", "recovery")}
    ${stat("Pago total sin descontar", "undiscounted")}
    ${stat("Diferencia contra el nominal", "haircutValue")}`;
}

/** Marco del simulador, con su aviso de que es una simulación. */
export function renderSimulator(data) {
  const base = data.scenarios?.base_nominal_mm ?? SIMULATOR_DEFAULTS.nominalMm;
  return `<div class="panel panel--static">
    <div class="panel__head">
      <div>
        <span class="panel__eyebrow">Simulación interactiva · misma fórmula que la validación</span>
        <h3 class="panel__title">Simulador de estructura de recuperación</h3>
        <p class="panel__sub">Nominal base: ${esc(usd(base))} · fecha de valuación: ${esc(
          data.scenarios?.valuation_date ?? data.meta?.valuation_date ?? "—"
        )}</p>
      </div>
      ${tierBadge("calculado")}
    </div>
    <div class="panel__pad">
      <div class="sim">
        <div class="sim__controls" id="simulator-controls" role="group" aria-label="Supuestos de la simulación">
          ${renderSimulatorControls()}
        </div>
        <div class="stack">
          <div class="sim__out" id="simulator-outputs" aria-live="polite" aria-atomic="true">
            ${renderSimulatorOutputs()}
          </div>
          <div class="chart-frame" id="simulator-chart-frame">
            <canvas id="chart-simulator" aria-label="Servicio anual proyectado" role="img"></canvas>
          </div>
          <div class="table-wrap" id="simulator-schedule"></div>
          <p class="chart-note">
            ${esc(data.scenarios?.note ?? "")}
            Una simulación no es un pronóstico: mover los supuestos cambia el resultado, y ese es precisamente el punto.
          </p>
        </div>
      </div>
    </div>
  </div>`;
}
