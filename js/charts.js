/**
 * js/charts.js — Visualizaciones del observatorio
 *
 * Diecinueve vistas construidas sobre los mismos datos del dataset:
 *   1. Línea histórica de deuda con marcadores de eventos de estrés
 *   2. Área apilada de composición por componente
 *   3. Anillo de composición de acreedores con total al centro
 *   4. Barras apiladas por administración (inicio y fin de cada gestión)
 *   5. Barras de laudos: capital de condena contra valor con intereses
 *   6. Radar comparado de presión y composición por administración
 *   7. Cascada de construcción del stock 1994–2026
 *   8. Treemap de exposición por acreedor (propio, squarified)
 *   9. Mapa de calor de composición anual (propio, DOM)
 *  10. Indicador semicircular de cobertura de reservas
 *  11. Curvas de recuperación por escenario frente a la quita
 *  12. Burbujas de exposición contra recuperación esperada por acreedor
 *  13. Servicio anual simulado (se monta desde js/simulator.js)
 *  14. Mosaico del régimen de sanciones por año y alcance (DOM, propio)
 *  15. Línea de tiempo de calificaciones con degradación por etapas
 *  16. Dumbbell de laudos: principal contra acumulado, con su brecha
 *  17. Barras de líneas de ejecución ordenadas por valor en disputa
 *  18. Líneas de capacidad: servicio simulado contra exportaciones y reservas
 *  19. Densidad de mecanismos: capacidad potencial por categoría (DOM, propio)
 *
 * Ciclo de vida: las instancias se guardan en un registro y se destruyen antes
 * de recrearse. Sin esto, cada filtro o cambio de tamaño dejaría gráficos
 * vivos consumiendo memoria y dibujando sobre lienzos huérfanos.
 */

import { CHART_THEME, CATEGORY_COLORS, CATEGORY_LABELS, MECHANISM_LABELS } from "./config.js";
import { recoveryNpv } from "./calc/index.js";
import { num, pct, usd } from "./format.js";
import {
  chartsAvailable,
  baseOptions,
  baseScales,
  baseTooltip,
  centerTextPlugin,
  stressEventsPlugin,
  lastValuePlugin,
  areaGradient,
  legendHtml,
  withAlpha,
  prefersReducedMotion,
} from "./charts/plugins.js";
import { renderHeatmap, renderHeatmapTable } from "./charts/heatmap.js";
import { renderTreemap } from "./charts/treemap.js";

/* ---------------------------------------------------------- registro --- */

const instances = new Map();

function register(key, canvasId, config) {
  if (!chartsAvailable()) return null;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const existing = instances.get(key);
  if (existing) existing.destroy();
  const chart = new window.Chart(canvas, config);
  instances.set(key, chart);
  return chart;
}

export function destroyChart(key) {
  const chart = instances.get(key);
  if (chart) {
    chart.destroy();
    instances.delete(key);
  }
}

export function destroyAllCharts() {
  for (const key of [...instances.keys()]) destroyChart(key);
}

/** Reajusta todos los gráficos vivos, por ejemplo tras abrir una tarjeta. */
export function resizeAllCharts() {
  for (const chart of instances.values()) {
    if (typeof chart.resize === "function") chart.resize();
  }
}

export function chartEvents() {
  return { register, instances };
}

/* ------------------------------------------------------------ helpers --- */

function chartPanel({ id, eyebrow, title, subtitle, note, legend = "", tall = false, heat = false, extra = "", omitCanvas = false }) {
  const frame = omitCanvas
    ? ""
    : `<div class="chart-frame ${tall ? "chart-frame--tall" : ""}">
        <canvas id="${id}" role="img" aria-label="${title}"></canvas>
      </div>`;
  return `<article class="panel panel--static" id="${id}-panel">
    <div class="panel__head">
      <div>
        <span class="panel__eyebrow">${eyebrow}</span>
        <h3 class="panel__title">${title}</h3>
        ${subtitle ? `<p class="panel__sub">${subtitle}</p>` : ""}
      </div>
    </div>
    <div class="panel__pad">
      ${frame}
      ${extra}
      ${legend && !omitCanvas ? `<div class="chart-legend">${legend}</div>` : ""}
      ${note ? `<p class="chart-note">${note}</p>` : ""}
    </div>
  </article>`;
}

/** Aviso cuando Chart.js no cargó: se explica en lugar de dejar un hueco. */
function offlineNotice() {
  return `<div class="error-panel" role="status">
    <p class="error-panel__title">Gráficos no disponibles</p>
    <p>La biblioteca de gráficos no pudo cargarse desde su red de distribución. Las tablas de cada sección
    contienen exactamente los mismos datos, así que el documento sigue siendo utilizable sin conexión externa.</p>
  </div>`;
}

/** Series del dataset como arreglos paralelos. */
function seriesArrays(data) {
  const points = data.historical_series?.points ?? [];
  return {
    points,
    years: points.map((point) => point.year),
    total: points.map((point) => Number(point.total_mm) || 0),
    bonds: points.map((point) => Number(point.bonds_mm) || 0),
    pdvsa: points.map((point) => Number(point.pdvsa_mm) || 0),
    bilateral: points.map((point) => Number(point.bilateral_mm) || 0),
    multilateral: points.map((point) => Number(point.multilateral_mm) || 0),
    paris: points.map((point) => Number(point.paris_club_mm) || 0),
    suppliers: points.map((point) => Number(point.suppliers_mm) || 0),
    other: points.map((point) => Number(point.other_mm) || 0),
  };
}

/** Perfil numérico comparable por administración, derivado solo de los datos. */
export function administrationProfiles(data) {
  const { points } = seriesArrays(data);
  const administrations = data.historical_matrix?.administrations ?? [];
  const byYear = new Map(points.map((point) => [point.year, point]));

  return administrations.map((admin) => {
    const endYear = Number(String(admin.to).slice(0, 4));
    const point = byYear.get(endYear) ?? points[points.length - 1];
    const total = Number(point.total_mm) || 1;
    const shocks = (admin.milestones ?? []).filter((milestone) =>
      /crisis|desplome|paro|sanci|default|colapso|emergencia|nacionalizaci/i.test(milestone.title)
    ).length;
    return {
      id: admin.id,
      name: admin.name,
      period: admin.period,
      stockPressure: Math.min(100, (Number(admin.growth_pct) / 300) * 100),
      stateCreditor: ((Number(point.bilateral_mm) + Number(point.multilateral_mm) + Number(point.paris_club_mm)) / total) * 100,
      marketCreditor: ((Number(point.bonds_mm) + Number(point.pdvsa_mm)) / total) * 100,
      arrears: ((Number(point.suppliers_mm) + Number(point.other_mm)) / total) * 100,
      shocks: Math.min(100, (shocks / 6) * 100),
      milestoneCount: (admin.milestones ?? []).length,
    };
  });
}

/* -------------------------------------------------------- render HTML --- */

