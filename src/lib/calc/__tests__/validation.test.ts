/**
 * Boundary and error handling. Every invalid input must produce a specific,
 * translatable error code — never NaN, never Infinity, never a silent fix.
 */
import { describe, expect, it } from 'vitest';
import { computePosition } from '../position';
import { computeRiskReward } from '../riskReward';
import { computeFees } from '../fees';
import { computeScaleOut } from '../scaleOut';
import type { CalcError } from '../errors';
import { fees, NO_FEES } from './helpers';

const okBase = {
  account: '10000',
  riskPct: '1',
  entry: '100',
  stop: '95',
  side: 'long' as const,
  leverage: '10',
  feeConfig: NO_FEES,
};

function codes(errors: CalcError[]): string[] {
  return errors.map((error) => error.code);
}

describe('position size — invalid inputs', () => {
  it('rejects a zero account balance', () => {
    const result = computePosition({ ...okBase, account: '0' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(codes(result.errors)).toContain('mustBePositive');
    expect(result.errors[0]?.field).toBe('account');
  });

  it('rejects a negative account balance', () => {
    const result = computePosition({ ...okBase, account: '-1000' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(codes(result.errors)).toContain('mustBePositive');
  });

  it('rejects a zero risk percentage', () => {
    const result = computePosition({ ...okBase, riskPct: '0' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(codes(result.errors)).toContain('mustBePositive');
  });

  it('rejects a risk percentage above 100%', () => {
    const result = computePosition({ ...okBase, riskPct: '150' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(codes(result.errors)).toContain('riskPctRange');
  });

  it('rejects a negative risk percentage', () => {
    const result = computePosition({ ...okBase, riskPct: '-1' });
    expect(result.ok).toBe(false);
  });

  it('rejects a zero entry price', () => {
    const result = computePosition({ ...okBase, entry: '0' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(codes(result.errors)).toContain('mustBePositive');
  });

  it('rejects a zero stop price', () => {
    const result = computePosition({ ...okBase, stop: '0' });
    expect(result.ok).toBe(false);
  });

  it('rejects identical entry and stop prices', () => {
    const result = computePosition({ ...okBase, stop: '100' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(codes(result.errors)).toContain('pricesEqual');
  });

  it('rejects a long with the stop above the entry', () => {
    const result = computePosition({ ...okBase, stop: '105' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(codes(result.errors)).toContain('stopAboveEntryForLong');
  });

  it('rejects a short with the stop below the entry', () => {
    const result = computePosition({ ...okBase, side: 'short', stop: '95' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(codes(result.errors)).toContain('stopBelowEntryForShort');
  });

  it('rejects zero and negative leverage', () => {
    expect(computePosition({ ...okBase, leverage: '0' }).ok).toBe(false);
    expect(computePosition({ ...okBase, leverage: '-3' }).ok).toBe(false);
  });

  it('rejects leverage above 125x', () => {
    const result = computePosition({ ...okBase, leverage: '126' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(codes(result.errors)).toContain('leverageRange');
  });

  it('rejects invalid fee rates', () => {
    const negative = computePosition({ ...okBase, feeConfig: fees('-0.1', '0.05') });
    expect(negative.ok).toBe(false);
    if (!negative.ok) expect(codes(negative.errors)).toContain('mustBeNonNegative');

    const tooLarge = computePosition({ ...okBase, feeConfig: fees('100', '0.05') });
    expect(tooLarge.ok).toBe(false);
    if (!tooLarge.ok) expect(codes(tooLarge.errors)).toContain('feeRateRange');
  });

  it('rejects empty, non-numeric and malformed strings', () => {
    expect(computePosition({ ...okBase, account: '' }).ok).toBe(false);
    expect(computePosition({ ...okBase, account: '   ' }).ok).toBe(false);
    expect(computePosition({ ...okBase, entry: 'abc' }).ok).toBe(false);
    expect(computePosition({ ...okBase, entry: '1,000' }).ok).toBe(false);
  });

  it('records a required-field error for a blank input', () => {
    const result = computePosition({ ...okBase, entry: '' });
    if (result.ok) throw new Error('expected failure');
    expect(codes(result.errors)).toContain('required');
  });

  it('rejects a price with more significant digits than we can honour', () => {
    // 41 significant digits — more than the 40-digit working precision
    const result = computePosition({
      ...okBase,
      entry: `9${'1234567890'.repeat(4)}`,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(codes(result.errors)).toContain('precisionLimit');
  });

  it('rejects values outside the supported magnitude window', () => {
    const tiny = computePosition({ ...okBase, entry: '0.0000000000001', stop: '0.00000000000009' });
    expect(tiny.ok).toBe(false);
    if (!tiny.ok) expect(codes(tiny.errors)).toContain('outOfRange');

    const huge = computePosition({ ...okBase, account: '1e16' });
    expect(huge.ok).toBe(false);
    if (!huge.ok) expect(codes(huge.errors)).toContain('outOfRange');
  });

  it('accepts the smallest and largest supported magnitudes', () => {
    const tiny = computePosition({
      ...okBase,
      entry: '0.00000000001',
      stop: '0.000000000005',
      account: '1',
      riskPct: '10',
      leverage: '1',
    });
    expect(tiny.ok).toBe(true);

    const huge = computePosition({
      ...okBase,
      account: '1000000000000000',
      entry: '1000000000000000',
      stop: '999999999999000',
      riskPct: '0.5',
      leverage: '1',
    });
    expect(huge.ok).toBe(true);
  });
});

describe('risk/reward — invalid inputs', () => {
  it('rejects a target on the wrong side of the entry', () => {
    const long = computeRiskReward({ side: 'long', entry: '100', stop: '95', takeProfit: '90' });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(codes(long.errors)).toContain('tpWrongSide');

    const short = computeRiskReward({ side: 'short', entry: '100', stop: '105', takeProfit: '110' });
    expect(short.ok).toBe(false);
    if (!short.ok) expect(codes(short.errors)).toContain('tpWrongSide');
  });

  it('rejects a target equal to the entry', () => {
    const result = computeRiskReward({ side: 'long', entry: '100', stop: '95', takeProfit: '100' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(codes(result.errors)).toContain('tpEqualsEntry');
  });

  it('never returns Infinity or NaN for a zero risk distance', () => {
    const result = computeRiskReward({ side: 'long', entry: '100', stop: '100', takeProfit: '110' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(codes(result.errors)).toContain('pricesEqual');
  });
});

describe('scale-out — invalid inputs', () => {
  const base = {
    side: 'long' as const,
    entry: '100',
    stop: '95',
    quantity: '10',
    openRatePct: '0.04',
    closeRatePct: '0.04',
    includeFees: true,
  };

  it('rejects percentages above 100 in a single leg', () => {
    const result = computeScaleOut({ ...base, targets: [{ id: 'a', price: '105', pct: '120' }] });
    expect(result.ok).toBe(false);
  });

  it('rejects a summed ladder above 100%', () => {
    const result = computeScaleOut({
      ...base,
      targets: [
        { id: 'a', price: '105', pct: '70' },
        { id: 'b', price: '110', pct: '40' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(codes(result.errors)).toContain('pctSumExceeds');
  });

  it('rejects negative percentages', () => {
    const result = computeScaleOut({ ...base, targets: [{ id: 'a', price: '105', pct: '-10' }] });
    expect(result.ok).toBe(false);
  });
});

describe('feasibility fuzz — never NaN / Infinity', () => {
  it('keeps every produced value finite across a wide input grid', () => {
    const accounts = ['0.00000001', '1', '999.99', '1000000', '1e14'];
    const risks = ['0.01', '0.5', '1', '2', '10', '100'];
    const entries = ['1e-11', '0.0001', '1', '105000', '1e14'];
    const distances = ['0.0001', '0.01', '0.5'];
    const leverages = ['1', '2', '10', '125'];
    let checked = 0;

    for (const account of accounts) {
      for (const riskPct of risks) {
        for (const entry of entries) {
          for (const distance of distances) {
            for (const leverage of leverages) {
              const entryDec = Number(entry);
              const stop = String(entryDec * (1 - Number(distance)));
              const result = computePosition({
                account,
                riskPct,
                entry,
                stop,
                side: 'long',
                leverage,
                feeConfig: fees('0.05', '0.05'),
              });
              if (!result.ok) continue;
              checked += 1;
              const values = Object.values(result.value).filter(
                (value): value is import('../../decimal').Decimal =>
                  typeof value === 'object' && value !== null && 'isFinite' in value,
              );
              for (const value of values) {
                expect(Number.isNaN(value.toNumber())).toBe(false);
                expect(value.isFinite()).toBe(true);
                expect(value.toString()).not.toContain('Infinity');
                expect(value.toString()).not.toContain('NaN');
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('never throws, whatever the inputs look like', () => {
    const inputs = ['', ' ', '0', '-1', 'abc', '1e999', 'NaN', 'Infinity', '1.2.3', '--5'];
    for (const value of inputs) {
      expect(() =>
        computePosition({
          account: value,
          riskPct: value,
          entry: value,
          stop: value,
          side: 'long',
          leverage: value,
          feeConfig: NO_FEES,
        }),
      ).not.toThrow();
      expect(() =>
        computeFees({
          side: 'long',
          entry: value,
          exit: value,
          quantity: value,
          openRatePct: value,
          closeRatePct: value,
        }),
      ).not.toThrow();
    }
  });

  it('reports the correct field for a bad fee rate', () => {
    const result = computeFees({
      side: 'long',
      entry: '100',
      exit: '110',
      quantity: '1',
      openRatePct: '100',
      closeRatePct: '0.1',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.field).toBe('openRate');
  });
});
