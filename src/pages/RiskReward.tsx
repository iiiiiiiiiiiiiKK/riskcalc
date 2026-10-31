import { useMemo } from 'react';
import { Decimal } from '../lib/decimal';
import { useApp } from '../app/state';
import { computeRiskReward } from '../lib/calc/riskReward';
import { takeProfitPriceForRR } from '../lib/calc/position';
import { formatPercent, formatPrice, formatRatio } from '../lib/format';
import type { Side } from '../lib/types';
import {
  Badge,
  Card,
  Chip,
  ErrorList,
  HeroStat,
  NumberInput,
  SectionLabel,
  Segmented,
  Stat,
} from '../components/ui';
import { TradeLevelBar } from '../components/TradeLevelBar';
import { useFieldError } from './shared';

const RR_PRESETS = ['1', '1.5', '2', '3', '5'];

export function RiskRewardPage() {
  const { t, em, trade, updateTrade, settings } = useApp();
  const decimals = settings.decimals;
  const fieldError = useFieldError();

  const result = useMemo(
    () =>
      computeRiskReward({
        side: trade.side,
        entry: trade.entry,
        stop: trade.stop,
        takeProfit: trade.tpPrice,
      }),
    [trade.side, trade.entry, trade.stop, trade.tpPrice],
  );

  const errors = result.ok ? [] : result.errors;

  const applyRR = (rr: string) => {
    const base = computeRRBase(trade.side, trade.entry, trade.stop);
    if (!base) return;
    const price = takeProfitPriceForRR(trade.side, base.entry, base.stop, new Decimal(rr));
    updateTrade({ tpPrice: price.toFixed(Math.min(8, Math.max(2, decimals))) });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
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
              testIdPrefix="rr-side"
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
              testId="rr-entry"
            />
            <NumberInput
              label={t('field.stop')}
              value={trade.stop}
              onChange={(stop) => updateTrade({ stop })}
              error={fieldError(errors, 'stop')}
              testId="rr-stop"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberInput
              label={t('field.takeProfit')}
              value={trade.tpPrice}
              onChange={(tpPrice) => updateTrade({ tpPrice })}
              error={fieldError(errors, 'takeProfit')}
              testId="rr-tp"
            />
            <div className="flex items-end">
              <div className="flex flex-wrap gap-1 pb-2.5">
                {RR_PRESETS.map((preset) => (
                  <Chip key={preset} onClick={() => applyRR(preset)} testId={`rr-preset-${preset}`}>
                    1:{preset}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          <p className="rounded-lg border border-line bg-surface2/50 p-3 text-[11.5px] leading-relaxed text-muted">
            {t('notice.risk')}
          </p>
        </div>
      </Card>

      <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Card>
          <SectionLabel right={<Badge tone={trade.side === 'long' ? 'long' : 'short'}>{trade.side === 'long' ? t('field.long') : t('field.short')}</Badge>}>
            {t('common.results')}
          </SectionLabel>
          <div className="p-4">
            {result.ok ? (
              <>
                <HeroStat
                  label={t('result.rr')}
                  value={formatRatio(result.value.ratio)}
                  tone="plain"
                  sub={
                    <>
                      {formatPrice(result.value.rewardDistance, decimals)} / {formatPrice(result.value.riskDistance, decimals)}
                    </>
                  }
                  testId="rr-ratio"
                />
                <div className="mt-4">
                  <TradeLevelBar
                    side={trade.side}
                    entry={result.value.entry}
                    stop={result.value.stop}
                    takeProfit={result.value.takeProfit}
                    decimals={decimals}
                    labels={{
                      stop: t('field.stop'),
                      entry: t('field.entry'),
                      takeProfit: t('field.takeProfit'),
                      risk: t('result.riskDistance'),
                      reward: t('result.rewardDistance'),
                    }}
                  />
                </div>
                <div className="mt-3 divide-y divide-line/60">
                  <Stat label={t('result.riskDistance')} value={formatPrice(result.value.riskDistance, decimals)} hint={formatPercent(result.value.riskPctOfEntry, 2)} tone="short" />
                  <Stat label={t('result.rewardDistance')} value={formatPrice(result.value.rewardDistance, decimals)} hint={formatPercent(result.value.rewardPctOfEntry, 2)} tone="long" />
                  <Stat label={t('field.takeProfit')} value={formatPrice(result.value.takeProfit, decimals)} />
                  <Stat label={t('field.stop')} value={formatPrice(result.value.stop, decimals)} />
                </div>
              </>
            ) : (
              <ErrorList items={errors.map(em)} />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Parse entry/stop for the preset buttons; returns null when the pair is invalid. */
function computeRRBase(
  side: Side,
  entryRaw: string,
  stopRaw: string,
): { entry: Decimal; stop: Decimal } | null {
  try {
    const entry = new Decimal(entryRaw.trim() === '' ? 'NaN' : entryRaw);
    const stop = new Decimal(stopRaw.trim() === '' ? 'NaN' : stopRaw);
    if (!entry.isFinite() || !stop.isFinite() || entry.lte(0) || stop.lte(0) || entry.eq(stop)) {
      return null;
    }
    if (side === 'long' && stop.gte(entry)) return null;
    if (side === 'short' && stop.lte(entry)) return null;
    return { entry, stop };
  } catch {
    return null;
  }
}
