/**
 * js/calc/index.js — Orquestación del análisis derivado
 *
 * El dataset declara, para cada cifra de la capa `calculado`, un bloque `calc`:
 *
 *   "calc": {
 *     "method": "recovery_npv",
 *     "target": "npv_mm",
 *     "store_as": "recovery_npv_mm",
 *     "params": { "nominal_mm": 75000, "haircut_pct": 70, ... }
 *   }
 *
 * Con ese bloque, cualquier consumidor —la interfaz o el validador— puede
 * reproducir el número. Si el número guardado y el reproducido difieren más
 * de la tolerancia, el validador falla: así ninguna cifra calculada puede
 * quedar desactualizada respecto a sus insumos.
 */

import { METHODS } from "./methods.js";
import { VALIDATION } from "../config.js";

export { METHODS };
export { compoundAccrual, recoveryNpv, impliedYield, ratio, sumValues, growth, yearsBetween } from "./methods.js";

/** ¿Este registro contiene un bloque de cálculo reproducible? */
export function hasCalc(record) {
  return Boolean(record && typeof record.calc === "object" && record.calc?.method);
}

/**
 * Recalcula un bloque `calc` y devuelve el valor para el `target` declarado.
 * @param {{method:string, params:object, target?:string}} calc
 * @returns {{value:number, outputs:object, method:string, target:string}}
 */
export function recompute(calc) {
  if (!calc || !calc.method) {
    throw new Error("Bloque de cálculo inválido: falta 'method'.");
  }
  const method = METHODS[calc.method];
  if (typeof method !== "function") {
    throw new Error(
      `Método de cálculo desconocido: "${calc.method}". Disponibles: ${Object.keys(METHODS).join(", ")}.`
    );
  }
  const target = calc.target ?? "npv_mm";
  const { value, outputs } = method(calc.params ?? {}, target);
  if (!Number.isFinite(value)) {
    throw new Error(`El método "${calc.method}" no produjo un número finito para el target "${target}".`);
  }
  return { value, outputs, method: calc.method, target };
}

/** Ejecuta el cálculo y devuelve solo el número. */
export function computedValue(calc) {
  return recompute(calc).value;
}

/**
 * Compara el valor guardado en el dataset contra el recalculado.
 * @returns {{ok:boolean, stored:number, computed:number, deltaPct:number, tolerancePct:number, calc:object}}
 */
export function verifyCalc(record, { tolerancePct = VALIDATION.tolerancePct } = {}) {
  const calc = record?.calc;
  const storeAs = calc?.store_as;
  if (!storeAs) {
    throw new Error("El bloque 'calc' debe declarar 'store_as' para poder auditar el valor.");
  }
  const stored = Number(record[storeAs]);
  const { value: computed } = recompute(calc);
  const denominator = Math.abs(stored) || Math.abs(computed) || 1;
  const deltaPct = Math.abs(computed - stored) / denominator * 100;
  return {
    ok: deltaPct <= tolerancePct,
    stored,
    computed,
    deltaPct,
    tolerancePct,
    calc,
    storeAs,
  };
}

/**
 * Sensibilidad de un cálculo respecto a un parámetro: recalcula variando un
 * insumo y describe el rango resultante. Es lo que permite decir "con tasa de
 * 3 % el laudo vale X; con 6 %, vale Y" sin inventar un punto único.
 */
export function sensitivity(calc, field, values) {
  return (values ?? []).map((value) => {
    const params = { ...(calc.params ?? {}), [field]: value };
    const { value: result } = recompute({ ...calc, params });
    return { [field]: value, value: result };
  });
}

/**
 * Construye el servicio de deuda anual de un escenario, para tablas y gráficos.
 * Reutiliza `recovery_npv` para no duplicar la lógica de flujos.
 */
export function buildServiceSchedule(calc, startYear) {
  const { outputs } = recompute(calc);
  const schedule = outputs.schedule ?? [];
  const base = Number(startYear) || new Date().getUTCFullYear();
  return schedule.map((row) => ({
    year: base + row.year_offset,
    coupon_mm: row.coupon_mm,
    principal_mm: row.principal_mm,
    total_mm: row.total_mm,
    pv_mm: row.pv_mm,
  }));
}

/** Formatea el lado derecho de la fórmula, para mostrarlo en la interfaz. */
export function describeCalc(calc) {
  const params = calc?.params ?? {};
  const entries = Object.entries(params).map(([key, value]) => [key, value]);
  return entries;
}
