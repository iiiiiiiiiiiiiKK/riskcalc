/**
 * Single application store: settings, the current trade draft, local history and
 * transient toasts. Persisted slices are written back to localStorage on change.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_SETTINGS,
  resolveFeeRates,
  type Currency,
  type FeeConfig,
  type HistoryEntry,
  type ScaleOutTarget,
  type Settings,
  type Side,
} from '../lib/types';
import { readJson, writeJson, STORAGE_KEYS } from '../lib/storage';
import {
  clearHistory as clearHistoryStore,
  loadHistory,
  removeHistoryEntry,
  addHistoryEntry,
  newId,
} from '../lib/history';
import { errorMessage, translate, warningMessage, type DictKey } from '../i18n';
import type { CalcError, CalcWarning } from '../lib/calc/errors';

export interface TradeState {
  side: Side;
  account: string;
  riskPct: string;
  entry: string;
  stop: string;
  leverage: string;
  tpPrice: string;
  feeConfig: FeeConfig;
  targets: ScaleOutTarget[];
  /** Optional manual quantity override on the take-profit page. */
  quantityOverride: string;
}

export const DEFAULT_TRADE: TradeState = {
  side: 'long',
  account: '10000',
  riskPct: '1',
  entry: '105000',
  stop: '103500',
  leverage: '10',
  tpPrice: '',
  feeConfig: DEFAULT_SETTINGS.feeConfig,
  targets: [],
  quantityOverride: '',
};

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'ok' | 'error';
}

interface AppContextValue {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  trade: TradeState;
  updateTrade: (patch: Partial<TradeState>) => void;
  resetTrade: () => void;
  t: (key: DictKey, params?: Record<string, string>) => string;
  em: (error: CalcError) => string;
  wm: (warning: CalcWarning) => string;
  currency: Currency;
  feeRates: { openPct: string; closePct: string };
  history: HistoryEntry[];
  saveEntry: (entry: HistoryEntry) => void;
  deleteEntry: (id: string) => void;
  clearHistory: () => void;
  toasts: ToastMessage[];
  pushToast: (text: string, tone?: 'ok' | 'error') => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function mergeSettings(stored: unknown): Settings {
  if (typeof stored !== 'object' || stored === null) return DEFAULT_SETTINGS;
  const s = stored as Partial<Settings> & { feeConfig?: Partial<FeeConfig> };
  const conversion = { ...DEFAULT_SETTINGS.conversion, ...(s.conversion ?? {}) };
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    feeConfig: { ...DEFAULT_SETTINGS.feeConfig, ...(s.feeConfig ?? {}) },
    conversion,
    decimals:
      typeof s.decimals === 'number' && s.decimals >= 0 && s.decimals <= 8
        ? Math.trunc(s.decimals)
        : DEFAULT_SETTINGS.decimals,
  };
}

function mergeTrade(stored: unknown, settings: Settings): TradeState {
  if (typeof stored !== 'object' || stored === null) {
    return {
      ...DEFAULT_TRADE,
      feeConfig: settings.feeConfig,
      riskPct: settings.riskPct,
      leverage: settings.leverage,
    };
  }
  const s = stored as Partial<TradeState> & { feeConfig?: Partial<FeeConfig> };
  return {
    ...DEFAULT_TRADE,
    ...s,
    feeConfig: { ...settings.feeConfig, ...(s.feeConfig ?? {}) },
    targets: Array.isArray(s.targets) ? s.targets.filter((x) => x && typeof x === 'object') : [],
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() =>
    mergeSettings(readJson<unknown>(STORAGE_KEYS.settings, null)),
  );
  const [trade, setTrade] = useState<TradeState>(() =>
    mergeTrade(readJson<unknown>(STORAGE_KEYS.trade, null), settings),
  );
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Persist settings / draft.
  useEffect(() => {
    writeJson(STORAGE_KEYS.settings, settings);
  }, [settings]);

  useEffect(() => {
    writeJson(STORAGE_KEYS.trade, trade);
  }, [trade]);

  // Theme + language side effects on <html>.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', settings.theme === 'light');
    root.lang = settings.lang === 'zh' ? 'zh-CN' : 'en';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', settings.theme === 'light' ? '#f5f7fa' : '#07080b');
  }, [settings.theme, settings.lang]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const pushToast = useCallback(
    (text: string, tone: 'ok' | 'error' = 'ok') => {
      const id = newId();
      setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
      timers.current[id] = setTimeout(() => dismissToast(id), 2800);
    },
    [dismissToast],
  );

  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
    },
    [],
  );

  const t = useCallback(
    (key: DictKey, params?: Record<string, string>) => translate(settings.lang, key, params),
    [settings.lang],
  );

  const em = useCallback(
    (error: CalcError) => errorMessage(settings.lang, error),
    [settings.lang],
  );

  const wm = useCallback(
    (warning: CalcWarning) => warningMessage(settings.lang, warning),
    [settings.lang],
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const updateTrade = useCallback((patch: Partial<TradeState>) => {
    setTrade((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetTrade = useCallback(() => {
    setTrade({
      ...DEFAULT_TRADE,
      feeConfig: settings.feeConfig,
      riskPct: settings.riskPct,
      leverage: settings.leverage,
    });
  }, [settings.feeConfig, settings.riskPct, settings.leverage]);

  const saveEntry = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => addHistoryEntry(prev, entry));
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setHistory((prev) => removeHistoryEntry(prev, id));
  }, []);

  const clearAllHistory = useCallback(() => {
    setHistory(clearHistoryStore());
  }, []);

  const feeRates = useMemo(() => resolveFeeRates(trade.feeConfig), [trade.feeConfig]);

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      updateSettings,
      resetSettings,
      trade,
      updateTrade,
      resetTrade,
      t,
      em,
      wm,
      currency: settings.currency,
      feeRates,
      history,
      saveEntry,
      deleteEntry,
      clearHistory: clearAllHistory,
      toasts,
      pushToast,
      dismissToast,
    }),
    [
      settings,
      updateSettings,
      resetSettings,
      trade,
      updateTrade,
      resetTrade,
      t,
      em,
      wm,
      feeRates,
      history,
      saveEntry,
      deleteEntry,
      clearAllHistory,
      toasts,
      pushToast,
      dismissToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
