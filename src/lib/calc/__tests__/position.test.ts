/**
 * Position sizing — hand-computed expectations.
 *
 * Every expected number below was derived by hand (or from an exact fraction)
 * and is written out explicitly, so the tests fail if the implementation drifts.
 */
import { describe, expect, it } from 'vitest';
import { computePosition } from '../position';
import { Decimal } from '../../decimal';
import { expectDec, fees, NO_FEES } from './helpers';

const base = {
  account: '10000',
  riskPct: '1',
  entry: '50000',
  stop: '49000',
  side: 'long' as const,
  leverage: '10',
  feeConfig: NO_FEES,
};

describe('position size — long', () => {
  it('computes quantity, notional, margin and loss with zero fees', () => {
    const result = computePosition(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const v = result.value;

    // risk = 10,000 × 1% = 100; stop distance = 50000 − 49000 = 1000
    // qty = 100 / 1000 = 0.1 ; notional = 0.1 × 50000 = 5000
    expectDec(v.riskAmount, '100');
    expectDec(v.stopDistance, '1000');
    expectDec(v.stopPct, '2');
    expectDec(v.quantity, '0.1');
    expectDec(v.notional, '5000');
    expectDec(v.notionalPctOfAccount, '50');
    expectDec(v.lossAtStop, '100');
    expectDec(v.margin, '500'); // 5000 / 10
    expectDec(v.marginPctOfAccount, '5');
    expectDec(v.breakEvenLeverage, '0.5'); // 5000 / 10000
    expect(v.quantity.toString()).toBe('0.1'); // exact, no 0.09999999999999999
  });

  it('matches the stop-loss budget exactly (loss at stop == risk amount)', () => {
    const result = computePosition({ ...base, feeConfig: fees('0.05', '0.05') });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // per unit = 1000 + 50000×0.0005 + 49000×0.0005 = 1000 + 25 + 24.5 = 1049.5
    expectDec(result.value.perUnitRisk, '1049.5');
    expectDec(result.value.perUnitStopDistance, '1000');
    expectDec(result.value.lossAtStopWithFees, '100');
    expectDec(result.value.lossAtStop, '95.2834683182467', 4); // 100/1049.5 × 1000
    expectDec(result.value.quantity, new Decimal('100').div('1049.5').toString());
  });
});

describe('position size — short', () => {
  it('computes quantity and notional for a short with 2% risk', () => {
    const result = computePosition({
      account: '10000',
      riskPct: '2',
      entry: '3000',
      stop: '3150',
      side: 'short',
      leverage: '5',
      feeConfig: NO_FEES,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const v = result.value;
    // risk = 200 ; distance = 3150 − 3000 = 150 ; qty = 200/150 = 4/3
    expectDec(v.riskAmount, '200');
    expectDec(v.stopDistance, '150');
    expectDec(v.quantity, new Decimal(4).div(3).toString());
    expectDec(v.notional, '4000'); // 4/3 × 3000
    expectDec(v.margin, '800'); // 4000 / 5
    expectDec(v.stopPct, '5');
  });
});

describe('position size — alternates', () => {
  it('scales linearly with the risk percentage', () => {
    const half = computePosition({ ...base, riskPct: '0.5' });
    const one = computePosition({ ...base, riskPct: '1' });
    const two = computePosition({ ...base, riskPct: '2' });
    expect(half.ok && one.ok && two.ok).toBe(true);
    if (!half.ok || !one.ok || !two.ok) return;
    expectDec(half.value.riskAmount, '50');
    expectDec(half.value.quantity, '0.05');
    expectDec(two.value.riskAmount, '200');
    expectDec(two.value.quantity, '0.2');
  });

  it('scales linearly with account size', () => {
    const result = computePosition({ ...base, account: '25000' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectDec(result.value.riskAmount, '250');
    expectDec(result.value.quantity, '0.25');
    expectDec(result.value.notional, '12500');
  });

  it('halves the quantity when the stop distance doubles', () => {
    const result = computePosition({ ...base, stop: '48000' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectDec(result.value.stopDistance, '2000');
    expectDec(result.value.stopPct, '4');
    expectDec(result.value.quantity, '0.05');
    expectDec(result.value.notional, '2500');
  });

  it('aggressive risk (2%) doubles size versus standard risk (1%)', () => {
    const standard = computePosition({ ...base, riskPct: '1' });
    const aggressive = computePosition({ ...base, riskPct: '2' });
    if (!standard.ok || !aggressive.ok) throw new Error('unexpected error');
    expectDec(aggressive.value.quantity, standard.value.quantity.mul(2).toString());
  });
});

describe('position size — leverage and margin', () => {
  it('leverage changes margin but never the quantity', () => {
    const at1 = computePosition({ ...base, leverage: '1' });
    const at100 = computePosition({ ...base, leverage: '100' });
    if (!at1.ok || !at100.ok) throw new Error('unexpected error');
    expectDec(at1.value.quantity, at100.value.quantity.toString());
    expectDec(at1.value.margin, '5000');
    expectDec(at100.value.margin, '50');
    expectDec(at1.value.marginPctOfAccount, '50');
    expectDec(at100.value.marginPctOfAccount, '0.5');
  });

  it('warns when margin would exceed the balance', () => {
    // account 1000, risk 1% → 10 ; stop distance 100 → qty 0.1 → notional 5000 → margin 5000 at 1x
    const result = computePosition({ ...base, account: '1000', stop: '49900', leverage: '1' });
    if (!result.ok) throw new Error('unexpected error');
    expect(result.warnings.map((w) => w.code)).toContain('marginExceedsAccount');
  });

  it('warns once risk exceeds 10% of the account', () => {
    const result = computePosition({ ...base, riskPct: '15' });
    if (!result.ok) throw new Error('unexpected error');
    expect(result.warnings.map((w) => w.code)).toContain('riskPctAggressive');
  });
});

describe('position size — precision', () => {
  it('keeps 0.3 × 10% exactly at 0.03 (no float drift)', () => {
    const result = computePosition({
      account: '0.3',
      riskPct: '10',
      entry: '1',
      stop: '0.5',
      side: 'long',
      leverage: '1',
      feeConfig: NO_FEES,
    });
    if (!result.ok) throw new Error('unexpected error');
    expect(result.value.riskAmount.toString()).toBe('0.03');
    expect(result.value.quantity.toString()).toBe('0.06');
  });

  it('preserves precision for a 0.1% risk of 100.1', () => {
    const result = computePosition({
      account: '100.1',
      riskPct: '0.1',
      entry: '1.5',
      stop: '1.4',
      side: 'long',
      leverage: '3',
      feeConfig: NO_FEES,
    });
    if (!result.ok) throw new Error('unexpected error');
    expect(result.value.riskAmount.toString()).toBe('0.1001');
    expect(result.value.quantity.toString()).toBe('1.001');
  });

  it('does not round intermediate values for tiny prices', () => {
    const result = computePosition({
      account: '100',
      riskPct: '1',
      entry: '0.00000123',
      stop: '0.00000120',
      side: 'long',
      leverage: '1',
      feeConfig: NO_FEES,
    });
    if (!result.ok) throw new Error('unexpected error');
    // risk 1 / distance 0.00000003 = 33333333.333…
    expect(result.value.quantity.toFixed(6)).toBe('33333333.333333');
  });
});
