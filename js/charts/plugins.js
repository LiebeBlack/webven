/**
 * js/charts/plugins.js — Tema, plugins y opciones compartidas de Chart.js
 *
 * Todos los gráficos del observatorio comparten tipografía monoespaciada,
 * retícula por hairlines y tooltips sobrios. Se centraliza aquí para que un
 * cambio de tema no obligue a tocar doce configuraciones.
 */

import { CHART_THEME } from "../config.js";
import { num } from "../format.js";

/** ¿Está Chart.js disponible? El CDN puede fallar y la página debe sobrevivir. */
export function chartsAvailable() {
  return typeof window !== "undefined" && typeof window.Chart === "function";
}

/** Mensaje uniforme cuando una visualización no puede construirse. */
export function chartsUnavailableMessage(detail = "") {
  return `<div class="empty">Visualización no disponible${detail ? `. ${detail}` : ""}</div>`;
}

/** Escala numérica de miles con separador local. */
export function tickNumber(value) {
  return num(value, Math.abs(Number(value)) < 10 ? 1 : 0);
}

/** Opciones base de tooltip. */
export function baseTooltip(extra = {}) {
  return {
    backgroundColor: CHART_THEME.tooltipBg,
    borderColor: CHART_THEME.tooltipBorder,
    borderWidth: 1,
    titleColor: CHART_THEME.inkStrong,
    titleFont: { family: CHART_THEME.font, size: 11, weight: "500" },
    bodyColor: CHART_THEME.ink,
    bodyFont: { family: CHART_THEME.font, size: 11 },
    padding: 10,
    cornerRadius: 2,
    displayColors: true,
    boxWidth: 8,
    boxHeight: 8,
    ...extra,
  };
}

/** Opciones base de ejes cartesianos. */
export function baseScales({ xTitle = "", yTitle = "", stacked = false } = {}) {
  return {
    x: {
      stacked,
      grid: { color: CHART_THEME.grid, drawBorder: false, drawTicks: false },
      border: { color: CHART_THEME.gridStrong },
      ticks: {
        color: CHART_THEME.inkDim,
        font: { family: CHART_THEME.font, size: 10 },
        maxRotation: 0,
        autoSkipPadding: 12,
      },
      title: xTitle
        ? { display: true, text: xTitle, color: CHART_THEME.inkDim, font: { family: CHART_THEME.font, size: 10 } }
        : undefined,
    },
    y: {
      stacked,
      grid: { color: CHART_THEME.grid, drawBorder: false, drawTicks: false },
      border: { color: CHART_THEME.gridStrong },
      ticks: {
        color: CHART_THEME.inkDim,
        font: { family: CHART_THEME.font, size: 10 },
        callback: (value) => tickNumber(value),
      },
      title: yTitle
        ? { display: true, text: yTitle, color: CHART_THEME.inkDim, font: { family: CHART_THEME.font, size: 10 } }
        : undefined,
    },
  };
}

/** Opciones base comunes a todos los gráficos. */
export function baseOptions({ plugins = {}, scales = null, indexAxis = "x" } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis,
    animation: prefersReducedMotion() ? false : { duration: 620, easing: "easeOutQuart" },
    interaction: { mode: "nearest", intersect: false, axis: "xy" },
    plugins: {
      legend: { display: false },
      tooltip: baseTooltip(),
      ...plugins,
    },
    ...(scales ? { scales } : {}),
  };
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ------------------------------------------------------------- plugins --- */

/**
 * Dibuja el total (o el valor principal) en el centro de un gráfico de anillo.
 * Se implementa como plugin en lugar de recuadro HTML superpuesto para que el
 * valor siga al gráfico al redimensionar.
 */
