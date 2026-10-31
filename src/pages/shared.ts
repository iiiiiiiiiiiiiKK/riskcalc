import { useMemo } from 'react';
import { useApp } from '../app/state';
import { computePosition, takeProfitPriceForRR } from '../lib/calc/position';
import type { CalcError, FieldKey } from '../lib/calc/errors';

/** Compute the position for the current trade draft (shared by several pages). */
export function usePosition() {
  const { trade } = useApp();
  return useMemo(
    () =>
      computePosition({
        account: trade.account,
        riskPct: trade.riskPct,
        entry: trade.entry,
        stop: trade.stop,
        side: trade.side,
        leverage: trade.leverage,
        feeConfig: trade.feeConfig,
      }),
    [trade],
  );
}

/** First error message recorded for a given input field. */
export function useFieldError() {
  const { em } = useApp();
  return (errors: CalcError[], field: FieldKey): string | undefined => {
    const match = errors.find((error) => error.field === field);
    return match ? em(match) : undefined;
  };
}

/** 2R reference target used by the visual price map. */
export function useTwoRTarget() {
  const { trade } = useApp();
  const position = usePosition();
  return useMemo(() => {
    if (!position.ok) return null;
    return takeProfitPriceForRR(
      trade.side,
      position.value.entry,
      position.value.stop,
      position.value.entry.mul(0).plus(2),
    );
  }, [position, trade.side]);
}
