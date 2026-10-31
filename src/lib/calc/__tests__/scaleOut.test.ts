/**
 * Scale-out ladder: per-leg profit, cumulative realized PnL and remaining size.
 */
import { describe, expect, it } from 'vitest';
import { computeScaleOut } from '../scaleOut';
import type { ScaleOutTarget } from '../../types';
import { expectDec } from './helpers';

const ladder: ScaleOutTarget[] = [
  { id: 'a', price: '105', pct: '30' },
  { id: 'b', price: '108', pct: '40' },
  { id: 'c', price: '112', pct: '30' },
];

const base = {
  side: 'long' as const,
  entry: '100',
  stop: '95',
  quantity: '10',
  openRatePct: '0.04',
  closeRatePct: '0.04',
  includeFees: true,
  targets: ladder,
};

describe('scale-out ladder', () => {
  it('sizes each leg from the position quantity', () => {
    const result = computeScaleOut(base);
    if (!result.ok) throw new Error('unexpected error');
    // 30% / 40% / 30% of 10 units → 3 / 4 / 3
    expect(result.value.legs.map((leg) => leg.qty.toString())).toEqual(['3', '4', '3']);
    expectDec(result.value.totalPct, '100');
    expectDec(result.value.remainingPct, '0');
    expectDec(result.value.remainingQty, '0');
  });

  it('computes per-leg gross, fees and net profit', () => {
    const result = computeScaleOut(base);
    if (!result.ok) throw new Error('unexpected error');
    const [leg1, leg2, leg3] = result.value.legs;
    if (!leg1 || !leg2 || !leg3) throw new Error('missing legs');

    // Leg 1: gross 5×3 = 15 ; open fee 3×100×0.04% = 0.12 ; close 3×105×0.04% = 0.126
    expectDec(leg1.grossPnl, '15');
    expectDec(leg1.openFeeShare, '0.12');
    expectDec(leg1.closeFee, '0.126');
    expectDec(leg1.netPnl, '14.754');

    // Leg 2: gross 8×4 = 32 ; open 4×100×0.04% = 0.16 ; close 4×108×0.04% = 0.1728
    expectDec(leg2.grossPnl, '32');
    expectDec(leg2.openFeeShare, '0.16');
    expectDec(leg2.closeFee, '0.1728');
    expectDec(leg2.netPnl, '31.6672');

    // Leg 3: gross 12×3 = 36 ; open 0.12 ; close 3×112×0.04% = 0.1344
    expectDec(leg3.grossPnl, '36');
    expectDec(leg3.netPnl, '35.7456');
  });

  it('accumulates realized profit leg by leg', () => {
    const result = computeScaleOut(base);
    if (!result.ok) throw new Error('unexpected error');
    expectDec(result.value.legs[0]!.cumulativeNetPnl, '14.754');
    expectDec(result.value.legs[1]!.cumulativeNetPnl, '46.4212'); // 14.754 + 31.6672
    expectDec(result.value.legs[2]!.cumulativeNetPnl, '82.1668'); // + 35.7456
    expectDec(result.value.totalNetPnl, '82.1668');
    expectDec(result.value.totalFees, '0.8332'); // 0.12+0.126+0.16+0.1728+0.12+0.1344
  });

  it('leaves the remainder open when the ladder closes less than 100%', () => {
    const result = computeScaleOut({
      ...base,
      targets: [
        { id: 'a', price: '105', pct: '30' },
        { id: 'b', price: '108', pct: '30' },
      ],
    });
    if (!result.ok) throw new Error('unexpected error');
    expectDec(result.value.totalPct, '60');
    expectDec(result.value.remainingPct, '40');
    expectDec(result.value.remainingQty, '4');
    // Worst case: the remaining 4 units are stopped at 95 → −20, minus close fee 4×95×0.04% = 0.152
    // realized legs: 14.754 + 23.7504 = 38.5044 → 38.5044 − 20.152 = 18.3524
    expectDec(result.value.worstCaseNetPnl, '18.3524');
  });

  it('works for a short ladder', () => {
    const result = computeScaleOut({
      side: 'short',
      entry: '100',
      stop: '105',
      quantity: '10',
      openRatePct: '0.1',
      closeRatePct: '0.1',
      includeFees: true,
      targets: [
        { id: 'a', price: '95', pct: '50' },
        { id: 'b', price: '90', pct: '50' },
      ],
    });
    if (!result.ok) throw new Error('unexpected error');
    const [leg1, leg2] = result.value.legs;
    if (!leg1 || !leg2) throw new Error('missing legs');
    // Leg 1: gross (100−95)×5 = 25 ; open 5×100×0.1% = 0.5 ; close 5×95×0.1% = 0.475
    expectDec(leg1.grossPnl, '25');
    expectDec(leg1.netPnl, '24.025');
    // Leg 2: gross (100−90)×5 = 50 ; open 0.5 ; close 5×90×0.1% = 0.45
    expectDec(leg2.netPnl, '49.05');
    expectDec(result.value.totalNetPnl, '73.075');
  });

  it('rejects a ladder that closes more than 100%', () => {
    const result = computeScaleOut({
      ...base,
      targets: [
        { id: 'a', price: '105', pct: '60' },
        { id: 'b', price: '108', pct: '60' },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.code)).toContain('pctSumExceeds');
  });

  it('rejects a target below the entry on a long', () => {
    const result = computeScaleOut({ ...base, targets: [{ id: 'a', price: '98', pct: '100' }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.code)).toContain('tpWrongSide');
  });

  it('rejects an empty ladder', () => {
    const result = computeScaleOut({ ...base, targets: [] });
    expect(result.ok).toBe(false);
  });

  it('computes the average exit price', () => {
    const result = computeScaleOut(base);
    if (!result.ok) throw new Error('unexpected error');
    // (105×30 + 108×40 + 112×30) / 100 = (3150 + 4320 + 3360)/100 = 108.3
    expectDec(result.value.averageExitPrice, '108.3');
  });
});
