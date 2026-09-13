/**
 * js/simulator.js — Simulador de estructura de recuperación
 *
 * Usa la misma función de cálculo que el validador (`recoveryNpv`), así que el
 * número que el usuario ve en pantalla es exactamente el que audita la
 * validación del repositorio. No hay una segunda implementación de la fórmula.
 *
 * El simulador está rotulado como simulación en toda la interfaz: no es un
 * pronóstico ni una recomendación de política.
 */

import { recoveryNpv } from "./calc/index.js";
import { num, pct, usd, toCsv } from "./format.js";
import { SIMULATOR_DEFAULTS, SIMULATOR_LIMITS, CHART_THEME } from "./config.js";
import { chartsAvailable, baseOptions, baseScales, baseTooltip, withAlpha, chartsUnavailableMessage } from "./charts/plugins.js";

let chart = null;
let frame = null;

/** Lee los supuestos actuales desde los controles. */
function readParams() {
  const params = {
    nominal_mm: SIMULATOR_DEFAULTS.nominalMm,
    haircut_pct: SIMULATOR_DEFAULTS.haircutPct,
    coupon_pct: SIMULATOR_DEFAULTS.couponPct,
    tenor_years: SIMULATOR_DEFAULTS.tenorYears,
    grace_years: SIMULATOR_DEFAULTS.graceYears,
    discount_rate_pct: SIMULATOR_DEFAULTS.discountRatePct,
  };
  const mapping = {
    haircutPct: "haircut_pct",
    couponPct: "coupon_pct",
    tenorYears: "tenor_years",
    graceYears: "grace_years",
    discountRatePct: "discount_rate_pct",
  };
  document.querySelectorAll("[data-sim-input]").forEach((input) => {
    const key = mapping[input.dataset.simInput];
    if (key) params[key] = Number(input.value);
  });
  return params;
}

/** Actualiza las etiquetas de valor de cada control. */
function syncControls(params) {
  const writes = {
    haircutPct: [`${num(params.haircut_pct)} %`, 0],
    couponPct: [`${num(params.coupon_pct, 2)} %`, 2],
    tenorYears: [`${num(params.tenor_years)} años`, 0],
    graceYears: [`${num(params.grace_years)} años`, 0],
    discountRatePct: [`${num(params.discount_rate_pct, 2)} %`, 2],
  };
  for (const [key, [text]] of Object.entries(writes)) {
    const output = document.querySelector(`[data-sim-output="${key}"]`);
    if (output) output.textContent = text;
  }
}

/** Escribe los resultados en los recuadros de salida. */
function syncOutputs(params, outputs) {
  const values = {
    nominal: usd(outputs.nominal_restructured_mm),
    coupon: usd(outputs.coupon_mm_per_period),
    npv: usd(outputs.npv_mm),
    recovery: pct(outputs.recovery_pct_of_nominal, 2),
    undiscounted: usd(outputs.undiscounted_mm),
    haircutValue: usd(params.nominal_mm - outputs.npv_mm),
  };
  for (const [key, text] of Object.entries(values)) {
    const node = document.querySelector(`[data-sim-result="${key}"]`);
    if (node) node.textContent = text;
  }
}

/** Tabla del servicio anual proyectado (se muestra truncada si es muy larga). */
function scheduleTable(params, outputs, { limit = 40, startYear = 2026 } = {}) {
  const rows = (outputs.schedule ?? []).slice(0, limit);
  const head = `<thead><tr>
      <th scope="col">Año</th>
      <th scope="col" class="table__num">Cupón</th>
      <th scope="col" class="table__num">Capital</th>
      <th scope="col" class="table__num">Total</th>
      <th scope="col" class="table__num">Factor de descuento</th>
      <th scope="col" class="table__num">Valor presente</th>
    </tr></thead>`;
  const body = rows
    .map(
      (row) => `<tr>
        <td>${startYear + row.year_offset}</td>
        <td class="table__num">${num(row.coupon_mm, 2)}</td>
        <td class="table__num">${num(row.principal_mm, 2)}</td>
        <td class="table__num">${num(row.total_mm, 2)}</td>
        <td class="table__num">${num(row.discount_factor, 6)}</td>
        <td class="table__num">${num(row.pv_mm, 2)}</td>
      </tr>`
    )
    .join("");
  const foot = `<tfoot><tr>
      <td>Total</td>
      <td class="table__num">${num(outputs.schedule.reduce((acc, row) => acc + row.coupon_mm, 0), 2)}</td>
      <td class="table__num">${num(outputs.schedule.reduce((acc, row) => acc + row.principal_mm, 0), 2)}</td>
      <td class="table__num">${num(outputs.undiscounted_mm, 2)}</td>
      <td class="table__num">—</td>
      <td class="table__num">${num(outputs.npv_mm, 2)}</td>
    </tr></tfoot>`;
  return `<table class="table table--compact">
    <caption>Servicio anual proyectado, en millones de dólares (se muestran ${num(rows.length)} de ${num(
      outputs.schedule.length
    )} períodos)</caption>
    ${head}
    <tbody>${body}</tbody>
    ${foot}
  </table>
  <p class="chart-note">
    Insumos: nominal base ${usd(params.nominal_mm)}, quita ${pct(params.haircut_pct, 0)},
    cupón ${pct(params.coupon_pct, 2)}, plazo ${num(params.tenor_years)} años,
    gracia ${num(params.grace_years)} años, descuento ${pct(params.discount_rate_pct, 2)}.
  </p>`;
}

