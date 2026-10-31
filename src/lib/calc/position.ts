/**
 * Core position sizing math.
 *
 * Formulas (all decimal, no intermediate rounding):
 *
 *   riskAmount        = account * riskPct / 100
 *   stopDistance      = |entry - stop|   (validated: long → stop < entry, short → stop > entry)
 *   stopPct           = stopDistance / entry * 100
 *   perUnitRisk       = stopDistance                               (fees excluded)
 *                     = stopDistance + entry*openRate + stop*closeRate  (fees included)
 *   quantity          = riskAmount / perUnitRisk
 *   notional          = quantity * entry
 *   margin            = notional / leverage
 *   notional / account → account usage %
 *
 * `perUnitRisk` with fees included is the exact per-unit loss at the stop when
 * both the entry and the exit fee are paid out of the same risk budget:
 *   loss = qty*(entry-stop) + qty*entry*openRate + qty*stop*closeRate
 */
import { Decimal, HUNDRED, ONE, ZERO } from '../decimal';
import type { Result, CalcWarning } from './errors';
import { Collector } from './errors';
import { parseDecimal } from './parse';
import { resolveFeeRates, type FeeConfig, type Side } from '../types';

export interface PositionInput {
  account: string;
  riskPct: string;
  entry: string;
  stop: string;
  side: Side;
  leverage: string;
  feeConfig: FeeConfig;
}

export interface PositionValue {
  side: Side;
  account: Decimal;
  riskPct: Decimal;
  entry: Decimal;
  stop: Decimal;
  stopDistance: Decimal;
  stopPct: Decimal;
  riskAmount: Decimal;
  perUnitRisk: Decimal;
  /** Per-unit loss at the stop, fees excluded (always computed, for transparency). */
  perUnitStopDistance: Decimal;
  quantity: Decimal;
  notional: Decimal;
  notionalPctOfAccount: Decimal;
  /** Theoretical loss at the stop, fees excluded. */
  lossAtStop: Decimal;
  /** Loss at the stop including entry + exit fees (equals riskAmount when fees are on). */
  lossAtStopWithFees: Decimal;
  leverage: Decimal;
  margin: Decimal;
  marginPctOfAccount: Decimal;
  /** Leverage that would consume exactly the whole account as margin. */
  breakEvenLeverage: Decimal;
  openFeeRatePct: Decimal;
  closeFeeRatePct: Decimal;
  feesIncluded: boolean;
}

const DEFAULT_LEVERAGE = '1';

export function computePosition(input: PositionInput): Result<PositionValue> {
  const c = new Collector();

  const account = parseDecimal(input.account, 'account', { positive: true, min: new Decimal('1e-8') }, c);
  const riskPct = parseDecimal(input.riskPct, 'riskPct', { positive: true }, c);
  const entry = parseDecimal(input.entry, 'entry', { positive: true }, c);
  const stop = parseDecimal(input.stop, 'stop', { positive: true }, c);
  const leverage = parseDecimal(
    input.leverage.trim() === '' ? DEFAULT_LEVERAGE : input.leverage,
    'leverage',
    { positive: true, min: ONE },
    c,
  );

  if (c.fail() || !account || !riskPct || !entry || !stop || !leverage) {
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }

  // --- risk percentage range ------------------------------------------------
  if (riskPct.gt(HUNDRED)) {
    c.error('riskPctRange', 'riskPct');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  if (riskPct.gt(10)) c.warn('riskPctAggressive', 'riskPct');

  // --- leverage range -------------------------------------------------------
  if (leverage.gt(new Decimal(125))) {
    c.error('leverageRange', 'leverage');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }

  // --- direction / price consistency ---------------------------------------
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

  // --- fee rates ------------------------------------------------------------
  const { openPct, closePct } = resolveFeeRates(input.feeConfig);
  const openRatePct = parseDecimal(openPct, 'openRate', { nonNegative: true }, c);
  const closeRatePct = parseDecimal(closePct, 'closeRate', { nonNegative: true }, c);
  if (c.fail() || !openRatePct || !closeRatePct) {
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  if (openRatePct.gte(HUNDRED) || closeRatePct.gte(HUNDRED)) {
    c.error('feeRateRange', openRatePct.gte(HUNDRED) ? 'openRate' : 'closeRate');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  if (openRatePct.gt(2) || closeRatePct.gt(2)) c.warn('feeRateHigh');

  const openRate = openRatePct.div(HUNDRED);
  const closeRate = closeRatePct.div(HUNDRED);
  const feesIncluded = input.feeConfig.include;

  // --- distances ------------------------------------------------------------
  const stopDistance =
    input.side === 'long' ? entry.minus(stop) : stop.minus(entry);
  const stopPct = stopDistance.div(entry).mul(HUNDRED);

  const feePerUnit = entry.mul(openRate).plus(stop.mul(closeRate));
  const perUnitRisk = feesIncluded ? stopDistance.plus(feePerUnit) : stopDistance;

  if (perUnitRisk.lte(0)) {
    c.error('mustBePositive', 'stop');
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }

  // --- sizing ---------------------------------------------------------------
  const riskAmount = account.mul(riskPct).div(HUNDRED);
  const quantity = riskAmount.div(perUnitRisk);
  const notional = quantity.mul(entry);
  const notionalPctOfAccount = notional.div(account).mul(HUNDRED);
  const lossAtStop = quantity.mul(stopDistance);
  const lossAtStopWithFees = quantity.mul(perUnitRisk);
  const margin = notional.div(leverage);
  const marginPctOfAccount = margin.div(account).mul(HUNDRED);
  const breakEvenLeverage = notional.div(account);

  if (margin.gt(account)) c.warn('marginExceedsAccount', 'leverage', { leverage: leverage.toString() });
  if (notionalPctOfAccount.gt(1000)) c.warn('notionalExceedsAccount');

  const value: PositionValue = {
    side: input.side,
    account,
    riskPct,
    entry,
    stop,
    stopDistance,
    stopPct,
    riskAmount,
    perUnitRisk,
    perUnitStopDistance: stopDistance,
    quantity,
    notional,
    notionalPctOfAccount,
    lossAtStop,
    lossAtStopWithFees,
    leverage,
    margin,
    marginPctOfAccount,
    breakEvenLeverage,
    openFeeRatePct: openRatePct,
    closeFeeRatePct: closeRatePct,
    feesIncluded,
  };

  return { ok: true, value, warnings: c.warnings };
}

/**
 * Derive a take-profit price from a risk/reward multiple.
 * long : entry + stopDistance * rr
 * short: entry - stopDistance * rr
 */
export function takeProfitPriceForRR(
  side: Side,
  entry: Decimal,
  stop: Decimal,
  rr: Decimal,
): Decimal {
  const stopDistance = side === 'long' ? entry.minus(stop) : stop.minus(entry);
  const reward = stopDistance.mul(rr);
  return side === 'long' ? entry.plus(reward) : entry.minus(reward);
}

/** Derive the risk/reward multiple implied by an explicit take-profit price. */
export function rrForTakeProfit(side: Side, entry: Decimal, stop: Decimal, tp: Decimal): Decimal {
  const stopDistance = side === 'long' ? entry.minus(stop) : stop.minus(entry);
  const rewardDistance = side === 'long' ? tp.minus(entry) : entry.minus(tp);
  if (stopDistance.isZero()) return ZERO;
  return rewardDistance.div(stopDistance);
}

export type { CalcWarning };
