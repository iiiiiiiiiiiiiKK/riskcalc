import { useMemo } from 'react';
import { Copy, RotateCcw, Save } from 'lucide-react';
import { useApp } from '../app/state';
import { Decimal } from '../lib/decimal';
import { CURRENCIES, type Currency, type Side } from '../lib/types';
import { formatAmount, formatPercent, formatPrice, formatQty, formatRatio } from '../lib/format';
import { takeProfitPriceForRR } from '../lib/calc/position';
import { copyText } from '../lib/clipboard';
import { newId } from '../lib/history';
import {
  Badge,
  Button,
  Card,
  Chip,
  ErrorList,
  HeroStat,
  NoticeList,
  NumberInput,
  SectionLabel,
  Segmented,
  Select,
  Stat,
} from '../components/ui';
import { FeeControls } from '../components/FeeControls';
import { TradeLevelBar } from '../components/TradeLevelBar';
import { useFieldError, usePosition } from './shared';

const RISK_TEMPLATES = [
  { value: '0.5', labelKey: 'template.conservative' },
  { value: '1', labelKey: 'template.standard' },
  { value: '2', labelKey: 'template.aggressive' },
] as const;

const LEVERAGE_PRESETS = ['1', '2', '3', '5', '10', '20', '50', '100'];

/** Reference 2R target used by the price map and the summary line. */
const TWO = new Decimal(2);

