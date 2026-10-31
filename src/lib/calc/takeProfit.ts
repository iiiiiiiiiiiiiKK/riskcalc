/**
 * Take-profit + risk/reward projections for a sized position.
 *
 * long  : tp = entry + stopDistance * rr   |  reward = tp - entry
 * short : tp = entry - stopDistance * rr   |  reward = entry - tp
 */
import { Decimal, HUNDRED, ZERO } from '../decimal';
import type { Result } from './errors';
import { Collector } from './errors';
import { parseDecimal } from './parse';
import type { Side } from '../types';

export interface TakeProfitInput {
  side: Side;
  entry: string;
  stop: string;
  quantity: string;
  leverage?: string;
  openRatePct: string;
  closeRatePct: string;
  /** When true the net figures subtract the entry and exit fees. */
  includeFees: boolean;
  /** Optional explicit take-profit price. Falls back to the 1:2 target. */
  targetPrice?: string;
}

export interface TakeProfitLeg {
  /** Risk/reward multiple as a plain decimal string ("1.5", "2", …). */
  rr: string;
  price: Decimal;
  rewardDistance: Decimal;
  grossPnl: Decimal;
  totalFee: Decimal;
  netPnl: Decimal;
  returnOnNotionalPct: Decimal;
}

export interface TakeProfitValue {
  side: Side;
  entry: Decimal;
  stop: Decimal;
  quantity: Decimal;
  stopDistance: Decimal;
  targetPrice: Decimal;
  rewardDistance: Decimal;
  rrRatio: Decimal;
  grossPnl: Decimal;
  openFee: Decimal;
  closeFee: Decimal;
  totalFee: Decimal;
  netPnl: Decimal;
  /** Loss at the stop including both fee legs (the denominator of the real R:R). */
  riskAtStopWithFees: Decimal;
  returnOnNotionalPct: Decimal;
  returnOnMarginPct: Decimal | null;
  /** Net profit divided by the fee-inclusive stop loss — the honest R:R multiple. */
  rrAfterFees: Decimal;
  leverage: Decimal | null;
  quickTargets: TakeProfitLeg[];
  /** Price move (absolute, per unit) needed just to pay both fees. */
  feeBreakEvenDistance: Decimal;
}

export const QUICK_RR_TARGETS = ['1', '1.5', '2', '3', '5'] as const;

export function computeTakeProfit(input: TakeProfitInput): Result<TakeProfitValue> {
  const c = new Collector();

  const entry = parseDecimal(input.entry, 'entry', { positive: true }, c);
  const stop = parseDecimal(input.stop, 'stop', { positive: true }, c);
  const quantity = parseDecimal(input.quantity, 'quantity', { positive: true }, c);
  const openRatePct = parseDecimal(input.openRatePct, 'openRate', { nonNegative: true }, c);
  const closeRatePct = parseDecimal(input.closeRatePct, 'closeRate', { nonNegative: true }, c);
  const leverage =
    input.leverage && input.leverage.trim() !== ''
      ? parseDecimal(input.leverage, 'leverage', { positive: true, min: new Decimal(1) }, c)
      : null;

  if (c.fail() || !entry || !stop || !quantity || !openRatePct || !closeRatePct) {
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  if (openRatePct.gte(HUNDRED) || closeRatePct.gte(HUNDRED)) {
    c.error('feeRateRange', openRatePct.gte(HUNDRED) ? 'openRate' : 'closeRate');
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

  const stopDistance = input.side === 'long' ? entry.minus(stop) : stop.minus(entry);
  const openRate = openRatePct.div(HUNDRED);
  const closeRate = closeRatePct.div(HUNDRED);

  const openFee = quantity.mul(entry).mul(openRate);

  const legFor = (rr: Decimal): TakeProfitLeg => {
    const price =
      input.side === 'long' ? entry.plus(stopDistance.mul(rr)) : entry.minus(stopDistance.mul(rr));
    const rewardDistance = input.side === 'long' ? price.minus(entry) : entry.minus(price);
    const grossPnl = rewardDistance.mul(quantity);
    const closeFee = quantity.mul(price).mul(closeRate);
    const totalFee = openFee.plus(closeFee);
    const netPnl = grossPnl.minus(totalFee);
    return {
      rr: rr.toString(),
      price,
      rewardDistance,
      grossPnl,
      totalFee,
      netPnl,
      returnOnNotionalPct: netPnl.div(quantity.mul(entry)).mul(HUNDRED),
    };
  };

  // Explicit target price, validated against the trade direction.
  let targetPrice: Decimal | null = null;
  if (input.targetPrice && input.targetPrice.trim() !== '') {
    targetPrice = parseDecimal(input.targetPrice, 'takeProfit', { positive: true }, c);
    if (!targetPrice) return { ok: false, errors: c.errors, warnings: c.warnings };
    if (targetPrice.eq(entry)) {
      c.error('tpEqualsEntry', 'takeProfit');
      return { ok: false, errors: c.errors, warnings: c.warnings };
    }
    const wrongSide =
      input.side === 'long' ? targetPrice.lt(entry) : targetPrice.gt(entry);
    if (wrongSide) {
      c.error('tpWrongSide', 'takeProfit');
      return { ok: false, errors: c.errors, warnings: c.warnings };
    }
  }

  const rewardDistance = targetPrice
    ? input.side === 'long'
      ? targetPrice.minus(entry)
      : entry.minus(targetPrice)
    : stopDistance.mul(2);

  const price = targetPrice ?? (input.side === 'long' ? entry.plus(rewardDistance) : entry.minus(rewardDistance));
  const grossPnl = rewardDistance.mul(quantity);
  const closeFee = quantity.mul(price).mul(closeRate);
  const totalFee = openFee.plus(closeFee);
  const netPnl = input.includeFees ? grossPnl.minus(totalFee) : grossPnl;

  const riskAtStopWithFees = quantity
    .mul(stopDistance.plus(entry.mul(openRate)).plus(stop.mul(closeRate)));

  const rrRatio = rewardDistance.div(stopDistance);
  const notional = quantity.mul(entry);

  const value: TakeProfitValue = {
    side: input.side,
    entry,
    stop,
    quantity,
    stopDistance,
    targetPrice: price,
    rewardDistance,
    rrRatio,
    grossPnl,
    openFee,
    closeFee,
    totalFee,
    netPnl,
    riskAtStopWithFees,
    returnOnNotionalPct: netPnl.div(notional).mul(HUNDRED),
    returnOnMarginPct: leverage ? netPnl.div(notional.div(leverage)).mul(HUNDRED) : null,
    rrAfterFees: riskAtStopWithFees.isZero() ? ZERO : netPnl.div(riskAtStopWithFees),
    leverage,
    quickTargets: QUICK_RR_TARGETS.map((rr) => legFor(new Decimal(rr))),
    feeBreakEvenDistance: totalFee.div(quantity),
  };

  return { ok: true, value, warnings: c.warnings };
}
