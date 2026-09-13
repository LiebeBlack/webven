/**
 * js/filters.js — Filtros de las secciones densas
 *
 * Los filtros operan sobre atributos de datos en el DOM (`data-filter-*`),
 * de modo que no hay que reconstruir el marcado para ocultar registros. Solo
 * dos casos exigen re-render: el orden de la tabla de acreedores y el recuento
 * de resultados, que se resuelve con un callback provisto por app.js.
 *
 * Regla de honestidad: cuando un filtro oculta registros, el contador visible
 * siempre declara cuántos se están mostrando sobre el total. Un filtro silencioso
 * es una forma de mentir con datos.
 */

import { CLASSES } from "./config.js";
import { num } from "./format.js";

const state = {
  creditorType: "all",
  creditorStatus: "all",
  creditorOrder: "exposure",
  mechanismCategory: "all",
  mechanismStatus: "all",
  timelineCategory: "all",
  timelineSeverity: "all",
};

let hooks = { rerenderCreditors: null, announce: null };

export function setFilterHooks(next) {
  hooks = { ...hooks, ...next };
}

export function getFilterState() {
  return { ...state };
}

/** Marca visualmente el chip activo dentro de su grupo. */
function activateChip(chip) {
  const group = chip.dataset.filterType
    ? "[data-filter-type]"
    : chip.dataset.filterMechanismCategory
      ? "[data-filter-mechanism-category]"
      : chip.dataset.filterMechanismStatus
        ? "[data-filter-mechanism-status]"
        : chip.dataset.filterTimelineCategory
          ? "[data-filter-timeline-category]"
          : chip.dataset.filterTimelineSeverity
            ? "[data-filter-timeline-severity]"
            : null;
  if (!group) return;
  const scope = chip.closest(".filters, .toolbar") ?? document;
  scope.querySelectorAll(group).forEach((other) => {
    const active = other === chip;
    other.classList.toggle(CLASSES.active, active);
    other.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

/** Aplica visibilidad y cuenta resultados en una colección de nodos. */
function applyVisibility(selector, predicate, counterSelector, label) {
  const nodes = [...document.querySelectorAll(selector)];
  let visible = 0;
  for (const node of nodes) {
    const show = predicate(node);
    node.hidden = !show;
    if (show) visible += 1;
  }
  const counter = counterSelector ? document.querySelector(counterSelector) : null;
  if (counter) {
    counter.textContent = `${num(visible)} de ${num(nodes.length)} ${label}`;
  }
  if (hooks.announce) hooks.announce(`${label}: ${visible} de ${nodes.length} visibles`);
  return visible;
}

function applyCreditorFilters() {
  applyVisibility(
    "[data-creditor-row]",
    (node) =>
      (state.creditorType === "all" || node.dataset.creditorType === state.creditorType) &&
      (state.creditorStatus === "all" || node.dataset.creditorStatus === state.creditorStatus),
    "[data-creditors-count]",
    "acreedores"
  );
}

function applyMechanismFilters() {
  applyVisibility(
    "[data-mechanism-category]",
    (node) =>
      (state.mechanismCategory === "all" || node.dataset.mechanismCategory === state.mechanismCategory) &&
      (state.mechanismStatus === "all" || node.dataset.mechanismStatus === state.mechanismStatus),
    "[data-mechanisms-count]",
    "mecanismos"
  );
}

function applyTimelineFilters() {
  applyVisibility(
    "[data-category]",
    (node) =>
      (state.timelineCategory === "all" || node.dataset.category === state.timelineCategory) &&
      (state.timelineSeverity === "all" || node.dataset.severity === state.timelineSeverity),
    "[data-timeline-count]",
    "hechos"
  );
}

/** Reaplica todos los filtros activos. Útil tras un re-render. */
export function applyFilters() {
  applyCreditorFilters();
  applyMechanismFilters();
  applyTimelineFilters();
}

export function resetFilters() {
  Object.assign(state, {
    creditorType: "all",
    creditorStatus: "all",
    creditorOrder: "exposure",
    mechanismCategory: "all",
    mechanismStatus: "all",
    timelineCategory: "all",
    timelineSeverity: "all",
  });
  document
    .querySelectorAll("[data-filter-type], [data-filter-mechanism-category], [data-filter-mechanism-status], [data-filter-timeline-category], [data-filter-timeline-severity]")
    .forEach((chip) => {
      const isAll = /^(all|)$/.test(
        chip.dataset.filterType ??
          chip.dataset.filterMechanismCategory ??
          chip.dataset.filterMechanismStatus ??
          chip.dataset.filterTimelineCategory ??
          chip.dataset.filterTimelineSeverity
      );
      chip.classList.toggle(CLASSES.active, isAll);
      chip.setAttribute("aria-pressed", isAll ? "true" : "false");
    });
  document.querySelectorAll("[data-filter-status]").forEach((select) => {
    select.value = "all";
  });
  document.querySelectorAll("[data-filter-order]").forEach((select) => {
    select.value = "exposure";
  });
  applyFilters();
}

function onDocumentClick(event) {
  const chip = event.target.closest(
    "[data-filter-type], [data-filter-mechanism-category], [data-filter-mechanism-status], [data-filter-timeline-category], [data-filter-timeline-severity]"
  );
  if (!chip) return;
  activateChip(chip);

  if (chip.dataset.filterType !== undefined) state.creditorType = chip.dataset.filterType;
  if (chip.dataset.filterMechanismCategory !== undefined) state.mechanismCategory = chip.dataset.filterMechanismCategory;
  if (chip.dataset.filterMechanismStatus !== undefined) state.mechanismStatus = chip.dataset.filterMechanismStatus;
  if (chip.dataset.filterTimelineCategory !== undefined) state.timelineCategory = chip.dataset.filterTimelineCategory;
  if (chip.dataset.filterTimelineSeverity !== undefined) state.timelineSeverity = chip.dataset.filterTimelineSeverity;

  applyFilters();
}

function onDocumentChange(event) {
  const select = event.target;
  if (select.matches("[data-filter-status]")) {
    state.creditorStatus = select.value;
    applyCreditorFilters();
  }
  if (select.matches("[data-filter-order]")) {
    state.creditorOrder = select.value;
    if (hooks.rerenderCreditors) hooks.rerenderCreditors(state.creditorOrder);
    applyCreditorFilters();
  }
}

let initialized = false;
export function initFilters() {
  if (initialized) return;
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("change", onDocumentChange);
  initialized = true;
}

export { applyCreditorFilters, applyMechanismFilters, applyTimelineFilters };
