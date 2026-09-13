/**
 * js/render/matrix.js — Matriz histórica comparada
 *
 * Evalúa cada administración con la misma vara: punto de partida, punto de
 * llegada, instrumento usado, shock absorbido y transparencia. Los hitos se
 * presentan como cronología interna y los indicadores comparables como lista
 * de valores con su capa de procedencia.
 */

import {
  esc,
  tierBadge,
  dataTable,
  calcBox,
  sourceListBlock,
  expandableHeader,
  expandableBody,
  panelSection,
  meter,
  anchorId,
} from "./parts.js";
import { num, pct, usd, signed, dateShort } from "../format.js";
import { verifyCalc } from "../calc/index.js";
import { renderTimelineItem } from "./timeline.js";

/** Escala de crecimiento usada como referencia visual de las barras. */
const GROWTH_SCALE = 600;

function indicatorList(indicators) {
  if (!indicators?.length) return "";
  return `<ul class="indicator-list">${indicators
    .map((item) => {
      const value =
        item.unit === "% del total" || item.unit === "% cubierto" || /%/.test(item.unit ?? "")
          ? pct(item.value_pct, 1)
          : item.unit === "MM USD"
            ? usd(item.value_mm)
            : `${num(item.value_mm)} ${esc(item.unit ?? "")}`;
      return `<li>
        <span class="k">${esc(item.label)}</span>
        <span class="v">${esc(value)} ${tierBadge(item.tier)}</span>
      </li>`;
    })
    .join("")}</ul>`;
}

function milestoneTimeline(milestones) {
  if (!milestones?.length) return "";
  const ordered = milestones.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return `<ol class="timeline">${ordered
    .map((milestone) =>
      renderTimelineItem(
        {
          id: milestone.date,
          date: milestone.date,
          category: "macroeconomia",
          title: milestone.title,
          detail: milestone.detail,
          severity: 1,
          tier: milestone.tier,
          debt_mm: milestone.debt_mm,
          source_ids: milestone.source_ids,
        },
        { prefix: "hito" }
      )
    )
    .join("")}</ol>`;
}

function adminCalc(admin) {
  if (!admin.calc) return "";
  let recomputed = null;
  try {
    const result = verifyCalc(admin);
    recomputed = { value: result.computed, deltaPct: result.deltaPct, tolerancePct: result.tolerancePct };
  } catch {
    recomputed = null;
  }
  return calcBox(admin.calc, { recomputed });
}

/** Panel de una administración. */
export function renderAdministration(admin, dimensions = []) {
  const id = anchorId("admin", admin.id);
  const growth = Number(admin.growth_pct) || 0;

  const comparison = dataTable({
    caption: `Comparación por dimensiones · ${admin.name}`,
    compact: true,
    columns: [{ label: "Dimensión" }, { label: "Evaluación" }],
    rows: (dimensions ?? []).map((dimension) => {
      const reading = describeDimension(admin, dimension.id);
      return [esc(dimension.label), reading];
    }),
  });

  const content = [
    `<div class="prose"><p>${esc(admin.context)}</p></div>`,
    panelSection("Tesis del período", `<div class="prose"><p>${esc(admin.thesis)}</p></div>`),
    panelSection("Indicadores comparables", indicatorList(admin.indicators)),
    panelSection("Hitos fechados", milestoneTimeline(admin.milestones)),
    panelSection("Comparación por dimensiones", comparison),
    adminCalc(admin),
    panelSection("Balance", `<div class="prose"><p>${esc(admin.assessment)}</p></div>`),
    sourceListBlock(admin.source_ids),
  ]
    .filter(Boolean)
    .join("");

  return `<article class="panel expandable admin-card" id="${esc(id)}" data-expandable data-expandable-group="administraciones">
    ${expandableHeader({
      id,
      eyebrow: `Administración · ${admin.period}`,
      title: admin.name,
      subtitle: admin.label,
      value: `<span class="num">${esc(usd(admin.debt_end_mm))}</span>`,
      aside: `${tierBadge(admin.tier)}
        <span style="display:block;margin-top:var(--sp-2)">${esc(signed(growth, 2))}</span>
        <span style="display:block;margin-top:var(--sp-2)">${esc(
          `${num(admin.debt_start_mm)} → ${num(admin.debt_end_mm)}`
        )}</span>`,
    })}
    ${expandableBody(id, { label: `Detalle de la gestión ${admin.name}`, content })}
    <div class="panel__pad" style="padding-top:0">
      ${meter(growth, GROWTH_SCALE, { variant: growth > 100 ? "meter--alert" : "meter--cool" })}
      <p class="chart-note">Crecimiento acumulado ${esc(pct(growth, 2))} · escala de referencia ${esc(num(GROWTH_SCALE))} %</p>
    </div>
    <div class="panel__footer">
      <span class="row">${srcCount(admin)} hitos · ${num((admin.indicators ?? []).length)} indicadores</span>
      <span class="row mono">${esc(dateShort(admin.from))} → ${esc(dateShort(admin.to))}</span>
    </div>
  </article>`;
}

