/**
 * Scale-out (partial take-profit) math.
 *
 * Each leg closes `pct`% of the *position quantity* at its own price:
 *   qtyLeg      = quantity * pct / 100
 *   grossPnlLeg = (price - entry) * qtyLeg      (long)
 *               = (entry - price) * qtyLeg      (short)
 *   openFeeLeg  = qtyLeg * entry * openRate      ← pro-rata share of the entry fee
 *   closeFeeLeg = qtyLeg * price * closeRate     ← charged on this leg's exit notional
 *   netPnlLeg   = grossPnlLeg - openFeeLeg - closeFeeLeg
 */
import { Decimal, HUNDRED } from '../decimal';
import type { Result } from './errors';
import { Collector } from './errors';
import { parseDecimal } from './parse';
import type { Side, ScaleOutTarget } from '../types';

export interface ScaleOutInput {
  side: Side;
  entry: string;
  stop: string;
  quantity: string;
  openRatePct: string;
  closeRatePct: string;
  includeFees: boolean;
  targets: ScaleOutTarget[];
}

export interface ScaleOutLeg {
  id: string;
  price: Decimal;
  pct: Decimal;
  qty: Decimal;
  rewardDistance: Decimal;
  grossPnl: Decimal;
  openFeeShare: Decimal;
  closeFee: Decimal;
  netPnl: Decimal;
  cumulativeNetPnl: Decimal;
  remainingQty: Decimal;
}

export interface ScaleOutValue {
  side: Side;
  entry: Decimal;
  stop: Decimal;
  quantity: Decimal;
  legs: ScaleOutLeg[];
  totalPct: Decimal;
  remainingPct: Decimal;
  remainingQty: Decimal;
  totalGrossPnl: Decimal;
  totalFees: Decimal;
  totalNetPnl: Decimal;
  /** Net PnL if the remaining (un-sold) quantity is closed at the stop. */
  worstCaseNetPnl: Decimal;
  riskAmountWithFees: Decimal;
  rrAfterFees: Decimal;
  averageExitPrice: Decimal;
}

export function computeScaleOut(input: ScaleOutInput): Result<ScaleOutValue> {
  const c = new Collector();

  const entry = parseDecimal(input.entry, 'entry', { positive: true }, c);
  const stop = parseDecimal(input.stop, 'stop', { positive: true }, c);
  const quantity = parseDecimal(input.quantity, 'quantity', { positive: true }, c);
  const openRatePct = parseDecimal(input.openRatePct, 'openRate', { nonNegative: true }, c);
  const closeRatePct = parseDecimal(input.closeRatePct, 'closeRate', { nonNegative: true }, c);

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

  if (!Array.isArray(input.targets) || input.targets.length === 0) {
    c.error('required', 'targets');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  if (input.targets.length > 12) {
    c.error('outOfRange', 'targets', { max: '12' });
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }

  const openRate = openRatePct.div(HUNDRED);
  const closeRate = closeRatePct.div(HUNDRED);

  const parsed = input.targets.map((t) => ({
    id: t.id,
    price: parseDecimal(t.price, 'price', { positive: true }, c),
    pct: parseDecimal(t.pct, 'pct', { nonNegative: true, max: HUNDRED }, c),
  }));

  if (c.fail() || parsed.some((p) => !p.price || p.pct === null)) {
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }

  const typed = parsed as { id: string; price: Decimal; pct: Decimal }[];
  const totalPct = typed.reduce((acc, t) => acc.plus(t.pct), new Decimal(0));

  if (totalPct.gt(HUNDRED)) {
    c.error('pctSumExceeds', 'pct', { sum: totalPct.toString() });
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }

  // Per-leg price validation: an exit target must be on the profitable side.
  for (const t of typed) {
    if (t.price.eq(entry)) {
      c.error('tpEqualsEntry', 'price');
      return { ok: false, errors: c.errors, warnings: c.warnings };
    }
    const wrongSide = input.side === 'long' ? t.price.lt(entry) : t.price.gt(entry);
    if (wrongSide) {
      c.error('tpWrongSide', 'price');
      return { ok: false, errors: c.errors, warnings: c.warnings };
    }
  }

  // Legs are evaluated in ascending price order for shorts, descending for longs,
  // which keeps the cumulative columns readable. Targets keep their input order
  // otherwise, so user intent is preserved.
  const legs: ScaleOutLeg[] = [];
  let cumulativeNetPnl = new Decimal(0);
  let remainingQty = quantity;

  for (const t of typed) {
    const qty = quantity.mul(t.pct).div(HUNDRED);
    const rewardDistance = input.side === 'long' ? t.price.minus(entry) : entry.minus(t.price);
    const grossPnl = rewardDistance.mul(qty);
    const openFeeShare = qty.mul(entry).mul(openRate);
    const closeFee = qty.mul(t.price).mul(closeRate);
    const netPnl = input.includeFees
      ? grossPnl.minus(openFeeShare).minus(closeFee)
      : grossPnl;

    cumulativeNetPnl = cumulativeNetPnl.plus(netPnl);
    remainingQty = remainingQty.minus(qty);

    legs.push({
      id: t.id,
      price: t.price,
      pct: t.pct,
      qty,
      rewardDistance,
      grossPnl,
      openFeeShare,
      closeFee,
      netPnl,
      cumulativeNetPnl,
      remainingQty,
    });
  }

  const totalGrossPnl = legs.reduce((a, l) => a.plus(l.grossPnl), new Decimal(0));
  const totalFees = legs.reduce((a, l) => a.plus(l.openFeeShare).plus(l.closeFee), new Decimal(0));
  const totalNetPnl = legs.reduce((a, l) => a.plus(l.netPnl), new Decimal(0));
  const remainingPct = HUNDRED.minus(totalPct);

  // If the rest is stopped out, the fees already paid stay sunk cost.
  const remainingStopLoss = remainingQty
    .mul(input.side === 'long' ? entry.minus(stop) : stop.minus(entry))
    .plus(remainingQty.mul(stop).mul(closeRate));

  const averageExitPrice = quantity.isZero()
    ? entry
    : legs.reduce((acc, l) => acc.plus(l.price.mul(l.pct)), new Decimal(0)).div(totalPct.isZero() ? HUNDRED : totalPct);

  const riskAmountWithFees = quantity
    .mul(input.side === 'long' ? entry.minus(stop) : stop.minus(entry))
    .plus(quantity.mul(entry).mul(openRate))
    .plus(quantity.mul(stop).mul(closeRate));

  return {
    ok: true,
    value: {
      side: input.side,
      entry,
      stop,
      quantity,
      legs,
      totalPct,
      remainingPct,
      remainingQty,
      totalGrossPnl,
      totalFees,
      totalNetPnl,
      worstCaseNetPnl: totalNetPnl.minus(remainingStopLoss),
      riskAmountWithFees,
      rrAfterFees: riskAmountWithFees.isZero()
        ? new Decimal(0)
        : totalNetPnl.div(riskAmountWithFees),
      averageExitPrice,
    },
    warnings: c.warnings,
  };
}
