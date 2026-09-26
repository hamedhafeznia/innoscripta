import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/** Separate from the feed preferences: this is how the app looks, not what it shows. */
export const useTheme = create<ThemeStore>()(
  persist((set) => ({ theme: 'system', setTheme: (theme) => set({ theme }) }), {
    name: 'innoscripta.theme',
    version: 1,
    partialize: ({ theme }) => ({ theme }),
  }),
);

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

/**
 * Applies the theme to `<html>`. `color-scheme` is set alongside the class so the
 * browser's own chrome (scrollbars, form controls, the address bar) follows too;
 * a dark page with a light scrollbar is the usual tell of a half-done dark mode.
 */
export function useApplyTheme() {
  const theme = useTheme((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && prefersDark());
      root.classList.toggle('dark', dark);
      root.style.colorScheme = dark ? 'dark' : 'light';
    };

    apply();

    // `system` is the default, so this path runs for everyone: guarded rather than
    // assumed, because an environment without matchMedia must still render a themed page.
    if (theme !== 'system' || !window.matchMedia) return;

    // Following the system means following it as it changes, not only at load.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
