/**
 * Stand-alone risk / reward math (no account size or quantity required).
 */
import { Decimal, HUNDRED } from '../decimal';
import type { Result } from './errors';
import { Collector } from './errors';
import { parseDecimal } from './parse';
import type { Side } from '../types';

export interface RiskRewardInput {
  side: Side;
  entry: string;
  stop: string;
  takeProfit: string;
}

export interface RiskRewardValue {
  side: Side;
  entry: Decimal;
  stop: Decimal;
  takeProfit: Decimal;
  riskDistance: Decimal;
  rewardDistance: Decimal;
  riskPctOfEntry: Decimal;
  rewardPctOfEntry: Decimal;
  /** reward / risk. 2 → "1:2". */
  ratio: Decimal;
  /** Ratio expressed with the risk side normalised to 1 (e.g. 1:2.00). */
  ratioLabel: string;
}

export function computeRiskReward(input: RiskRewardInput): Result<RiskRewardValue> {
  const c = new Collector();

  const entry = parseDecimal(input.entry, 'entry', { positive: true }, c);
  const stop = parseDecimal(input.stop, 'stop', { positive: true }, c);
  const takeProfit = parseDecimal(input.takeProfit, 'takeProfit', { positive: true }, c);

  if (c.fail() || !entry || !stop || !takeProfit) {
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }

  if (entry.eq(stop)) {
    c.error('pricesEqual', 'stop');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  if (input.side === 'long' && stop.gt(entry)) {
    c.error('stopAboveEntryForLong', 'stop');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  if (input.side === 'short' && stop.lt(entry)) {
    c.error('stopBelowEntryForShort', 'stop');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  if (takeProfit.eq(entry)) {
    c.error('tpEqualsEntry', 'takeProfit');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  if (input.side === 'long' && takeProfit.lt(entry)) {
    c.error('tpWrongSide', 'takeProfit');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  if (input.side === 'short' && takeProfit.gt(entry)) {
    c.error('tpWrongSide', 'takeProfit');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }

  const riskDistance = input.side === 'long' ? entry.minus(stop) : stop.minus(entry);
  const rewardDistance =
    input.side === 'long' ? takeProfit.minus(entry) : entry.minus(takeProfit);

  if (riskDistance.lte(0) || rewardDistance.lte(0)) {
    c.error('invalidNumber', 'takeProfit');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }

  const ratio = rewardDistance.div(riskDistance);
  if (!ratio.isFinite()) {
    c.error('notFinite', 'takeProfit');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }

  return {
    ok: true,
    value: {
      side: input.side,
      entry,
      stop,
      takeProfit,
      riskDistance,
      rewardDistance,
      riskPctOfEntry: riskDistance.div(entry).mul(HUNDRED),
      rewardPctOfEntry: rewardDistance.div(entry).mul(HUNDRED),
      ratio,
      ratioLabel: `1:${ratio.toFixed(2)}`,
    },
    warnings: c.warnings,
  };
}
