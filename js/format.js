/**
 * js/format.js — Formato y saneamiento
 *
 * Un solo lugar para: presentar números en español venezolano, mostrar fechas,
 * escapar HTML y manipular colecciones. Ninguna otra parte de la aplicación
 * debe llamar a `Intl` ni interpolar texto sin pasar por `escapeHtml`.
 */

const LOCALE = "es-VE";

const numberFmt0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const numberFmt1 = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const numberFmt2 = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea un número con separador de miles local y decimales controlados. */
export function num(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  if (digits === 0) return numberFmt0.format(n);
  if (digits === 1) return numberFmt1.format(n);
  if (digits === 2) return numberFmt2.format(n);
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** Valores en millones de dólares → "US$ 164.432 MM". */
export function usd(valueMm, { digits = 0, unit = true } = {}) {
  if (valueMm === null || valueMm === undefined) return "—";
  return `US$ ${num(valueMm, digits)}${unit ? " MM" : ""}`;
}

/** Valores en millones de dólares → "US$ 164,4 MM" abreviado en millardos. */
export function usdBn(valueMm, { digits = 1 } = {}) {
  if (valueMm === null || valueMm === undefined) return "—";
  return `US$ ${num(Number(valueMm) / 1000, digits)} MM MM`;
}

/** Porcentaje. `digits=1` por defecto porque las cifras fiscales rara vez
 *  toleran más precisión que esa. */
export function pct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${num(value, digits)}%`;
}

/** Ratio expresado en veces: "9,4x". */
export function times(value, digits = 1) {
  if (value === null || value === undefined) return "—";
  return `${num(value, digits)}x`;
}

/** Fecha ISO (YYYY-MM-DD o YYYY-MM) → "8 de marzo de 2019". */
export function dateLong(iso) {
  const ms = parseIso(iso);
  if (ms === null) return iso ?? "—";
  return new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(ms));
}

/** Fecha ISO → "2019-03-08" (compacta, para tablas). */
export function dateShort(iso) {
  const ms = parseIso(iso);
  if (ms === null) return iso ?? "—";
  return new Date(ms).toISOString().slice(0, 10);
}

/** Año de una fecha ISO o el propio número si ya es un año. */
export function yearOf(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return String(value);
  const ms = parseIso(value);
  return ms === null ? String(value).slice(0, 4) : String(new Date(ms).getUTCFullYear());
}

/** Convierte un ISO parcial (año, año-mes o fecha completa) a milisegundos UTC. */
function parseIso(iso) {
  if (typeof iso === "number") return Date.UTC(iso, 0, 1);
  if (typeof iso !== "string") return null;
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(iso.trim());
  if (!match) return null;
  const [, y, m = "01", d = "01"] = match;
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

/** Fechas en formato largo a partir de un año suelto. */
export function yearLabel(year) {
  return Number(year) < 0 ? `${Math.abs(year)} a. C.` : String(year);
}

/** Rango "1999–2013". */
export function rangeLabel(from, to) {
  return `${yearOf(from)}–${yearOf(to)}`;
}

/** Signo explícito para variaciones: "+12,4%" / "−3,1%". */
export function signed(value, digits = 1, suffix = "%") {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${num(Math.abs(n), digits)}${suffix}`;
}

/** Dirección semántica de un delta, para elegir clase CSS. */
export function deltaDirection(value, { invert = false } = {}) {
  if (value === null || value === undefined || Number(value) === 0) return "flat";
  const positive = Number(value) > 0;
  const up = invert ? !positive : positive;
  return up ? "up" : "down";
}

/** Escapa texto destinado a `innerHTML`. Toda interpolación pasa por aquí. */
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Solo se permiten enlaces http(s). Evita `javascript:` en datos externos. */
export function safeUrl(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/** Dominio legible de una URL, para las referencias del ledger de fuentes. */
export function hostOf(url) {
  const safe = safeUrl(url);
  if (!safe) return "";
  try {
    return new URL(safe).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Identificador estable para anclas y deep-links. */
export function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72);
}

/** Recorta preservando palabras completas. */
export function truncate(text, max = 140) {
  const str = String(text ?? "");
  if (str.length <= max) return str;
  return `${str.slice(0, str.lastIndexOf(" ", max) || max)}…`;
}

/** Índice por id. Lanza si hay duplicados: un id repetido es un error de datos
 *  que debe explotar en desarrollo, no sobrescribir silenciosamente. */
export function indexById(records, key = "id") {
  const map = new Map();
  const duplicates = [];
  for (const record of records ?? []) {
    const id = record?.[key];
    if (id === undefined) continue;
    if (map.has(id)) duplicates.push(id);
    map.set(id, record);
  }
  if (duplicates.length > 0) {
    throw new Error(`Identificadores duplicados en el dataset: ${duplicates.join(", ")}`);
  }
  return map;
}

/** Suma tolerante a nulos. */
export function sum(values) {
  return (values ?? []).reduce((acc, v) => acc + (Number(v) || 0), 0);
}

/** Acota un número a un rango. */
export function clamp(value, min, max) {
  return Math.min(Math.max(Number(value), min), max);
}

/** Redondeo bancario-comercial a `digits` decimales, para evitar 0.30000004. */
export function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

/** Recorre una ruta con puntos sobre un objeto: "a.b.c". */
export function getPath(object, path) {
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc === null || acc === undefined ? acc : acc[key]), object);
}

/** Conteo legible con singular/plural. */
export function countLabel(n, singular, plural) {
  return `${num(n)} ${Number(n) === 1 ? singular : plural}`;
}

/** Cita formal reproducible de un registro, para el botón "citar". */
export function citationFor({ title, valueText, asOf, sourceNames, datasetVersion }) {
  const sources = (sourceNames ?? []).filter(Boolean).join("; ");
  return [
    `"${title}"${valueText ? `: ${valueText}` : ""}.`,
    asOf ? `Dato al ${dateShort(asOf)}.` : "",
    sources ? `Fuente(s): ${sources}.` : "",
    `Observatorio Arquitectónico de la Deuda Soberana de Venezuela, dataset v${datasetVersion ?? "—"}.`,
    `Consultado el ${dateShort(new Date().toISOString())}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Genera un CSV con BOM (para Excel en español) a partir de cabeceras y filas. */
export function toCsv(headers, rows) {
  const escape = (cell) => {
    const value = cell === null || cell === undefined ? "" : String(cell);
    return /[";\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  };
  const lines = [headers.map(escape).join(";"), ...rows.map((row) => row.map(escape).join(";"))];
  return `\uFEFF${lines.join("\r\n")}`;
}
