import { useMemo } from 'react';
import { Decimal } from '../lib/decimal';
import { formatPrice } from '../lib/format';
import { cx } from './ui';

/**
 * Visual price map: stop ▸ entry ▸ take-profit.
 * Purely presentational — geometry uses floats, the numbers shown are the
 * exact Decimal strings passed in.
 */
export function TradeLevelBar({
  side,
  entry,
  stop,
  takeProfit,
  labels,
  decimals = 2,
}: {
  side: 'long' | 'short';
  entry: Decimal | null;
  stop: Decimal | null;
  takeProfit: Decimal | null;
  labels: { stop: string; entry: string; takeProfit: string; risk: string; reward: string };
  decimals?: number;
}) {
  const geometry = useMemo(() => {
    if (!entry || !stop || !takeProfit || !entry.isFinite() || !stop.isFinite() || !takeProfit.isFinite()) {
      return null;
    }
    const e = entry.toNumber();
    const s = stop.toNumber();
    const t = takeProfit.toNumber();
    const values = [e, s, t];
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) return null;
    const span = max - min;
    const pad = span * 0.08;
    const lo = min - pad;
    const hi = max + pad;
    const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
    const start = Math.min(pos(s), pos(t));
    const end = Math.max(pos(s), pos(t));
    return {
      entryX: pos(e),
      stopX: pos(s),
      tpX: pos(t),
      zoneLeft: start,
      zoneWidth: Math.max(0.5, end - start),
      riskWidth: Math.abs(pos(e) - pos(s)),
      rewardWidth: Math.abs(pos(t) - pos(e)),
      riskFrom: Math.min(pos(e), pos(s)),
      rewardFrom: Math.min(pos(e), pos(t)),
    };
  }, [entry, stop, takeProfit]);

  if (!geometry || !entry || !stop || !takeProfit) {
    return (
      <div className="flex h-[86px] items-center justify-center rounded-lg border border-dashed border-line text-[11px] text-muted">
        {labels.risk} / {labels.reward}
      </div>
    );
  }

  const stopValue: Decimal = stop;
  const entryValue: Decimal = entry;
  const takeProfitValue: Decimal = takeProfit;

  const tick = (x: number, label: string, value: Decimal, tone: string) => (
    <div
      className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-center"
      style={{ left: `${Math.min(96, Math.max(4, x))}%` }}
    >
      <div className={cx('text-[10px] font-medium uppercase tracking-wide', tone)}>{label}</div>
      <div className="mono text-[11px] text-txt">{formatPrice(value, decimals)}</div>
    </div>
  );

  return (
    <div className="px-1">
      <div className="relative h-[54px]">
        {tick(geometry.stopX, labels.stop, stopValue, 'text-short')}
        {tick(geometry.entryX, labels.entry, entryValue, 'text-dim')}
        {tick(geometry.tpX, labels.takeProfit, takeProfitValue, 'text-long')}
        <div className="absolute inset-x-0 bottom-2 h-1.5 rounded-full bg-line" />
        <div
          className="absolute bottom-2 h-1.5 rounded-l-full bg-short/45"
          style={{ left: `${geometry.riskFrom}%`, width: `${geometry.riskWidth}%` }}
        />
        <div
          className="absolute bottom-2 h-1.5 rounded-r-full bg-long/45"
          style={{ left: `${geometry.rewardFrom}%`, width: `${geometry.rewardWidth}%` }}
        />
        <div
          className="absolute bottom-[3px] h-3.5 w-0.5 rounded-full bg-txt"
          style={{ left: `${geometry.entryX}%` }}
        />
        <div
          className="absolute bottom-[3px] h-3.5 w-0.5 rounded-full bg-short"
          style={{ left: `${geometry.stopX}%` }}
        />
        <div
          className="absolute bottom-[3px] h-3.5 w-0.5 rounded-full bg-long"
          style={{ left: `${geometry.tpX}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10.5px] text-muted">
        <span>{side === 'long' ? '← risk' : 'reward →'}</span>
        <span>{side === 'long' ? 'reward →' : '← risk'}</span>
      </div>
    </div>
  );
}
