import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { AppProvider, useApp } from './app/state';
import { BottomNav, BrandMark, PAGES, SideNav, XIcon, X_HANDLE, X_URL, isPageKey, type PageKey } from './components/nav';
import { ToastStack } from './components/ui';
import { PositionSizePage } from './pages/PositionSize';
import { RiskRewardPage } from './pages/RiskReward';
import { TakeProfitPage } from './pages/TakeProfit';
import { FeeCalculatorPage } from './pages/FeeCalculator';
import { HistoryPage } from './pages/History';
import { SettingsPage } from './pages/Settings';

function parseHash(): PageKey {
  if (typeof window === 'undefined') return 'position';
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  return isPageKey(raw) ? raw : 'position';
}

function Shell() {
  const { t, settings, updateSettings, toasts, dismissToast } = useApp();
  const [page, setPage] = useState<PageKey>(() => parseHash());

  useEffect(() => {
    const onHashChange = () => setPage(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: PageKey) => {
    setPage(next);
    if (window.location.hash !== `#/${next}`) window.location.hash = `/${next}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const meta = PAGES.find((item) => item.key === page) ?? PAGES[0]!;
  const isDark = settings.theme === 'dark';

  return (
    <div className="min-h-dvh bg-bg text-txt">
      <div className="mx-auto flex w-full max-w-[1480px]">
        <SideNav
          page={page}
          onNavigate={navigate}
          appName={t('app.name')}
          tagline={t('app.tagline')}
          navLabel={(key) => t(key)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
            <div className="flex items-center gap-2.5 px-3 py-2.5 sm:px-4 lg:px-6 lg:py-3">
              <div className="flex items-center gap-2 lg:hidden">
                <BrandMark className="h-7 w-7" />
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[14px] font-semibold leading-tight text-txt lg:text-[15px]">
                  {t(meta.titleKey)}
                </h1>
                <p className="hidden truncate text-[11.5px] leading-tight text-muted sm:block">
                  {t(meta.subtitleKey)}
                </p>
              </div>

              {/* Author link — top-right, always visible (requirement: 𝕏 in the header) */}
              <a
                href={X_URL}
                target="_blank"
                rel="noreferrer noopener"
                data-testid="x-link-top"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface2 px-2 py-1.5 text-[11.5px] font-medium text-dim transition-colors hover:border-lineStrong hover:text-txt"
                aria-label={`${t('app.follow')} ${X_HANDLE}`}
                title={`${t('app.author')} ${X_HANDLE}`}
              >
                <XIcon className="h-3 w-3" />
                <span className="hidden sm:inline">𝕏</span>
                <span className="mono hidden md:inline">{X_HANDLE}</span>
                <span className="sm:hidden">𝕏</span>
              </a>

              <button
                type="button"
                onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
                aria-label={isDark ? t('settings.themeLight') : t('settings.themeDark')}
                data-testid="theme-toggle"
                className="shrink-0 rounded-lg border border-line bg-surface2 p-2 text-dim transition-colors hover:border-lineStrong hover:text-txt"
              >
                {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-3 pb-24 pt-3 sm:px-4 lg:px-6 lg:pb-8 lg:pt-5">
            <div className="mb-3 lg:hidden">
              <p className="text-[11.5px] leading-snug text-muted">{t(meta.subtitleKey)}</p>
            </div>

            {page === 'position' && <PositionSizePage />}
            {page === 'riskReward' && <RiskRewardPage />}
            {page === 'takeProfit' && <TakeProfitPage />}
            {page === 'fees' && <FeeCalculatorPage />}
            {page === 'history' && <HistoryPage navigate={navigate} />}
            {page === 'settings' && <SettingsPage />}
          </main>

          <footer className="border-t border-line px-3 py-4 pb-24 text-[11px] leading-relaxed text-muted sm:px-4 lg:px-6 lg:pb-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium text-dim">{t('footer.note')}</span>
              <span>{t('footer.disclaimer')}</span>
              <a
                href={X_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-dim transition-colors hover:text-txt"
              >
                <XIcon className="h-3 w-3" />
                {X_HANDLE}
              </a>
            </div>
          </footer>
        </div>
      </div>

      <BottomNav page={page} onNavigate={navigate} navLabel={(key) => t(key)} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
