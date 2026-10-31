import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Decimal } from '../lib/decimal';
import { useApp } from '../app/state';
import { computeTakeProfit } from '../lib/calc/takeProfit';
import { computeScaleOut } from '../lib/calc/scaleOut';
import { takeProfitPriceForRR } from '../lib/calc/position';
import { formatAmount, formatPercent, formatPrice, formatQty, formatRatio, formatSigned } from '../lib/format';
import { newId } from '../lib/history';
import type { Side } from '../lib/types';
import {
  Badge,
  Button,
  Card,
  ErrorList,
  HeroStat,
  NoticeList,
  NumberInput,
  SectionLabel,
  Segmented,
  Stat,
} from '../components/ui';
import { FeeControls } from '../components/FeeControls';
import { useFieldError, usePosition } from './shared';

const QUICK_RR = ['1', '1.5', '2', '3', '5'];
const DEFAULT_PCTS = ['30', '40', '30'];
const SUGGESTED_RR = ['1.5', '2.5', '4', '6'];

export function TakeProfitPage() {
  const { t, em, wm, trade, updateTrade, settings, feeRates, currency } = useApp();
  const decimals = settings.decimals;
  const position = usePosition();
  const fieldError = useFieldError();
  const [mode, setMode] = useState<'single' | 'ladder'>('single');

  const autoQty = position.ok ? position.value.quantity.toFixed(Math.max(2, Math.min(12, 8))) : '';
  const quantity = trade.quantityOverride.trim() === '' ? autoQty : trade.quantityOverride;

  // Seed a sensible ladder the first time this page is used so the planner is
  // never an empty table: three legs at 1.5R / 2.5R / 4R with 30/40/30 %.
  useEffect(() => {
    if (trade.targets.length > 0 || !position.ok) return;
    const { entry, stop } = position.value;
    const legs = SUGGESTED_RR.slice(0, 3).map((rr, index) => ({
      id: newId(),
      price: takeProfitPriceForRR(trade.side, entry, stop, new Decimal(rr)).toFixed(
        Math.min(8, Math.max(2, decimals)),
      ),
      pct: DEFAULT_PCTS[index] ?? '30',
    }));
    updateTrade({ targets: legs });
    // Only react to the "empty ladder" condition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.ok, trade.targets.length]);

  // Seed the single-target field with a 2R default when it is still empty.
  useEffect(() => {
    if (trade.tpPrice.trim() !== '' || !position.ok) return;
    const price = takeProfitPriceForRR(
      trade.side,
      position.value.entry,
      position.value.stop,
      new Decimal(2),
    );
    updateTrade({ tpPrice: price.toFixed(Math.min(8, Math.max(2, decimals))) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.ok]);

  const single = useMemo(
    () =>
      computeTakeProfit({
        side: trade.side,
        entry: trade.entry,
        stop: trade.stop,
        quantity,
        leverage: trade.leverage,
        openRatePct: feeRates.openPct,
        closeRatePct: feeRates.closePct,
        includeFees: trade.feeConfig.include,
        targetPrice: trade.tpPrice,
      }),
    [trade.side, trade.entry, trade.stop, quantity, trade.leverage, feeRates, trade.feeConfig.include, trade.tpPrice],
  );

  const ladder = useMemo(
    () =>
      computeScaleOut({
        side: trade.side,
        entry: trade.entry,
        stop: trade.stop,
        quantity,
        openRatePct: feeRates.openPct,
        closeRatePct: feeRates.closePct,
        includeFees: trade.feeConfig.include,
        targets: trade.targets,
      }),
    [trade.side, trade.entry, trade.stop, quantity, feeRates, trade.feeConfig.include, trade.targets],
  );

  const singleErrors = single.ok ? [] : single.errors;
  const ladderErrors = ladder.ok ? [] : ladder.errors;

  const setTarget = (id: string, patch: { price?: string; pct?: string }) => {
    updateTrade({
      targets: trade.targets.map((target) => (target.id === id ? { ...target, ...patch } : target)),
    });
  };

  const addTarget = () => {
    if (trade.targets.length >= 12) return;
    let price = '';
    if (position.ok) {
      const rr = SUGGESTED_RR[Math.min(trade.targets.length, SUGGESTED_RR.length - 1)] ?? '2';
      price = takeProfitPriceForRR(
        trade.side,
        position.value.entry,
        position.value.stop,
        new Decimal(rr),
      ).toFixed(Math.min(8, Math.max(2, decimals)));
    }
    updateTrade({
      targets: [...trade.targets, { id: newId(), price, pct: '20' }],
    });
  };

  const removeTarget = (id: string) => {
    updateTrade({ targets: trade.targets.filter((target) => target.id !== id) });
  };

  const ladderWarnings = useMemo(() => {
    if (!ladder.ok) return [];
    const list: string[] = [];
    const total = ladder.value.totalPct;
    if (total.lt(100)) {
      list.push(
        wm({
          code: 'pctRemainder',
          params: {
            pct: formatPercent(total, 0),
            rest: formatPercent(ladder.value.remainingPct, 0),
          },
        }),
      );
    }
    return list;
  }, [ladder, wm]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
        {/* ---------------------------------------------------------- inputs */}
        <Card>
          <SectionLabel
            right={
              <Segmented<Side>
                options={[
                  { value: 'long', label: t('field.long'), tone: 'long' },
                  { value: 'short', label: t('field.short'), tone: 'short' },
                ]}
                value={trade.side}
                onChange={(side) => updateTrade({ side, targets: [] })}
                size="sm"
                ariaLabel={t('field.side')}
                testIdPrefix="tp-side"
              />
            }
          >
            {t('common.inputs')}
          </SectionLabel>

          <div className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumberInput
                label={t('field.entry')}
                value={trade.entry}
                onChange={(entry) => updateTrade({ entry })}
                testId="tp-entry"
              />
              <NumberInput
                label={t('field.stop')}
                value={trade.stop}
                onChange={(stop) => updateTrade({ stop })}
                testId="tp-stop"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumberInput
                label={t('field.quantity')}
                value={quantity}
                onChange={(value) => updateTrade({ quantityOverride: value })}
                hint={position.ok ? `${t('result.positionSize')}: ${formatQty(position.value.quantity, decimals)}` : undefined}
                testId="tp-quantity"
              />
              <NumberInput
                label={t('field.leverage')}
                unit="x"
                value={trade.leverage}
                onChange={(leverage) => updateTrade({ leverage })}
                testId="tp-leverage"
              />
            </div>

            <div className="rounded-lg border border-line bg-surface2/50 p-3">
              <FeeControls compact />
            </div>
          </div>
        </Card>

        {/* --------------------------------------------------------- headline */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <SectionLabel
              right={
                <Segmented<'single' | 'ladder'>
                  options={[
                    { value: 'single', label: t('field.takeProfit') },
                    { value: 'ladder', label: t('field.targets') },
                  ]}
                  value={mode}
                  onChange={setMode}
                  size="sm"
                  ariaLabel={t('field.targets')}
                  testIdPrefix="tp-mode"
                />
              }
            >
              {mode === 'single' ? t('result.quickTargets') : t('result.totalPct')}
            </SectionLabel>

            <div className="p-4">
              {mode === 'single' ? (
                single.ok ? (
                  <>
                    <HeroStat
                      label={t('result.netPnl')}
                      value={formatSigned(single.value.netPnl, decimals)}
                      unit={currency}
                      tone={single.value.netPnl.gte(0) ? 'long' : 'short'}
                      sub={
                        <>
                          {t('result.rrAfterFees')} {formatRatio(single.value.rrAfterFees)} ·{' '}
                          {t('field.takeProfit')} {formatPrice(single.value.targetPrice, decimals)}
                        </>
                      }
                      testId="tp-net"
                    />
                    <div className="mt-3 divide-y divide-line/60">
                      <Stat label={t('result.grossPnl')} value={formatAmount(single.value.grossPnl, decimals)} unit={currency} tone="long" />
                      <Stat label={t('result.totalFee')} value={formatAmount(single.value.totalFee, decimals)} unit={currency} tone="short" />
                      <Stat label={t('result.returnNotional')} value={formatPercent(single.value.returnOnNotionalPct, 2)} />
                      {single.value.returnOnMarginPct && (
                        <Stat label={t('result.returnMargin')} value={formatPercent(single.value.returnOnMarginPct, 2)} />
                      )}
                      <Stat label={t('result.riskAtStop')} value={formatAmount(single.value.riskAtStopWithFees, decimals)} unit={currency} />
                      <Stat label={t('result.feeMove')} value={formatPrice(single.value.feeBreakEvenDistance, decimals)} />
                      <Stat label={t('result.rr')} value={formatRatio(single.value.rrRatio)} tone="accent" />
                    </div>
                  </>
                ) : (
                  <ErrorList items={singleErrors.map(em)} />
                )
              ) : ladder.ok ? (
                <>
                  <HeroStat
                    label={t('result.netPnl')}
                    value={formatSigned(ladder.value.totalNetPnl, decimals)}
                    unit={currency}
                    tone={ladder.value.totalNetPnl.gte(0) ? 'long' : 'short'}
                    sub={
                      <>
                        {t('result.totalPct')} {formatPercent(ladder.value.totalPct, 0)} ·{' '}
                        {t('result.remaining')} {formatPercent(ladder.value.remainingPct, 0)}
                      </>
                    }
                    testId="ladder-net"
                  />
                  <div className="mt-3 divide-y divide-line/60">
                    <Stat label={t('result.grossPnl')} value={formatAmount(ladder.value.totalGrossPnl, decimals)} unit={currency} tone="long" />
                    <Stat label={t('result.totalFee')} value={formatAmount(ladder.value.totalFees, decimals)} unit={currency} tone="short" />
                    <Stat label={t('result.remaining')} value={formatQty(ladder.value.remainingQty, decimals)} hint={formatPercent(ladder.value.remainingPct, 0)} />
                    <Stat label={t('result.avgExit')} value={formatPrice(ladder.value.averageExitPrice, decimals)} />
                    <Stat label={t('result.worstCase')} value={formatSigned(ladder.value.worstCaseNetPnl, decimals)} unit={currency} tone={ladder.value.worstCaseNetPnl.gte(0) ? 'long' : 'short'} />
                    <Stat label={t('result.rrAfterFees')} value={formatRatio(ladder.value.rrAfterFees)} tone="accent" />
                  </div>
                  {ladderWarnings.length > 0 && (
                    <div className="mt-3 rounded-lg border border-warn/25 bg-warn/5 p-2.5">
                      <NoticeList items={ladderWarnings} />
                    </div>
                  )}
                </>
              ) : (
                <ErrorList items={ladderErrors.map(em)} />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ------------------------------------------------------ single target */}
      <Card>
        <SectionLabel right={<Badge tone="accent">{t('field.takeProfit')}</Badge>}>
          {t('result.quickTargets')}
        </SectionLabel>
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <NumberInput
            label={t('field.takeProfit')}
            value={trade.tpPrice}
            onChange={(tpPrice) => updateTrade({ tpPrice })}
            error={fieldError(singleErrors, 'takeProfit')}
            testId="tp-price"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {single.ok
              ? single.value.quickTargets.map((target) => (
                  <button
                    key={target.rr}
                    type="button"
                    onClick={() =>
                      updateTrade({
                        tpPrice: target.price.toFixed(Math.min(8, Math.max(2, decimals))),
                      })
                    }
                    className="rounded-lg border border-line bg-surface2 p-2.5 text-left transition-colors hover:border-accent/50"
                    data-testid={`tp-quick-${target.rr}`}
                  >
                    <div className="text-[10.5px] uppercase tracking-wide text-muted">1:{target.rr}</div>
                    <div className="mono mt-0.5 text-[12.5px] font-semibold text-txt">
                      {formatPrice(target.price, decimals)}
                    </div>
                    <div className="mono text-[11px] text-dim">
                      {formatSigned(target.netPnl, decimals)}
                    </div>
                  </button>
                ))
              : QUICK_RR.map((rr) => (
                  <div key={rr} className="rounded-lg border border-line bg-surface2 p-2.5 text-[11px] text-muted">
                    1:{rr}
                  </div>
                ))}
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------ ladder */}
      <Card>
        <SectionLabel
          right={
            <Button size="sm" variant="subtle" onClick={addTarget} testId="add-target" disabled={trade.targets.length >= 12}>
              <Plus className="h-3.5 w-3.5" /> {t('common.add')}
            </Button>
          }
        >
          {t('field.targets')}
        </SectionLabel>

        <div className="p-4">
          <div className="space-y-2">
            <div className="hidden grid-cols-[28px_1fr_88px_1fr_1fr_1fr_80px_32px] gap-2 px-1 text-[10.5px] uppercase tracking-wide text-muted lg:grid">
              <span>#</span>
              <span>{t('field.price')}</span>
              <span>{t('field.tpPct')}</span>
              <span>{t('result.qtyLeg')}</span>
              <span>{t('result.grossPnl')}</span>
              <span>{t('result.netPnl')}</span>
              <span>{t('result.cumulative')}</span>
              <span />
            </div>

            {trade.targets.length === 0 && (
              <p className="rounded-lg border border-dashed border-line p-4 text-center text-[12px] text-muted">
                {t('common.empty')}
              </p>
            )}

            {trade.targets.map((target, index) => {
              const leg = ladder.ok ? ladder.value.legs[index] : undefined;
              return (
                <div
                  key={target.id}
                  className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface2/40 p-2 lg:grid-cols-[28px_1fr_88px_1fr_1fr_1fr_80px_32px] lg:items-center lg:border-0 lg:bg-transparent lg:p-1"
                >
                  <span className="hidden text-[11px] text-muted lg:block">{index + 1}</span>
                  <div>
                    <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted lg:hidden">
                      {t('field.price')}
                    </span>
                    <input
                      className="mono w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] text-txt focus:border-accent/60 focus:outline-none"
                      value={target.price}
                      onChange={(event) => setTarget(target.id, { price: event.target.value })}
                      inputMode="decimal"
                      autoComplete="off"
                      data-testid={`target-price-${index}`}
                      aria-label={`${t('field.price')} ${index + 1}`}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      className="mono w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] text-txt focus:border-accent/60 focus:outline-none"
                      value={target.pct}
                      onChange={(event) => setTarget(target.id, { pct: event.target.value })}
                      inputMode="decimal"
                      autoComplete="off"
                      data-testid={`target-pct-${index}`}
                      aria-label={`${t('field.tpPct')} ${index + 1}`}
                    />
                    <span className="text-[11px] text-muted">%</span>
                  </div>
                  <span className="mono text-[12px] text-dim" data-testid={`target-qty-${index}`}>
                    {leg ? formatQty(leg.qty, decimals) : '—'}
                  </span>
                  <span className="mono text-[12px] text-dim">{leg ? formatSigned(leg.grossPnl, decimals) : '—'}</span>
                  <span className="mono text-[12px] font-semibold text-txt">{leg ? formatSigned(leg.netPnl, decimals) : '—'}</span>
                  <span className="mono text-[12px] text-dim">
                    {leg ? formatSigned(leg.cumulativeNetPnl, decimals) : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTarget(target.id)}
                    aria-label={`${t('common.remove')} ${index + 1}`}
                    className="justify-self-end rounded-md p-1.5 text-muted transition-colors hover:bg-short/10 hover:text-short"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {ladder.ok && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-line bg-surface2/40 p-2.5">
                <div className="text-[10.5px] uppercase tracking-wide text-muted">{t('result.totalPct')}</div>
                <div className="mono text-[14px] font-semibold text-txt">{formatPercent(ladder.value.totalPct, 0)}</div>
              </div>
              <div className="rounded-lg border border-line bg-surface2/40 p-2.5">
                <div className="text-[10.5px] uppercase tracking-wide text-muted">{t('result.remaining')}</div>
                <div className="mono text-[14px] font-semibold text-txt">{formatQty(ladder.value.remainingQty, decimals)}</div>
              </div>
              <div className="rounded-lg border border-line bg-surface2/40 p-2.5">
                <div className="text-[10.5px] uppercase tracking-wide text-muted">{t('result.totalFee')}</div>
                <div className="mono text-[14px] font-semibold text-short">{formatAmount(ladder.value.totalFees, decimals)}</div>
              </div>
              <div className="rounded-lg border border-line bg-surface2/40 p-2.5">
                <div className="text-[10.5px] uppercase tracking-wide text-muted">{t('result.avgExit')}</div>
                <div className="mono text-[14px] font-semibold text-txt">{formatPrice(ladder.value.averageExitPrice, decimals)}</div>
              </div>
            </div>
          )}

          {!ladder.ok && <div className="mt-3"><ErrorList items={ladderErrors.map(em)} /></div>}
        </div>
      </Card>
    </div>
  );
}
