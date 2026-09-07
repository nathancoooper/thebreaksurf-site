'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'tbs-theme-preference';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  const resolved = preference === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    : preference;
  root.dataset.tbsTheme = preference;
  root.dataset.tbsThemeResolved = resolved;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = stored === 'light' || stored === 'dark' ? stored : 'system';
    applyTheme(initial);
    window.setTimeout(() => {
      setPreferenceState(initial);
      setResolvedTheme(document.documentElement.dataset.tbsThemeResolved === 'dark' ? 'dark' : 'light');
    }, 0);

    const syncSystemTheme = () => {
      if ((window.localStorage.getItem(STORAGE_KEY) ?? 'system') !== 'system') return;
      applyTheme('system');
      setResolvedTheme(media.matches ? 'dark' : 'light');
    };
    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : 'system';
      applyTheme(next);
      setPreferenceState(next);
      setResolvedTheme(document.documentElement.dataset.tbsThemeResolved === 'dark' ? 'dark' : 'light');
    };
    media.addEventListener('change', syncSystemTheme);
    window.addEventListener('storage', syncStoredTheme);
    return () => {
      media.removeEventListener('change', syncSystemTheme);
      window.removeEventListener('storage', syncStoredTheme);
    };
  }, []);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    setResolvedTheme(document.documentElement.dataset.tbsThemeResolved === 'dark' ? 'dark' : 'light');
  }

  return <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>{children}</ThemeContext.Provider>;
}
