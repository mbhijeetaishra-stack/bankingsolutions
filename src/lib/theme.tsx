'use client';

import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
  isDark: true,
});

const STORAGE_KEY = 'bs_theme';

export function applyThemeClass(t: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', t);
  if (t === 'light') {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }

  if (document.body) {
    document.body.setAttribute('data-theme', t);
    if (t === 'light') {
      document.body.classList.remove('dark');
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
      document.body.classList.add('dark');
    }
  }
}

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('bs_theme_change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('bs_theme_change', callback);
  };
}

function getSnapshot(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const val = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return val === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function getServerSnapshot(): Theme {
  return 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // storage quota or incognito restriction fallback
    }
    applyThemeClass(newTheme);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('bs_theme_change'));
    }
  };

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        isDark: theme === 'dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
