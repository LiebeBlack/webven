/**
 * js/calc/methods.js — Fórmulas puras del análisis derivado
 *
 * Requisitos de diseño:
 *  1. Sin DOM, sin red, sin estado: mismas entradas → mismas salidas.
 *  2. Reproducibles fuera del navegador (el validador de CI importa este mismo
 *     archivo), para que una cifra "calculada" pueda auditarse con un comando.
 *  3. Toda función devuelve también sus intermedios, para que la interfaz pueda
 *     mostrar el procedimiento en lugar de pedir confianza.
 */

import { round } from "../format.js";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** Años entre dos fechas ISO, en base 365,25. */
export function yearsBetween(fromIso, toIso) {
  const from = Date.UTC(
    Number(fromIso.slice(0, 4)),
    Number(fromIso.slice(5, 7) || 1) - 1,
    Number(fromIso.slice(8, 10) || 1)
  );
  const to = Date.UTC(
    Number(toIso.slice(0, 4)),
    Number(toIso.slice(5, 7) || 1) - 1,
    Number(toIso.slice(8, 10) || 1)
  );
  return (to - from) / MS_PER_YEAR;
}

/**
 * Interés acumulado sobre un capital.
 *   A = P · (1 + r/n)^(n·t)
 * @param {{principal_mm:number, rate_pct:number, from:string, to:string, compounds_per_year?:number}} params
 * @param {string} target  "total_mm" | "interest_mm" | "t_years"
 */
export function compoundAccrual(
  { principal_mm, rate_pct, from, to, compounds_per_year = 1 },
  target = "total_mm"
) {
  const n = Number(compounds_per_year) || 1;
  const t = yearsBetween(from, to);
  const total = Number(principal_mm) * (1 + Number(rate_pct) / 100 / n) ** (n * t);
  const out = {
    t_years: round(t, 4),
    total_mm: round(total, 2),
    interest_mm: round(total - Number(principal_mm), 2),
  };
  return { value: out[target] ?? out.total_mm, outputs: out };
}

/**
 * Valor presente de una recuperación bajo reestructuración.
 *   Nominal reestructurado  R = N · (1 − h)
 *   Cupón por período      C = R · c
 *   VPN = Σ_{i=g+1}^{g+T} C/(1+d)^i  +  R/(1+d)^(g+T)
 * @param {{nominal_mm:number, haircut_pct:number, coupon_pct:number,
 *          tenor_years:number, grace_years?:number, discount_rate_pct:number}} params
 * @param {string} target "npv_mm" | "recovery_pct_of_nominal" | "nominal_restructured_mm"
 */
export function recoveryNpv(
  {
    nominal_mm,
    haircut_pct,
    coupon_pct,
    tenor_years,
    grace_years = 0,
    discount_rate_pct,
  },
  target = "npv_mm"
) {
  const nominal = Number(nominal_mm);
  const restructured = nominal * (1 - Number(haircut_pct) / 100);
  const coupon = restructured * (Number(coupon_pct) / 100);
  const discount = 1 + Number(discount_rate_pct) / 100;
  const grace = Number(grace_years) || 0;
  const tenor = Number(tenor_years);
  const schedule = [];
  let npv = 0;
  let undiscounted = 0;

  for (let period = 1; period <= grace + tenor; period += 1) {
    const paysCoupon = period > grace;
    const paysPrincipal = period === grace + tenor;
    const cashflow = (paysCoupon ? coupon : 0) + (paysPrincipal ? restructured : 0);
    const discountFactor = 1 / discount ** period;
    const pv = cashflow * discountFactor;
    npv += pv;
    undiscounted += cashflow;
    schedule.push({
      period,
      year_offset: period,
      coupon_mm: round(paysCoupon ? coupon : 0, 2),
      principal_mm: round(paysPrincipal ? restructured : 0, 2),
      total_mm: round(cashflow, 2),
      discount_factor: round(discountFactor, 6),
      pv_mm: round(pv, 2),
    });
  }

  const outputs = {
    nominal_restructured_mm: round(restructured, 2),
    coupon_mm_per_period: round(coupon, 2),
    npv_mm: round(npv, 2),
    undiscounted_mm: round(undiscounted, 2),
    recovery_pct_of_nominal: round((npv / nominal) * 100, 2),
    // Cuántos centavos de cada dólar nominal recupera el acreedor ya
    // descontado el tiempo. Coincide numéricamente con el porcentaje porque
    // "cents per dollar" es, por definición, el porcentaje × 1: se publica
    // como salida propia para que la interfaz pueda etiquetar la lectura
    // en centavos sin recalcular ni duplicar la fórmula en el cliente.
    effective_cents_per_dollar: round((npv / nominal) * 100, 2),
    schedule,
  };
  return { value: outputs[target] ?? outputs.npv_mm, outputs };
}

/**
 * Tasa interna de retorno implícita de un bono cotizando bajo la par.
 * Resuelve   Σ C/(1+y)^i + 100/(1+y)^n = P   por bisección.
 * Se usa bisección y no Newton porque el precio bajo la par garantiza
 * monotonía estricta y la bisección nunca diverge.
 * @param {{price_pct:number, coupon_pct:number, tenor_years:number,
 *          redemption_pct?:number, guess_min?:number, guess_max?:number}} params
 */
