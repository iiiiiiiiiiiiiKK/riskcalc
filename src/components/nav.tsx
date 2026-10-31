import clsx from 'clsx';
import {
  Calculator,
  History,
  Percent,
  Settings,
  Target,
  Gauge,
  type LucideIcon,
} from 'lucide-react';
import type { DictKey } from '../i18n';

export type PageKey = 'position' | 'riskReward' | 'takeProfit' | 'fees' | 'history' | 'settings';

export const PAGES: {
  key: PageKey;
  icon: LucideIcon;
  labelKey: DictKey;
  titleKey: DictKey;
  subtitleKey: DictKey;
}[] = [
  {
    key: 'position',
    icon: Calculator,
    labelKey: 'nav.position',
    titleKey: 'page.position.title',
    subtitleKey: 'page.position.subtitle',
  },
  {
    key: 'riskReward',
    icon: Gauge,
    labelKey: 'nav.riskReward',
    titleKey: 'page.riskReward.title',
    subtitleKey: 'page.riskReward.subtitle',
  },
  {
    key: 'takeProfit',
    icon: Target,
    labelKey: 'nav.takeProfit',
    titleKey: 'page.takeProfit.title',
    subtitleKey: 'page.takeProfit.subtitle',
  },
  {
    key: 'fees',
    icon: Percent,
    labelKey: 'nav.fees',
    titleKey: 'page.fees.title',
    subtitleKey: 'page.fees.subtitle',
  },
  {
    key: 'history',
    icon: History,
    labelKey: 'nav.history',
    titleKey: 'page.history.title',
    subtitleKey: 'page.history.subtitle',
  },
  {
    key: 'settings',
    icon: Settings,
    labelKey: 'nav.settings',
    titleKey: 'page.settings.title',
    subtitleKey: 'page.settings.subtitle',
  },
];

export function isPageKey(value: string | undefined): value is PageKey {
  return !!value && PAGES.some((page) => page.key === value);
}

export const X_URL = 'https://x.com/0xkillcoin';
export const X_HANDLE = '@0xkillcoin';

export function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="currentColor"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** Circular brand mark: a risk bracket around a percentage. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-lineStrong bg-surface2 text-accent',
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M4 9V5.6C4 4.7 4.7 4 5.6 4H9" strokeLinecap="round" />
        <path d="M15 4h3.4c.9 0 1.6.7 1.6 1.6V9" strokeLinecap="round" />
        <path d="M20 15v3.4c0 .9-.7 1.6-1.6 1.6H15" strokeLinecap="round" />
        <path d="M9 20H5.6C4.7 20 4 19.3 4 18.4V15" strokeLinecap="round" />
        <path d="M9.2 14.8 14.8 9.2" strokeLinecap="round" />
        <circle cx="9.6" cy="9.6" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="14.4" cy="14.4" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

export function SideNav({
  page,
  onNavigate,
  appName,
  tagline,
  navLabel,
}: {
  page: PageKey;
  onNavigate: (page: PageKey) => void;
  appName: string;
  tagline: string;
  navLabel: (key: DictKey) => string;
}) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface/40 px-3 py-4 lg:flex">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <BrandMark />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold leading-tight text-txt">{appName}</div>
          <div className="truncate text-[11px] leading-tight text-muted">{tagline}</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5" aria-label="Main">
        {PAGES.map(({ key, icon: Icon, labelKey }) => {
          const active = key === page;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              aria-current={active ? 'page' : undefined}
              data-testid={`nav-${key}`}
              className={clsx(
                'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-accent/12 text-accent'
                  : 'text-dim hover:bg-line/40 hover:text-txt',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span>{navLabel(labelKey)}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto px-2 pt-4">
        <a
          href={X_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-2 rounded-lg border border-line bg-surface2 px-2.5 py-2 text-[12px] font-medium text-dim transition-colors hover:border-lineStrong hover:text-txt"
        >
          <XIcon className="h-3.5 w-3.5" />
          <span className="truncate">{X_HANDLE}</span>
        </a>
      </div>
    </aside>
  );
}

export function BottomNav({
  page,
  onNavigate,
  navLabel,
}: {
  page: PageKey;
  onNavigate: (page: PageKey) => void;
  navLabel: (key: DictKey) => string;
}) {
  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-between gap-0.5 border-t border-line bg-surface/95 px-1 pt-1 backdrop-blur lg:hidden"
      aria-label="Main"
    >
      {PAGES.map(({ key, icon: Icon, labelKey }) => {
        const active = key === page;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            aria-current={active ? 'page' : undefined}
            data-testid={`mobile-nav-${key}`}
            className={clsx(
              'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-0.5 py-1.5 text-[10px] font-medium transition-colors',
              active ? 'text-accent' : 'text-muted',
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
            <span className="w-full truncate text-center leading-tight">{navLabel(labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
