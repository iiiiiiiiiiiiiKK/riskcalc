/**
 * Strict input parsing. Nothing here silently "fixes" a value: every invalid
 * input produces a specific, translatable error code.
 */
import { Decimal, MAX_INPUT_SIGNIFICANT_DIGITS, MAX_MAGNITUDE, MIN_MAGNITUDE } from '../decimal';
import type { CalcError, Collector, FieldKey } from './errors';

export interface ParseRules {
  /** Must be strictly greater than zero. */
  positive?: boolean;
  /** May be zero but not negative. */
  nonNegative?: boolean;
  /** Reject values below this magnitude (inclusive bound). */
  min?: Decimal;
  /** Reject values above this magnitude (inclusive bound). */
  max?: Decimal;
  /** Human readable bounds used inside error messages. */
  minLabel?: string;
  maxLabel?: string;
}

const NUMERIC_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;

/**
 * Count significant digits straight from the user's string.
 * (Decimal itself rounds to the working precision on construction, so it cannot
 *  be used to detect an over-long input.)
 */
export function countSignificantDigits(text: string): number {
  const mantissa = text.replace(/^[+-]/, '').split(/[eE]/)[0] ?? '';
  const digits = mantissa.replace('.', '').replace(/^0+/, '');
  return digits.length === 0 ? 1 : digits.length;
}

/**
 * Parse a raw user string into a Decimal.
 * Returns `null` and records an error when the input is unusable.
 */
export function parseDecimal(
  raw: string | number | undefined | null,
  field: FieldKey,
  rules: ParseRules,
  c: Collector,
): Decimal | null {
  const text = typeof raw === 'number' ? String(raw) : (raw ?? '').trim();

  if (text === '') {
    c.error('required', field);
    return null;
  }
  if (!NUMERIC_PATTERN.test(text)) {
    c.error('invalidNumber', field);
    return null;
  }

  const value = new Decimal(text);

  if (!value.isFinite()) {
    c.error('invalidNumber', field);
    return null;
  }

  // Guard against values decimal.js would have to round before we even start,
  // which would make results silently imprecise ("no premature rounding").
  if (countSignificantDigits(text) > MAX_INPUT_SIGNIFICANT_DIGITS) {
    c.error('precisionLimit', field, { digits: String(MAX_INPUT_SIGNIFICANT_DIGITS) });
    return null;
  }

  const abs = value.abs();
  const min = rules.min ?? MIN_MAGNITUDE;
  const max = rules.max ?? MAX_MAGNITUDE;

  if (abs.gt(max)) {
    c.error('outOfRange', field, { max: rules.maxLabel ?? max.toString() });
    return null;
  }
  if (abs.lt(min) && !value.isZero()) {
    c.error('outOfRange', field, { min: rules.minLabel ?? min.toString() });
    return null;
  }

  if (rules.positive && value.lte(0)) {
    c.error('mustBePositive', field);
    return null;
  }
  if (rules.nonNegative && value.lt(0)) {
    c.error('mustBeNonNegative', field);
    return null;
  }
  if (value.isZero() && rules.positive) {
    c.error('mustBePositive', field);
    return null;
  }

  return value;
}

/** Percent helper: parses "1.5" meaning 1.5% and returns 1.5 (percent units). */
export function parsePercent(
  raw: string | number | undefined | null,
  field: FieldKey,
  rules: ParseRules & { allowHundred?: boolean },
  c: Collector,
): Decimal | null {
  const value = parseDecimal(
    raw,
    field,
    { ...rules, max: rules.max ?? new Decimal(rules.allowHundred === false ? 100 : 100) },
    c,
  );
  if (!value) return null;
  const upper = new Decimal(100);
  if (rules.allowHundred === false ? value.gte(upper) : value.gt(upper)) {
    c.error('riskPctRange', field, {});
    return null;
  }
  return value;
}

export function ensureFinite(value: Decimal, field: FieldKey, c: Collector): Decimal | null {
  if (!value.isFinite()) {
    c.error('notFinite', field);
    return null;
  }
  return value;
}

/** Safe division that turns a zero denominator into a structured error. */
export function safeDiv(
  a: Decimal,
  b: Decimal,
  field: FieldKey,
  c: Collector,
): Decimal | null {
  if (b.isZero()) {
    c.error('divideByZero', field);
    return null;
  }
  return ensureFinite(a.div(b), field, c);
}

export function errorList(c: Collector): CalcError[] {
  return c.errors;
}