export function impliedYield(
  { price_pct, coupon_pct, tenor_years, redemption_pct = 100, guess_min = 0.0001, guess_max = 5 },
  target = "ytm_pct"
) {
  const price = Number(price_pct);
  const coupon = Number(coupon_pct);
  const redemption = Number(redemption_pct);
  const tenor = Number(tenor_years);

  const priceAt = (y) => {
    let pv = 0;
    for (let i = 1; i <= tenor; i += 1) {
      const cashflow = coupon + (i === tenor ? redemption : 0);
      pv += cashflow / (1 + y) ** i;
    }
    return pv;
  };

  let low = Number(guess_min);
  let high = Number(guess_max);
  let iterations = 0;
  let mid = low;

  // Validación de bracket: si el precio no está entre el valor con rendimiento
  // máximo (y→guess_min) y el mínimo (y→guess_max), no existe solución en el
  // intervalo. Fallar con un mensaje claro es parte del contrato de auditoría:
  // un rendimiento implícito inventado en el borde del intervalo sería peor
  // que ningún número.
  const priceAtLow = priceAt(low);
  const priceAtHigh = priceAt(high);
  if (!(price <= priceAtLow && price >= priceAtHigh)) {
    throw new Error(
      `implied_yield: el precio ${price} % queda fuera del rango resoluble [${round(priceAtHigh, 2)}, ${round(
        priceAtLow,
        2
      )}] para cupón ${coupon} %, plazo ${tenor} años y rescate ${redemption} %. Ajuste guess_min/guess_max.`
    );
  }

  // 80 iteraciones llevan la precisión muy por debajo de un punto base.
  while (iterations < 80) {
    mid = (low + high) / 2;
    const pv = priceAt(mid);
    if (Math.abs(pv - price) < 1e-7) break;
    if (pv > price) low = mid;
    else high = mid;
    iterations += 1;
  }

  const outputs = {
    ytm_pct: round(mid * 100, 4),
    iterations,
    price_target_pct: round(price, 4),
    solved_price_pct: round(priceAt(mid), 6),
  };
  return { value: outputs[target] ?? outputs.ytm_pct, outputs };
}

/**
 * Ratio expresado en porcentaje: deuda/PIB, deuda/exportaciones, etc.
 * @param {{numerator_mm:number, denominator_mm:number}} params
 */
export function ratio({ numerator_mm, denominator_mm }, target = "value_pct") {
  const denominator = Number(denominator_mm);
  const outputs = {
    value_pct: denominator === 0 ? 0 : round((Number(numerator_mm) / denominator) * 100, 2),
    value_times: denominator === 0 ? 0 : round(Number(numerator_mm) / denominator, 3),
  };
  return { value: outputs[target] ?? outputs.value_pct, outputs };
}

/**
 * Suma de un conjunto de importes. Se usa para totalizar bloques del dataset
 * (por ejemplo, el stock en default a partir de sus tramos).
 * @param {{items:Array<{label?:string, value_mm:number}>}} params
 */
export function sumValues({ items }, target = "total_mm") {
  const list = (items ?? []).map((item) => ({
    label: item.label ?? "",
    value_mm: Number(item.value_mm) || 0,
  }));
  const outputs = {
    total_mm: round(
      list.reduce((acc, item) => acc + item.value_mm, 0),
      2
    ),
    count: list.length,
    max_mm: round(list.reduce((acc, item) => Math.max(acc, item.value_mm), 0), 2),
  };
  return { value: outputs[target] ?? outputs.total_mm, outputs };
}

/**
 * Variación porcentual entre dos valores. Se usa en los indicadores de
 * crecimiento de la deuda entre administraciones.
 *
 * Si se declara `years` (o `from`/`to` ISO), además calcula el CAGR de la
 * variación: sin horizonte temporal el CAGR no está definido y se reporta
 * como null, nunca como 0 (un cero sería una tasa, no una ausencia).
 * @param {{from_mm:number, to_mm:number, years?:number, from?:string, to?:string}} params
 */
export function growth({ from_mm, to_mm, years, from, to }, target = "growth_pct") {
  const from = Number(from_mm);
  const outputs = {
    delta_mm: round(Number(to_mm) - from, 2),
    growth_pct: from === 0 ? 0 : round(((Number(to_mm) - from) / from) * 100, 2),
    cagr_pct: null,
  };

  let horizon = Number(years);
  if (!Number.isFinite(horizon) || horizon <= 0) {
    if (typeof from === "string" && typeof to === "string") {
      horizon = yearsBetween(from, to);
    }
  }
  if (Number.isFinite(horizon) && horizon > 0 && from > 0 && Number(to_mm) > 0) {
    outputs.cagr_pct = round(((Number(to_mm) / from) ** (1 / horizon) - 1) * 100, 2);
  }

  return { value: outputs[target] ?? outputs.growth_pct, outputs };
}

/** Métodos disponibles, indexados por el nombre que usa el dataset. */
export const METHODS = {
  compound_accrual: compoundAccrual,
  recovery_npv: recoveryNpv,
  implied_yield: impliedYield,
  ratio,
  sum: sumValues,
  growth,
};