export const centerTextPlugin = {
  id: "centerText",
  afterDraw(chart, _args, options) {
    if (!options?.display) return;
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta?.data?.length) return;
    const x = meta.data[0].x;
    const y = meta.data[0].y;
    const radius = meta.data[0].outerRadius ?? 0;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = CHART_THEME.inkDim;
    ctx.font = `10px ${CHART_THEME.font}`;
    ctx.fillText(options.label ?? "", x, y - 14);

    ctx.fillStyle = CHART_THEME.inkStrong;
    ctx.font = `16px ${CHART_THEME.font}`;
    ctx.fillText(options.value ?? "", x, y + 4);

    if (options.sub) {
      ctx.fillStyle = CHART_THEME.inkDim;
      ctx.font = `10px ${CHART_THEME.font}`;
      ctx.fillText(options.sub, x, y + 20);
    }

    ctx.restore();
    void radius;
  },
};

/**
 * Marca los eventos de estrés sobre una serie temporal: línea vertical tenue y
 * etiqueta rotada. Son los hitos del dataset histórico, no decoración.
 */
export const stressEventsPlugin = {
  id: "stressEvents",
  afterDatasetsDraw(chart, _args, options) {
    const events = options?.events;
    if (!events?.length) return;
    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    if (!xScale) return;

    ctx.save();
    ctx.font = `9px ${CHART_THEME.font}`;
    events.forEach((event) => {
      const index = xScale.getPixelForValue(event.year);
      if (!Number.isFinite(index) || index < chartArea.left || index > chartArea.right) return;
      const severe = Number(event.severity) >= 3;
      ctx.strokeStyle = severe ? "rgba(196, 69, 63, 0.45)" : "rgba(110, 116, 126, 0.35)";
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(index, chartArea.top);
      ctx.lineTo(index, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.save();
      ctx.translate(index + 3, chartArea.top + 4);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = severe ? "rgba(224, 132, 127, 0.9)" : "rgba(110, 116, 126, 0.85)";
      ctx.textBaseline = "bottom";
      ctx.fillText(String(event.label).slice(0, 34), 0, 0);
      ctx.restore();
    });
    ctx.restore();
  },
};

/** Etiqueta el último punto de una serie: es el dato que más se consulta. */
export const lastValuePlugin = {
  id: "lastValue",
  afterDatasetsDraw(chart, _args, options) {
    if (!options?.display) return;
    const dataset = chart.data.datasets[0];
    if (!dataset?.data?.length) return;
    const meta = chart.getDatasetMeta(0);
    const point = meta.data[meta.data.length - 1];
    if (!point) return;
    const { ctx } = chart;
    const value = dataset.data[dataset.data.length - 1];
    ctx.save();
    ctx.fillStyle = CHART_THEME.accent;
    ctx.font = `11px ${CHART_THEME.font}`;
    ctx.textAlign = "right";
    ctx.fillText(options.formatter ? options.formatter(value) : String(value), point.x - 6, point.y - 8);
    ctx.restore();
  },
};

/**
 * Degradado de área bajo la curva. Se aplica a los datasets temporales para
 * dar jerarquía sin recurrir a colores saturados.
 */
export function areaGradient(context, color, { from = 0.28, to = 0 } = {}) {
  const { chart } = context;
  const { ctx, chartArea } = chart;
  if (!chartArea) return `rgba(200, 162, 74, ${to})`;
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, withAlpha(color, from));
  gradient.addColorStop(1, withAlpha(color, to));
  return gradient;
}

/** Convierte un color hex en rgba con alfa. */
export function withAlpha(hex, alpha) {
  const clean = String(hex).replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Genera la leyenda HTML de un gráfico a partir de sus datasets. */
export function legendHtml(datasets) {
  return datasets
    .map(
      (dataset) =>
        `<span class="legend__item">
          <span class="legend__swatch ${dataset.borderDash ? "legend__swatch--line" : ""}"
            style="background:${dataset.legendColor ?? dataset.borderColor ?? dataset.backgroundColor}"></span>
          ${dataset.label ?? ""}
        </span>`
    )
    .join("");
}

export { CHART_THEME };
