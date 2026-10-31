import { useApp } from '../app/state';
import type { FeeConfig, FeeMode } from '../lib/types';
import { NumberInput, Segmented, Toggle } from './ui';

/**
 * Shared fee editor. Rates are entered in percent (0.05 = 0.05%), which is how
 * every exchange publishes them, and are never assumed by the app.
 */
export function FeeControls({ compact = false }: { compact?: boolean }) {
  const { t, trade, updateTrade } = useApp();
  const feeConfig = trade.feeConfig;

  const patch = (next: Partial<FeeConfig>) =>
    updateTrade({ feeConfig: { ...feeConfig, ...next } });

  return (
    <div className="space-y-3">
      <Segmented<FeeMode>
        options={[
          { value: 'taker', label: t('field.feeTaker') },
          { value: 'maker', label: t('field.feeMaker') },
          { value: 'custom', label: t('field.feeCustom') },
        ]}
        value={feeConfig.mode}
        onChange={(mode) => patch({ mode })}
        size="sm"
        ariaLabel={t('field.feeMode')}
        testIdPrefix="fee-mode"
      />

      <div className={compact ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
        {feeConfig.mode === 'custom' ? (
          <>
            <NumberInput
              label={t('field.openFee')}
              unit="%"
              value={feeConfig.openRate}
              onChange={(openRate) => patch({ openRate })}
              testId="fee-open"
            />
            <NumberInput
              label={t('field.closeFee')}
              unit="%"
              value={feeConfig.closeRate}
              onChange={(closeRate) => patch({ closeRate })}
              testId="fee-close"
            />
          </>
        ) : (
          <NumberInput
            label={feeConfig.mode === 'maker' ? `${t('field.feeMaker')} ${t('common.unit')}` : `${t('field.feeTaker')} ${t('common.unit')}`}
            unit="%"
            value={feeConfig.mode === 'maker' ? feeConfig.makerRate : feeConfig.takerRate}
            onChange={(value) =>
              patch(feeConfig.mode === 'maker' ? { makerRate: value } : { takerRate: value })
            }
            hint={t('notice.fees')}
            testId={feeConfig.mode === 'maker' ? 'fee-maker-rate' : 'fee-taker-rate'}
            className="sm:col-span-2"
          />
        )}
      </div>

      <Toggle
        checked={feeConfig.include}
        onChange={(include) => patch({ include })}
        label={t('common.includeFees')}
        description={t('notice.fees')}
        testId="fee-include"
      />
    </div>
  );
}
