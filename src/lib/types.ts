/**
 * Shared domain types.
 *
 * RiskCalc deliberately keeps every user-facing numeric value as a *string*.
 * Parsing happens exactly once, through `parseDecimal` in `lib/calc/parse.ts`,
 * so that no value ever round-trips through IEEE-754 binary floats.
 */

export type Side = 'long' | 'short';

export const CURRENCIES = ['USDT', 'USDC', 'USD', 'BTC', 'ETH'] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Lang = 'en' | 'zh';
export type Theme = 'dark' | 'light';

/** How trading fees are resolved into concrete opener/closer rates. */
export type FeeMode = 'taker' | 'maker' | 'custom';

export interface FeeConfig {
  mode: FeeMode;
  /** Maker fee, in percent (e.g. "0.02" means 0.02%). */
  makerRate: string;
  /** Taker fee, in percent. */
  takerRate: string;
  /** Custom open fee, in percent. Used when mode === 'custom'. */
  openRate: string;
  /** Custom close fee, in percent. Used when mode === 'custom'. */
  closeRate: string;
  /** Whether fees are part of the calculations. */
  include: boolean;
}

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  mode: 'taker',
  makerRate: '0.02',
  takerRate: '0.05',
  openRate: '0.05',
  closeRate: '0.05',
  include: true,
};

/** Resolve the effective open/close rates (in percent) for a fee config. */
export function resolveFeeRates(fees: FeeConfig): { openPct: string; closePct: string } {
  if (fees.mode === 'maker') return { openPct: fees.makerRate, closePct: fees.makerRate };
  if (fees.mode === 'taker') return { openPct: fees.takerRate, closePct: fees.takerRate };
  return { openPct: fees.openRate, closePct: fees.closeRate };
}

export interface ScaleOutTarget {
  id: string;
  /** Exit price for this leg. */
  price: string;
  /** Percentage of the *position* closed at this leg (0-100). */
  pct: string;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  side: Side;
  currency: Currency;
  account: string;
  riskPct: string;
  entry: string;
  stop: string;
  leverage: string;
  quantity: string;
  notional: string;
  riskAmount: string;
  feeConfig: FeeConfig;
}

export interface Settings {
  lang: Lang;
  theme: Theme;
  currency: Currency;
  riskPct: string;
  leverage: string;
  decimals: number;
  feeConfig: FeeConfig;
  /** Optional manual FX conversion, disabled by default (never guessed). */
  conversion: {
    enabled: boolean;
    from: Currency;
    to: Currency;
    rate: string;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'zh',
  theme: 'dark',
  currency: 'USDT',
  riskPct: '1',
  leverage: '10',
  decimals: 2,
  feeConfig: DEFAULT_FEE_CONFIG,
  conversion: { enabled: false, from: 'USDT', to: 'USD', rate: '' },
};