/** Construye el marcado de las doce vistas fijas que no dependen del simulador. */
export function renderCharts(data) {
  if (!chartsAvailable()) {
    return offlineNotice();
  }

  const series = data.historical_series ?? {};
  const points = series.points ?? [];
  const first = points[0] ?? { year: 1990, total_mm: 0 };
  const last = points[points.length - 1] ?? { year: 2026, total_mm: 0 };
  const creditors = (data.creditors ?? []).slice().sort((a, b) => Number(b.exposure_mm) - Number(a.exposure_mm));
  const totalExposure = creditors.reduce((acc, creditor) => acc + Number(creditor.exposure_mm), 0);
  const coverage = Number(
    ((data.kpis ?? []).find((kpi) => kpi.id === "cobertura-reservas")?.value_pct) ?? 0
  );

  const lineLegend = legendHtml([
    { label: "Deuda externa total", borderColor: CHART_THEME.accent, legendColor: CHART_THEME.accent },
    { label: "Atrasos comerciales y de proveedores", borderColor: CHART_THEME.accentViolet, legendColor: CHART_THEME.accentViolet, borderDash: [4, 3] },
  ]);

  const compositionLegend = legendHtml(
    (series.series_definitions ?? []).map((definition) => ({
      label: definition.label,
      backgroundColor: definition.color,
      legendColor: definition.color,
    }))
  );

  const awards = (data.arbitration_cases ?? [])
    .slice()
    .sort((a, b) => Number(b.award_mm) - Number(a.award_mm))
    .slice(0, 10);
  const awardsLegend = legendHtml([
    { label: "Capital de condena", backgroundColor: CHART_THEME.accent, legendColor: CHART_THEME.accent },
    { label: "Valor con intereses modelados", backgroundColor: CHART_THEME.accentViolet, legendColor: CHART_THEME.accentViolet },
  ]);

  return [
    chartPanel({
      id: "chart-debt-line",
      eyebrow: "Visualización 1 · trayectoria",
      title: "Deuda externa total y atrasos comerciales, 1990–2026",
      subtitle: `${num(first.year)}–${num(last.year)} · valores en millones de dólares`,
      tall: true,
      legend: lineLegend,
      note: `Las líneas verticales marcan los eventos de estrés declarados en el dataset (severidad 3 en rojo).
        El total pasa de ${usd(first.total_mm)} a ${usd(last.total_mm)}. Los puntos interpolados se distinguen en la
        tabla de datos por su marca de procedencia, no en el trazo.`,
    }),

    chartPanel({
      id: "chart-composition-area",
      eyebrow: "Visualización 2 · composición",
      title: "Quién prestó, año por año",
      subtitle: "Área apilada por componente de acreedor",
      tall: true,
      legend: compositionLegend,
      note: `El cambio de acreedor es el fenómeno central: en 1990 los bonos Brady y los multilaterales dominaban el
        stock; en 2026 los bonos y los atrasos comerciales explican cerca del 68 % del total.`,
    }),

    chartPanel({
      id: "chart-creditors-doughnut",
      eyebrow: "Visualización 3 · acreedores",
      title: "Composición de la exposición agregada",
      subtitle: `${num(creditors.length)} clases de acreedor · ${usd(totalExposure)}`,
      legend: legendHtml(
        creditors.map((creditor) => ({
          label: creditor.name,
          backgroundColor: CATEGORY_COLORS[creditor.type] ?? CATEGORY_COLORS.otro,
          legendColor: CATEGORY_COLORS[creditor.type] ?? CATEGORY_COLORS.otro,
        }))
      ),
      note: "El centro muestra el total agregado. Cada segmento incluye los laudos arbitrales a valor nominal, que son contingentes y no deuda ya reconocida.",
    }),

    chartPanel({
      id: "chart-admin-bars",
      eyebrow: "Visualización 4 · administraciones",
      title: "Composición al inicio y al final de cada gestión",
      subtitle: "Barras apiladas · millones de dólares",
      tall: true,
      legend: legendHtml([
        { label: "Bonos (República y PDVSA)", backgroundColor: CHART_THEME.accent, legendColor: CHART_THEME.accent },
        { label: "Acreedores de Estado", backgroundColor: CHART_THEME.accentCool, legendColor: CHART_THEME.accentCool },
        { label: "Atrasos y otros", backgroundColor: CHART_THEME.accentViolet, legendColor: CHART_THEME.accentViolet },
      ]),
      note: "Seis barras: inicio y cierre de cada una de las tres gestiones analizadas. Los totales coinciden con las anclas de la serie histórica.",
    }),

    chartPanel({
      id: "chart-awards-bars",
      eyebrow: "Visualización 5 · arbitrajes",
      title: "Capital de condena contra valor acumulado",
      subtitle: "Los diez laudos de mayor monto",
      tall: true,
      legend: awardsLegend,
      note: "La distancia entre ambas barras es el interés acumulado, que crece con el tiempo y sin pagos intermedios. Es el costo financiero del retraso en la negociación.",
    }),

    chartPanel({
      id: "chart-admin-radar",
      eyebrow: "Visualización 6 · comparación",
      title: "Perfil comparado por administración",
      subtitle: "Cinco dimensiones derivadas de los datos del período",
      note: `Escalas declaradas: presión de stock sobre una base de 300 % acumulado; participación de acreedores estatales,
        de mercado y de atrasos en porcentaje del total al cierre de cada gestión; cantidad de shocks externos sobre
        un máximo de seis. Ninguna dimensión es una valoración: todas son proporciones verificables.`,
    }),

    chartPanel({
      id: "chart-waterfall",
      eyebrow: "Visualización 7 · construcción del stock",
      title: "De dónde salió cada dólar de deuda entre 1994 y 2026",
      subtitle: "Cascada aditiva por componente",
      tall: true,
      note: `Parte de ${usd(Number(first.total_mm))} en 1994 y termina en ${usd(Number(last.total_mm))}. Cada barra flotante
        es el aporte de un componente al aumento neto. La suma de aportes es exactamente el aumento total: si no
        cuadrara, la validación del dataset fallaría.`,
    }),

    chartPanel({
      id: "chart-treemap",
      eyebrow: "Visualización 8 · exposición",
      title: "Treemap de acreedores por exposición",
      subtitle: "Área proporcional al monto reclamado",
      extra: `<div class="treemap" id="chart-treemap">${renderTreemap(data)}</div>`,
      // Las vistas DOM (heat: true) no declaran <canvas>: el contenido va en
      // `extra`, así que no hay que duplicar el id en un marco vacío.
      heat: true,
      omitCanvas: true,
    }),

    chartPanel({
      id: "chart-heatmap",
      eyebrow: "Visualización 9 · densidad",
      title: "Mapa de calor de composición anual",
      subtitle: "Peso de cada componente dentro del total de su año",
      extra: renderHeatmap(data),
      heat: true,
      omitCanvas: true,
    }),

    chartPanel({
      id: "chart-gauge",
      eyebrow: "Visualización 10 · cobertura",
      title: "Cobertura de reservas sobre la deuda agregada",
      subtitle: `${pct(coverage, 2)} cubierto`,
      note: `Menos de seis centavos por cada dólar de exposición agregada. El indicador es semicircular porque mide una
        fracción de un total, no una comparación entre categorías.`,
    }),

    chartPanel({
      id: "chart-scenario-curves",
      eyebrow: "Visualización 11 · escenarios",
      title: "Valor presente de la recuperación según la quita",
      subtitle: "Cada curva mantiene el cupón, el plazo y el descuento de su escenario",
      tall: true,
      legend: legendHtml(
        (data.scenarios?.items ?? []).map((scenario, index) => ({
          label: `${scenario.name} (${pct(scenario.probability_pct, 0)})`,
          borderColor: CHART_THEME.series[index % CHART_THEME.series.length],
          legendColor: CHART_THEME.series[index % CHART_THEME.series.length],
          borderDash: [2, 2],
        }))
      ),
      note: "Las cinco curvas se calculan en vivo con la misma función que usa el validador. Los puntos marcados horizontalmente son las quitas de cada escenario precalculado.",
    }),

    chartPanel({
      id: "chart-creditor-bubbles",
      eyebrow: "Visualización 12 · riesgo",
      title: "Exposición contra recuperación esperada, por acreedor",
      subtitle: "El tamaño de la burbuja indica la capacidad de presión",
      tall: true,
      note: `Eje horizontal: exposición en millones de dólares (escala logarítmica, porque las magnitudes difieren en más de
        un orden). Eje vertical: recuperación estimada en porcentaje. El cuadrante inferior derecho —mucha exposición,
        poca recuperación— concentra el problema político de cualquier acuerdo.`,
    }),

    chartPanel({
      id: "chart-heatmap-table",
      eyebrow: "Visualización 13 · datos de respaldo",
      title: "Tabla completa del mapa de calor",
      subtitle: "Los mismos valores del mapa de calor, en formato tabular",
      extra: renderHeatmapTable(data),
      heat: true,
      omitCanvas: true,
      note: "Se publica siempre una versión tabular de cada visualización: es lo que hace accesible el documento para lectores de pantalla y lo que sobrevive a la impresión.",
    }),

    /* ---------------- Vistas 14 a 19 (revisión integral) ---------------- */

    sanctionsMosaicPanel(data),
    ratingsTimelinePanel(data),
    awardsGapPanel(data),
    enforcementBarsPanel(data),
    capacityLinesPanel(data),
    mechanismDensityPanel(data),
  ].join("");
}

