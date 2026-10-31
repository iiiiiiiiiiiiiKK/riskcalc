/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-panel) / <alpha-value>)',
        surface2: 'rgb(var(--c-panel-2) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        lineStrong: 'rgb(var(--c-line-strong) / <alpha-value>)',
        txt: 'rgb(var(--c-text) / <alpha-value>)',
        dim: 'rgb(var(--c-dim) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        long: 'rgb(var(--c-long) / <alpha-value>)',
        short: 'rgb(var(--c-short) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Noto Sans SC',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'SFMono-Regular',
          'ui-monospace',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgb(var(--c-line) / 0.6) inset, 0 18px 40px -28px rgba(0,0,0,0.85)',
        pop: '0 24px 60px -24px rgba(0,0,0,0.65)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        toastIn: {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 180ms ease-out',
        toastIn: 'toastIn 200ms ease-out',
      },
    },
  },
  plugins: [],
};
