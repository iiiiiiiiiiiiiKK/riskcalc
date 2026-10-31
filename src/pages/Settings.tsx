import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useApp } from '../app/state';
import { CURRENCIES, type Currency, type FeeMode, type Lang, type Theme } from '../lib/types';
import { Button, Card, Modal, NumberInput, SectionLabel, Segmented, Select, Toggle } from '../components/ui';
import { XIcon, X_HANDLE, X_URL } from '../components/nav';
import { APP_VERSION } from '../version';

const DECIMAL_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '8'];

export function SettingsPage() {
  const {
    t,
    settings,
    updateSettings,
    resetSettings,
    pushToast,
    clearHistory,
    history,
  } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);

  const fee = settings.feeConfig;
  const patchFee = (patch: Partial<typeof fee>) =>
    updateSettings({ feeConfig: { ...fee, ...patch } });

  const rateValue =
    fee.mode === 'maker' ? fee.makerRate : fee.mode === 'taker' ? fee.takerRate : fee.openRate;
  const setRate = (value: string) => {
    if (fee.mode === 'maker') patchFee({ makerRate: value });
    else if (fee.mode === 'taker') patchFee({ takerRate: value });
    else patchFee({ openRate: value, closeRate: value });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionLabel>{t('settings.language')} / {t('settings.theme')}</SectionLabel>
        <div className="space-y-3 p-4">
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
              {t('settings.language')}
            </div>
            <Segmented<Lang>
              options={[
                { value: 'zh', label: '中文' },
                { value: 'en', label: 'English' },
              ]}
              value={settings.lang}
              onChange={(lang) => updateSettings({ lang })}
              ariaLabel={t('settings.language')}
              testIdPrefix="lang"
            />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
              {t('settings.theme')}
            </div>
            <Segmented<Theme>
              options={[
                { value: 'dark', label: t('settings.themeDark') },
                { value: 'light', label: t('settings.themeLight') },
              ]}
              value={settings.theme}
              onChange={(theme) => updateSettings({ theme })}
              ariaLabel={t('settings.theme')}
              testIdPrefix="theme"
            />
          </div>
        </div>
      </Card>

      <Card>
        <SectionLabel>{t('common.templates')}</SectionLabel>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select<Currency>
              label={t('settings.defaultCurrency')}
              value={settings.currency}
              options={CURRENCIES.map((code) => ({ value: code, label: code }))}
              onChange={(currency) => updateSettings({ currency })}
              testId="settings-currency"
            />
            <Select<string>
              label={t('settings.decimals')}
              value={String(settings.decimals)}
              options={DECIMAL_OPTIONS.map((value) => ({ value, label: value }))}
              onChange={(value) => updateSettings({ decimals: Number(value) })}
              testId="settings-decimals"
            />
            <NumberInput
              label={t('settings.defaultRisk')}
              unit="%"
              value={settings.riskPct}
              onChange={(riskPct) => updateSettings({ riskPct })}
              testId="settings-risk"
            />
            <NumberInput
              label={t('settings.defaultLeverage')}
              unit="x"
              value={settings.leverage}
              onChange={(leverage) => updateSettings({ leverage })}
              testId="settings-leverage"
            />
          </div>
          <p className="text-[11px] text-muted">{t('settings.decimalsHint')}</p>
        </div>
      </Card>

      <Card>
        <SectionLabel>{t('settings.defaultFees')}</SectionLabel>
        <div className="space-y-3 p-4">
          <Segmented<FeeMode>
            options={[
              { value: 'taker', label: t('field.feeTaker') },
              { value: 'maker', label: t('field.feeMaker') },
              { value: 'custom', label: t('field.feeCustom') },
            ]}
            value={fee.mode}
            onChange={(mode) => patchFee({ mode })}
            size="sm"
            ariaLabel={t('field.feeMode')}
            testIdPrefix="settings-fee-mode"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberInput
              label={fee.mode === 'maker' ? t('field.feeMaker') : fee.mode === 'taker' ? t('field.feeTaker') : t('field.openFee')}
              unit="%"
              value={rateValue}
              onChange={setRate}
              testId="settings-fee-rate"
            />
            {fee.mode === 'custom' && (
              <NumberInput
                label={t('field.closeFee')}
                unit="%"
                value={fee.closeRate}
                onChange={(closeRate) => patchFee({ closeRate })}
                testId="settings-fee-close"
              />
            )}
          </div>
          <Toggle
            checked={fee.include}
            onChange={(include) => patchFee({ include })}
            label={t('common.includeFees')}
            description={t('notice.fees')}
            testId="settings-fee-include"
          />
        </div>
      </Card>

      <Card>
        <SectionLabel>{t('settings.conversion')}</SectionLabel>
        <div className="space-y-3 p-4">
          <Toggle
            checked={settings.conversion.enabled}
            onChange={(enabled) =>
              updateSettings({ conversion: { ...settings.conversion, enabled } })
            }
            label={t('settings.conversion')}
            description={t('settings.conversionHint')}
            testId="settings-conversion"
          />
          {settings.conversion.enabled && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select<Currency>
                label={t('common.currency')}
                value={settings.conversion.from}
                options={CURRENCIES.map((code) => ({ value: code, label: code }))}
                onChange={(from) => updateSettings({ conversion: { ...settings.conversion, from } })}
                testId="settings-conversion-from"
              />
              <Select<Currency>
                label={t('common.currency')}
                value={settings.conversion.to}
                options={CURRENCIES.map((code) => ({ value: code, label: code }))}
                onChange={(to) => updateSettings({ conversion: { ...settings.conversion, to } })}
                testId="settings-conversion-to"
              />
              <NumberInput
                label={t('settings.conversionRate')}
                value={settings.conversion.rate}
                onChange={(rate) => updateSettings({ conversion: { ...settings.conversion, rate } })}
                testId="settings-conversion-rate"
              />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionLabel>{t('settings.data')}</SectionLabel>
        <div className="space-y-3 p-4">
          <p className="text-[12px] text-dim">
            {t('history.count', { count: String(history.length) })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmClear(true)}
              disabled={history.length === 0}
              testId="settings-clear-history"
            >
              <Trash2 className="h-3.5 w-3.5" /> {t('settings.clearHistory')}
            </Button>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                resetSettings();
                pushToast(t('settings.resetDone'));
              }}
              testId="settings-reset"
            >
              {t('settings.resetSettings')}
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted">{t('notice.privacy')}</p>
        </div>
      </Card>

      <Card>
        <SectionLabel>{t('settings.about')}</SectionLabel>
        <div className="space-y-3 p-4 text-[12px] leading-relaxed text-dim">
          <div className="flex items-center justify-between">
            <span>{t('settings.version')}</span>
            <span className="mono text-txt">{APP_VERSION}</span>
          </div>
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center justify-between rounded-lg border border-line bg-surface2 px-3 py-2 text-txt transition-colors hover:border-lineStrong"
            data-testid="settings-x-link"
          >
            <span className="flex items-center gap-2">
              <XIcon className="h-3.5 w-3.5" />
              {X_HANDLE}
            </span>
            <span className="text-[11px] text-muted">x.com</span>
          </a>
          <p>{t('notice.disclaimer')}</p>
          <p>{t('notice.precision')}</p>
        </div>
      </Card>

      <Modal
        open={confirmClear}
        title={t('settings.clearHistory')}
        onClose={() => setConfirmClear(false)}
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={() => setConfirmClear(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                clearHistory();
                setConfirmClear(false);
                pushToast(t('history.cleared'));
              }}
              testId="settings-confirm-clear"
            >
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        {t('history.clearConfirm')}
      </Modal>
    </div>
  );
}
