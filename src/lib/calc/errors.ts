/**
 * Structured, translatable calculation errors and warnings.
 *
 * The math layer never returns user-facing English/Chinese text: it returns
 * machine codes plus parameters. The i18n layer turns them into messages, which
 * keeps formulas unit-testable and the UI fully bilingual.
 */

export type ErrorCode =
  | 'required'
  | 'invalidNumber'
  | 'mustBePositive'
  | 'mustBeNonNegative'
  | 'pricesEqual'
  | 'stopAboveEntryForLong'
  | 'stopBelowEntryForShort'
  | 'riskPctRange'
  | 'leverageRange'
  | 'feeRateRange'
  | 'tpWrongSide'
  | 'tpEqualsEntry'
  | 'pctRange'
  | 'pctSumExceeds'
  | 'outOfRange'
  | 'precisionLimit'
  | 'divideByZero'
  | 'notFinite';

export type FieldKey =
  | 'account'
  | 'riskPct'
  | 'entry'
  | 'stop'
  | 'takeProfit'
  | 'leverage'
  | 'openRate'
  | 'closeRate'
  | 'quantity'
  | 'price'
  | 'pct'
  | 'rate'
  | 'targets'
  | 'exit'
  | 'account2';

export interface CalcError {
  code: ErrorCode;
  field: FieldKey;
  params?: Record<string, string>;
}

export type WarningCode =
  | 'riskPctAggressive'
  | 'marginExceedsAccount'
  | 'notionalExceedsAccount'
  | 'pctRemainder'
  | 'tinyPrice'
  | 'feeRateHigh'
  | 'leverageBelowRequired';

export interface CalcWarning {
  code: WarningCode;
  field?: FieldKey;
  params?: Record<string, string>;
}

export type Result<T> =
  | { ok: true; value: T; warnings: CalcWarning[] }
  | { ok: false; errors: CalcError[]; warnings: CalcWarning[] };

/** Collects errors while a formula evaluates, then short-circuits. */
export class Collector {
  errors: CalcError[] = [];
  warnings: CalcWarning[] = [];

  error(code: ErrorCode, field: FieldKey, params?: Record<string, string>): void {
    this.errors.push({ code, field, params });
  }

  warn(code: WarningCode, field?: FieldKey, params?: Record<string, string>): void {
    this.warnings.push({ code, field, params });
  }

  fail(): boolean {
    return this.errors.length > 0;
  }
}

export function err(
  code: ErrorCode,
  field: FieldKey,
  params?: Record<string, string>,
): CalcError {
  return { code, field, params };
}