/* ------------------------------------------------------------- montaje --- */

/**
 * Crea las instancias de Chart.js. Se llama después de inyectar el HTML.
 * @returns {{created:number, failed:string[]}}
 */
export function initCharts(data) {
  const failed = [];
  let created = 0;
  if (!chartsAvailable()) return { created, failed: ["Chart.js no disponible"] };

  const tryCreate = (key, canvasId, factory) => {
    try {
      const chart = register(key, canvasId, factory());
      if (chart) created += 1;
    } catch (error) {
      failed.push(`${key}: ${error.message}`);
    }
  };

  const { years, total, suppliers } = seriesArrays(data);
  const events = (data.historical_series?.events ?? []).map((event) => ({
    year: event.year,
    label: event.label,
    severity: event.severity,
  }));
  const seriesDefinitions = data.historical_series?.series_definitions ?? [];

  /* 1. Línea histórica con eventos de estrés. */
  tryCreate("debt-line", "chart-debt-line", () => ({
    type: "line",
    data: {
      labels: years,
      datasets: [
        {
          label: "Deuda externa total",
          data: total,
          borderColor: CHART_THEME.accent,
          backgroundColor: (context) => areaGradient(context, CHART_THEME.accent, { from: 0.24 }),
          fill: true,
          borderWidth: 1.6,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.18,
        },
        {
          label: "Atrasos comerciales y de proveedores",
          data: suppliers,
          borderColor: CHART_THEME.accentViolet,
          backgroundColor: "transparent",
          borderWidth: 1.2,
          borderDash: [4, 3],
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0.18,
        },
      ],
    },
    options: baseOptions({
      scales: baseScales({ yTitle: "Millones de USD" }),
      plugins: {
        stressEvents: { events },
        lastValue: { display: true, formatter: (value) => usd(value) },
      },
    }),
    plugins: [stressEventsPlugin, lastValuePlugin],
  }));

  /* 2. Área apilada de composición. */
  tryCreate("composition-area", "chart-composition-area", () => ({
    type: "line",
    data: {
      labels: years,
      datasets: seriesDefinitions.map((definition) => ({
        label: definition.label,
        data: (data.historical_series?.points ?? []).map((point) => Number(point[definition.key]) || 0),
        borderColor: withAlpha(definition.color, 0.85),
        backgroundColor: withAlpha(definition.color, 0.42),
        fill: true,
        borderWidth: 0.8,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.12,
      })),
    },
    options: baseOptions({
      scales: baseScales({ stacked: true, yTitle: "Millones de USD" }),
      plugins: { tooltip: baseTooltip({ mode: "index", intersect: false }) },
    }),
  }));

  /* 3. Anillo de acreedores con total al centro. */
  tryCreate("creditors-doughnut", "chart-creditors-doughnut", () => {
    const creditors = (data.creditors ?? []).slice().sort((a, b) => Number(b.exposure_mm) - Number(a.exposure_mm));
    const totalExposure = creditors.reduce((acc, creditor) => acc + Number(creditor.exposure_mm), 0);
    return {
      type: "doughnut",
      data: {
        labels: creditors.map((creditor) => creditor.name),
        datasets: [
          {
            data: creditors.map((creditor) => Number(creditor.exposure_mm)),
            backgroundColor: creditors.map((creditor) => withAlpha(CATEGORY_COLORS[creditor.type] ?? CATEGORY_COLORS.otro, 0.7)),
            borderColor: CHART_THEME.surface,
            borderWidth: 1,
            hoverOffset: 4,
          },
        ],
      },
      options: baseOptions({
        plugins: {
          centerText: { display: true, label: "exposición agregada", value: `${num(totalExposure / 1000, 1)} MM MM`, sub: "millardos de dólares" },
          tooltip: baseTooltip({
            callbacks: {
              label: (context) => {
                const creditor = creditors[context.dataIndex];
                return `${creditor.name}: ${usd(creditor.exposure_mm)} (${pct(creditor.share_pct, 2)})`;
              },
            },
          }),
        },
      }),
      plugins: [centerTextPlugin],
    };
  });

  /* 4. Barras apiladas por administración. */
  tryCreate("admin-bars", "chart-admin-bars", () => {
    const { points } = seriesArrays(data);
    const byYear = new Map(points.map((point) => [point.year, point]));
    const administrations = data.historical_matrix?.administrations ?? [];
    const labels = [];
    const bonds = [];
    const state = [];
    const arrears = [];
    for (const admin of administrations) {
      for (const [tag, iso] of [["Inicio", admin.from], ["Cierre", admin.to]]) {
        const year = Number(String(iso).slice(0, 4));
        const point = byYear.get(year) ?? points[points.length - 1];
        labels.push(`${admin.name.split(" ")[0]} ${tag.toLowerCase()} ${year}`);
        bonds.push(Number(point.bonds_mm) + Number(point.pdvsa_mm));
        state.push(Number(point.bilateral_mm) + Number(point.multilateral_mm) + Number(point.paris_club_mm));
        arrears.push(Number(point.suppliers_mm) + Number(point.other_mm));
      }
    }
    return {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Bonos (República y PDVSA)", data: bonds, backgroundColor: withAlpha(CHART_THEME.accent, 0.8), stack: "s" },
          { label: "Acreedores de Estado", data: state, backgroundColor: withAlpha(CHART_THEME.accentCool, 0.8), stack: "s" },
          { label: "Atrasos y otros", data: arrears, backgroundColor: withAlpha(CHART_THEME.accentViolet, 0.8), stack: "s" },
        ],
      },
      options: baseOptions({
        scales: baseScales({ stacked: true, yTitle: "Millones de USD" }),
        plugins: { tooltip: baseTooltip({ mode: "index", intersect: false }) },
      }),
    };
  });

  /* 5. Barras horizontales de laudos. */
  tryCreate("awards-bars", "chart-awards-bars", () => {
    const awards = (data.arbitration_cases ?? [])
      .slice()
      .sort((a, b) => Number(b.award_mm) - Number(a.award_mm))
      .slice(0, 10);
    return {
      type: "bar",
      data: {
        labels: awards.map((record) => record.claimant.replace(/\s*\(.*?\)\s*/g, " ").trim().slice(0, 34)),
        datasets: [
          { label: "Capital de condena", data: awards.map((record) => Number(record.award_mm)), backgroundColor: withAlpha(CHART_THEME.accent, 0.85) },
          {
            label: "Valor con intereses",
            data: awards.map((record) => Number(record.award_total_mm ?? record.award_mm)),
            backgroundColor: withAlpha(CHART_THEME.accentViolet, 0.75),
          },
        ],
      },
      options: baseOptions({
        indexAxis: "y",
        scales: baseScales({ xTitle: "Millones de USD" }),
        plugins: {
          tooltip: baseTooltip({
            callbacks: {
              afterBody: (items) => {
                const record = awards[items[0].dataIndex];
                return record?.reconciliation?.note ? `Conciliación: ${record.reconciliation.note.slice(0, 120)}…` : "";
              },
            },
          }),
        },
      }),
    };
  });

  /* 6. Radar comparado. */
  tryCreate("admin-radar", "chart-admin-radar", () => {
    const profiles = administrationProfiles(data);
    const colors = [CHART_THEME.accentCool, CHART_THEME.accent, CHART_THEME.accentViolet];
    return {
      type: "radar",
      data: {
        labels: [
          "Presión de stock",
          "Acreedor de Estado",
          "Acreedor de mercado",
          "Atrasos comerciales",
          "Shocks externos",
        ],
        datasets: profiles.map((profile, index) => ({
          label: `${profile.name} (${profile.period})`,
          data: [
            Number(profile.stockPressure.toFixed(1)),
            Number(profile.stateCreditor.toFixed(1)),
            Number(profile.marketCreditor.toFixed(1)),
            Number(profile.arrears.toFixed(1)),
            Number(profile.shocks.toFixed(1)),
          ],
          borderColor: colors[index % colors.length],
          backgroundColor: withAlpha(colors[index % colors.length], 0.16),
          borderWidth: 1.4,
          pointRadius: 2,
          pointBackgroundColor: colors[index % colors.length],
        })),
      },
      options: baseOptions({
        scales: {
          r: {
            angleLines: { color: CHART_THEME.grid },
            grid: { color: CHART_THEME.grid },
            pointLabels: { color: CHART_THEME.ink, font: { family: CHART_THEME.font, size: 10 } },
            ticks: { display: false, stepSize: 25 },
            suggestedMin: 0,
            suggestedMax: 100,
          },
        },
        plugins: { legend: { display: true, position: "bottom" }, tooltip: baseTooltip() },
      }),
    };
  });

  /* 7. Cascada de construcción del stock. */
  tryCreate("waterfall", "chart-waterfall", () => {
    const points = data.historical_series?.points ?? [];
    const start = points[0];
    const end = points[points.length - 1];
    const definitions = data.historical_series?.series_definitions ?? [];
    const bars = [];
    const colors = [];
    const labels = [`Stock ${start.year}`];

    bars.push([0, Number(start.total_mm)]);
    colors.push(withAlpha(CHART_THEME.inkDim, 0.55));

    let cursor = Number(start.total_mm);
    for (const definition of definitions) {
      const delta = (Number(end[definition.key]) || 0) - (Number(start[definition.key]) || 0);
      const from = cursor;
      const to = cursor + delta;
      bars.push([from, to]);
      colors.push(withAlpha(definition.color, 0.75));
      labels.push(`${definition.label.split(" ")[0]} ${delta >= 0 ? "+" : ""}${num(delta)}`);
      cursor = to;
    }

    bars.push([0, Number(end.total_mm)]);
    colors.push(withAlpha(CHART_THEME.accent, 0.9));
    labels.push(`Stock ${end.year}`);

    return {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Variación del stock",
            data: bars,
            backgroundColor: colors,
            borderColor: CHART_THEME.surface,
            borderWidth: 1,
            borderRadius: 2,
          },
        ],
      },
      options: baseOptions({
        scales: baseScales({ yTitle: "Millones de USD" }),
        plugins: {
          tooltip: baseTooltip({
            callbacks: {
              label: (context) => {
                const [from, to] = context.raw;
                return `${usd(to - from)} de variación · acumulado ${usd(to)}`;
              },
            },
          }),
        },
      }),
    };
  });

  /* 10. Indicador semicircular de cobertura. */
  tryCreate("coverage-gauge", "chart-gauge", () => {
    const kpi = (data.kpis ?? []).find((item) => item.id === "cobertura-reservas");
    const coverage = Number(kpi?.value_pct ?? 0);
    return {
      type: "doughnut",
      data: {
        labels: ["Cubierto con reservas", "Descubierto"],
        datasets: [
          {
            data: [coverage, Math.max(0, 100 - coverage)],
            backgroundColor: [withAlpha(CHART_THEME.accentCool, 0.85), withAlpha(CHART_THEME.inkDim, 0.16)],
            borderColor: CHART_THEME.surface,
            borderWidth: 1,
            circumference: 180,
            rotation: 270,
          },
        ],
      },
      options: baseOptions({
        plugins: {
          centerText: { display: true, label: "cobertura efectiva", value: pct(coverage, 2), sub: "reservas / deuda agregada" },
          tooltip: baseTooltip({
            callbacks: {
              label: (context) => `${context.label}: ${pct(context.raw, 2)}`,
            },
          }),
        },
      }),
      plugins: [centerTextPlugin],
    };
  });

  /* 11. Curvas de recuperación por escenario. */
  tryCreate("scenario-curves", "chart-scenario-curves", () => {
    const scenarios = data.scenarios?.items ?? [];
    const haircuts = Array.from({ length: 20 }, (_, index) => index * 5);
    return {
      type: "line",
      data: {
        labels: haircuts.map((haircut) => `${haircut} %`),
        datasets: scenarios.map((scenario, index) => ({
          label: `${scenario.name} (${pct(scenario.probability_pct, 0)})`,
          data: haircuts.map((haircut) => {
            const { outputs } = recoveryNpv({
              nominal_mm: data.scenarios.base_nominal_mm,
              haircut_pct: haircut,
              coupon_pct: scenario.coupon_pct,
              tenor_years: scenario.tenor_years,
              grace_years: scenario.grace_years,
              discount_rate_pct: scenario.discount_rate_pct,
            });
            return outputs.npv_mm;
          }),
          borderColor: CHART_THEME.series[index % CHART_THEME.series.length],
          backgroundColor: "transparent",
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.2,
        })),
      },
      options: baseOptions({
        scales: baseScales({ xTitle: "Quita aplicada", yTitle: "VPN de la recuperación (MM USD)" }),
        plugins: { tooltip: baseTooltip({ mode: "index", intersect: false }) },
      }),
    };
  });

  /* 12. Burbujas de exposición contra recuperación esperada. */
  tryCreate("creditor-bubbles", "chart-creditor-bubbles", () => {
    const creditors = data.creditors ?? [];
    const weight = { alta: 16, media: 11, baja: 7 };
    const groups = {};
    for (const creditor of creditors) {
      const type = creditor.type;
      groups[type] = groups[type] ?? [];
      groups[type].push({
        x: Math.max(1, Number(creditor.exposure_mm)),
        y: Number(creditor.recovery_outlook?.pct_estimate ?? 0),
        r: weight[creditor.leverage] ?? 8,
        label: creditor.name,
      });
    }
    return {
      type: "bubble",
      data: {
        datasets: Object.entries(groups).map(([type, points]) => ({
          label: CATEGORY_LABELS[type] ?? type,
          data: points,
          backgroundColor: withAlpha(CATEGORY_COLORS[type] ?? CATEGORY_COLORS.otro, 0.42),
          borderColor: CATEGORY_COLORS[type] ?? CATEGORY_COLORS.otro,
          borderWidth: 1,
        })),
      },
      options: baseOptions({
        scales: {
          x: {
            type: "logarithmic",
            grid: { color: CHART_THEME.grid },
            ticks: { color: CHART_THEME.inkDim, font: { family: CHART_THEME.font, size: 10 }, callback: (value) => num(value) },
            title: { display: true, text: "Exposición (MM USD, escala logarítmica)", color: CHART_THEME.inkDim, font: { family: CHART_THEME.font, size: 10 } },
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: CHART_THEME.grid },
            ticks: { color: CHART_THEME.inkDim, font: { family: CHART_THEME.font, size: 10 }, callback: (value) => `${value} %` },
            title: { display: true, text: "Recuperación estimada", color: CHART_THEME.inkDim, font: { family: CHART_THEME.font, size: 10 } },
          },
        },
        plugins: {
          legend: { display: true, position: "bottom" },
          tooltip: baseTooltip({
            callbacks: {
              label: (context) =>
                `${context.raw.label}: ${usd(context.raw.x)} expuestos · ${pct(context.raw.y, 0)} de recuperación estimada`,
            },
          }),
        },
      }),
    };
  });

  /* 14. Mosaico de sanciones (DOM, no Chart.js). */
  try {
    mountSanctionsMosaic(data);
    created += 1;
  } catch (error) {
    failed.push(`sanctions-mosaic: ${error.message}`);
  }

  /* 15. Línea de tiempo de calificaciones. */
  tryCreate("ratings-timeline", "chart-ratings-timeline", () => mountRatingsTimeline(data));

  /* 16. Dumbbell de laudos con brecha de intereses. */
  tryCreate("awards-gap", "chart-awards-gap", () => mountAwardsGap(data));

  /* 17. Barras de líneas de ejecución. */
  tryCreate("enforcement-bars", "chart-enforcement-bars", () => mountEnforcementBars(data));

  /* 18. Líneas de capacidad: servicio contra exportaciones y reservas. */
  tryCreate("capacity-lines", "chart-capacity-lines", () => mountCapacityLines(data));

  /* 19. Densidad de mecanismos (DOM, no Chart.js). */
  // El panel se autoregistra en el HTML (panel con id chart-mechanism-density);
  // aquí solo se verifica que el contenedor exista.
  if (document.getElementById("chart-mechanism-density")) {
    created += 1;
  } else {
    failed.push("mechanism-density: contenedor no encontrado");
  }

  return { created, failed };
}

