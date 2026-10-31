/**
 * Decimal precision layer.
 *
 * All monetary / quantity / price / percentage math runs through decimal.js
 * with 40 significant digits of working precision. Rounding only ever happens
 * in `lib/format.ts` at render time — never inside the calculation pipeline.
 *
 * Why 40 digits? Inputs are capped at 15 integer digits with up to 18 decimals
 * (see MIN_MAGNITUDE / MAX_MAGNITUDE in parse.ts), so 40 significant digits
 * leaves an enormous head-room for intermediate products and divisions
 * (worst case is squaring a 15+18 digit value) while still being far cheaper
 * than arbitrary-precision rational arithmetic.
 */
import Decimal from 'decimal.js';

// 40 significant digits, explicit rounding mode, and plain (non-exponential)
// string output for every value a normal user could paste in.
Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 40,
  minE: -9e15,
  maxE: 9e15,
});

export { Decimal };

export const ZERO = new Decimal(0);
export const ONE = new Decimal(1);
export const HUNDRED = new Decimal(100);

/** Small helper to build a Decimal from a literal string/number. */
export function D(value: string | number | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Lowest magnitude accepted from a user input. */
export const MIN_MAGNITUDE = new Decimal('1e-12');
/** Highest magnitude accepted from a user input. */
export const MAX_MAGNITUDE = new Decimal('1e15');
/** Maximum number of significant digits accepted from a single input. */
export const MAX_INPUT_SIGNIFICANT_DIGITS = 40;

/** True when the value is a finite decimal (never NaN / ±Infinity). */
export function isUsable(value: Decimal | null | undefined): value is Decimal {
  return !!value && value.isFinite();
}
