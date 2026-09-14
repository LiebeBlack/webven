/**
 * js/data/contract.js — Contrato y auditoría del dataset
 *
 * Este módulo no toca el DOM ni la red, así que corre en dos entornos:
 *   · en el navegador, desde tests/validate.html (auditoría visible);
 *   · en CI, desde tools/validate.mjs (portero del despliegue).
 *
 * Qué comprueba:
 *   1. Presencia de bloques y arreglos obligatorios.
 *   2. Identificadores únicos dentro de cada colección.
 *   3. Coherencia de capas de procedencia (tier) contra el catálogo.
 *   4. Resolución de todas las referencias source_ids a fuentes existentes.
 *   5. Porcentajes que deben sumar 100 (acreedores, escenarios).
 *   6. Coherencia aritmética de la serie histórica y de los bloques de deuda.
 *   7. Recálculo de toda cifra de la capa `calculado` con su bloque `calc`.
 *   8. Recálculo de las sensibilidades que declaran parámetro alterado (`patch`).
 *
 * Nada de esto es decorativo: si un insumo del dataset cambia y el resultado
 * derivado no se actualiza, la validación falla y el despliegue se detiene.
 */

import { recompute, hasCalc } from "../calc/index.js";
import { TIER_ORDER, VALIDATION } from "../config.js";

const MSG_TIEROS = TIER_ORDER.join(", ");

/* ------------------------------------------------------------------ utils --- */

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Recorre el árbol y ejecuta `visit(nodo, ruta)` en cada objeto y arreglo. */
function walk(node, path, visit) {
  visit(node, path);
  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, `${path}[${index}]`, visit));
  } else if (isPlainObject(node)) {
    for (const [key, value] of Object.entries(node)) {
      walk(value, path ? `${path}.${key}` : key, visit);
    }
  }
}

/** Todas las referencias a fuentes del documento, con su ruta. */
export function collectSourceRefs(database) {
  const refs = [];
  walk(database, "", (node, path) => {
    if (!isPlainObject(node)) return;
    if (Array.isArray(node.source_ids)) {
      node.source_ids.forEach((id) => refs.push({ id, path }));
    }
    if (Array.isArray(node.reported_source_ids)) {
      node.reported_source_ids.forEach((id) => refs.push({ id, path }));
    }
  });
  // `sources` define las referencias, no las consume.
  return refs.filter((ref) => !ref.path.startsWith("sources"));
}

/** Todos los registros que declaran una capa de procedencia. */
export function collectTiers(database) {
  const found = [];
  walk(database, "", (node, path) => {
    if (!isPlainObject(node)) return;
    if (typeof node.tier === "string") found.push({ tier: node.tier, path });
  });
  return found.filter((item) => !item.path.startsWith("meta.tiers"));
}

/** Todos los registros con bloque de cálculo. */
export function collectCalcs(database) {
  const found = [];
  walk(database, "", (node, path) => {
    if (hasCalc(node)) found.push({ record: node, path });
  });
  return found;
}

function uniqueIds(records, label, errors) {
  const seen = new Map();
  for (const record of records ?? []) {
    const id = record?.id;
    if (id === undefined) {
      errors.push(`${label}: hay un registro sin 'id'.`);
      continue;
    }
    if (seen.has(id)) {
      errors.push(`${label}: identificador duplicado "${id}".`);
    }
    seen.set(id, true);
  }
  return seen.size;
}

/** Lee una ruta con puntos ("scenarios.items") sin romper si falta un tramo. */
function atPath(object, path) {
  return String(path)
    .split(".")
    .reduce((node, key) => (node === null || node === undefined ? node : node[key]), object);
}

function sumField(records, field) {
  return (records ?? []).reduce((acc, item) => acc + (Number(item?.[field]) || 0), 0);
}

function firstNumeric(entry, keys = ["value", "value_mm", "value_pct", "value_times"]) {
  for (const key of keys) {
    if (entry[key] !== undefined && entry[key] !== null) return { key, value: Number(entry[key]) };
  }
  return null;
}

