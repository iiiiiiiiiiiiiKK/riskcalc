/**
 * Risk / reward ratios and take-profit price derivation.
 */
import { describe, expect, it } from 'vitest';
import { computeRiskReward } from '../riskReward';
import { takeProfitPriceForRR, rrForTakeProfit } from '../position';
import { Decimal } from '../../decimal';
import { expectDec } from './helpers';

describe('risk / reward ratio', () => {
  it('reports 1:1 when the target mirrors the stop distance', () => {
    const result = computeRiskReward({ side: 'long', entry: '100', stop: '90', takeProfit: '110' });
    if (!result.ok) throw new Error(result.errors[0]?.code);
    expectDec(result.value.riskDistance, '10');
    expectDec(result.value.rewardDistance, '10');
    expectDec(result.value.ratio, '1');
    expect(result.value.ratioLabel).toBe('1:1.00');
    expectDec(result.value.riskPctOfEntry, '10');
    expectDec(result.value.rewardPctOfEntry, '10');
  });

  it('reports 1:2', () => {
    const result = computeRiskReward({ side: 'long', entry: '100', stop: '90', takeProfit: '120' });
    if (!result.ok) throw new Error('unexpected error');
    expectDec(result.value.ratio, '2');
    expectDec(result.value.riskDistance, '10');
    expectDec(result.value.rewardDistance, '20');
  });

  it('reports 1:3 for a short', () => {
    const result = computeRiskReward({ side: 'short', entry: '100', stop: '105', takeProfit: '85' });
    if (!result.ok) throw new Error('unexpected error');
    expectDec(result.value.riskDistance, '5');
    expectDec(result.value.rewardDistance, '15');
    expectDec(result.value.ratio, '3');
    expect(result.value.ratioLabel).toBe('1:3.00');
  });

  it('supports fractional ratios', () => {
    const result = computeRiskReward({ side: 'long', entry: '100', stop: '95', takeProfit: '107.5' });
    if (!result.ok) throw new Error('unexpected error');
    expectDec(result.value.ratio, '1.5');
  });

  it('keeps exact decimals for non-terminating ratios', () => {
    const result = computeRiskReward({ side: 'long', entry: '100', stop: '90', takeProfit: '133.33' });
    if (!result.ok) throw new Error('unexpected error');
    expect(result.value.ratio.toFixed(6)).toBe(new Decimal('33.33').div('10').toFixed(6));
  });
});

describe('take-profit price derivation', () => {
  it('derives long targets by adding the reward distance', () => {
    // entry 100, stop 95 → risk 5; 1:3 → +15 → 115
    const tp = takeProfitPriceForRR('long', new Decimal('100'), new Decimal('95'), new Decimal(3));
    expect(tp.toString()).toBe('115');
  });

  it('derives short targets by subtracting the reward distance', () => {
    // entry 100, stop 105 → risk 5; 1:3 → −15 → 85
    const tp = takeProfitPriceForRR('short', new Decimal('100'), new Decimal('105'), new Decimal(3));
    expect(tp.toString()).toBe('85');
  });

  it('derives 1.5R / 2R / 5R multiples exactly', () => {
    const entry = new Decimal('105000');
    const stop = new Decimal('102000'); // risk 3000
    expect(takeProfitPriceForRR('long', entry, stop, new Decimal('1.5')).toString()).toBe('109500');
    expect(takeProfitPriceForRR('long', entry, stop, new Decimal(2)).toString()).toBe('111000');
    expect(takeProfitPriceForRR('long', entry, stop, new Decimal(5)).toString()).toBe('120000');
    // short: stop 108000 → risk 3000 → 2R target 99000
    expect(takeProfitPriceForRR('short', entry, new Decimal('108000'), new Decimal(2)).toString()).toBe(
      '99000',
    );
  });

  it('round-trips: derive a price then read the ratio back', () => {
    const entry = new Decimal('100');
    const stop = new Decimal('94.5');
    const tp = takeProfitPriceForRR('long', entry, stop, new Decimal('2.5'));
    expect(rrForTakeProfit('long', entry, stop, tp).toString()).toBe('2.5');
  });
});
