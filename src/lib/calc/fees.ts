/**
 * Trading fee math.
 *
 * openFee      = openNotional  * openRate
 * closeFee     = closeNotional * closeRate     ← uses the *exit* notional, not the entry one
 * grossPnl     = (exit - entry) * qty           (long)   / (entry - exit) * qty (short)
 * netPnl       = grossPnl - openFee - closeFee
 */
import { Decimal, HUNDRED } from '../decimal';
import type { Result } from './errors';
import { Collector } from './errors';
import { parseDecimal } from './parse';
import type { Side } from '../types';

export interface FeeInput {
  side: Side;
  entry: string;
  exit: string;
  quantity: string;
  openRatePct: string;
  closeRatePct: string;
  /** Optional leverage to express returns on margin as well as on notional. */
  leverage?: string;
}

export interface FeeValue {
  side: Side;
  entry: Decimal;
  exit: Decimal;
  quantity: Decimal;
  openNotional: Decimal;
  closeNotional: Decimal;
  openFeeRatePct: Decimal;
  closeFeeRatePct: Decimal;
  openFee: Decimal;
  closeFee: Decimal;
  totalFee: Decimal;
  /** Gross PnL before any fee, signed (negative when the trade loses). */
  grossPnl: Decimal;
  netPnl: Decimal;
  /** netPnl / openNotional * 100 */
  netReturnOnNotionalPct: Decimal;
  /** netPnl / margin * 100, null when no leverage was supplied. */
  netReturnOnMarginPct: Decimal | null;
  /** Fees as a share of the entry notional, in percent. */
  feePctOfNotional: Decimal;
  /** Move of the exit price needed to cover both fees, in price units. */
  totalFeePriceEquivalent: Decimal;
}

export function computeFees(input: FeeInput): Result<FeeValue> {
  const c = new Collector();

  const entry = parseDecimal(input.entry, 'entry', { positive: true }, c);
  const exit = parseDecimal(input.exit, 'exit', { positive: true }, c);
  const quantity = parseDecimal(input.quantity, 'quantity', { positive: true }, c);
  const openRatePct = parseDecimal(input.openRatePct, 'openRate', { nonNegative: true }, c);
  const closeRatePct = parseDecimal(input.closeRatePct, 'closeRate', { nonNegative: true }, c);
  const leverage =
    input.leverage && input.leverage.trim() !== ''
      ? parseDecimal(input.leverage, 'leverage', { positive: true }, c)
      : null;

  if (c.fail() || !entry || !exit || !quantity || !openRatePct || !closeRatePct) {
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  if (openRatePct.gte(HUNDRED) || closeRatePct.gte(HUNDRED)) {
    c.error('feeRateRange', openRatePct.gte(HUNDRED) ? 'openRate' : 'closeRate');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }

  const openRate = openRatePct.div(HUNDRED);
  const closeRate = closeRatePct.div(HUNDRED);

  const openNotional = quantity.mul(entry);
  const closeNotional = quantity.mul(exit);
  const openFee = openNotional.mul(openRate);
  const closeFee = closeNotional.mul(closeRate);
  const totalFee = openFee.plus(closeFee);

  const grossPnl =
    input.side === 'long' ? exit.minus(entry).mul(quantity) : entry.minus(exit).mul(quantity);
  const netPnl = grossPnl.minus(totalFee);

  const netReturnOnNotionalPct = netPnl.div(openNotional).mul(HUNDRED);
  const netReturnOnMarginPct =
    leverage && leverage.gt(0) ? netPnl.div(openNotional.div(leverage)).mul(HUNDRED) : null;

  return {
    ok: true,
    value: {
      side: input.side,
      entry,
      exit,
      quantity,
      openNotional,
      closeNotional,
      openFeeRatePct: openRatePct,
      closeFeeRatePct: closeRatePct,
      openFee,
      closeFee,
      totalFee,
      grossPnl,
      netPnl,
      netReturnOnNotionalPct,
      netReturnOnMarginPct,
      feePctOfNotional: totalFee.div(openNotional).mul(HUNDRED),
      totalFeePriceEquivalent: totalFee.div(quantity),
    },
    warnings: c.warnings,
  };
}

/**
 * Break-even price including entry and exit fees.
 *
 * Long :  X = entry * (1 + openRate) / (1 - closeRate)
 * Short:  X = entry * (1 - openRate) / (1 + closeRate)
 *
 * Derivation (long), profit at exit price X equals zero:
 *   qty*(X - entry) - qty*entry*openRate - qty*X*closeRate = 0
 *   → X(1 - closeRate) = entry(1 + openRate)
 * Note the close fee is charged on the *exit* notional (X), which is why the
 * break-even is not simply entry * (1 + openRate + closeRate).
 */
export function computeBreakEven(input: {
  side: Side;
  entry: string;
  openRatePct: string;
  closeRatePct: string;
}): Result<{ side: Side; entry: Decimal; breakEven: Decimal; distancePct: Decimal }> {
  const c = new Collector();
  const entry = parseDecimal(input.entry, 'entry', { positive: true }, c);
  const openRatePct = parseDecimal(input.openRatePct, 'openRate', { nonNegative: true }, c);
  const closeRatePct = parseDecimal(input.closeRatePct, 'closeRate', { nonNegative: true }, c);

  if (c.fail() || !entry || !openRatePct || !closeRatePct) {
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  if (openRatePct.gte(HUNDRED) || closeRatePct.gte(HUNDRED)) {
    c.error('feeRateRange', openRatePct.gte(HUNDRED) ? 'openRate' : 'closeRate');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }

  const openRate = openRatePct.div(HUNDRED);
  const closeRate = closeRatePct.div(HUNDRED);

  const breakEven =
    input.side === 'long'
      ? entry.mul(openRate.plus(1)).div(new Decimal(1).minus(closeRate))
      : entry.mul(new Decimal(1).minus(openRate)).div(closeRate.plus(1));

  if (!breakEven.isFinite() || breakEven.lte(0)) {
    c.error('notFinite', 'entry');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }

  const distancePct = breakEven.minus(entry).div(entry).mul(HUNDRED);

  return {
    ok: true,
    value: { side: input.side, entry, breakEven, distancePct },
    warnings: c.warnings,
  };
}