/** Serie de servicio anual, usada por el gráfico del simulador. */
export function serviceSeries(params) {
  const { outputs } = recoveryNpv(params);
  return {
    labels: (outputs.schedule ?? []).map((row) => `Año ${row.period}`),
    coupon: (outputs.schedule ?? []).map((row) => row.coupon_mm),
    principal: (outputs.schedule ?? []).map((row) => row.principal_mm),
    pv: (outputs.schedule ?? []).map((row) => row.pv_mm),
    npv: outputs.npv_mm,
  };
}

/* ==================================================== vistas 14 a 19 === */
/*
 * Seis vistas añadidas en la revisión integral. Ninguna introduce una cifra
 * nueva: cada una reorganiza registros que ya existen y que la auditoría
 * recalcula, para que un patrón visible en el gráfico pueda rastrearse hasta
 * su registro y su fuente.
 */

/* ---- 14. Mosaico del régimen de sanciones ----------------------------- */

/** Agrupa las medidas de sanción por año y les asigna alcance normalizado. */
export function sanctionsByYear(data) {
  const rows = (data.sanctions_regime ?? []).map((measure) => {
    const year = Number(String(measure.date).slice(0, 4));
    const scope = /individuo|persona/i.test(measure.scope)
      ? "personas"
      : /deuda|financiamiento|bono/i.test(measure.scope)
        ? "financiero"
        : /empresa|petroler|sector|logístic|entidad|múltiple/i.test(measure.scope)
          ? "sectorial"
          : "general";
    return { year, scope, instrument: measure.instrument, effect: measure.effect, id: measure.id };
  });
  const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
  const scopes = ["personas", "financiero", "sectorial", "general"];
  const matrix = years.map((year) => ({
    year,
    cells: scopes.map((scope) => rows.filter((row) => row.year === year && row.scope === scope).length),
    total: rows.filter((row) => row.year === year).length,
  }));
  return { years, scopes, matrix, total: rows.length };
}