/** Construye o actualiza el gráfico de servicio. */
function syncChart(params, outputs) {
  if (!chartsAvailable()) return;
  const canvas = document.getElementById("chart-simulator");
  if (!canvas) return;

  const rows = outputs.schedule;
  const labels = rows.map((row) => String(2026 + row.year_offset));
  const coupon = rows.map((row) => row.coupon_mm);
  const principal = rows.map((row) => row.principal_mm);

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = coupon;
    chart.data.datasets[1].data = principal;
    chart.update();
    return;
  }

  chart = new window.Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Cupón anual",
          data: coupon,
          backgroundColor: withAlpha(CHART_THEME.accent, 0.75),
          stack: "servicio",
        },
        {
          label: "Amortización de capital",
          data: principal,
          backgroundColor: withAlpha(CHART_THEME.accentCool, 0.8),
          stack: "servicio",
        },
      ],
    },
    options: baseOptions({
      scales: baseScales({ stacked: true, yTitle: "Millones de USD" }),
      plugins: { tooltip: baseTooltip({ mode: "index", intersect: false }) },
      interaction: { mode: "index", intersect: false },
    }),
  });
}

/** Recalcula todo. Se llama ante cualquier cambio de supuesto. */
function refresh({ silent = false } = {}) {
  const params = readParams();
  const { outputs } = recoveryNpv(params);

  syncControls(params);
  syncOutputs(params, outputs);
  syncChart(params, outputs);

  const schedule = document.getElementById("simulator-schedule");
  if (schedule) schedule.innerHTML = scheduleTable(params, outputs);

  if (!silent) {
    const live = document.getElementById("simulator-outputs");
    if (live) live.setAttribute("data-updated-at", String(Date.now()));
  }
  return { params, outputs };
}

/** Exporta el servicio proyectado completo a CSV. */
function exportCsv() {
  const params = readParams();
  const { outputs } = recoveryNpv(params);
  const headers = [
    "Año",
    "Período",
    "Cupón (MM USD)",
    "Capital (MM USD)",
    "Total (MM USD)",
    "Factor de descuento",
    "Valor presente (MM USD)",
  ];
  const rows = outputs.schedule.map((row) => [
    2026 + row.year_offset,
    row.period,
    row.coupon_mm,
    row.principal_mm,
    row.total_mm,
    row.discount_factor,
    row.pv_mm,
  ]);
  const csv = toCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `servicio-simulado-quita-${params.haircut_pct}-cupon-${params.coupon_pct}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { params, rows: rows.length };
}

/** Inicializa el simulador. Idempotente. */
export function initSimulator(data) {
  const controls = document.getElementById("simulator-controls");
  if (!controls) return null;

  controls.addEventListener("input", (event) => {
    if (!event.target.matches("[data-sim-input]")) return;
    // Se agrupa en un frame para no recalcular en cada píxel del deslizador.
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = null;
      refresh({ silent: true });
    });
  });

  controls.addEventListener("click", (event) => {
    if (event.target.closest("[data-sim-reset]")) {
      const mapping = {
        haircutPct: SIMULATOR_DEFAULTS.haircutPct,
        couponPct: SIMULATOR_DEFAULTS.couponPct,
        tenorYears: SIMULATOR_DEFAULTS.tenorYears,
        graceYears: SIMULATOR_DEFAULTS.graceYears,
        discountRatePct: SIMULATOR_DEFAULTS.discountRatePct,
      };
      document.querySelectorAll("[data-sim-input]").forEach((input) => {
        const value = mapping[input.dataset.simInput];
        if (value !== undefined) input.value = String(value);
      });
      refresh();
      window.dispatchEvent(
        new CustomEvent("observatorio:announce", { detail: "Supuestos del simulador restablecidos." })
      );
      return;
    }
    if (event.target.closest("[data-sim-export]")) {
      const result = exportCsv();
      window.dispatchEvent(
        new CustomEvent("observatorio:announce", {
          detail: `Descargado el servicio proyectado con ${result.rows} períodos.`,
        })
      );
    }
  });

  const initial = refresh({ silent: true });

  // Se expone para la paleta de comandos y para depuración.
  window.__observatorioSimulator = { refresh, readParams, limits: SIMULATOR_LIMITS, initial };
  return initial;
}

export { refresh as refreshSimulator, readParams as readSimulatorParams, exportCsv as exportSimulatorCsv };

/** Mensaje usado cuando Chart.js no está disponible, para no dejar vacío el marco. */
export function simulatorChartFallback() {
  return chartsUnavailableMessage("El servicio anual proyectado se muestra en la tabla inferior.");
}
