/**
 * Namespaced localStorage helpers. Every access is guarded: browsers can throw
 * (private mode, disabled storage, quota) and the app must keep working.
 */
const PREFIX = 'riskcalc.v1.';

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): boolean {
  try {
    window.localStorage.removeItem(PREFIX + key);
    return true;
  } catch {
    return false;
  }
}

export const STORAGE_KEYS = {
  settings: 'settings',
  history: 'history',
  trade: 'trade',
} as const;