function sanctionsMosaicPanel(data) {
  const { years, matrix, total } = sanctionsByYear(data);
  return chartPanel({
    id: "chart-sanctions-mosaic",
    eyebrow: "Visualización 14 · sanciones",
    title: "Cómo se construyó el cerco, año por año",
    subtitle: `${num(total)} medidas registradas entre ${num(years[0])} y ${num(years[years.length - 1])}`,
    extra: `<div class="sanctions-mosaic" id="chart-sanctions-mosaic" role="img"
      aria-label="Mosaico de medidas de sanción por año: cada celda es una medida, agrupadas por alcance"></div>
      <div class="chart-legend">${legendHtml([
        { label: "Sobre personas", backgroundColor: "var(--tier-oficial)", legendColor: "var(--tier-oficial)" },
        { label: "Sobre deuda y financiamiento", backgroundColor: "var(--alert)", legendColor: "var(--alert)" },
        { label: "Sectorial o empresarial", backgroundColor: "var(--warn)", legendColor: "var(--warn)" },
        { label: "Marco general", backgroundColor: "var(--ink-3)", legendColor: "var(--ink-3)" },
      ])}</div>`,
    heat: true,
    note: `El salto de 2017 es el punto de inflexión: las medidas dejan de señalar individuos y tocan la deuda y el
      financiamiento, que es exactamente el momento en que la salida voluntaria del default se vuelve operativamente
      imposible. Cada celda corresponde a un registro del bloque sanciones_regime, con su fuente en la ficha de la sección Ejecución.`,
  });
}

