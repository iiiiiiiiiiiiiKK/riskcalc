/**
 * Fee math and break-even prices, verified against hand calculations.
 */
import { describe, expect, it } from 'vitest';
import { computeBreakEven, computeFees } from '../fees';
import { Decimal } from '../../decimal';
import { expectDec } from './helpers';

describe('fees', () => {
  const base = {
    side: 'long' as const,
    entry: '50000',
    exit: '55000',
    quantity: '0.2',
    openRatePct: '0.04',
    closeRatePct: '0.04',
  };

  it('charges the open fee on the entry notional and the close fee on the exit notional', () => {
    const result = computeFees(base);
    if (!result.ok) throw new Error('unexpected error');
    const v = result.value;
    // open notional 0.2 × 50000 = 10000 → 0.04% = 4
    // close notional 0.2 × 55000 = 11000 → 0.04% = 4.4
    expectDec(v.openNotional, '10000');
    expectDec(v.closeNotional, '11000');
    expectDec(v.openFee, '4');
    expectDec(v.closeFee, '4.4');
    expectDec(v.totalFee, '8.4');
    expect(v.openFee.eq(v.closeFee)).toBe(false);
  });

  it('computes gross and net profit', () => {
    const result = computeFees(base);
    if (!result.ok) throw new Error('unexpected error');
    // gross = (55000 − 50000) × 0.2 = 1000 ; net = 1000 − 4 − 4.4 = 991.6
    expectDec(result.value.grossPnl, '1000');
    expectDec(result.value.netPnl, '991.6');
    expectDec(result.value.netReturnOnNotionalPct, '9.916');
  });

  it('handles a losing short', () => {
    const result = computeFees({
      ...base,
      side: 'short',
      entry: '100',
      exit: '110',
      quantity: '10',
      openRatePct: '0.1',
      closeRatePct: '0.1',
    });
    if (!result.ok) throw new Error('unexpected error');
    // gross = (100 − 110) × 10 = −100 ; fees = 10×100×0.1% + 10×110×0.1% = 1 + 1.1 = 2.1
    expectDec(result.value.grossPnl, '-100');
    expectDec(result.value.totalFee, '2.1');
    expectDec(result.value.netPnl, '-102.1');
  });

  it('computes return on margin when leverage is provided', () => {
    const result = computeFees({ ...base, leverage: '10' });
    if (!result.ok) throw new Error('unexpected error');
    // notional 10000, margin 1000 → 991.6 / 1000 = 99.16%
    expectDec(result.value.netReturnOnMarginPct, '99.16');
  });

  it('exposes the fee cost as a price distance per unit', () => {
    const result = computeFees(base);
    if (!result.ok) throw new Error('unexpected error');
    // 8.4 / 0.2 = 42 price units
    expectDec(result.value.totalFeePriceEquivalent, '42');
  });
});

describe('break-even price (after fees)', () => {
  it('long: X = entry × (1 + open) / (1 − close)', () => {
    const result = computeBreakEven({
      side: 'long',
      entry: '50000',
      openRatePct: '0.04',
      closeRatePct: '0.04',
    });
    if (!result.ok) throw new Error('unexpected error');
    // 50000 × 1.0004 / 0.9996 = 50040.01600640256…
    expectDec(result.value.breakEven, new Decimal('50020').div('0.9996').toString(), 10);
    expect(result.value.breakEven.gt(new Decimal('50000'))).toBe(true);
  });

  it('long: profit is exactly zero at the break-even price', () => {
    const entry = new Decimal('50000');
    const result = computeBreakEven({
      side: 'long',
      entry: entry.toString(),
      openRatePct: '0.05',
      closeRatePct: '0.07',
    });
    if (!result.ok) throw new Error('unexpected error');
    const qty = new Decimal('1');
    const gross = result.value.breakEven.minus(entry).mul(qty);
    const openFee = entry.mul('0.0005');
    const closeFee = result.value.breakEven.mul('0.0007');
    // Cross-check the formula with the fee model itself.
    expect(gross.minus(openFee).minus(closeFee).abs().lt(new Decimal('1e-18'))).toBe(true);
  });

  it('short: X = entry × (1 − open) / (1 + close)', () => {
    const result = computeBreakEven({
      side: 'short',
      entry: '100',
      openRatePct: '0.1',
      closeRatePct: '0.1',
    });
    if (!result.ok) throw new Error('unexpected error');
    // 100 × 0.999 / 1.001 = 99.800199800199…
    expectDec(result.value.breakEven, new Decimal('99.9').div('1.001').toString(), 10);
    expect(result.value.breakEven.lt(new Decimal('100'))).toBe(true);
    expectDec(result.value.distancePct, new Decimal('99.9').div('1.001').minus(100).toString(), 10);
  });

  it('short: profit is exactly zero at the break-even price', () => {
    const entry = new Decimal('100');
    const result = computeBreakEven({
      side: 'short',
      entry: entry.toString(),
      openRatePct: '0.05',
      closeRatePct: '0.07',
    });
    if (!result.ok) throw new Error('unexpected error');
    const gross = entry.minus(result.value.breakEven);
    const openFee = entry.mul('0.0005');
    const closeFee = result.value.breakEven.mul('0.0007');
    expect(gross.minus(openFee).minus(closeFee).abs().lt(new Decimal('1e-18'))).toBe(true);
  });

  it('equals the entry price when both fees are zero', () => {
    const result = computeBreakEven({
      side: 'long',
      entry: '12345.6789',
      openRatePct: '0',
      closeRatePct: '0',
    });
    if (!result.ok) throw new Error('unexpected error');
    expect(result.value.breakEven.toString()).toBe('12345.6789');
  });
});