/* -------------------------------------------------------------- auditoría --- */

/**
 * Audita el dataset completo.
 * @param {object} database
 * @param {{tolerancePct?:number}} options
 * @returns {{ok:boolean, errors:string[], warnings:string[], sections:Array, stats:object}}
 */
export function validateDatabase(database, options = {}) {
  const tolerancePct = options.tolerancePct ?? VALIDATION.tolerancePct;
  const errors = [];
  const warnings = [];
  const sections = [];
  const stats = {
    sources: 0,
    calcRecords: 0,
    calcVerified: 0,
    /** Valores derivados auditables = verificados + desviados. Es el
     *  denominador honesto de "cuántas cifras derivadas se recalcularon". */
    calcValues: 0,
    sensitivityDeclared: 0,
    sensitivityVerified: 0,
    tierRecords: 0,
    sourceRefs: 0,
    seriesPoints: 0,
  };

  const push = (id, label, checks) => {
    const failed = checks.filter((c) => c.status === "fail").length;
    const warned = checks.filter((c) => c.status === "warn").length;
    sections.push({
      id,
      label,
      status: failed > 0 ? "fail" : warned > 0 ? "warn" : "pass",
      checks,
    });
  };
  const check = (label, status, detail = "") => ({ label, status, detail });

  if (!isPlainObject(database)) {
    return {
      ok: false,
      errors: ["El documento raíz no es un objeto JSON."],
      warnings,
      generatedAt: new Date().toISOString(),
      sections: [
        {
          id: "root",
          label: "Documento raíz",
          status: "fail",
          checks: [{ label: "Tipo de documento", status: "fail", detail: "No es un objeto JSON." }],
        },
      ],
      stats,
    };
  }

  /* 1. Bloques obligatorios ------------------------------------------------ */
  const missingKeys = VALIDATION.requiredTopLevelKeys.filter((key) => !(key in database));
  const missingArrays = VALIDATION.requiredArrays.filter((key) => {
    const value = atPath(database, key);
    return !Array.isArray(value) || value.length === 0;
  });
  if (missingKeys.length) errors.push(`Faltan bloques obligatorios: ${missingKeys.join(", ")}.`);
  if (missingArrays.length) errors.push(`Arreglos obligatorios vacíos o ausentes: ${missingArrays.join(", ")}.`);
  push("estructura", "Estructura del documento", [
    check("Bloques obligatorios", missingKeys.length ? "fail" : "pass", missingKeys.join(", ")),
    check("Arreglos obligatorios con contenido", missingArrays.length ? "fail" : "pass", missingArrays.join(", ")),
  ]);

  /* 2. Fuentes ------------------------------------------------------------- */
  const sources = Array.isArray(database.sources) ? database.sources : [];
  stats.sources = sources.length;
  const sourceIds = uniqueIds(sources, "sources", errors);
  const sourceMap = new Map(sources.map((s) => [s.id, s]));
  const sourcesWithoutUrl = sources.filter((s) => !s.url);
  push("fuentes", "Ledger de fuentes", [
    check("Identificadores únicos", sourceIds === sources.length ? "pass" : "fail", `${sourceIds} de ${sources.length}`),
    check(
      "Todas las fuentes tienen editor y fecha de acceso",
      sources.every((s) => s.publisher && s.accessed_at) ? "pass" : "fail",
      ""
    ),
    check(
      "Fuentes sin URL directa (documento físico o portal)",
      sourcesWithoutUrl.length ? "warn" : "pass",
      sourcesWithoutUrl.map((s) => s.id).join(", ")
    ),
  ]);

  /* 3. Resolución de referencias ------------------------------------------ */
  const refs = collectSourceRefs(database);
  stats.sourceRefs = refs.length;
  const dangling = refs.filter((ref) => !sourceMap.has(ref.id));
  if (dangling.length) {
    const sample = dangling.slice(0, 8).map((d) => `${d.id} en ${d.path}`).join(" | ");
    errors.push(`Referencias a fuentes inexistentes: ${dangling.length}. ${sample}`);
  }
  push("referencias", "Trazabilidad de referencias", [
    check(`Referencias resueltas`, dangling.length ? "fail" : "pass", `${refs.length - dangling.length} de ${refs.length}`),
  ]);

  /* 4. Capas de procedencia ----------------------------------------------- */
  const tiers = collectTiers(database);
  stats.tierRecords = tiers.length;
  const invalidTiers = tiers.filter((item) => !TIER_ORDER.includes(item.tier));
  if (invalidTiers.length) {
    errors.push(
      `Capas de procedencia inválidas: ${invalidTiers.map((t) => `"${t.tier}" en ${t.path}`).join(", ")}. Válidas: ${MSG_TIEROS}.`
    );
  }
  const tierCounts = TIER_ORDER.reduce((acc, tier) => {
    acc[tier] = tiers.filter((t) => t.tier === tier).length;
    return acc;
  }, {});
  push("capas", "Capas de procedencia", [
    check("Solo capas declaradas en el catálogo", invalidTiers.length ? "fail" : "pass", invalidTiers.length ? MSG_TIEROS : ""),
    check(
      "Distribución de capas",
      "pass",
      TIER_ORDER.map((t) => `${t}: ${tierCounts[t]}`).join(" · ")
    ),
  ]);

  /* 5. Identificadores por colección ------------------------------------- */
  const idChecks = [
    ["kpis", database.kpis],
    ["creditors", database.creditors],
    ["arbitration_cases", database.arbitration_cases],
    ["recovery_mechanisms", database.recovery_mechanisms],
    ["legal_instruments", database.legal_instruments],
    ["global_timeline", database.global_timeline],
    ["enforcement_map", database.enforcement_map],
    ["institutional_map", database.institutional_map],
    ["sanctions_regime", database.sanctions_regime],
    ["watchlist", database.watchlist],
    ["data_gaps", database.data_gaps],
    ["creditor_committees", database.creditor_committees],
  ];
  const idDetails = [];
  let idsOk = true;
  for (const [label, records] of idChecks) {
    if (!Array.isArray(records)) continue;
    const before = errors.length;
    uniqueIds(records, label, errors);
    if (errors.length > before) idsOk = false;
    idDetails.push(`${label}: ${records.length}`);
  }
  push("ids", "Identificadores", [
    check("Sin duplicados en ninguna colección", idsOk ? "pass" : "fail", ""),
    check("Conteo por colección", "pass", idDetails.join(" · ")),
  ]);

  /* 6. Porcentajes que deben sumar 100 ------------------------------------ */
  const sumChecks = [];
  for (const rule of VALIDATION.sumTo100) {
    const records = atPath(database, rule.path);
    const total = sumField(records, rule.field);
    const ok = Math.abs(total - 100) <= 0.05;
    if (!ok) errors.push(`La ${rule.label} suma ${total.toFixed(2)} y debería sumar 100.`);
    sumChecks.push(check(`${rule.label} = 100`, ok ? "pass" : "fail", `suma ${total.toFixed(2)}`));
  }
  push("sumas", "Cierres aritméticos", sumChecks);

  /* 7. Serie histórica ---------------------------------------------------- */
  const points = database.historical_series?.points ?? [];
  stats.seriesPoints = points.length;
  const componentKeys = ["bonds_mm", "pdvsa_mm", "bilateral_mm", "multilateral_mm", "paris_club_mm", "suppliers_mm", "other_mm"];
  const badPoints = [];
  for (const point of points) {
    const parts = componentKeys.reduce((acc, key) => acc + (Number(point[key]) || 0), 0);
    if (Math.abs(parts - Number(point.total_mm)) > 1) {
      badPoints.push(`${point.year} (${parts} vs ${point.total_mm})`);
    }
  }
  const years = points.map((p) => p.year);
  const consecutive = years.every((year, index) => index === 0 || year === years[index - 1] + 1);
  const anchorYears = new Set(database.historical_series?.anchor_years ?? []);
  const basisMismatch = points.filter((p) => (anchorYears.has(p.year) ? p.basis !== "ancla" : p.basis !== "interpolada"));
  if (badPoints.length) errors.push(`Serie histórica: ${badPoints.length} años no cuadran: ${badPoints.join(", ")}.`);
  push("serie", "Serie histórica", [
    check("Suma de componentes igual al total en cada año", badPoints.length ? "fail" : "pass", badPoints.length ? badPoints.join(", ") : `${points.length} años`),
    check("Años consecutivos sin huecos", consecutive ? "pass" : "fail", `${years[0]}–${years[years.length - 1]}`),
    check("Marca de procedencia coherente con los años ancla", basisMismatch.length ? "warn" : "pass", basisMismatch.map((p) => p.year).join(", ")),
  ]);

  /* 8. Bloques de instrumentos ------------------------------------------- */
  const blocks = database.debt_instruments?.blocks ?? [];
  const blockChecks = [];
  let blocksOk = true;
  for (const block of blocks) {
    const parts = sumField(block.items, "amount_outstanding_mm");
    const ok = Math.abs(parts - Number(block.total_mm)) <= 1;
    if (!ok) {
      blocksOk = false;
      errors.push(`Bloque "${block.id}": los tramos suman ${parts} y el total declarado es ${block.total_mm}.`);
    }
    blockChecks.push(
      check(`${block.label}`, ok ? "pass" : "fail", `${block.items?.length ?? 0} tramos · ${parts.toLocaleString("es-VE")} MM`)
    );
  }
  if (blocks.length) {
    const byId = Object.fromEntries(blocks.map((b) => [b.id, b]));
    const last = points[points.length - 1];
    if (last) {
      const crossChecks = [
        ["bonos-soberanos", last.bonds_mm],
        ["bonos-pdvsa", last.pdvsa_mm],
        ["proveedores-atrasos", last.suppliers_mm],
        ["otros-reconocidos", last.other_mm],
      ];
      for (const [id, expected] of crossChecks) {
        const block = byId[id];
        if (!block) continue;
        const ok = Math.abs(Number(block.total_mm) - Number(expected)) <= 1;
        if (!ok) {
          blocksOk = false;
          errors.push(`Bloque "${id}" (${block.total_mm}) no coincide con la serie de ${last.year} (${expected}).`);
        }
      }
      const official = byId["credito-oficial"];
      if (official) {
        const expected = last.bilateral_mm + last.multilateral_mm + last.paris_club_mm;
        if (Math.abs(Number(official.total_mm) - expected) > 1) {
          blocksOk = false;
          errors.push(`Bloque de crédito oficial (${official.total_mm}) no coincide con bilaterales + multilaterales + Club de París (${expected}).`);
        }
      }
    }
  }
  push("instrumentos", "Composición del stock", [
    check("Cada bloque cuadra con sus tramos y con la serie", blocksOk ? "pass" : "fail", `${blocks.length} bloques`),
    ...blockChecks,
  ]);

  /* 9. Recálculo de cifras derivadas ------------------------------------- */
  const calcs = collectCalcs(database);
  stats.calcRecords = calcs.length;
  const calcFailures = [];
  const droppedCalcs = [];
  for (const { record, path } of calcs) {
    const storeAs = record.calc?.store_as;
    if (!storeAs) {
      // Un cálculo sin destino declarado no puede auditarse: se reporta como faltante.
      droppedCalcs.push(`${path} (sin store_as)`);
      continue;
    }
    try {
      const stored = Number(record[storeAs]);
      if (!Number.isFinite(stored)) {
        calcFailures.push(`${path}.${storeAs} no es numérico`);
        continue;
      }
      const { value: computed } = recompute(record.calc);
      const denom = Math.abs(stored) || Math.abs(computed) || 1;
      const deltaPct = (Math.abs(computed - stored) / denom) * 100;
      if (deltaPct > tolerancePct) {
        calcFailures.push(
          `${path}.${storeAs}: guardado ${stored} vs recalculado ${computed} (${deltaPct.toFixed(3)} % de desvío)`
        );
      } else {
        stats.calcVerified += 1;
      }

      // Salidas secundarias del mismo cálculo (porcentaje de recuperación, etc.).
      for (const output of record.calc.extra_outputs ?? []) {
        const target = output.store_as;
        const expectedValue = Number(record[target]);
        if (!Number.isFinite(expectedValue)) {
          calcFailures.push(`${path}.${target} no es numérico`);
          continue;
        }
        const out = recompute({ ...record.calc, target: output.target });
        const d = Math.abs(out.value - expectedValue) / (Math.abs(expectedValue) || 1) * 100;
        if (d > tolerancePct) {
          calcFailures.push(`${path}.${target}: guardado ${expectedValue} vs recalculado ${out.value} (${d.toFixed(3)} %)`);
        } else {
          stats.calcVerified += 1;
        }
      }
    } catch (error) {
      calcFailures.push(`${path}: ${error.message}`);
    }
  }

  /* 10. Sensibilidades declaradas ---------------------------------------- */
  const sensitivityFailures = [];
  const unverifiableSensitivities = [];
  for (const { record, path } of calcs) {
    for (const entry of record.calc?.sensitivity ?? []) {
      const declared = firstNumeric(entry);
      if (!declared) continue;
      stats.sensitivityDeclared += 1;
      if (!entry.patch) {
        // Declarada sin parámetro alterado: no puede recalcularse. Se informa
        // en lugar de ignorarse, para que ninguna sensibilidad quede fuera de
        // auditoría sin que se note.
        unverifiableSensitivities.push(`${path} → "${entry.label}"`);
        continue;
      }
      try {
        const method = entry.method ?? record.calc.method;
        const target = entry.target ?? record.calc.target;
        const params = { ...(record.calc.params ?? {}), ...entry.patch };
        const { value } = recompute({ method, params, target });
        const d = Math.abs(value - declared.value) / (Math.abs(declared.value) || 1) * 100;
        if (d > tolerancePct) {
          sensitivityFailures.push(`${path} → "${entry.label}": guardado ${declared.value} vs recalculado ${value} (${d.toFixed(3)} %)`);
        } else {
          stats.sensitivityVerified += 1;
        }
      } catch (error) {
        sensitivityFailures.push(`${path} → "${entry.label}": ${error.message}`);
      }
    }
  }
  stats.calcValues = stats.calcVerified + calcFailures.length;

  if (calcFailures.length) errors.push(...calcFailures.map((f) => `Cálculo derivado: ${f}`));
  if (sensitivityFailures.length) errors.push(...sensitivityFailures.map((f) => `Sensibilidad: ${f}`));
  push("calculos", "Cifras derivadas y sensibilidades", [
    check(
      `Cifras recalculadas dentro de ±${tolerancePct} %`,
      calcFailures.length ? "fail" : "pass",
      `${stats.calcVerified} de ${stats.calcValues} verificadas · ${calcFailures.length} con desvío`
    ),
    check(
      "Sensibilidades verificables recalculadas",
      sensitivityFailures.length ? "fail" : "pass",
      `${stats.sensitivityVerified} de ${stats.sensitivityDeclared} declaradas`
    ),
    check(
      "Sensibilidades sin parámetro alterado (no verificables)",
      unverifiableSensitivities.length ? "warn" : "pass",
      unverifiableSensitivities.join(", ")
    ),
    check(
      "Cálculos sin destino declarado",
      droppedCalcs.length ? "warn" : "pass",
      droppedCalcs.join(", ")
    ),
  ]);

  /* 11. Escenarios -------------------------------------------------------- */
  const scenarios = database.scenarios?.items ?? [];
  let scenarioFailures = 0;
  const scenarioChecks = scenarios.map((scenario) => {
    const recoveryPct = Number(scenario.recovery_pct_of_nominal);
    const consistent =
      Number(database.scenarios.base_nominal_mm) > 0 &&
      Math.abs((Number(scenario.recovery_npv_mm) / Number(database.scenarios.base_nominal_mm)) * 100 - recoveryPct) < 0.05;
    // Un escenario internamente inconsistente debe detener la validación: el
    // VPN es la cifra sobre la que se compara cualquier oferta de canje.
    if (!consistent) scenarioFailures += 1;
    return check(
      `${scenario.name}`,
      consistent ? "pass" : "fail",
      `quita ${scenario.haircut_pct} % · recuperación ${recoveryPct} % del nominal`
    );
  });
  if (scenarioFailures > 0) {
    errors.push(`Escenarios: ${scenarioFailures} con VPN inconsistente respecto al nominal base.`);
  }
  push("escenarios", "Escenarios de recuperación", scenarioChecks);

  /* 12. Coherencia de la matriz histórica -------------------------------- */
  const admins = database.historical_matrix?.administrations ?? [];
  const adminChecks = admins.map((admin) => {
    const start = points.find((p) => p.year === Number(String(admin.from).slice(0, 4)));
    const end = points.find((p) => p.year === Number(String(admin.to).slice(0, 4)));
    const drift = [];
    if (start && Math.abs(Number(start.total_mm) - Number(admin.debt_start_mm)) > 1) {
      drift.push(`inicio declarado ${admin.debt_start_mm} vs serie ${start.total_mm}`);
    }
    if (end && Math.abs(Number(end.total_mm) - Number(admin.debt_end_mm)) > 1) {
      drift.push(`fin declarado ${admin.debt_end_mm} vs serie ${end.total_mm}`);
    }
    if (end && Math.abs(Number(end.total_mm) - Number(admin.debt_end_mm)) <= 1 && end.year === 2026 && Number(admin.debt_end_mm) !== Number(end.total_mm)) {
      drift.push("fin del período no coincide con el último ancla");
    }
    return check(
      `${admin.name} (${admin.period})`,
      drift.length ? "warn" : "pass",
      drift.join(" · ") || `${admin.milestones?.length ?? 0} hitos`
    );
  });
  push("matriz", "Matriz histórica", adminChecks);

  const ok = errors.length === 0;
  return { ok, errors, warnings, sections, stats, generatedAt: new Date().toISOString() };
}