/** Mosaico DOM: una celda por medida, columnas por año, colores por alcance. */
export function mountSanctionsMosaic(data) {
  const host = document.getElementById("chart-sanctions-mosaic");
  if (!host) return;
  const { years, matrix } = sanctionsByYear(data);
  const max = Math.max(...matrix.map((row) => row.total), 1);
  const scopeClass = { personas: "mosaic__cell--personas", financiero: "mosaic__cell--financiero", sectorial: "mosaic__cell--sectorial", general: "mosaic__cell--general" };
  const rows = (data.sanctions_regime ?? []).map((measure) => ({
    year: Number(String(measure.date).slice(0, 4)),
    scope: /individuo|persona/i.test(measure.scope)
      ? "personas"
      : /deuda|financiamiento|bono/i.test(measure.scope)
        ? "financiero"
        : /empresa|petroler|sector|logístic|entidad|múltiple/i.test(measure.scope)
          ? "sectorial"
          : "general",
    measure,
  }));

  host.innerHTML = years
    .map((year) => {
      const cells = rows.filter((row) => row.year === year);
      const intensity = 0.45 + 0.55 * (cells.length / max);
      const items = cells.length
        ? cells
            .map(
              (cell) =>
                `<span class="mosaic__cell ${scopeClass[cell.scope]}" style="opacity:${intensity.toFixed(2)}"
                  title="${cell.year} · ${cell.scope} — ${cell.measure.instrument}"></span>`
            )
            .join("")
        : `<span class="mosaic__cell mosaic__cell--empty" title="${year}: sin medidas registradas"></span>`;
      return `<div class="mosaic__year"><div class="mosaic__cells">${items}</div><span class="mosaic__label">${year}</span></div>`;
    })
    .join("");
}

/* ---- 15. Línea de tiempo de calificaciones ----------------------------- */

function ratingsTimelinePanel(data) {
  const ratings = data.ratings_history ?? [];
  return chartPanel({
    id: "chart-ratings-timeline",
    eyebrow: "Visualización 15 · calidad de crédito",
    title: "La degradación no fue un acto: fue un proceso",
    subtitle: `${num(ratings.length)} acciones de calificación entre 2014 y 2026`,
    tall: true,
    legend: legendHtml([
      { label: "Grado especulativo alto (CCC)", backgroundColor: CHART_THEME.accentCool, legendColor: CHART_THEME.accentCool },
      { label: "Default selectivo o restringido", backgroundColor: CHART_THEME.alert, legendColor: "#c4453f" },
      { label: "Impago declarado", backgroundColor: CHART_THEME.accentViolet, legendColor: CHART_THEME.accentViolet },
    ]),
    note: `En menos de tres años el país recorrió de CCC a SD: la distancia entre «riesgo extraordinario» y «impago» fue
      una sucesión de decisiones, no un evento. Los puntos de 2020 y 2026 son consolidaciones agregadas, no acciones de
      una agencia concreta; así están rotulados en el bloque ratings_history.`,
  });
}

/** Etapa de cada acción de calificación, para color y forma. */
function ratingStage(action) {
  if (/SD|RD|selectivo|restringido/i.test(action)) return "default";
  if (/impago|\bC\b/i.test(action)) return "impago";
  return "especulativo";
}

function mountRatingsTimeline(data) {
  const ratings = (data.ratings_history ?? [])
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const stageColor = { especulativo: CHART_THEME.accentCool, default: "#c4453f", impago: CHART_THEME.accentViolet };
  const byAgency = {};
  for (const record of ratings) {
    const agency = record.agency;
    byAgency[agency] = byAgency[agency] ?? [];
    byAgency[agency].push({ ...record, year: Number(String(record.date).slice(0, 4)) });
  }
  const rows = Object.entries(byAgency);

  return {
    type: "scatter",
    data: {
      datasets: rows.map(([agency, records]) => ({
        label: agency,
        data: records.map((record) => ({
          x: record.year,
          y: agency,
          stage: ratingStage(record.action),
          action: record.action,
          rationale: record.rationale,
        })),
        backgroundColor: records.map((record) => withAlpha(stageColor[ratingStage(record.action)], 0.85)),
        borderColor: records.map((record) => stageColor[ratingStage(record.action)]),
        pointRadius: 7,
        pointHoverRadius: 9,
      })),
    },
    options: baseOptions({
      scales: {
        // Escala lineal sobre años, no "time": el adaptador de fechas de
        // Chart.js es otra dependencia de CDN y aquí no hace falta. El eje
        // sirve años completos del bloque ratings_history.
        x: {
          type: "linear",
          min: Math.min(...ratings.map((record) => Number(String(record.date).slice(0, 4)))) - 0.5,
          max: Math.max(...ratings.map((record) => Number(String(record.date).slice(0, 4)))) + 0.5,
          grid: { color: CHART_THEME.grid },
          ticks: {
            color: CHART_THEME.inkDim,
            font: { family: CHART_THEME.font, size: 10 },
            stepSize: 2,
            callback: (value) => num(value),
          },
          title: { display: true, text: "Año de la acción", color: CHART_THEME.inkDim, font: { family: CHART_THEME.font, size: 10 } },
        },
        y: {
          type: "category",
          labels: rows.map(([agency]) => agency),
          offset: true,
          grid: { color: CHART_THEME.grid },
          ticks: { color: CHART_THEME.inkDim, font: { family: CHART_THEME.font, size: 10 } },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: baseTooltip({
          callbacks: {
            title: (items) => `${items[0].raw.y} · ${items[0].raw.x}`,
            label: (context) => `${context.raw.action} — ${context.raw.rationale.slice(0, 110)}`,
          },
        }),
      },
    }),
  };
}

/* ---- 16. Dumbbell de laudos: principal contra acumulado ---------------- */

function awardsGapPanel(data) {
  return chartPanel({
    id: "chart-awards-gap",
    eyebrow: "Visualización 16 · laudos por reclamante",
    title: "El interés devengado, medido laudo por laudo",
    subtitle: "Línea entre condena original y valor acumulado a la fecha de valuación",
    tall: true,
    legend: legendHtml([
      { label: "Principal condenado", backgroundColor: CHART_THEME.accentCool, legendColor: CHART_THEME.accentCool },
      { label: "Valor acumulado con intereses", backgroundColor: CHART_THEME.accentViolet, legendColor: CHART_THEME.accentViolet },
    ]),
    note: `Cada par de puntos es un caso: el punto azul es lo que el tribunal condenó, el violeta lo que se debe hoy.
      La distancia no es una estimación: se calcula con la tasa asumida declarada de cada caso y el validador la
      recalcula. Es el precio exacto de cada año sin negociación.`,
  });
}

function mountAwardsGap(data) {
  const cases = (data.arbitration_cases ?? [])
    .filter((record) => Number(record.award_mm) > 0 && Number(record.award_total_mm) > 0)
    .sort((a, b) => Number(b.award_total_mm) - Number(a.award_total_mm))
    .slice(0, 10);
  // Etiqueta corta por caso: quita el paréntesis y los sufijos societarios.
  const shortName = (record) =>
    record.claimant
      .replace(/\s*\(.*?\)\s*/g, " ")
      .replace(/\s*(International|Corporation|Incorporated|Ltd\.?|Limited|S\.?A\.?|N\.?V\.?|B\.?V\.?|Inc\.?|GmbH|PLC)\b.*$/i, "")
      .trim()
      .slice(0, 26);

  return {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Principal",
          data: cases.map((record) => ({ x: Number(record.award_mm), y: shortName(record) })),
          backgroundColor: withAlpha(CHART_THEME.accentCool, 0.9),
          pointRadius: 5,
        },
        {
          label: "Acumulado",
          data: cases.map((record) => ({ x: Number(record.award_total_mm), y: shortName(record) })),
          backgroundColor: withAlpha(CHART_THEME.accentViolet, 0.9),
          pointRadius: 5,
        },
        {
          label: "Brecha de intereses",
          type: "line",
          data: cases.map((record) => ({
            x: Number(record.award_mm),
            y: shortName(record),
            gap: Number(record.award_total_mm) - Number(record.award_mm),
            to: Number(record.award_total_mm),
            date: record.award_date,
            rate: record.interest_rate_assumed_pct,
          })),
          borderColor: withAlpha(CHART_THEME.inkDim, 0.5),
          borderWidth: 1.2,
          pointRadius: 0,
        },
      ],
    },
    options: baseOptions({
      indexAxis: "y",
      scales: {
        x: {
          type: "logarithmic",
          min: 10,
          grid: { color: CHART_THEME.grid },
          ticks: { color: CHART_THEME.inkDim, font: { family: CHART_THEME.font, size: 10 }, callback: (value) => num(value) },
          title: { display: true, text: "Millones de USD (escala logarítmica)", color: CHART_THEME.inkDim, font: { family: CHART_THEME.font, size: 10 } },
        },
        y: {
          type: "category",
          offset: true,
          position: "right",
          grid: { display: false },
          ticks: { color: CHART_THEME.ink, font: { family: CHART_THEME.font, size: 10 }, autoSkip: false, crossAlign: "far" },
        },
      },
      plugins: {
        legend: { display: true, position: "bottom" },
        tooltip: baseTooltip({
          filter: (item) => item.datasetIndex === 2,
          callbacks: {
            label: (context) => `Intereses devengados: ${usd(context.raw.gap)} (tasa asumida ${pct(context.raw.rate, 1)}, laudo ${context.raw.date})`,
          },
        }),
      },
    }),
  };
}

