/**
 * Observatorio Arquitectónico de la Deuda Soberana de Venezuela
 * js/config.js — Constantes, contratos de UI y parámetros del observatorio
 *
 * Todo valor que la aplicación necesita compartir entre módulos vive aquí.
 * Ningún módulo debe declarar rutas, colores o umbrales por su cuenta.
 */

/** Versión del cliente. Se muestra en el pie y en el boot. */
export const APP_VERSION = "1.0.0";

/** Rutas de datos. Relativas a propósito: el sitio debe funcionar en un
 *  subdirectorio de GitHub Pages (`usuario.github.io/repositorio/`). */
export const DATA_PATHS = {
  json: "./data/database.json",
  embedded: "./data/database.embedded.js",
};

/** Origen de los datos según cómo se resolvió la carga. */
export const DATA_SOURCES = {
  page: {
    id: "page",
    label: "dataset embebido en la página",
    ok: true,
    note: "Distribución de archivo único: el dataset viaja dentro del propio HTML, sin fetch ni módulos externos. Funciona incluso desde file://.",
  },
  json: { id: "json", label: "data/database.json", ok: true },
  embedded: {
    id: "embedded",
    label: "data/database.embedded.js",
    ok: true,
    note: "Respaldo embebido: el fetch del JSON falló (habitual en file:// o con caché corrupta).",
  },
  embeddedInline: {
    id: "embeddedInline",
    label: "respaldo embebido en el bundle",
    ok: false,
    note: "Se usó el respaldo de último recurso dentro de js/data/loader.js.",
  },
};

/** Contenedores del DOM que el motor rellena. Centralizados para que un
 *  cambio de maquetación no obligue a tocar la lógica de render. */
export const CONTAINERS = {
  boot: "#boot-screen",
  bootLog: "#boot-log",
  tierLegend: "#tier-legend",
  metaLine: "#dataset-meta",
  scopeNotes: "#scope-notes",
  sourceNotice: "#source-notice",
  ticker: "#ticker-track",
  recentEvents: "#recent-events",
  kpiGrid: "#kpi-grid",
  kpiNote: "#kpi-note",
  charts: "#charts-container",
  creditorsTable: "#creditors-table",
  creditorFilters: "#creditor-filters",
  creditorsSummary: "#creditors-summary",
  creditorNotes: "#creditor-notes",
  committees: "#creditor-committees",
  ratings: "#ratings-history",
  awardsContainer: "#awards-container",
  awardsSummary: "#awards-summary",
  awardsTable: "#awards-table",
  awardsBars: "#awards-bars",
  enforcementContainer: "#enforcement-container",
  enforcementSummary: "#enforcement-summary",
  enforcementNote: "#enforcement-note",
  timelineSummary: "#timeline-summary",
  globalTimeline: "#timeline-container",
  administrationMatrix: "#administration-matrix",
  administrationTable: "#administration-table",
  mechanismsGrid: "#mechanisms-grid",
  mechanismFilters: "#mechanism-filters",
  mechanismSummary: "#mechanism-summary",
  mechanismsTable: "#mechanisms-table",
  legalInstruments: "#legal-instruments",
  scenariosContainer: "#scenarios-container",
  scenariosTable: "#scenarios-table",
  simulator: "#scenario-simulator",
  sanctionsContainer: "#sanctions-container",
  sanctionsNote: "#sanctions-note",
  institutionalContainer: "#institutional-container",
  institutionalBars: "#institutional-bars",
  sourcesLedger: "#sources-ledger",
  sourcesSummary: "#sources-summary",
  auditReport: "#audit-report",
  glossary: "#glossary",
  watchlist: "#watchlist",
  dataGaps: "#data-gaps",
  gapsIntro: "#gaps-intro",
  footerMeta: "#footer-meta",
  progressBar: "#progress-bar",
  palette: "#command-palette",
  paletteInput: "#palette-input",
  paletteList: "#palette-list",
  toastWrap: "#toast-wrap",
};

/** Capas de procedencia. El orden importa: de mayor a menor jerarquía
 *  probatoria. Se comunican con etiqueta + color, nunca solo con color. */
