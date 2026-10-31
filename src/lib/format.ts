/**
 * Display formatting. This is the ONLY place where rounding happens.
 * Values arrive here with full 40-digit precision and leave as strings.
 */
import { Decimal } from './decimal';

const DASH = '—';

/** Fixed-point string without exponential notation, normalising "-0.00" to "0.00". */
export function toFixedPlain(value: Decimal, decimals: number): string {
  const clamped = Math.max(0, Math.min(18, Math.trunc(decimals)));
  const fixed = value.toFixed(clamped);
  const negative = fixed.startsWith('-');
  const body = negative ? fixed.slice(1) : fixed;
  if (!/[1-9]/.test(body)) return body; // -0.000 → 0.000
  return negative ? `-${body}` : body;
}

/** Insert thousands separators into a plain decimal string. */
export function groupDigits(input: string): string {
  const negative = input.startsWith('-');
  const body = negative ? input.slice(1) : input;
  const [intPart = '0', fracPart] = body.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const out = fracPart !== undefined ? `${grouped}.${fracPart}` : grouped;
  return negative ? `-${out}` : out;
}

export function trimTrailingZeros(input: string): string {
  if (!input.includes('.')) return input;
  return input.replace(/\.?0+$/, '');
}

export function formatNumber(
  value: Decimal | null | undefined,
  decimals = 2,
  opts: { group?: boolean; dash?: string } = {},
): string {
  if (!value || !value.isFinite()) return opts.dash ?? DASH;
  return groupDigits(toFixedPlain(value, decimals));
}

/** Amounts (account currency): fixed decimals + grouping. */
export function formatAmount(value: Decimal | null | undefined, decimals = 2): string {
  return formatNumber(value, decimals);
}

/** Prices: never lose the significant digits of sub-cent assets. */
export function formatPrice(value: Decimal | null | undefined, decimals = 2): string {
  if (!value || !value.isFinite()) return DASH;
  const abs = value.abs();
  let d = decimals;
  if (abs.gt(0) && abs.lt(1)) {
    // Show at least 4 significant digits, never more than 10.
    const needed = Math.max(decimals, Math.min(10, 4 - abs.e - 1));
    d = needed;
  }
  return groupDigits(toFixedPlain(value, d));
}

/** Quantities: keep enough precision for small coin amounts. */
export function formatQty(value: Decimal | null | undefined, decimals = 2): string {
  if (!value || !value.isFinite()) return DASH;
  const abs = value.abs();
  let d = decimals;
  if (abs.gt(0) && abs.lt(1)) d = Math.max(decimals, Math.min(10, 6));
  return groupDigits(toFixedPlain(value, d));
}

export function formatPercent(value: Decimal | null | undefined, decimals = 2): string {
  if (!value || !value.isFinite()) return DASH;
  return `${groupDigits(toFixedPlain(value, decimals))}%`;
}

/** "1:2", "1:2.5", "1:0.35" — trailing zeros removed for readability. */
export function formatRatio(value: Decimal | null | undefined): string {
  if (!value || !value.isFinite()) return DASH;
  if (value.isZero()) return '1:0';
  const fixed = value.toFixed(4);
  return `1:${trimTrailingZeros(fixed)}`;
}

/** Signed amount, e.g. "+1,204.50" / "-88.20". */
export function formatSigned(value: Decimal | null | undefined, decimals = 2): string {
  if (!value || !value.isFinite()) return DASH;
  const shown = toFixedPlain(value, decimals);
  if (!/[1-9]/.test(shown)) return shown;
  return value.gt(0) ? `+${groupDigits(shown)}` : groupDigits(shown);
}

export function formatDateTime(iso: string, lang: 'en' | 'zh'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return DASH;
  try {
    return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** Clamp helper used by the leverage/decimals steppers. */
export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Parse a stored string back into a Decimal for display; null when unusable. */
export function dec(value: string | Decimal | null | undefined): Decimal | null {
  if (value instanceof Decimal) return value.isFinite() ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const parsed = new Decimal(value.trim());
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}