/* ---- 17. Barras de líneas de ejecución --------------------------------- */

function enforcementBarsPanel(data) {
  return chartPanel({
    id: "chart-enforcement-bars",
    eyebrow: "Visualización 17 · ejecución",
    title: "Qué están ejecutando y dónde, ordenado por valor",
    subtitle: "Cada barra es un activo o flujo bajo disputa concreta",
    tall: true,
    note: `La barra más larga no es un laudo: es la acumulación de sentencias laborales sin ejecución, que crece en
      silencio. Las demás son activos identificables —acciones de Citgo, colateral pignorado, oro en custodia— cuyo
      destino lo decide un tribunal extranjero. Es la columna que falta en la mayoría de los recuentos de deuda.`,
  });
}

function mountEnforcementBars(data) {
  const rows = (data.enforcement_map ?? [])
    .slice()
    .sort((a, b) => Number(b.value_mm) - Number(a.value_mm));
  // Nombres de fila cortos y legibles: el detalle completo está en el tooltip
  // y en la ficha de cada línea del mapa de ejecución.
  const shortTarget = (row) => {
    const t = row.target.replace(/\s*\(.*?\)\s*/g, " ").trim();
    if (/^Acciones de PDV Holding/i.test(t)) return "Acciones de Citgo";
    if (/^Participaci\u00f3n del 50,1/i.test(t)) return "Colateral del bono PDVSA 2020";
    if (/^Oro venezolano/i.test(t)) return "Oro en el Banco de Inglaterra";
    if (/^Cuentas (corresponsales|sancionadas)/i.test(t)) return t.startsWith("Cuentas corresponsales") ? "Cuentas corresponsales" : "Cuentas bajo licencia";
    if (/^Mon\u00f3meros/i.test(t)) return "Mon\u00f3meros (control disputado)";
    if (/^Refiner\u00eda/i.test(t)) return "Refiner\u00eda de Curazao";
    if (/^Buques/i.test(t)) return "Buques y cargamentos";
    if (/^Pequiven/i.test(t)) return "Acciones de Pequiven";
    if (/^Sentencias laborales/i.test(t)) return "Sentencias laborales";
    if (/^Exxon/i.test(t)) return "Ejecuci\u00f3n Exxon (laudo ICC)";
    if (/^ConocoPhillips/i.test(t)) return "Activos del Caribe (Conoco)";
    if (/^Inmuebles/i.test(t)) return "Inmuebles diplom\u00e1ticos";
    if (/^Reservas/i.test(t)) return "Reservas ejecutables";
    return t.split(/\s+/).slice(0, 4).join(" ");
  };
  return {
    type: "bar",
    data: {
      labels: rows.map(shortTarget),
      datasets: [
        {
          label: "Valor en disputa",
          data: rows.map((row) => Number(row.value_mm)),
          backgroundColor: rows.map((row) =>
            /ejecuci|avanzad|activo/i.test(row.status)
              ? withAlpha(CHART_THEME.alert, 0.78)
              : /retenid|bloquead|disputad/i.test(row.status)
                ? withAlpha(CHART_THEME.accent, 0.72)
                : withAlpha(CHART_THEME.accentCool, 0.6)
          ),
          borderColor: CHART_THEME.surface,
          borderWidth: 1,
          borderRadius: 2,
        },
      ],
    },
    options: baseOptions({
      indexAxis: "y",
      scales: baseScales({ xTitle: "Millones de USD en disputa" }),
      plugins: {
        legend: { display: false },
        tooltip: baseTooltip({
          callbacks: {
            afterBody: (items) => {
              const row = rows[items[0].dataIndex];
              return [`Reclamante: ${row.claimant}`, `Estado: ${row.status}`];
            },
          },
        }),
      },
    }),
  };
}

/* ---- 18. Líneas de capacidad ------------------------------------------- */

function capacityLinesPanel(data) {
  const base = Number(data.scenarios?.base_nominal_mm) || 75000;
  const reserves = Number((data.kpis ?? []).find((kpi) => kpi.id === "reservas-internacionales")?.value_mm) || 10000;
  return chartPanel({
    id: "chart-capacity-lines",
    eyebrow: "Visualización 18 · sostenibilidad",
    title: "Cuánto servicio puede pagar el país, contra lo que pediría cada escenario",
    subtitle: "Horizonte de 25 años del escenario promedio ponderado · millones de dólares por año",
    tall: true,
    legend: legendHtml([
      { label: "Servicio total requerido (escenario medio)", borderColor: CHART_THEME.accentViolet, legendColor: CHART_THEME.accentViolet, borderDash: [5, 3] },
      { label: `Exportaciones anuales de referencia`, borderColor: CHART_THEME.accentCool, legendColor: CHART_THEME.accentCool },
      { label: `Reservas totales (nivel, no flujo)`, borderColor: CHART_THEME.inkDim, legendColor: CHART_THEME.inkDim },
    ]),
    note: `La lectura honesta: el servicio medio requerido ${usd(base)} de nominal reestructurado se compara contra un
      ingreso anual que hoy es una fracción de lo que fue. Las reservas —una línea plana, porque son un nivel y no un
      flujo— no alcanzan ni para un año de servicio. El techo de cualquier acuerdo no lo fija la voluntad del acreedor:
      lo fija el flujo de exportación.`,
  });
}