export const TIERS = {
  oficial: {
    id: "oficial",
    label: "Oficial",
    long: "Documental oficial",
    color: "#7fa6c8",
    order: 1,
    description:
      "Cifra publicada por la entidad emisora, un tribunal o un organismo multilateral: boletines del BCV, laudos del CIADI, actas de clubes de acreedores, comunicados de OFAC.",
  },
  reportado: {
    id: "reportado",
    label: "Reportado",
    long: "Reportado por terceros",
    color: "#c8a24a",
    order: 2,
    description:
      "Cifra difundida por prensa especializada, bancos de inversión, comités de acreedores u observatorios independientes. No es un acto oficial, pero es trazable a un emisor identificable.",
  },
  precedente: {
    id: "precedente",
    label: "Precedente",
    long: "Precedente aplicado en otro país",
    color: "#6ea89a",
    order: 3,
    description:
      "Instrumento o doctrina que ya se aplicó en una reestructuración soberana verificable (Plan Brady, canje argentino de 2005, cláusulas de acción colectiva agregadas) pero que no tiene aplicación consumada en Venezuela. Es un hecho documentado en otra jurisdicción: ni cifra oficial venezolana ni hipótesis teórica.",
  },
  calculado: {
    id: "calculado",
    label: "Calculado",
    long: "Análisis derivado propio",
    color: "#9c7fc8",
    order: 4,
    description:
      "Resultado de una fórmula explícita sobre datos de las capas anteriores. Cada valor calculado se recalcula en el validador, así que no puede quedar desfasado respecto a sus insumos.",
  },
  propuesta: {
    id: "propuesta",
    label: "Propuesta",
    long: "Instrumento propuesto / teórico",
    color: "#6e747e",
    order: 5,
    description:
      "Diseño de política económica o instrumento financiero que todavía no existe en ningún país ni tiene precedente directo aplicado a Venezuela. Nunca debe leerse como hecho observable.",
  },
};

/** Orden canónico de las capas para leyendas y tablas. */
export const TIER_ORDER = ["oficial", "reportado", "precedente", "calculado", "propuesta"];

/** Paleta de gráficos. Alineada con tokens.css. */
export const CHART_THEME = {
  ink: "#a8adb6",
  inkStrong: "#ededed",
  inkDim: "#6e747e",
  grid: "#16171a",
  gridStrong: "#23252a",
  surface: "#08090a",
  tooltipBg: "rgba(5, 5, 6, 0.96)",
  tooltipBorder: "#23252a",
  accent: "#c8a24a",
  accentCool: "#7fa6c8",
  accentViolet: "#9c7fc8",
  alert: "#c4453f",
  warn: "#c08a3e",
  ok: "#4e8f6b",
  font: "'JetBrains Mono', monospace",
  /** Series por defecto para composiciones (acreedores, tramos, etc.). */
  series: [
    "#c8a24a",
    "#7fa6c8",
    "#9c7fc8",
    "#4e8f6b",
    "#c08a3e",
    "#c4453f",
    "#8a8f98",
    "#5d8aa8",
    "#a98bd0",
    "#b58a4e",
    "#6b8f9c",
    "#8d6e63",
  ],
};

/** Colores por categoría de salida, usados en los gráficos de composición. */
export const CATEGORY_COLORS = {
  tenedor_bonos: "#c8a24a",
  arbitral: "#c4453f",
  estado: "#7fa6c8",
  multilateral: "#4e8f6b",
  proveedor: "#9c7fc8",
  interno: "#8a8f98",
  otro: "#5d8aa8",
};

/** Tokens de categoría en español para etiquetas legibles. */
export const CATEGORY_LABELS = {
  tenedor_bonos: "Tenedores de bonos",
  arbitral: "Acreedores arbitrales",
  estado: "Acreedores estatales",
  multilateral: "Multilaterales",
  proveedor: "Proveedores y contratistas",
  interno: "Deuda interna",
  otro: "Otros",
};

/** Etiquetas de las categorías de mecanismos de recuperación (bloque
 *  recovery_mechanisms). Cualquier categoría nueva en el dataset debe
 *  declararse aquí para que la vista 19 la lea legible. */
export const MECHANISM_LABELS = {
  fideicomiso: "Fideicomisos y vehículos de pago",
  mercado: "Operaciones de mercado",
  legal: "Instrumentos legales y contractuales",
  colateral: "Colateralización de flujos",
  multilateral: "Marco multilateral",
  fiscal: "Medidas fiscales internas",
  regulatorio: "Cambios regulatorios",
  otro: "Otros mecanismos",
};

