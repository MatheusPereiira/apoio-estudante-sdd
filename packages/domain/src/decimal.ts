import Decimal from "decimal.js";
import type { CasasDecimais } from "./types.js";

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export const ZERO = new Decimal(0);
export const DEZ = new Decimal(10);
export const CEM = new Decimal(100);
export const DOIS = new Decimal(2);

export function toDecimal(value: number | string | Decimal): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(typeof value === "number" ? String(value) : value);
}

export function roundHalfUp(value: Decimal, casas: CasasDecimais): Decimal {
  return value.toDecimalPlaces(casas, Decimal.ROUND_HALF_UP);
}

export function roundCeiling(value: Decimal, casas: CasasDecimais): Decimal {
  return value.toDecimalPlaces(casas, Decimal.ROUND_CEIL);
}

export function decimalToNumber(value: Decimal): number {
  return Number(value.toString());
}

/**
 * Formata um Decimal com exatamente 4 casas decimais (HALF_UP) sem usar Number.toFixed().
 */
export function formatExact4(value: Decimal): string {
  const rounded = value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const str = rounded.toString();
  const isNeg = str.startsWith("-");
  const unsigned = isNeg ? str.slice(1) : str;
  const [intPart = "0", fracPart = ""] = unsigned.split(".");
  const paddedFrac = fracPart.padEnd(4, "0").slice(0, 4);
  return `${isNeg ? "-" : ""}${intPart}.${paddedFrac}`;
}
