/**
 * js/app.js — Punto de entrada del observatorio
 *
 * Secuencia:
 *   1. Marcar el documento como "con JavaScript" (si no, las tarjetas se muestran abiertas).
 *   2. Cargar el dataset por la cadena de respaldo y auditar el contrato.
 *   3. Montar cada sección de forma aislada: si una falla, las demás siguen.
 *   4. Inicializar gráficos e interacción.
 *   5. Retirar la pantalla de arranque.
 *
 * El aislamiento por sección es deliberado: un error de datos en el apartado
 * arbitral no puede dejar sin contenido el resto del informe. Cada fallo se
 * muestra en su sección, con el mensaje técnico a la vista.
 */

import { CONTAINERS, CLASSES, APP_VERSION, SECTIONS } from "./config.js";
import { loadDatabase, describeAttempts } from "./data/loader.js";
import { indexById, num, pct } from "./format.js";
import { setRenderContext } from "./render/parts.js";
import {
  renderBootLog,
  renderTicker,
  renderDatasetMeta,
  renderTierLegend,
  renderFooter,
  renderSectionError,
  renderSourceNotice,
  renderScopeNotes,
} from "./render/shell.js";
import { renderKPIs, renderKpiNote } from "./render/kpis.js";
import { renderGlobalTimeline, renderTimelineSummary, renderRecentEvents } from "./render/timeline.js";
import {
  renderAdministrationMatrix,
  renderAdministrationTable,
} from "./render/matrix.js";
import {
  renderCreditorsTable,
  renderCreditorFilters,
  renderCreditorsSummary,
  renderCreditorNotes,
  renderCreditorCommittees,
  renderRatingsHistory,
} from "./render/creditors.js";
import { renderAwards, renderAwardsSummary, renderAwardsTable, renderAwardsBars } from "./render/awards.js";
import {
  renderMechanisms,
  renderMechanismFilters,
  renderMechanismsTable,
  renderMechanismSummary,
  renderLegalInstruments,
} from "./render/mechanisms.js";
import { renderScenarios, renderScenariosTable, renderSimulator } from "./render/scenarios.js";
import {
  renderEnforcement,
  renderEnforcementSummary,
  renderEnforcementNote,
  renderSanctions,
  renderSanctionsNote,
  renderInstitutional,
  renderInstitutionalBars,
  renderCommitteesTable,
} from "./render/enforcement.js";
import {
  renderSourcesLedger,
  renderGlossary,
  renderWatchlist,
  renderDataGaps,
  renderEvidenceSummary,
  renderAuditReport,
  renderGapsIntro,
} from "./render/sources.js";
import { renderCharts, initCharts, resizeAllCharts } from "./charts.js";
import { initExpandables, setGroupOpen, openCount } from "./expandable.js";
import { initFilters, setFilterHooks, applyFilters, getFilterState } from "./filters.js";
import { initSimulator } from "./simulator.js";
import {
  setNoJsFlag,
  hideBoot,
  appendBootLine,
  initProgressBar,
  initRevealObserver,
  initCountUp,
  initNavActive,
  initCitationCopy,
  initCommandPalette,
  initAnnouncements,
  initPrintExpansion,
  toast,
  announce,
} from "./ui.js";

/* ------------------------------------------------------------- utilidades --- */

const mounted = new Set();
const failures = [];

/** Monta HTML en un contenedor declarado. Informa si el contenedor no existe. */
function mount(key, html) {
  const selector = CONTAINERS[key] ?? key;
  const node = document.querySelector(selector);
  if (!node) {
    console.warn(`[observatorio] contenedor no encontrado: ${selector}`);
    return null;
  }
  node.innerHTML = html;
  mounted.add(key);
  return node;
}

/**
 * Ejecuta un render aislado: captura el error, lo registra y lo muestra en el
 * contenedor correspondiente en lugar de interrumpir el montaje completo.
 */
function section(label, key, producer) {
  try {
    const html = producer();
    if (html === null || html === undefined || html === "") return true;
    if (key) mount(key, html);
    return true;
  } catch (error) {
    failures.push({ label, error });
    console.error(`[observatorio] fallo en "${label}"`, error);
    if (key) {
      try {
        mount(key, renderSectionError(label, error));
      } catch {
        /* si ni siquiera se puede mostrar el error, se ignora */
      }
    }
    return false;
  }
}

/* ----------------------------------------------------------------- arranque --- */

