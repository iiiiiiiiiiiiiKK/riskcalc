/**
 * Take-profit projections on a sized position.
 */
import { describe, expect, it } from 'vitest';
import { computeTakeProfit } from '../takeProfit';
import { expectDec } from './helpers';

const base = {
  side: 'long' as const,
  entry: '100',
  stop: '95',
  quantity: '10',
  leverage: '5',
  openRatePct: '0.1',
  closeRatePct: '0.1',
  includeFees: true,
};

describe('take profit', () => {
  it('computes gross, fees and net profit at an explicit target', () => {
    const result = computeTakeProfit({ ...base, targetPrice: '110' });
    if (!result.ok) throw new Error('unexpected error');
    const v = result.value;
    // gross = (110 − 100) × 10 = 100
    // open fee = 10 × 100 × 0.1% = 1 ; close fee = 10 × 110 × 0.1% = 1.1
    expectDec(v.rewardDistance, '10');
    expectDec(v.grossPnl, '100');
    expectDec(v.openFee, '1');
    expectDec(v.closeFee, '1.1');
    expectDec(v.totalFee, '2.1');
    expectDec(v.netPnl, '97.9');
    expectDec(v.rrRatio, '2');
    // margin = 1000 / 5 = 200 → 97.9 / 200 = 48.95%
    expectDec(v.returnOnMarginPct, '48.95');
    expectDec(v.returnOnNotionalPct, '9.79');
  });

  it('lists the 1/1.5/2/3/5 R quick targets with exact prices', () => {
    const result = computeTakeProfit({ ...base, targetPrice: '' });
    if (!result.ok) throw new Error('unexpected error');
    const prices = result.value.quickTargets.map((leg) => leg.price.toString());
    // risk 5 → 1R 105, 1.5R 107.5, 2R 110, 3R 115, 5R 125
    expect(prices).toEqual(['105', '107.5', '110', '115', '125']);
    expect(result.value.quickTargets.map((leg) => leg.rr)).toEqual(['1', '1.5', '2', '3', '5']);
  });

  it('computes a short quick-target ladder downwards', () => {
    const result = computeTakeProfit({
      ...base,
      side: 'short',
      entry: '100',
      stop: '105',
      targetPrice: '',
    });
    if (!result.ok) throw new Error('unexpected error');
    const prices = result.value.quickTargets.map((leg) => leg.price.toString());
    expect(prices).toEqual(['95', '92.5', '90', '85', '75']);
  });

  it('reports R:R after fees honestly', () => {
    const result = computeTakeProfit({ ...base, targetPrice: '110' });
    if (!result.ok) throw new Error('unexpected error');
    // risk at stop incl. fees = 10×5 + 10×100×0.001 + 10×95×0.001 = 50 + 1 + 0.95 = 51.95
    expectDec(result.value.riskAtStopWithFees, '51.95');
    expectDec(result.value.rrAfterFees, result.value.netPnl.div(51.95).toString(), 10);
  });

  it('skips fee deduction when fees are excluded', () => {
    const result = computeTakeProfit({ ...base, includeFees: false, targetPrice: '110' });
    if (!result.ok) throw new Error('unexpected error');
    expectDec(result.value.netPnl, '100');
    expectDec(result.value.totalFee, '2.1'); // still reported for transparency
  });

  it('rejects a target on the wrong side of the entry', () => {
    const result = computeTakeProfit({ ...base, targetPrice: '95' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.code)).toContain('tpWrongSide');
  });
});