export function PositionSizePage() {
  const {
    t,
    em,
    wm,
    trade,
    updateTrade,
    resetTrade,
    settings,
    updateSettings,
    saveEntry,
    pushToast,
    currency,
    history,
  } = useApp();
  const result = usePosition();
  const fieldError = useFieldError();
  const decimals = settings.decimals;
  const errors = result.ok ? [] : result.errors;

  const target = useMemo(() => {
    if (!result.ok) return null;
    return takeProfitPriceForRR(trade.side, result.value.entry, result.value.stop, new Decimal(2));
  }, [result, trade.side]);

  /**
   * Optional manual conversion. RiskCalc never fetches FX rates: the only rate
   * ever used is the one the user typed in Settings.
   */
  const converted = useMemo(() => {
    if (!result.ok || !settings.conversion.enabled) return null;
    try {
      const rate = new Decimal(settings.conversion.rate.trim());
      if (!rate.isFinite() || rate.lte(0)) return null;
      return {
        rate,
        risk: result.value.riskAmount.mul(rate),
        notional: result.value.notional.mul(rate),
        to: settings.conversion.to,
      };
    } catch {
      return null;
    }
  }, [result, settings.conversion]);

  const summary = useMemo(() => {
    if (!result.ok) return '';
    const v = result.value;
    const sideLabel = trade.side === 'long' ? t('field.long') : t('field.short');
    const lines = [
      `${t('copy.header', { side: sideLabel })}`,
      `${t('field.account')}: ${formatAmount(v.account, decimals)} ${currency}`,
      `${t('field.riskPct')}: ${formatPercent(v.riskPct, 2)} → ${formatAmount(v.riskAmount, decimals)} ${currency}`,
      `${t('field.entry')}: ${formatPrice(v.entry, decimals)}`,
      `${t('field.stop')}: ${formatPrice(v.stop, decimals)} (${formatPercent(v.stopPct.negated(), 2)})`,
      `${t('result.positionSize')}: ${formatQty(v.quantity, decimals)}`,
      `${t('result.notional')}: ${formatAmount(v.notional, decimals)} ${currency}`,
      `${t('result.margin')}: ${formatAmount(v.margin, decimals)} ${currency} @ ${v.leverage.toString()}x`,
      `${t('result.rr')}: ${formatRatio(TWO)} → ${t('field.takeProfit')} ${formatPrice(target, decimals)}`,
    ];
    return lines.join('\n');
  }, [result, trade.side, t, currency, decimals, target]);

  const copyResults = async () => {
    if (!summary) return;
    const ok = await copyText(summary);
    pushToast(ok ? t('common.copied') : t('common.copyFailed'), ok ? 'ok' : 'error');
  };

  const save = () => {
    if (!result.ok) return;
    const v = result.value;
    saveEntry({
      id: newId(),
      createdAt: new Date().toISOString(),
      side: trade.side,
      currency,
      account: trade.account,
      riskPct: trade.riskPct,
      entry: trade.entry,
      stop: trade.stop,
      leverage: trade.leverage,
      quantity: v.quantity.toString(),
      notional: v.notional.toString(),
      riskAmount: v.riskAmount.toString(),
      feeConfig: trade.feeConfig,
    });
    pushToast(t('common.saved'));
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
      {/* ------------------------------------------------------------ inputs */}
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
              testIdPrefix="side"
            />
          }
        >
          {t('common.inputs')}
        </SectionLabel>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberInput
              label={t('field.account')}
              value={trade.account}
              onChange={(account) => updateTrade({ account })}
              unit={currency}
              error={fieldError(errors, 'account')}
              testId="input-account"
            />
            <Select<Currency>
              label={t('common.currency')}
              value={settings.currency}
              options={CURRENCIES.map((code) => ({ value: code, label: code }))}
              onChange={(next) => updateSettings({ currency: next })}
              testId="select-currency"
            />
          </div>

          <div>
            <NumberInput
              label={t('field.riskPct')}
              value={trade.riskPct}
              onChange={(riskPct) => updateTrade({ riskPct })}
              unit="%"
              error={fieldError(errors, 'riskPct')}
              testId="input-risk"
              right={
                <span className="flex flex-wrap gap-1">
                  {RISK_TEMPLATES.map((template) => (
                    <Chip
                      key={template.value}
                      active={trade.riskPct === template.value}
                      onClick={() => updateTrade({ riskPct: template.value })}
                      testId={`risk-template-${template.value}`}
                    >
                      {t(template.labelKey)}
                    </Chip>
                  ))}
                </span>
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberInput
              label={t('field.entry')}
              value={trade.entry}
              onChange={(entry) => updateTrade({ entry })}
              placeholder="0.00"
              error={fieldError(errors, 'entry')}
              testId="input-entry"
            />
            <NumberInput
              label={t('field.stop')}
              value={trade.stop}
              onChange={(stop) => updateTrade({ stop })}
              placeholder="0.00"
              error={fieldError(errors, 'stop')}
              testId="input-stop"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberInput
              label={t('field.leverage')}
              value={trade.leverage}
              onChange={(leverage) => updateTrade({ leverage })}
              unit="x"
              error={fieldError(errors, 'leverage')}
              testId="input-leverage"
            />
            <div className="flex items-end">
              <div className="flex flex-wrap gap-1 pb-2.5">
                {LEVERAGE_PRESETS.map((preset) => (
                  <Chip
                    key={preset}
                    active={trade.leverage === preset}
                    onClick={() => updateTrade({ leverage: preset })}
                    testId={`leverage-preset-${preset}`}
                  >
                    {preset}x
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface2/50 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {t('field.feeMode')}
            </div>
            <FeeControls compact />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={resetTrade} variant="ghost" size="sm" testId="reset-position">
              <RotateCcw className="h-3.5 w-3.5" /> {t('common.reset')}
            </Button>
            <Button onClick={copyResults} variant="subtle" size="sm" disabled={!result.ok} testId="copy-results">
              <Copy className="h-3.5 w-3.5" /> {t('common.copy')}
            </Button>
            <Button onClick={save} variant="primary" size="sm" disabled={!result.ok} testId="save-position">
              <Save className="h-3.5 w-3.5" /> {t('common.save')}
            </Button>
            <span className="ml-auto text-[11px] text-muted">
              {t('history.count', { count: String(history.length) })}
            </span>
          </div>
        </div>
      </Card>

      {/* ----------------------------------------------------------- results */}
      <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Card className="overflow-hidden">
          <SectionLabel right={<Badge tone={trade.side === 'long' ? 'long' : 'short'}>{trade.side === 'long' ? t('field.long') : t('field.short')}</Badge>}>
            {t('common.results')}
          </SectionLabel>

          <div className="p-4">
            {result.ok ? (
              <>
                <HeroStat
                  label={t('result.positionSize')}
                  value={formatQty(result.value.quantity, decimals)}
                  sub={
                    <>
                      {t('result.notional')} {formatAmount(result.value.notional, decimals)} {currency}
                    </>
                  }
                  testId="result-quantity"
                />

                <div className="mt-4">
                  <TradeLevelBar
                    side={trade.side}
                    entry={result.value.entry}
                    stop={result.value.stop}
                    takeProfit={target}
                    decimals={decimals}
                    labels={{
                      stop: `${t('field.stop')}`,
                      entry: `${t('field.entry')}`,
                      takeProfit: `2R`,
                      risk: t('result.riskDistance'),
                      reward: t('result.rewardDistance'),
                    }}
                  />
                </div>

                <div className="mt-3 divide-y divide-line/60">
                  <Stat
                    label={t('result.riskAmount')}
                    value={formatAmount(result.value.riskAmount, decimals)}
                    unit={currency}
                    tone="short"
                    emphasis
                    testId="result-risk"
                  />
                  <Stat
                    label={t('result.stopDistance')}
                    value={formatPrice(result.value.stopDistance, decimals)}
                    hint={formatPercent(result.value.stopPct.negated(), 2)}
                  />
                  <Stat
                    label={t('result.lossAtStopWithFees')}
                    value={formatAmount(result.value.lossAtStopWithFees, decimals)}
                    unit={currency}
                    tone="short"
                  />
                  <Stat
                    label={t('result.notional')}
                    value={formatAmount(result.value.notional, decimals)}
                    unit={currency}
                    testId="result-notional"
                  />
                  <Stat
                    label={t('result.notionalPct')}
                    value={formatPercent(result.value.notionalPctOfAccount, 2)}
                  />
                  <Stat
                    label={t('result.margin')}
                    value={formatAmount(result.value.margin, decimals)}
                    unit={currency}
                    hint={`${formatPercent(result.value.marginPctOfAccount, 2)} · ${result.value.leverage.toString()}x`}
                    testId="result-margin"
                  />
                  <Stat
                    label={t('result.breakEvenLeverage')}
                    value={`${result.value.breakEvenLeverage.toDecimalPlaces(2).toString()}x`}
                  />
                  <Stat label={t('result.rr')} value={formatRatio(TWO)} tone="accent" />
                </div>

                {result.warnings.length > 0 && (
                  <div className="mt-3 rounded-lg border border-warn/25 bg-warn/5 p-2.5">
                    <NoticeList items={result.warnings.map(wm)} />
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <ErrorList items={errors.map(em)} />
                <p className="text-[12px] leading-relaxed text-muted">{t('notice.risk')}</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-3.5">
          {converted && (
            <div className="mb-3 rounded-lg border border-accent/25 bg-accent/5 p-2.5 text-[11.5px] text-dim">
              <div className="mono">
                ≈ {formatAmount(converted.risk, decimals)} {converted.to} {t('result.riskAmount')}
              </div>
              <div className="mono">
                ≈ {formatAmount(converted.notional, decimals)} {converted.to} {t('result.notional')}
              </div>
              <div className="mt-1 text-muted">
                1 {currency} = {converted.rate.toString()} {converted.to}
              </div>
            </div>
          )}
          <ul className="space-y-2 text-[11.5px] leading-relaxed text-muted">
            <li>· {t('notice.leverage')}</li>
            <li>· {t('notice.margin')}</li>
            <li>· {t('notice.precision')}</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