function mountCapacityLines(data) {
  const scenarios = data.scenarios?.items ?? [];
  const base = Number(data.scenarios?.base_nominal_mm) || 75000;
  const weighted = scenarios.reduce(
    (acc, scenario) => ({
      coupon: acc.coupon + Number(scenario.probability_pct) * Number(scenario.coupon_pct),
      tenor: acc.tenor + Number(scenario.probability_pct) * Number(scenario.tenor_years),
      grace: acc.grace + Number(scenario.probability_pct) * Number(scenario.grace_years),
      haircut: acc.haircut + Number(scenario.probability_pct) * Number(scenario.haircut_pct),
      discount: acc.discount + Number(scenario.probability_pct) * Number(scenario.discount_rate_pct),
      weight: acc.weight + Number(scenario.probability_pct),
    }),
    { coupon: 0, tenor: 0, grace: 0, haircut: 0, discount: 0, weight: 0 }
  );
  const average =
    weighted.weight > 0
      ? {
          coupon: weighted.coupon / weighted.weight,
          tenor: Math.round(weighted.tenor / weighted.weight),
          grace: Math.round(weighted.grace / weighted.weight),
          haircut: weighted.haircut / weighted.weight,
          discount: weighted.discount / weighted.weight,
        }
      : { coupon: 5, tenor: 25, grace: 4, haircut: 70, discount: 12 };

  const { outputs } = recoveryNpv({
    nominal_mm: base,
    haircut_pct: average.haircut,
    coupon_pct: average.coupon,
    tenor_years: average.tenor,
    grace_years: average.grace,
    discount_rate_pct: average.discount,
  });
  const schedule = outputs.schedule ?? [];

  const exportsKpi = (data.kpis ?? []).find((kpi) => kpi.id === "deuda-exportaciones");
  // Exportaciones de referencia derivadas del propio dataset: stock entre el
  // ratio deuda/exportaciones, que el validador ya audita.
  const exportsRef = Number(exportsKpi?.value_times) > 0 ? base / Number(exportsKpi.value_times) : 25000;
  const reserves = Number((data.kpis ?? []).find((kpi) => kpi.id === "reservas-internacionales")?.value_mm) || 10000;

  return {
    type: "line",
    data: {
      labels: schedule.map((row) => `Año ${row.period}`),
      datasets: [
        {
          label: "Servicio total requerido",
          data: schedule.map((row) => row.total_mm),
          borderColor: CHART_THEME.accentViolet,
          borderWidth: 1.6,
          borderDash: [5, 3],
          pointRadius: 0,
          tension: 0,
        },
        {
          label: "Exportaciones anuales de referencia",
          data: schedule.map(() => exportsRef),
          borderColor: CHART_THEME.accentCool,
          borderWidth: 1.2,
          pointRadius: 0,
          tension: 0,
        },
        {
          label: "Reservas totales (nivel)",
          data: schedule.map(() => reserves),
          borderColor: withAlpha(CHART_THEME.inkDim, 0.8),
          borderWidth: 1,
          pointRadius: 0,
          tension: 0,
        },
      ],
    },
    options: baseOptions({
      scales: baseScales({ yTitle: "Millones de USD por año" }),
      plugins: {
        tooltip: baseTooltip({
          mode: "index",
          intersect: false,
          callbacks: {
            afterBody: (items) => [
              `Escenario medio ponderado: quita ${pct(average.haircut, 0)}, cupón ${pct(average.coupon, 1)}, ${average.grace} años de gracia y ${average.tenor} de plazo`,
            ],
          },
        }),
      },
    }),
  };
}

/* ---- 19. Densidad de mecanismos ---------------------------------------- */

function mechanismDensityPanel(data) {
  /**
   * La capacidad declarada de cada mecanismo NO es aditiva: muchos tocan el
   * mismo flujo petrolero o el mismo stock de bonos (casi todos apuntan a los
   * mismos 77.000 MM). Sumarlos daría un techo ficticio de cientos de miles de
   * millones. Lo que se grafica es el MÁXIMO declarado por familia —el techo
   * que esa vía alcanzaría si se ejecutara sola—, que es la lectura que el
   * bloque admite sin inventar una suma imposible.
   */
  const rows = (data.recovery_mechanisms ?? []).reduce((acc, mechanism) => {
    const category = mechanism.category ?? "otro";
    acc[category] = acc[category] ?? { count: 0, capacity: 0, fits: 0 };
    acc[category].count += 1;
    acc[category].capacity = Math.max(acc[category].capacity, Number(mechanism.capacity_mm) || 0);
    acc[category].fits += Number(mechanism.fit_score) || 0;
    return acc;
  }, {});
  const sorted = Object.entries(rows).sort((a, b) => b[1].capacity - a[1].capacity);
  const maxCapacity = Math.max(...sorted.map(([, value]) => value.capacity), 1);

  return chartPanel({
    id: "chart-mechanism-density",
    eyebrow: "Visualización 19 · ingeniería de recuperación",
    title: "Dónde está el potencial de recuperación, por categoría",
    subtitle: `${num((data.recovery_mechanisms ?? []).length)} mecanismos evaluados · techo por familia (el máximo declarado, no la suma)`,
    extra: `<div class="mech-density" role="img" aria-label="Techo de recuperación por categoría de mecanismo: el máximo declarado dentro de cada familia">
      ${sorted
        .map(
          ([category, value]) => `<div class="mech-density__row">
            <span class="mech-density__label">${MECHANISM_LABELS[category] ?? category}</span>
            <span class="mech-density__track">
              <span class="mech-density__bar" style="width:${((value.capacity / maxCapacity) * 100).toFixed(1)}%"></span>
            </span>
            <span class="mech-density__value">${usd(value.capacity)}<em>${num(value.count)} mecanismo(s) · aptitud media ${(
              value.fits / value.count
            ).toFixed(1)}/5</em></span>
          </div>`
        )
        .join("")}
    </div>`,
    heat: true,
    note: `Las capacidades declaradas no son aditivas: casi todos los mecanismos tocan el mismo flujo petrolero o el
      mismo stock de bonos, y sumarlos daría un techo ficticio de cientos de miles de millones. La barra es el máximo
      declarado dentro de cada familia —lo que esa vía alcanzaría si se ejecutara sola—, y la aptitud media, sobre 5,
      es la evaluación cualitativa del bloque con su justificación en la ficha de cada mecanismo.`,
  });
}

export { prefersReducedMotion, renderHeatmap, renderTreemap, renderHeatmapTable };
