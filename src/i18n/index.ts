/**
 * Tiny dependency-free i18n layer.
 *
 * `t(key, params)` interpolates `{name}` placeholders. Calculation errors and
 * warnings are translated from their machine codes, so the math layer stays
 * free of prose.
 */
import type { CalcError, CalcWarning } from '../lib/calc/errors';
import { en, type Dictionary, type DictKey } from './en';
import { zh } from './zh';
import type { Lang } from '../lib/types';

export type { Dictionary, DictKey };

const DICTS: Record<Lang, Dictionary> = { en, zh };

export function interpolate(template: string, params?: Record<string, string>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? params[key] ?? match : match,
  );
}

export function translate(
  lang: Lang,
  key: DictKey,
  params?: Record<string, string>,
): string {
  const dict = DICTS[lang] ?? en;
  return interpolate(dict[key] ?? en[key] ?? key, params);
}

export function errorMessage(lang: Lang, error: CalcError): string {
  if (error.code === 'outOfRange') {
    if (error.params?.max) return translate(lang, 'err.maxValue', { value: error.params.max });
    if (error.params?.min) return translate(lang, 'err.minValue', { value: error.params.min });
  }
  return translate(lang, `err.${error.code}` as DictKey, error.params);
}

export function warningMessage(lang: Lang, warning: CalcWarning): string {
  return translate(lang, `warn.${warning.code}` as DictKey, warning.params);
}
