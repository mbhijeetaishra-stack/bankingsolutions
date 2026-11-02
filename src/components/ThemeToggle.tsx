'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme';

interface ThemeToggleProps {
  variant?: 'switch' | 'sidebar' | 'icon-only';
  className?: string;
}

export default function ThemeToggle({ variant = 'switch', className = '' }: ThemeToggleProps) {
  const { toggleTheme, isDark } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR or before hydration, default to dark to match initial server HTML
  const activeDark = mounted ? isDark : true;

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${activeDark ? 'Light' : 'Dark'} Mode`}
        title={`Switch to ${activeDark ? 'Light' : 'Dark'} Mode`}
        className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between border bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-white border-white/[0.06] cursor-pointer group select-none ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm shrink-0 transition-transform group-hover:scale-110">
            {activeDark ? '🌙' : '☀️'}
          </span>
          <span className="truncate">{activeDark ? 'Dark Mode' : 'Light Mode'}</span>
        </div>

        {/* Animated Pill Switch */}
        <div
          className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 flex items-center ${
            activeDark ? 'bg-slate-800 border border-amber-400/30' : 'bg-amber-400 border border-amber-500'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center text-[9px] ${
              activeDark ? 'translate-x-0 bg-slate-200 text-slate-900' : 'translate-x-5 bg-slate-950 text-amber-300'
            }`}
          >
            {activeDark ? '🌙' : '☀️'}
          </div>
        </div>
      </button>
    );
  }

  if (variant === 'icon-only') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${activeDark ? 'Light' : 'Dark'} Mode`}
        title={`Switch to ${activeDark ? 'Light' : 'Dark'} Mode`}
        className={`w-8 h-8 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] hover:border-amber-400/40 text-sm flex items-center justify-center transition shadow-sm cursor-pointer select-none ${className}`}
      >
        <span>{activeDark ? '🌙' : '☀️'}</span>
      </button>
    );
  }

  // Default: Compact Pill Toggle Switch
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${activeDark ? 'Light' : 'Dark'} Mode`}
        title={`Currently in ${activeDark ? 'Dark' : 'Light'} Mode. Click to toggle.`}
        className={`relative inline-flex items-center h-8 w-14 rounded-full transition-colors duration-300 focus:outline-none p-1 border cursor-pointer select-none ${
          activeDark
            ? 'bg-slate-900/90 border-white/[0.12] hover:border-amber-400/50'
            : 'bg-amber-100 border-amber-400/50 hover:border-amber-500'
        }`}
      >
        {/* Background Icons */}
        <span className="absolute left-1.5 text-[11px] text-amber-500 pointer-events-none">
          ☀️
        </span>
        <span className="absolute right-1.5 text-[11px] text-slate-400 pointer-events-none">
          🌙
        </span>

        {/* Sliding Thumb Knob */}
        <span
          className={`w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ease-in-out flex items-center justify-center text-xs shrink-0 z-10 ${
            activeDark
              ? 'translate-x-6 bg-slate-800 text-amber-300 border border-white/[0.1]'
              : 'translate-x-0 bg-white text-slate-900 border border-amber-300'
          }`}
        >
          {activeDark ? '🌙' : '☀️'}
        </span>
      </button>
    </div>
  );
}
