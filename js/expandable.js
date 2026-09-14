/**
 * js/expandable.js — Sistema de tarjetas expandibles
 *
 * Decisiones de implementación:
 *  · Delegación de eventos sobre `document`: las tarjetas se inyectan después
 *    del render y se re-renderizan con los filtros, así que registrar listeners
 *    por tarjeta obligaría a reengancharlos en cada pasada.
 *  · Acordeón selectivo: en los grupos densos (mecanismos, escenarios, laudos)
 *    abrir una tarjeta cierra la anterior, porque comparar dos fichas largas
 *    abiertas es ilegible. En indicadores y vacíos se permite tener varias
 *    abiertas, porque ahí la comparación es el uso principal.
 *  · Estado en el DOM (clase + aria-expanded): no hay estado paralelo que
 *    pueda desincronizarse del atributo accesible.
 */

import { CLASSES } from "./config.js";

/** Grupos que funcionan como acordeón. */
const ACCORDION_GROUPS = new Set(["mecanismos", "escenarios", "laudos", "administraciones", "acreedores"]);

/** Duración de la transición, en milisegundos (debe coincidir con styles.css). */
const COLLAPSE_MS = 460;

function cardOf(element) {
  return element.closest("[data-expandable]");
}

function groupOf(card) {
  return card?.dataset.expandableGroup ?? "";
}

function isOpen(card) {
  return card?.classList.contains(CLASSES.open) ?? false;
}

/** Abre o cierra una tarjeta, con el estado accesible correspondiente. */
export function setExpanded(card, open) {
  if (!card) return;
  const toggle = card.querySelector("[data-expandable-toggle]");
  if (!toggle) return;

  const body = card.querySelector(":scope > .expandable__body");

  if (open) {
    card.classList.remove(CLASSES.collapsing);
    card.classList.add(CLASSES.open);
    toggle.setAttribute("aria-expanded", "true");
    // Defensa en profundidad: ningún renderizador debe dejar un atributo
    // `hidden` en el cuerpo; si lo hubiera, la tarjeta no abriría nunca
    // porque tokens.css lo resuelve a display:none !important.
    if (body) body.removeAttribute("hidden");
  } else {
    card.classList.add(CLASSES.collapsing);
    card.classList.remove(CLASSES.open);
    toggle.setAttribute("aria-expanded", "false");
    // El cuerpo no recibe `hidden`: lo mantiene el CSS cerrado, que permite
    // animar el cierre y retira el contenido del árbol accesible mediante
    // `visibility: hidden` una vez terminada la transición.
    window.setTimeout(() => card.classList.remove(CLASSES.collapsing), COLLAPSE_MS);
  }
}

export function toggleExpanded(card) {
  const next = !isOpen(card);
  if (next) {
    // Acordeón: se cierra el resto del grupo antes de abrir esta.
    const group = groupOf(card);
    if (group && ACCORDION_GROUPS.has(group)) {
      document
        .querySelectorAll(`[data-expandable][data-expandable-group="${group}"]`)
        .forEach((other) => {
          if (other !== card && isOpen(other)) setExpanded(other, false);
        });
    }
  }
  setExpanded(card, next);
  return next;
}

export function closeAll(group) {
  const selector = group
    ? `[data-expandable][data-expandable-group="${group}"]`
    : "[data-expandable]";
  document.querySelectorAll(selector).forEach((card) => {
    if (isOpen(card)) setExpanded(card, false);
  });
}

function onDocumentClick(event) {
  const toggle = event.target.closest("[data-expandable-toggle]");
  if (!toggle) return;
  const card = cardOf(toggle);
  if (!card) return;
  // El botón vive dentro del contenedor; un clic en un botón anidado
  // (por ejemplo "citar") no debe alternar la tarjeta.
  if (event.target.closest("button:not([data-expandable-toggle])")) return;
  toggleExpanded(card);
}

/**
 * Enlaces profundos: si la URL apunta a una tarjeta, se abre y se resalta.
 * También funciona cuando el destino está dentro de una tarjeta cerrada.
 */
export function openFromHash(hash = window.location.hash, { scroll = true } = {}) {
  if (!hash || hash.length < 2) return false;
  const id = decodeURIComponent(hash.slice(1));
  const target = document.getElementById(id);
  if (!target) return false;

  const card = target.matches("[data-expandable]") ? target : target.closest("[data-expandable]");
  if (card) {
    setExpanded(card, true);
    // Si la tarjeta está dentro de otro contenedor expandible, se abre en cascada.
    let parent = card.parentElement?.closest("[data-expandable]");
    while (parent) {
      setExpanded(parent, true);
      parent = parent.parentElement?.closest("[data-expandable]");
    }
  }

  const focusTarget = card ?? target;
  if (scroll) {
    focusTarget.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  focusTarget.classList.add(CLASSES.hashTarget);
  window.setTimeout(() => focusTarget.classList.remove(CLASSES.hashTarget), 1800);
  return true;
}

/** Inicializa la delegación. Idempotente: puede llamarse tras cada render. */
let initialized = false;
export function initExpandables() {
  if (initialized) return;
  document.addEventListener("click", onDocumentClick);
  window.addEventListener("hashchange", () => openFromHash());
  initialized = true;
  if (window.location.hash) {
    // Se difiere para que el resto del documento termine de montarse.
    window.setTimeout(() => openFromHash(), 120);
  }
}

/** Expande o contrae todo un grupo (útil para impresión y para comandos). */
export function setGroupOpen(group, open) {
  const cards = document.querySelectorAll(
    group ? `[data-expandable][data-expandable-group="${group}"]` : "[data-expandable]"
  );
  cards.forEach((card) => setExpanded(card, open));
}

/** Cuenta de tarjetas abiertas, para mostrar en la paleta de comandos. */
export function openCount() {
  return document.querySelectorAll(`[data-expandable].${CLASSES.open}`).length;
}
