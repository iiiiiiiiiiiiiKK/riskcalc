/**
 * Calculation history: newest first, capped, stored locally only.
 */
import { readJson, writeJson, STORAGE_KEYS } from './storage';
import type { HistoryEntry } from './types';

const MAX_ENTRIES = 100;

export function loadHistory(): HistoryEntry[] {
  const raw = readJson<unknown>(STORAGE_KEYS.history, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isHistoryEntry).slice(0, MAX_ENTRIES);
}

export function saveHistory(entries: HistoryEntry[]): boolean {
  return writeJson(STORAGE_KEYS.history, entries.slice(0, MAX_ENTRIES));
}

export function addHistoryEntry(entries: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...entries.filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES);
  saveHistory(next);
  return next;
}

export function removeHistoryEntry(entries: HistoryEntry[], id: string): HistoryEntry[] {
  const next = entries.filter((e) => e.id !== id);
  saveHistory(next);
  return next;
}

export function clearHistory(): HistoryEntry[] {
  saveHistory([]);
  return [];
}

/** Pretty JSON payload for the export button. */
export function historyToJson(entries: HistoryEntry[]): string {
  return JSON.stringify(
    {
      app: 'RiskCalc',
      exportedAt: new Date().toISOString(),
      count: entries.length,
      calculations: entries,
    },
    null,
    2,
  );
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.createdAt === 'string' &&
    (v.side === 'long' || v.side === 'short') &&
    typeof v.entry === 'string' &&
    typeof v.stop === 'string' &&
    typeof v.quantity === 'string' &&
    typeof v.riskAmount === 'string'
  );
}

export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