function srcCount(admin) {
  return num((admin.milestones ?? []).length);
}

/** Lectura cualitativa de cada dimensión, derivada de los datos del período. */
function describeDimension(admin, dimensionId) {
  const indicators = admin.indicators ?? [];
  const find = (pattern) => indicators.find((item) => pattern.test(item.label));
  switch (dimensionId) {
    case "stock": {
      const growth = find(/crecimiento del stock/i);
      const value = growth ? Number(growth.value_mm) : 0;
      return `${esc(usd(value))} de aumento neto. ${esc(admin.thesis.split(".")[0])}.`;
    }
    case "composicion": {
      const bilateral = find(/bilateral/i);
      return bilateral
        ? `Peso bilateral ${esc(pct(bilateral.value_pct, 1))} del total al cierre del período.`
        : "Composición dominada por acreedores privados y multilaterales.";
    }
    case "transparencia": {
      const disclosure = find(/divulgación|divulgacion|estados financieros|publicación/i);
      return disclosure
        ? `${esc(num(disclosure.value_pct ?? disclosure.value_mm))} de cumplimiento declarado. Los datos faltantes se documentan en los vacíos de información.`
        : "Sin métrica directa de divulgación; se declara como vacío de información.";
    }
    case "shock": {
      const severity = (admin.milestones ?? []).filter((m) => /crisis|desplome|paro|sanci|default|colapso/i.test(m.title)).length;
      return `${num(severity)} hitos de shock externo o de interrupción documentados en el período.`;
    }
    case "reestructuracion": {
      const rounds = (admin.milestones ?? []).filter((m) => /reestructur|canje|refinanci|negociaci/i.test(m.title)).length;
      return rounds
        ? `${num(rounds)} intentos o rondas documentadas de renegociación.`
        : "Sin rondas formales de renegociación en el período.";
    }
    default:
      return "Sin lectura automática: dimensión fuera del catálogo.";
  }
}

/** Matriz completa. */
export function renderAdministrationMatrix(data) {
  const matrix = data.historical_matrix ?? {};
  const administrations = matrix.administrations ?? [];
  if (!administrations.length) return `<div class="empty">Sin administraciones registradas.</div>`;
  return administrations.map((admin) => renderAdministration(admin, matrix.dimensions)).join("");
}

/** Tabla comparativa de una sola vista, útil para impresión. */
export function renderAdministrationTable(data) {
  const administrations = data.historical_matrix?.administrations ?? [];
  if (!administrations.length) return "";
  return dataTable({
    caption: "Comparación directa de las tres administraciones analizadas",
    columns: [
      { label: "Administración" },
      { label: "Período" },
      { label: "Stock inicial", align: "num" },
      { label: "Stock final", align: "num" },
      { label: "Crecimiento", align: "num" },
      { label: "Hitos", align: "num" },
      { label: "Capa" },
    ],
    rows: administrations.map((admin) => [
      esc(admin.name),
      esc(admin.period),
      esc(num(admin.debt_start_mm)),
      esc(num(admin.debt_end_mm)),
      esc(pct(admin.growth_pct, 2)),
      esc(num((admin.milestones ?? []).length)),
      tierBadge(admin.tier),
    ]),
    foot: [
      "<b>Serie reconstruida 1994–2026</b>",
      "",
      esc(num(27000)),
      esc(num(170360)),
      esc(pct(530.96, 2)),
      esc(num(administrations.reduce((acc, a) => acc + (a.milestones?.length ?? 0), 0))),
      "",
    ],
  });
}
