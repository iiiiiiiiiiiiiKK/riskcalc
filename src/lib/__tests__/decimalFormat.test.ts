/**
 * Decimal layer guarantees: exact decimal arithmetic, single rounding step,
 * clean display strings.
 */
import { describe, expect, it } from 'vitest';
import { Decimal, D } from '../decimal';
import {
  formatAmount,
  formatNumber,
  formatPercent,
  formatPrice,
  formatQty,
  formatRatio,
  formatSigned,
  groupDigits,
  toFixedPlain,
  trimTrailingZeros,
} from '../format';

describe('decimal arithmetic', () => {
  it('adds without binary float artefacts', () => {
    expect(D('0.1').plus('0.2').toString()).toBe('0.3');
    expect(0.1 + 0.2).not.toBe(0.3); // documents the problem we avoid
  });

  it('subtracts without drift', () => {
    expect(D('0.3').minus('0.1').minus('0.1').minus('0.1').toString()).toBe('0');
  });

  it('multiplies percentages exactly', () => {
    expect(D('19.99').mul(D('3').div(100)).toString()).toBe('0.5997');
  });

  it('divides with 40 significant digits of working precision', () => {
    const third = D('1').div('3');
    expect(third.toFixed(20)).toBe('0.33333333333333333333');
  });

  it('keeps chained operations within 1e-30 of the exact result', () => {
    // 10000 × 1% ÷ 3 → 33.333… ; multiplying back shows the 40-digit residue
    const risk = D('10000').mul(D('1').div(100));
    const qty = risk.div('3');
    expect(qty.mul('3').minus('100').abs().lt('1e-30')).toBe(true);
    expect(D('0.1').mul('3').toString()).toBe('0.3');
  });
});

describe('formatting', () => {
  it('groups thousands and pads decimals', () => {
    expect(formatNumber(D('1234567.891'), 2)).toBe('1,234,567.89');
    expect(formatNumber(D('0'), 2)).toBe('0.00');
    expect(formatNumber(D('-1234.5'), 2)).toBe('-1,234.50');
  });

  it('never prints a negative zero', () => {
    expect(toFixedPlain(D('-0.0001'), 2)).toBe('0.00');
    expect(formatNumber(D('-0.0004'), 2)).toBe('0.00');
  });

  it('renders percentage values', () => {
    expect(formatPercent(D('1.5'), 2)).toBe('1.50%');
    expect(formatPercent(D('-2.345'), 2)).toBe('-2.35%');
  });

  it('keeps significant decimals for sub-1 prices', () => {
    expect(formatPrice(D('0.00001234'), 2)).toBe('0.00001234');
    expect(formatPrice(D('105000.5'), 2)).toBe('105,000.50');
  });

  it('trims ratio formatting', () => {
    expect(formatRatio(D('2'))).toBe('1:2');
    expect(formatRatio(D('1.5'))).toBe('1:1.5');
    expect(formatRatio(D('0.3333'))).toBe('1:0.3333');
  });

  it('formats signed amounts', () => {
    expect(formatSigned(D('1234.5'), 2)).toBe('+1,234.50');
    expect(formatSigned(D('-1234.5'), 2)).toBe('-1,234.50');
    expect(formatSigned(D('0'), 2)).toBe('0.00');
  });

  it('formats quantities with enough decimals for small values', () => {
    expect(formatQty(D('0.000123456'), 2)).toBe('0.000123');
  });

  it('formats amounts with the configured precision', () => {
    expect(formatAmount(D('1000'), 0)).toBe('1,000');
    expect(formatAmount(D('1000'), 4)).toBe('1,000.0000');
  });

  it('shows an em dash for invalid values instead of NaN', () => {
    expect(formatAmount(null, 2)).toBe('—');
    expect(formatPrice(new Decimal(NaN), 2)).toBe('—');
  });

  it('handles string helpers', () => {
    expect(groupDigits('1234567')).toBe('1,234,567');
    expect(groupDigits('-1234.5678')).toBe('-1,234.5678');
    expect(trimTrailingZeros('2.5000')).toBe('2.5');
    expect(trimTrailingZeros('3.0000')).toBe('3');
  });
});
