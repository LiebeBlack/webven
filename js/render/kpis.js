/**
 * js/render/kpis.js — Indicadores clave
 *
 * Cada indicador es una tarjeta expandible. Cerrada muestra el valor y su capa
 * de procedencia; abierta revela desglose, nota metodológica, bloque de cálculo
 * reproducible, conciliación con la cifra reportada y fuentes.
 */

import {
  esc,
  tierBadge,
  sparkline,
  dataTable,
  calcBox,
  reconciliationBox,
  sourceListBlock,
  expandableHeader,
  expandableBody,
  panelSection,
  formatKpiValue,
  anchorId,
} from "./parts.js";
import { num, pct, usd, signed, deltaDirection } from "../format.js";
import { verifyCalc } from "../calc/index.js";
import { THRESHOLDS } from "../config.js";

/** Etiquetas legibles para los grupos de indicadores. */
const GROUP_LABELS = {
  stock: "Formación de stock",
  arbitral: "Acreencia arbitral",
  macro: "Capacidad de pago",
  calidad: "Calidad de la acreencia",
  historia: "Lectura histórica",
};

/** Umbral de alerta aplicable a un indicador, si corresponde. */
function thresholdNote(kpi) {
  if (kpi.id === "deuda-pib" && Number(kpi.value_pct) > THRESHOLDS.debtToGdpAlert) {
    return `<p class="chart-note">Supera el umbral de alerta de ${esc(num(THRESHOLDS.debtToGdpAlert))} % del PIB definido en este observatorio.</p>`;
  }
  if (kpi.id === "deuda-exportaciones" && Number(kpi.value_times) > THRESHOLDS.debtToExportsAlert / 100) {
    return `<p class="chart-note">El stock equivale a más de ${esc(num(THRESHOLDS.debtToExportsAlert))} % de las exportaciones anuales.</p>`;
  }
  if (kpi.id === "cobertura-reservas" && Number(kpi.value_pct) < THRESHOLDS.reserveCoverageAlertPct) {
    return `<p class="chart-note">Por debajo del ${esc(num(THRESHOLDS.reserveCoverageAlertPct))} % de cobertura: no hay colchón efectivo.</p>`;
  }
  return "";
}

/** Desglose interno del indicador. */
function breakdownBlock(kpi) {
  if (!Array.isArray(kpi.breakdown) || kpi.breakdown.length === 0) return "";
  const rows = kpi.breakdown.map((item) => [
    esc(item.label),
    esc(item.value_mm !== undefined ? num(item.value_mm, 0) : num(item.value_pct, 2)),
    `US$ MM`,
    `<span class="tier-mark tier-mark--${esc(item.tier ?? "reportado")}">${esc(item.tier ?? "reportado")}</span>`,
  ]);
  return panelSection(
    "Desglose",
    dataTable({
      caption: `Composición declarada de ${kpi.label}`,
      compact: true,
      columns: [
        { label: "Componente" },
        { label: "Valor", align: "num" },
        { label: "Unidad" },
        { label: "Capa" },
      ],
      rows,
    })
  );
}

/** Bloque de cálculo reproducible, con recálculo hecho en esta sesión. */
function calcBlock(kpi) {
  if (!kpi.calc) return "";
  let recomputed = null;
  try {
    const result = verifyCalc(kpi);
    recomputed = { value: result.computed, deltaPct: result.deltaPct, tolerancePct: result.tolerancePct };
  } catch (error) {
    recomputed = { value: Number.NaN, deltaPct: Number.NaN, tolerancePct: Number.NaN };
  }
  return calcBox(kpi.calc, { recomputed });
}

/** Tarjeta de un indicador. */
export function renderKpiCard(kpi) {
  const id = anchorId("kpi", kpi.id);
  const value = formatKpiValue(kpi);
  const direction = deltaDirection(kpi.delta_yoy_pct, { invert: false });
  const deltaClass = `delta delta--${direction}`;
  const delta =
    kpi.delta_yoy_pct !== undefined && kpi.delta_yoy_pct !== null
      ? `<span class="${deltaClass}">${esc(signed(kpi.delta_yoy_pct, 1))} anual</span>`
      : "";

  const aside = `${tierBadge(kpi.tier)}
    ${kpi.as_of ? `<span style="display:block;margin-top:var(--sp-2)">${esc(kpi.as_of)}</span>` : ""}`;

  const content = [
    kpi.note ? `<div class="prose"><p>${esc(kpi.note)}</p></div>` : "",
    kpi.sparkline?.length ? `<div style="margin-top:var(--sp-4)">${sparkline(kpi.sparkline)}</div>` : "",
    thresholdNote(kpi),
    breakdownBlock(kpi),
    calcBlock(kpi),
    reconciliationBox(kpi.reconciliation),
    sourceListBlock(kpi.source_ids),
    `<div class="expandable__section">
      <p class="expandable__section-title">Cita sugerida</p>
      <p class="mono" style="font-size:var(--fs-xs);color:var(--ink-2)">
        «${esc(kpi.label)}»: ${esc(value)}${kpi.as_of ? `, al ${esc(kpi.as_of)}` : ""}.
        Observatorio Arquitectónico de la Deuda Soberana de Venezuela.
      </p>
    </div>`,
  ]
    .filter(Boolean)
    .join("");

  return `<article class="panel expandable" id="${esc(id)}" data-expandable data-expandable-group="kpis">
    ${expandableHeader({
      id,
      eyebrow: `${GROUP_LABELS[kpi.group] ?? "Indicador"} · ${kpi.unit}`,
      title: kpi.label,
      subtitle: kpi.sublabel,
      value,
      aside,
    })}
    ${expandableBody(id, { label: `Detalle de ${kpi.label}`, content })}
    <div class="panel__footer">
      <span class="row">${delta}</span>
      <span class="row mono">${esc(kpi.id)}</span>
    </div>
  </article>`;
}

/** Retícula completa de indicadores. */
export function renderKPIs(data) {
  const kpis = data.kpis ?? [];
  if (!kpis.length) {
    return `<div class="empty">El dataset no contiene indicadores.</div>`;
  }
  return kpis.map(renderKpiCard).join("");
}

/** Nota metodológica general que acompaña a la retícula. */
export function renderKpiNote(data) {
  const meta = data.meta ?? {};
  const counts = (data.kpis ?? []).reduce((acc, kpi) => {
    acc[kpi.tier] = (acc[kpi.tier] ?? 0) + 1;
    return acc;
  }, {});
  const detail = Object.entries(counts)
    .map(([tier, count]) => `${tier}: ${count}`)
    .join(" · ");
  return `<div class="flow-note">
    <p>${esc(meta.methodology_summary ?? "")}</p>
    <p class="mono" style="margin-top:var(--sp-2)">Indicadores por capa · ${esc(detail)}</p>
    <p class="mono" style="margin-top:var(--sp-2)">
      Los indicadores de capacidad de pago se publican con su sensibilidad: un ratio único sobre un PIB
      estimado con margen de error sería una precisión falsa.
    </p>
  </div>`;
}