/** Extrae del archivo embebido el objeto JSON que contiene. */
export function extractEmbedded(text) {
  const match = /export const embeddedDatabase = ([\s\S]*);\s*\nexport default embeddedDatabase;/.exec(text);
  if (!match) throw new Error("No se pudo extraer el objeto embebido: formato inesperado en database.embedded.js.");
  return JSON.parse(match[1]);
}

/** Compara el JSON publicado con el respaldo embebido, campo por campo. */
export function compareDatasets(a, b) {
  const differences = [];
  const stack = [[a, b, "$"]];
  while (stack.length) {
    const [left, right, path] = stack.pop();
    if (left === right) continue;
    if (typeof left !== typeof right) {
      differences.push(`${path}: tipo distinto (${typeof left} vs ${typeof right})`);
      continue;
    }
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) {
        differences.push(`${path}: longitud distinta (${left.length} vs ${right.length})`);
        continue;
      }
      left.forEach((item, index) => stack.push([item, right[index], `${path}[${index}]`]));
      continue;
    }
    if (isPlainObject(left) && isPlainObject(right)) {
      const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
      for (const key of keys) stack.push([left[key], right[key], `${path}.${key}`]);
      continue;
    }
    differences.push(`${path}: ${JSON.stringify(left)} vs ${JSON.stringify(right)}`);
    if (differences.length > 25) break;
  }
  return differences;
}