async function bootstrap() {
  setNoJsFlag();
  initExpandables();
  initFilters();
  initAnnouncements();
  initCitationCopy();
  initPrintExpansion();
  initProgressBar();

  const bootLines = [{ label: "Cliente", detail: `v${APP_VERSION}`, status: "ok" }];
  appendBootLine("Cliente", `v${APP_VERSION}`, "ok");
  appendBootLine("Cargando dataset", "…", "warn");

  const result = await loadDatabase({ validate: true });
  const { data, source, validation, attempts, degraded, error } = result;

  describeAttempts(attempts).forEach((attempt) => {
    appendBootLine(`Fuente ${attempt.label}`, attempt.detail, attempt.status);
    bootLines.push(attempt);
  });
  appendBootLine(
    "Auditoría de contrato",
    validation ? (validation.ok ? "sin incidencias" : `${validation.errors.length} incidencia(s)`) : "omitida",
    validation ? (validation.ok ? "ok" : "fail") : "warn"
  );

  // Contexto compartido por las piezas de plantilla (fuentes, versión).
  let sourceMap = new Map();
  try {
    sourceMap = indexById(data.sources ?? []);
  } catch (mapError) {
    failures.push({ label: "Índice de fuentes", error: mapError });
    console.error("[observatorio] no se pudo indexar las fuentes", mapError);
  }
  setRenderContext({ sourceMap, meta: data.meta ?? {} });

  /* ---- Armazón ---- */
  section("Cinta de eventos", "ticker", () => renderTicker(data));
  section("Metadatos del dataset", "metaLine", () =>
    renderDatasetMeta(data, { source, validation })
  );
  section("Leyenda de capas", "tierLegend", () => renderTierLegend());
  section("Notas de alcance", "scopeNotes", () => renderScopeNotes(data.meta));
  section("Aviso de carga degradada", "sourceNotice", () => renderSourceNotice({ source, attempts }));

  /* ---- Resumen ejecutivo ---- */
  section("Indicadores clave", "kpiGrid", () => renderKPIs(data));
  section("Nota metodológica de indicadores", "kpiNote", () => renderKpiNote(data));
  section("Hechos recientes", "recentEvents", () => renderRecentEvents(data, 5));

  /* ---- Visualizaciones ---- */
  section("Panel de visualizaciones", "charts", () => renderCharts(data));

  /* ---- Acreedores ---- */
  section("Filtros de acreedores", "creditorFilters", () => renderCreditorFilters(data));
  section("Resumen de acreedores", "creditorsSummary", () => renderCreditorsSummary(data));
  section("Tabla de acreedores", "creditorsTable", () => renderCreditorsTable(data));
  section("Notas de posición por acreedor", "creditorNotes", () => renderCreditorNotes(data));
  section("Comités de acreedores", "committees", () => renderCreditorCommittees(data));
  section("Historial de calificaciones", "ratings", () => renderRatingsHistory(data));

  /* ---- Arbitrajes ---- */
  section("Resumen de arbitrajes", "awardsSummary", () => renderAwardsSummary(data));
  section("Fichas de laudos", "awardsContainer", () => renderAwards(data));
  section("Tabla de laudos", "awardsTable", () => renderAwardsTable(data));
  section("Comparación visual de laudos", "awardsBars", () => renderAwardsBars(data));

  /* ---- Ejecución y sanciones ---- */
  section("Resumen de ejecución", "enforcementSummary", () => renderEnforcementSummary(data));
  section("Mapa de ejecución", "enforcementContainer", () => renderEnforcement(data));
  section("Nota de ejecución", "enforcementNote", () => renderEnforcementNote());
  section("Régimen de sanciones", "sanctionsContainer", () => renderSanctions(data));
  section("Nota de sanciones", "sanctionsNote", () => renderSanctionsNote());
  section("Mapa institucional", "institutionalContainer", () => renderInstitutional(data));
  section("Influencia por actor", "institutionalBars", () => renderInstitutionalBars(data));

  /* ---- Histórico ---- */
  section("Resumen de cronología", "timelineSummary", () => renderTimelineSummary(data));
  section("Cronología global", "globalTimeline", () => renderGlobalTimeline(data));
  section("Matriz de administraciones", "administrationMatrix", () => renderAdministrationMatrix(data));
  section("Tabla comparativa de administraciones", "administrationTable", () =>
    renderAdministrationTable(data)
  );

  /* ---- Mecanismos ---- */
  section("Filtros de mecanismos", "mechanismFilters", () => renderMechanismFilters(data));
  section("Resumen de mecanismos", "mechanismSummary", () => renderMechanismSummary(data));
  section("Fichas de mecanismos", "mechanismsGrid", () => renderMechanisms(data));
  section("Tabla de mecanismos", "mechanismsTable", () => renderMechanismsTable(data));
  section("Instrumentos jurídicos", "legalInstruments", () => renderLegalInstruments(data));

  /* ---- Escenarios y simulador ---- */
  section("Escenarios", "scenariosContainer", () => renderScenarios(data));
  section("Tabla de escenarios", "scenariosTable", () => renderScenariosTable(data));
  section("Simulador", "simulator", () => renderSimulator(data));

  /* ---- Aparato probatorio ---- */
  section("Resumen probatorio", "sourcesSummary", () => renderEvidenceSummary(data, validation));
  section("Auditoría automática", "auditReport", () => renderAuditReport(validation));
  section("Ledger de fuentes", "sourcesLedger", () => renderSourcesLedger(data));
  section("Glosario", "glossary", () => renderGlossary(data));
  section("Vacíos declarados", "gapsIntro", () => renderGapsIntro(data));
  section("Lista de vacíos", "dataGaps", () => renderDataGaps(data));
  section("Vigilancia", "watchlist", () => renderWatchlist(data));

  /* ---- Pie ---- */
  section("Pie de página", "footerMeta", () => renderFooter(data, { source, validation }));

  /* ---- Interacción dependiente del DOM ya montado ---- */
  section("Inicialización de gráficos", null, () => {
    const outcome = initCharts(data);
    if (outcome.failed.length) {
      console.warn("[observatorio] gráficos no construidos:", outcome.failed);
      toast(`No se pudieron construir ${outcome.failed.length} gráfico(s). Se muestran las tablas equivalentes.`, "warn");
    }
    return "";
  });

  section("Simulador interactivo", null, () => {
    initSimulator(data);
    return "";
  });

  section("Filtros aplicados", null, () => {
    setFilterHooks({
      rerenderCreditors: (order) => {
        const ordered = sortCreditors(data.creditors ?? [], order);
        const { renderCreditorsTable: rerender } = { renderCreditorsTable };
        const html = rerender({ ...data, creditors: ordered });
        mount("creditorsTable", html);
      },
      announce,
    });
    applyFilters();
    return "";
  });

  section("Navegación y revelado", null, () => {
    initRevealObserver();
    initCountUp();
    initNavActive();
    initCommandPalette(data);
    return "";
  });

  /* ---- Comandos globales de expansión ---- */
  document.addEventListener("observatorio:expand-all", () => {
    setGroupOpen(null, true);
    resizeAllCharts();
  });
  document.addEventListener("observatorio:collapse-all", () => setGroupOpen(null, false));

  /* ---- Redimensionado: los gráficos necesitan aviso al cambiar de tamaño ---- */
  let resizeFrame = null;
  window.addEventListener(
    "resize",
    () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        resizeAllCharts();
      });
    },
    { passive: true }
  );

  /* ---- Estado expuesto para depuración y para las pruebas ---- */
  window.__observatorio = {
    version: APP_VERSION,
    data,
    source,
    validation,
    attempts,
    degraded,
    failures,
    mounted: [...mounted],
    filters: getFilterState,
    openCards: openCount,
    expandAll: () => setGroupOpen(null, true),
    collapseAll: () => setGroupOpen(null, false),
  };

  /* ---- Avisos finales ---- */
  if (error) {
    toast("No se pudo cargar el dataset: la interfaz se muestra vacía y explica el fallo.", "error", { timeout: 9000 });
  } else if (degraded) {
    toast("Datos cargados desde el respaldo embebido. Revisa la nota al inicio del documento.", "warn", { timeout: 9000 });
  }

  if (validation && !validation.ok) {
    toast(
      `La auditoría encontró ${validation.errors.length} incidencia(s) en el dataset. El detalle está en el aparato probatorio.`,
      "error",
      { timeout: 9000 }
    );
  }

  if (failures.length) {
    toast(`${failures.length} sección(es) no pudieron montarse. Se indica el detalle en su lugar.`, "warn", {
      timeout: 8000,
    });
  }

  appendBootLine(
    "Interfaz",
    `${mounted.size} contenedores montados · ${num(data.global_timeline?.length ?? 0)} hechos · ${num(
      validation?.stats.calcVerified ?? 0
    )} de ${num(validation?.stats.calcValues ?? 0)} cifras derivadas recalculadas dentro de tolerancia`,
    failures.length ? "warn" : "ok"
  );

  window.setTimeout(hideBoot, 320);

  // Enlaces profundos y sección inicial.
  if (window.location.hash) {
    window.setTimeout(() => {
      const id = window.location.hash.slice(1);
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
  }

  return { data, validation, failures };
}

/* ------------------------------------------------------------------ errores --- */

window.addEventListener("error", (event) => {
  console.error("[observatorio] error no controlado", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[observatorio] promesa rechazada sin manejar", event.reason);
});

/* ------------------------------------------------------------------- inicio --- */

bootstrap().catch((error) => {
  console.error("[observatorio] fallo fatal en el arranque", error);
  const main = document.querySelector("main");
  if (main) {
    main.insertAdjacentHTML("afterbegin", renderSectionError("Arranque del cliente", error));
  }
  hideBoot();
  toast("Fallo fatal al iniciar el observatorio. Se muestra el detalle técnico.", "error", { timeout: 12000 });
});

/** Ordena acreedores según el criterio elegido en la interfaz. */
function sortCreditors(creditors, order) {
  const list = [...creditors];
  switch (order) {
    case "share":
      return list.sort((a, b) => Number(b.share_pct) - Number(a.share_pct));
    case "name":
      return list.sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));
    case "outlook":
      return list.sort(
        (a, b) =>
          Number(b.recovery_outlook?.pct_estimate ?? 0) - Number(a.recovery_outlook?.pct_estimate ?? 0)
      );
    case "exposure":
    default:
      return list.sort((a, b) => Number(b.exposure_mm) - Number(a.exposure_mm));
  }
}

export { bootstrap, sortCreditors, SECTIONS, CLASSES };
