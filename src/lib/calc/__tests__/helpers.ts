import { expect } from 'vitest';
import { Decimal } from '../../decimal';
import type { FeeConfig } from '../../types';

export function expectDec(actual: Decimal | null, expected: string, dp = 12): void {
  expect(actual).not.toBeNull();
  expect(actual!.toFixed(dp)).toBe(new Decimal(expected).toFixed(dp));
}

export function fees(openPct: string, closePct: string, include = true): FeeConfig {
  return {
    mode: 'custom',
    makerRate: '0.02',
    takerRate: '0.05',
    openRate: openPct,
    closeRate: closePct,
    include,
  };
}

export const NO_FEES: FeeConfig = {
  mode: 'custom',
  makerRate: '0',
  takerRate: '0',
  openRate: '0',
  closeRate: '0',
  include: true,
};
