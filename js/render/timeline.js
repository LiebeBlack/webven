/**
 * js/render/timeline.js — Cronología global
 *
 * Lista ordenada de hechos, con marca de severidad, categoría y capa de
 * procedencia. Los elementos se revelan al entrar en pantalla mediante
 * IntersectionObserver (js/ui.js); el estado inicial ya es legible si el
 * observador no está disponible (clase is-visible aplicada de inmediato).
 */

import { esc, tierBadge, sourceRefs } from "./parts.js";
import { dateShort, num } from "../format.js";

const CATEGORY_LABELS = {
  crisis: "Crisis",
  macroeconomia: "Macroeconomía",
  legal: "Jurídico",
  sanciones: "Sanciones",
  default: "Cesación de pagos",
  reestructuracion: "Reestructuración",
  dato: "Dato",
  politico: "Político",
};

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] ?? category ?? "Sin categoría";
}

/** Un hito de la cronología. */
export function renderTimelineItem(event, { prefix = "t" } = {}) {
  const severity = Number(event.severity) || 1;
  return `<li class="timeline__item" id="${esc(prefix)}-${esc(event.id)}" data-category="${esc(event.category ?? "otro")}"
    data-severity="${severity}" data-tier="${esc(event.tier ?? "reportado")}">
    <span class="timeline__dot timeline__dot--severity-${severity}" aria-hidden="true"></span>
    <p class="timeline__date">
      ${esc(dateShort(event.date))}
      · ${esc(categoryLabel(event.category))}
      · severidad ${severity}/3
    </p>
    <p class="timeline__title">${esc(event.title)}</p>
    <p class="timeline__detail">${esc(event.detail)}</p>
    <div class="timeline__facts">
      ${tierBadge(event.tier)}
      ${event.debt_mm !== undefined ? `<span class="badge"><span class="dot"></span>stock ${esc(num(event.debt_mm))} MM</span>` : ""}
      ${sourceRefs(event.source_ids, { compact: true })}
    </div>
  </li>`;
}

/** Cronología completa. */
export function renderGlobalTimeline(data) {
  const events = (data.global_timeline ?? []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!events.length) return `<div class="empty">Sin hechos registrados en la cronología.</div>`;
  return `<ol class="timeline">${events.map((event) => renderTimelineItem(event)).join("")}</ol>`;
}

/** Resumen de la cronología por categoría, para el encabezado de sección. */
export function renderTimelineSummary(data) {
  const events = data.global_timeline ?? [];
  const byCategory = events.reduce((acc, event) => {
    acc[event.category] = (acc[event.category] ?? 0) + 1;
    return acc;
  }, {});
  const severe = events.filter((event) => Number(event.severity) === 3).length;
  return `<div class="row">
    ${Object.entries(byCategory)
      .map(([category, count]) => `<span class="pill pill--info">${esc(categoryLabel(category))} · ${num(count)}</span>`)
      .join("")}
    <span class="pill pill--alert">Severidad máxima · ${num(severe)}</span>
  </div>`;
}

/** Cinta de eventos para la portada del documento (usada en la sección de resumen). */
export function renderRecentEvents(data, limit = 6) {
  const events = (data.global_timeline ?? [])
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, limit);
  if (!events.length) return "";
  return `<ol class="timeline">${events.map((event) => renderTimelineItem(event, { prefix: "recent" })).join("")}</ol>`;
}
