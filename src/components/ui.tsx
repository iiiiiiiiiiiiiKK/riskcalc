import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import { AlertTriangle, Check, ChevronDown, Info, X } from 'lucide-react';

export const cx = clsx;

/* ------------------------------------------------------------------ layout */

export function Card({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return <Tag className={cx('card shadow-panel', className)}>{children}</Tag>;
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {children}
      </span>
      {right}
    </div>
  );
}

/* ----------------------------------------------------------------- buttons */

type ButtonVariant = 'primary' | 'subtle' | 'ghost' | 'danger' | 'success';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent/90 border border-accent/50 shadow-[0_6px_18px_-10px_rgb(var(--c-accent))]',
  subtle: 'bg-surface2 text-txt border border-line hover:border-lineStrong hover:bg-line/40',
  ghost: 'text-dim hover:text-txt hover:bg-line/40 border border-transparent',
  danger: 'bg-short/10 text-short border border-short/30 hover:bg-short/20',
  success: 'bg-long/10 text-long border border-long/30 hover:bg-long/20',
};

export function Button({
  variant = 'subtle',
  size = 'md',
  className,
  children,
  testId,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        BUTTON_STYLES[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ inputs */

export function NumberInput({
  label,
  value,
  onChange,
  unit,
  error,
  hint,
  placeholder,
  inputMode = 'decimal',
  testId,
  disabled,
  className,
  right,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  unit?: ReactNode;
  error?: string;
  hint?: ReactNode;
  placeholder?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  testId?: string;
  disabled?: boolean;
  className?: string;
  right?: ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={cx('min-w-0', className)}>
      {(label || right) && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
              {label}
            </label>
          )}
          {right}
        </div>
      )}
      <div
        className={cx(
          'flex items-stretch overflow-hidden rounded-lg border bg-surface2 transition-colors',
          error
            ? 'border-short/60 focus-within:border-short'
            : 'border-line focus-within:border-accent/70',
          disabled && 'opacity-60',
        )}
      >
        <input
          id={id}
          data-testid={testId}
          className="field-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
        />
        {unit && (
          <span className="flex shrink-0 items-center border-l border-line/70 px-2.5 text-[11px] font-medium uppercase tracking-wide text-muted">
            {unit}
          </span>
        )}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1 text-xs text-short">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  testId,
  className,
}: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  testId?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx('min-w-0', className)}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center rounded-lg border border-line bg-surface2 focus-within:border-accent/70">
        <select
          id={id}
          data-testid={testId}
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          className="w-full appearance-none bg-transparent px-3 py-2.5 pr-8 text-[14px] font-medium text-txt focus:outline-none"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-surface text-txt">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted" aria-hidden />
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel,
  testIdPrefix,
}: {
  options: { value: T; label: ReactNode; tone?: 'long' | 'short' }[];
  value: T;
  onChange: (next: T) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  testIdPrefix?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-lg border border-line bg-surface2 p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={testIdPrefix ? `${testIdPrefix}-${option.value}` : undefined}
            onClick={() => onChange(option.value)}
            className={cx(
              'flex-1 rounded-md text-center font-medium transition-colors',
              size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-[13px]',
              active
                ? option.tone === 'long'
                  ? 'bg-long/15 text-long'
                  : option.tone === 'short'
                    ? 'bg-short/15 text-short'
                    : 'bg-line text-txt'
                : 'text-dim hover:text-txt',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  testId,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cx(
        'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
        active
          ? 'border-accent/60 bg-accent/15 text-accent'
          : 'border-line bg-surface2 text-dim hover:border-lineStrong hover:text-txt',
      )}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  testId?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-txt">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : undefined}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors',
          checked ? 'border-accent/60 bg-accent/80' : 'border-line bg-line/70',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}

/* ------------------------------------------------------------------- stats */

export function Stat({
  label,
  value,
  unit,
  tone,
  hint,
  testId,
  emphasis,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  tone?: 'long' | 'short' | 'accent' | 'plain';
  hint?: ReactNode;
  testId?: string;
  emphasis?: boolean;
}) {
  const toneClass =
    tone === 'long'
      ? 'text-long'
      : tone === 'short'
        ? 'text-short'
        : tone === 'accent'
          ? 'text-accent'
          : 'text-txt';
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 py-2 last:border-b-0">
      <span className="text-[12.5px] leading-tight text-dim">{label}</span>
      <span className="shrink-0 text-right">
        <span
          data-testid={testId}
          className={cx(
            'mono font-semibold',
            emphasis ? 'text-[17px]' : 'text-[14.5px]',
            toneClass,
          )}
        >
          {value}
        </span>
        {unit && <span className="ml-1 text-[10.5px] uppercase tracking-wide text-muted">{unit}</span>}
        {hint && <span className="block text-[11px] text-muted">{hint}</span>}
      </span>
    </div>
  );
}

export function HeroStat({
  label,
  value,
  unit,
  sub,
  tone = 'plain',
  testId,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  tone?: 'plain' | 'long' | 'short';
  testId?: string;
}) {
  const toneClass =
    tone === 'long' ? 'text-long' : tone === 'short' ? 'text-short' : 'text-txt';
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          data-testid={testId}
          className={cx('mono text-[clamp(26px,6vw,34px)] font-semibold leading-none', toneClass)}
        >
          {value}
        </span>
        {unit && <span className="text-[12px] uppercase tracking-wide text-muted">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-dim">{sub}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- notices */

export function ErrorList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1.5" role="alert">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-1.5 text-xs text-short">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function NoticeList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-1.5 text-xs text-warn">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'long' | 'short' | 'accent';
}) {
  const styles =
    tone === 'long'
      ? 'border-long/30 bg-long/10 text-long'
      : tone === 'short'
        ? 'border-short/30 bg-short/10 text-short'
        : tone === 'accent'
          ? 'border-accent/30 bg-accent/10 text-accent'
          : 'border-line bg-surface2 text-dim';
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide',
        styles,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------- modal */

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-md animate-toastIn rounded-xl border border-line bg-surface p-4 shadow-pop focus:outline-none"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-txt">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted transition-colors hover:bg-line/50 hover:text-txt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="text-[13px] leading-relaxed text-dim">{children}</div>
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ toasts */

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: { id: string; text: string; tone: 'ok' | 'error' }[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => onDismiss(toast.id)}
          className={cx(
            'pointer-events-auto flex max-w-sm animate-toastIn items-center gap-2 rounded-lg border px-3 py-2 text-[13px] shadow-pop backdrop-blur',
            toast.tone === 'error'
              ? 'border-short/40 bg-short/15 text-short'
              : 'border-long/40 bg-long/15 text-long',
          )}
        >
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="text-left">{toast.text}</span>
        </button>
      ))}
    </div>
  );
}
