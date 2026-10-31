import { useMemo } from 'react';
import { useApp } from '../app/state';
import { computeBreakEven, computeFees } from '../lib/calc/fees';
import { formatAmount, formatPercent, formatPrice, formatSigned } from '../lib/format';
import type { Side } from '../lib/types';
import {
  Card,
  ErrorList,
  HeroStat,
  NumberInput,
  SectionLabel,
  Segmented,
  Stat,
} from '../components/ui';
import { FeeControls } from '../components/FeeControls';
import { useFieldError, usePosition } from './shared';

export function FeeCalculatorPage() {
  const { t, em, trade, updateTrade, settings, feeRates, currency } = useApp();
  const decimals = settings.decimals;
  const position = usePosition();
  const fieldError = useFieldError();

  const autoQty = position.ok ? position.value.quantity.toFixed(Math.max(2, Math.min(12, 8))) : '';
  const quantity = trade.quantityOverride.trim() === '' ? autoQty : trade.quantityOverride;
  const exitPrice = trade.tpPrice.trim() === '' ? '' : trade.tpPrice;

  const fees = useMemo(
    () =>
      computeFees({
        side: trade.side,
        entry: trade.entry,
        exit: exitPrice,
        quantity,
        openRatePct: feeRates.openPct,
        closeRatePct: feeRates.closePct,
        leverage: trade.leverage,
      }),
    [trade.side, trade.entry, exitPrice, quantity, feeRates, trade.leverage],
  );

  const breakEven = useMemo(
    () =>
      computeBreakEven({
        side: trade.side,
        entry: trade.entry,
        openRatePct: feeRates.openPct,
        closeRatePct: feeRates.closePct,
      }),
    [trade.side, trade.entry, feeRates],
  );

  const errors = fees.ok ? [] : fees.errors;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
      <div className="space-y-4">
        <Card>
          <SectionLabel
            right={
              <Segmented<Side>
                options={[
                  { value: 'long', label: t('field.long'), tone: 'long' },
                  { value: 'short', label: t('field.short'), tone: 'short' },
                ]}
                value={trade.side}
                onChange={(side) => updateTrade({ side })}
                size="sm"
                ariaLabel={t('field.side')}
                testIdPrefix="fee-side"
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
                error={fieldError(errors, 'entry')}
                testId="fee-entry"
              />
              <NumberInput
                label={t('field.exit')}
                value={exitPrice}
                onChange={(tpPrice) => updateTrade({ tpPrice })}
                error={fieldError(errors, 'exit')}
                testId="fee-exit"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumberInput
                label={t('field.quantity')}
                value={quantity}
                onChange={(value) => updateTrade({ quantityOverride: value })}
                error={fieldError(errors, 'quantity')}
                hint={position.ok ? `${t('result.positionSize')}: ${position.value.quantity.toFixed(6)}` : undefined}
                testId="fee-quantity"
              />
              <NumberInput
                label={t('field.leverage')}
                unit="x"
                value={trade.leverage}
                onChange={(leverage) => updateTrade({ leverage })}
                testId="fee-leverage"
              />
            </div>

            <div className="rounded-lg border border-line bg-surface2/50 p-3">
              <FeeControls compact />
            </div>
          </div>
        </Card>

        <Card className="p-3.5">
          <ul className="space-y-2 text-[11.5px] leading-relaxed text-muted">
            <li>· {t('notice.fees')}</li>
            <li>· {t('notice.precision')}</li>
            <li>· {t('notice.disclaimer')}</li>
          </ul>
        </Card>
      </div>

      <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Card>
          <SectionLabel>{t('common.results')}</SectionLabel>
          <div className="p-4">
            {fees.ok ? (
              <>
                <HeroStat
                  label={t('result.netPnl')}
                  value={formatSigned(fees.value.netPnl, decimals)}
                  unit={currency}
                  tone={fees.value.netPnl.gte(0) ? 'long' : 'short'}
                  sub={
                    <>
                      {t('result.totalFee')} {formatAmount(fees.value.totalFee, decimals)} {currency}
                    </>
                  }
                  testId="fee-net"
                />
                <div className="mt-3 divide-y divide-line/60">
                  <Stat label={t('result.entryNotional')} value={formatAmount(fees.value.openNotional, decimals)} unit={currency} />
                  <Stat label={t('result.exitNotional')} value={formatAmount(fees.value.closeNotional, decimals)} unit={currency} />
                  <Stat label={t('result.openFee')} value={formatAmount(fees.value.openFee, decimals)} unit={currency} tone="short" testId="fee-open-amount" />
                  <Stat label={t('result.closeFee')} value={formatAmount(fees.value.closeFee, decimals)} unit={currency} tone="short" testId="fee-close-amount" />
                  <Stat label={t('result.feePct')} value={formatPercent(fees.value.feePctOfNotional, 3)} />
                  <Stat label={t('result.feeMove')} value={formatPrice(fees.value.totalFeePriceEquivalent, decimals)} />
                  <Stat label={t('result.grossPnl')} value={formatSigned(fees.value.grossPnl, decimals)} unit={currency} />
                  <Stat label={t('result.returnNotional')} value={formatPercent(fees.value.netReturnOnNotionalPct, 2)} />
                  {fees.value.netReturnOnMarginPct && (
                    <Stat label={t('result.returnMargin')} value={formatPercent(fees.value.netReturnOnMarginPct, 2)} />
                  )}
                </div>
              </>
            ) : (
              <ErrorList items={errors.map(em)} />
            )}
          </div>
        </Card>

        <Card>
          <SectionLabel>{t('result.breakEvenPrice')}</SectionLabel>
          <div className="p-4">
            {breakEven.ok ? (
              <>
                <HeroStat
                  label={t('result.breakEvenPrice')}
                  value={formatPrice(breakEven.value.breakEven, decimals)}
                  sub={
                    <>
                      {t('result.breakEvenDistance')} {formatPercent(breakEven.value.distancePct, 3)}
                    </>
                  }
                  testId="fee-breakeven"
                />
                <div className="mt-3 divide-y divide-line/60">
                  <Stat label={t('field.entry')} value={formatPrice(breakEven.value.entry, decimals)} />
                  <Stat label={t('field.openFee')} value={formatPercent(fees.ok ? fees.value.openFeeRatePct : null, 3)} />
                  <Stat label={t('field.closeFee')} value={formatPercent(fees.ok ? fees.value.closeFeeRatePct : null, 3)} />
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted">
                  {trade.side === 'long'
                    ? 'X = entry × (1 + openRate) ÷ (1 − closeRate)'
                    : 'X = entry × (1 − openRate) ÷ (1 + closeRate)'}
                </p>
              </>
            ) : (
              <ErrorList items={breakEven.ok ? [] : breakEven.errors.map(em)} />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
