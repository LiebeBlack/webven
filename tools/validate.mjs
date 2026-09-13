#!/usr/bin/env node
/**
 * tools/validate.mjs — Portero de la validación en CI
 *
 * Corre con el Node que ya trae el runner de GitHub Actions: no hay
 * `npm install` ni dependencias, porque el proyecto no tiene ninguna.
 *
 * Comprueba:
 *   1. Que data/database.json sea JSON válido y cumpla el contrato (js/data/contract.js).
 *   2. Que el respaldo embebido (data/database.embedded.js) sea idéntico al JSON.
 *   3. Que todas las cifras de la capa calculada se reproduzcan con su fórmula.
 *
 * Uso:
 *    node tools/validate.mjs            # informe y salida con código 1 si falla
 *    node tools/validate.mjs --quiet    # solo errores
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { validateDatabase, extractEmbedded, compareDatasets } from "../js/data/contract.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const quiet = process.argv.includes("--quiet");

const COLORS = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
  bold: "\u001b[1m",
};

const paint = (color, text) => `${COLORS[color]}${text}${COLORS.reset}`;
const log = (...args) => {
  if (!quiet) console.log(...args);
};

async function main() {
  log(paint("bold", "Observatorio de Deuda Soberana VE — validación del dataset"));
  log(paint("dim", `raíz: ${root}`));
  log("");

  let database;
  try {
    const raw = await readFile(resolve(root, "data/database.json"), "utf8");
    database = JSON.parse(raw);
    log(`${paint("green", "✓")} data/database.json analizado (${(raw.length / 1024).toFixed(1)} KB)`);
  } catch (error) {
    console.error(`${paint("red", "✗")} No se pudo leer o analizar data/database.json: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const report = validateDatabase(database);

  log("");
  log(paint("bold", "Secciones auditadas"));
  for (const section of report.sections) {
    const marker =
      section.status === "pass" ? paint("green", "✓") : section.status === "warn" ? paint("yellow", "!") : paint("red", "✗");
    log(`${marker} ${section.label}`);
    if (section.status !== "pass" || !quiet) {
      for (const check of section.checks) {
        const checkMarker =
          check.status === "pass" ? paint("dim", "·") : check.status === "warn" ? paint("yellow", "·") : paint("red", "·");
        if (check.status === "pass" && quiet) continue;
        log(`   ${checkMarker} ${check.label}${check.detail ? paint("dim", ` — ${check.detail}`) : ""}`);
      }
    }
  }

  log("");
  log(paint("bold", "Estadísticas"));
  for (const [key, value] of Object.entries(report.stats)) {
    log(`   ${paint("dim", key.padEnd(24))} ${value}`);
  }

  // Comparación con el respaldo embebido.
  log("");
  try {
    const embeddedText = await readFile(resolve(root, "data/database.embedded.js"), "utf8");
    const embedded = extractEmbedded(embeddedText);
    const differences = compareDatasets(database, embedded);
    if (differences.length) {
      console.error(paint("red", `✗ El respaldo embebido difiere del JSON en ${differences.length} punto(s):`));
      differences.slice(0, 10).forEach((difference) => console.error(`   · ${difference}`));
      report.errors.push("El respaldo embebido no coincide con database.json. Ejecuta tools/build-database.ps1.");
    } else {
      log(`${paint("green", "✓")} El respaldo embebido es idéntico al JSON publicado`);
    }
  } catch (error) {
    console.error(paint("red", `✗ No se pudo verificar el respaldo embebido: ${error.message}`));
    report.errors.push(`Respaldo embebido no verificable: ${error.message}`);
  }

  // Resultado final.
  log("");
  if (report.errors.length) {
    console.error(paint("red", paint("bold", `✗ VALIDACIÓN FALLIDA — ${report.errors.length} error(es)`)));
    report.errors.slice(0, 30).forEach((error) => console.error(`   · ${error}`));
    if (report.errors.length > 30) {
      console.error(paint("dim", `   … y ${report.errors.length - 30} más`));
    }
    process.exitCode = 1;
    return;
  }

  if (report.warnings.length) {
    report.warnings.forEach((warning) => log(paint("yellow", `! ${warning}`)));
  }

  console.log(paint("green", paint("bold", "✓ VALIDACIÓN CORRECTA")));
  console.log(
    paint(
      "dim",
      `   ${report.stats.calcVerified}/${report.stats.calcValues} valores derivados recalculados · ` +
        `${report.stats.sensitivityVerified}/${report.stats.sensitivityDeclared} sensibilidades verificadas · ` +
        `${report.stats.seriesPoints} años de serie cuadrados · ` +
        `${report.stats.sources} fuentes resueltas`
    )
  );
}

main().catch((error) => {
  console.error(paint("red", `Fallo inesperado del validador: ${error.stack ?? error.message}`));
  process.exitCode = 1;
});
