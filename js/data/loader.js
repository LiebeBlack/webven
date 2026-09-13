/**
 * js/data/loader.js — Carga del dataset con cadena de respaldo
 *
 * Un fetch puede fallar por motivos muy distintos: el sitio abierto con file://
 * (los módulos ES y el fetch de archivos locales no funcionan ahí), una ruta
 * mal escrita en un despliegue bajo subdirectorio, una caché intermedia que
 * devuelve un archivo truncado o una red corporativa que bloquea .json.
 *
 * Estrategia: se intenta el JSON publicado, luego el módulo embebido y por
 * último una estructura mínima en memoria. En todos los casos se informa al
 * usuario qué fuente se usó: nunca se muestra un dato sin decir de dónde salió.
 */

import { DATA_PATHS, DATA_SOURCES } from "../config.js";
import { validateDatabase } from "./contract.js";

/** Error con contexto de todos los intentos realizados. */
export class DataLoadError extends Error {
  constructor(message, attempts = []) {
    super(message);
    this.name = "DataLoadError";
    this.attempts = attempts;
  }
}

/**
 * Estructura de último recurso. No contiene cifras: solo la forma mínima para
 * que la interfaz pueda dibujarse y explicar el fallo en lugar de quedar en
 * blanco. Se declara explícitamente como capa `propuesta` para que ninguna
 * parte de la UI lo presente como dato.
 */
const MINIMAL_FALLBACK = {
  meta: {
    slug: "observatorio-deuda-soberana-ve",
    title: "Observatorio Arquitectónico de la Deuda Soberana de Venezuela",
    short_title: "Observatorio de Deuda Soberana VE",
    subtitle: "Sin datos cargados",
    masthead: "Información del Mercantil Venezolano",
    version: "1.0.0",
    dataset_version: "sin-cargar",
    generated_at: new Date().toISOString().slice(0, 10),
    valuation_date: new Date().toISOString().slice(0, 10),
    currency: "USD",
    unit: "millones de dólares (MM USD)",
    locale: "es-VE",
    period: "1990–2026",
    editorial_note: "No fue posible cargar el dataset. La interfaz se dibuja con una estructura vacía para explicar el fallo.",
    disclaimer:
      "Sin datos cargados. Este estado no debe interpretarse como ausencia de deuda ni como cifra alguna.",
    methodology_summary: "",
    tiers: [],
    scope_notes: [],
  },
  sources: [],
  kpis: [],
  debt_instruments: { basis_note: "", as_of: null, tier: "propuesta", source_ids: [], blocks: [] },
  creditors: [],
  creditor_committees: [],
  ratings_history: [],
  arbitration_cases: [],
  enforcement_map: [],
  historical_matrix: { unit: "", note: "", dimensions: [], administrations: [] },
  historical_series: { unit: "", tier: "propuesta", note: "", anchor_years: [], series_definitions: [], points: [], events: [] },
  recovery_mechanisms: [],
  legal_instruments: [],
  scenarios: { base_nominal_mm: 0, valuation_date: null, unit: "", note: "", items: [] },
  global_timeline: [],
  sanctions_regime: [],
  institutional_map: [],
  glossary: [],
  watchlist: [],
  data_gaps: [],
};

/**
 * Dataset embebido en la propia página (distribución de archivo único).
 * Se comprueba antes que el fetch a propósito: si la página trae los datos,
 * no hay razón para gastar una petición ni para depender de la red.
 */
function pageEmbed() {
  const data = globalThis.__OBS_DATABASE__;
  return data && typeof data === "object" ? data : null;
}

/** Intenta leer el JSON publicado. */
async function tryJson(signal) {
  const response = await fetch(DATA_PATHS.json, {
    cache: "no-cache",
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`El servidor respondió ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  if (!text.trim()) throw new Error("El archivo llegó vacío.");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`El archivo no es JSON válido: ${error.message}`);
  }
}

/** Intenta el módulo embebido (mismo contenido, sin fetch). */
async function tryEmbedded() {
  const module = await import(DATA_PATHS.embedded);
  const data = module.embeddedDatabase ?? module.default;
  if (!data) throw new Error("El módulo embebido no exporta 'embeddedDatabase'.");
  return data;
}

/**
 * Carga el dataset aplicando la cadena de respaldo.
 * @param {{signal?:AbortSignal, validate?:boolean}} options
 * @returns {Promise<{data:object, source:object, validation:object|null, attempts:Array, degraded:boolean}>}
 */
export async function loadDatabase({ signal, validate = true } = {}) {
  const attempts = [];

  // La sonda del embebido no se registra como intento fallido: en la
  // distribución multiarchivo su ausencia es lo normal, no un error.
  const embedded = pageEmbed();
  if (embedded) {
    attempts.push({ source: DATA_SOURCES.page.id, ok: true });
    return {
      data: embedded,
      source: DATA_SOURCES.page,
      validation: validate ? validateDatabase(embedded) : null,
      attempts,
      degraded: false,
    };
  }

  try {
    const data = await tryJson(signal);
    attempts.push({ source: DATA_SOURCES.json.id, ok: true });
    return {
      data,
      source: DATA_SOURCES.json,
      validation: validate ? validateDatabase(data) : null,
      attempts,
      degraded: false,
    };
  } catch (error) {
    attempts.push({ source: DATA_SOURCES.json.id, ok: false, error: error.message });
  }

  try {
    const data = await tryEmbedded();
    attempts.push({ source: DATA_SOURCES.embedded.id, ok: true });
    return {
      data,
      source: DATA_SOURCES.embedded,
      validation: validate ? validateDatabase(data) : null,
      attempts,
      degraded: true,
    };
  } catch (error) {
    attempts.push({ source: DATA_SOURCES.embedded.id, ok: false, error: error.message });
  }

  attempts.push({ source: DATA_SOURCES.embeddedInline.id, ok: true });
  return {
    data: MINIMAL_FALLBACK,
    source: DATA_SOURCES.embeddedInline,
    validation: null,
    attempts,
    degraded: true,
    error: new DataLoadError(
      "No se pudo cargar el dataset desde ninguna de las fuentes disponibles.",
      attempts
    ),
  };
}

/** Resumen legible de la cadena de intentos, para el registro de arranque. */
export function describeAttempts(attempts) {
  return attempts.map((attempt) => ({
    label: attempt.source,
    status: attempt.ok ? "ok" : "fail",
    detail: attempt.ok ? "cargado" : attempt.error,
  }));
}