/** Umbrales de lectura rápida. No son juicios de valor: son disparadores
 *  de color y de texto en la interfaz. */
export const THRESHOLDS = {
  /** Deuda / PIB por encima del cual se marca insostenibilidad evidente. */
  debtToGdpAlert: 100,
  /** Deuda / exportaciones por encima del cual el servicio es inalcanzable. */
  debtToExportsAlert: 300,
  /** Cobertura de reservas por debajo de la cual no hay colchón. */
  reserveCoverageAlertPct: 10,
  /** Recuperación de tenedores por debajo de la cual se habla de quita profunda. */
  recoveryDeepHaircutPct: 30,
  /** Probabilidad a partir de la cual un escenario se destaca en la UI. */
  scenarioProbabilityFocusPct: 30,
};

/** Parámetros por defecto del simulador de escenarios (valores de partida
 *  del análisis derivado, no recomendaciones). */
export const SIMULATOR_DEFAULTS = {
  nominalMm: 75000,
  haircutPct: 70,
  couponPct: 5,
  tenorYears: 25,
  graceYears: 4,
  discountRatePct: 12,
};

/** Límites del simulador: acotan la entrada para que el resultado siga siendo
 *  interpretable y para que el eje del gráfico no se vuelva ilegible. */
export const SIMULATOR_LIMITS = {
  haircutPct: { min: 0, max: 95, step: 1 },
  couponPct: { min: 0, max: 12, step: 0.25 },
  tenorYears: { min: 5, max: 40, step: 1 },
  graceYears: { min: 0, max: 10, step: 1 },
  discountRatePct: { min: 4, max: 30, step: 0.5 },
};

/** Tolerancia del validador al recomputar una cifra de la capa `calculado`.
 *  0,5 % absorbe el redondeo a millones sin tolerar un error conceptual. */
export const VALIDATION = {
  tolerancePct: 0.5,
  requiredTopLevelKeys: [
    "meta",
    "sources",
    "kpis",
    "debt_instruments",
    "creditors",
    "arbitration_cases",
    "historical_matrix",
    "historical_series",
    "recovery_mechanisms",
    "legal_instruments",
    "scenarios",
    "global_timeline",
    "glossary",
  ],
  /** Rutas (con puntos) cuyo contenido debe ser un arreglo no vacío. */
  requiredArrays: [
    "sources",
    "kpis",
    "creditors",
    "arbitration_cases",
    "recovery_mechanisms",
    "scenarios.items",
    "global_timeline",
  ],
  /** Arreglos de suma obligada a 100 (con tolerancia). */
  sumTo100: [
    { path: "creditors", field: "share_pct", label: "participación de acreedores" },
    { path: "scenarios.items", field: "probability_pct", label: "probabilidad de escenarios" },
  ],
};

/** Clases compartidas por la interfaz. */
export const CLASSES = {
  open: "is-open",
  collapsing: "is-collapsing",
  visible: "is-visible",
  active: "is-active",
  hashTarget: "hash-target",
  noJs: "no-js",
};

/** Secciones ancladas: alimenta la navegación y la paleta de comandos. */
export const SECTIONS = [
  { id: "resumen", label: "Resumen ejecutivo" },
  { id: "trayectoria", label: "Trayectoria y composición" },
  { id: "datos", label: "Matriz de datos por capa" },
  { id: "acreedores", label: "Mapa de acreedores" },
  { id: "arbitrajes", label: "Laudos y arbitrajes" },
  { id: "ejecucion", label: "Ejecución y activos" },
  { id: "matriz-historica", label: "Matriz histórica" },
  { id: "cronologia", label: "Cronología global" },
  { id: "mecanismos", label: "Mecanismos de recuperación" },
  { id: "escenarios", label: "Escenarios y simulador" },
  { id: "sanciones", label: "Régimen de sanciones" },
  { id: "actores", label: "Mapa institucional" },
  { id: "vigilancia", label: "Vigilancia y vacíos" },
  { id: "fuentes", label: "Fuentes y glosario" },
];

/** Aviso legal que se muestra en el pie y en el boot. */
export const DISCLAIMER =
  "Documento analítico de circulación informativa. No constituye asesoría financiera, legal ni fiscal. " +
  "Las cifras de la capa calculada son estimaciones reproducibles a partir de supuestos explícitos, no valores oficiales.";
