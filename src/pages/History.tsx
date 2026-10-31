import { useState } from 'react';
import { Download, RotateCcw, Trash2 } from 'lucide-react';
import { useApp } from '../app/state';
import { formatAmount, formatDateTime, formatPrice, formatQty, dec } from '../lib/format';
import { historyToJson } from '../lib/history';
import { downloadJson } from '../lib/clipboard';
import { Badge, Button, Card, Modal, SectionLabel } from '../components/ui';
import type { PageKey } from '../components/nav';

export function HistoryPage({ navigate }: { navigate: (page: PageKey) => void }) {
  const { t, history, deleteEntry, clearHistory, pushToast, settings, updateTrade } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);
  const decimals = settings.decimals;

  const restore = (id: string) => {
    const entry = history.find((item) => item.id === id);
    if (!entry) return;
    updateTrade({
      side: entry.side,
      account: entry.account,
      riskPct: entry.riskPct,
      entry: entry.entry,
      stop: entry.stop,
      leverage: entry.leverage,
      feeConfig: entry.feeConfig,
      quantityOverride: '',
      tpPrice: '',
      targets: [],
    });
    pushToast(t('history.restored'));
    navigate('position');
  };

  const exportAll = () => {
    if (history.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`riskcalc-history-${stamp}.json`, historyToJson(history));
    pushToast(t('history.exported'));
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionLabel
          right={
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="subtle" onClick={exportAll} disabled={history.length === 0} testId="export-history">
                <Download className="h-3.5 w-3.5" /> {t('common.export')}
              </Button>
              <Button size="sm" variant="danger" onClick={() => setConfirmClear(true)} disabled={history.length === 0} testId="clear-history">
                <Trash2 className="h-3.5 w-3.5" /> {t('common.clearAll')}
              </Button>
            </div>
          }
        >
          {t('history.count', { count: String(history.length) })}
        </SectionLabel>

        <div className="p-3">
          {history.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-8 text-center text-[12.5px] text-muted">
              {t('history.empty')}
            </p>
          ) : (
            <ul className="space-y-2" data-testid="history-list">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-line bg-surface2/40 p-3"
                  data-testid="history-item"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.side === 'long' ? 'long' : 'short'}>
                      {item.side === 'long' ? t('field.long') : t('field.short')}
                    </Badge>
                    <span className="mono text-[13px] font-semibold text-txt">
                      {t('history.qty')} {formatQty(dec(item.quantity), decimals)}
                    </span>
                    <span className="mono text-[12px] text-dim">
                      {formatPrice(dec(item.entry), decimals)} → {formatPrice(dec(item.stop), decimals)}
                    </span>
                    <span className="mono text-[12px] text-short">
                      {t('history.risk')} {formatAmount(dec(item.riskAmount), decimals)} {item.currency}
                    </span>
                    <span className="ml-auto text-[11px] text-muted">
                      {formatDateTime(item.createdAt, settings.lang)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    <span>
                      {t('field.account')} {formatAmount(dec(item.account), decimals)} {item.currency}
                    </span>
                    <span>·</span>
                    <span>
                      {t('field.riskPct')} {item.riskPct}%
                    </span>
                    <span>·</span>
                    <span>
                      {t('field.leverage')} {item.leverage}x
                    </span>
                    <div className="ml-auto flex gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => restore(item.id)}
                        testId="restore-history"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> {t('common.restore')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          deleteEntry(item.id);
                          pushToast(t('common.delete'));
                        }}
                        testId="delete-history"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {t('common.delete')}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
              testId="confirm-clear-history"
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
