'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const DISMISS_KEY = 'bs_pwa_banner_dismissed_v1';

export default function PwaAppExperience() {
  const pathname = usePathname() || '/';
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isIos, setIsIos] = useState(false);

  // Hide mobile bottom bar & floating banner inside active Mock Test window so exam controls are unobstructed
  const isExamAttemptRoute =
    pathname.startsWith('/mock-test/') && !pathname.endsWith('/result');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Register Service Worker for PWA installability
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('SW registration skipped:', err));
    }

    // 2. Check if already running as installed standalone app
    const standaloneMatch =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standaloneMatch);

    // 3. Check if iOS device
    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(iosDevice);

    const wasDismissed = localStorage.getItem(DISMISS_KEY) === 'true';
    if (!standaloneMatch && !wasDismissed) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (localStorage.getItem(DISMISS_KEY) !== 'true') {
        setShowBanner(true);
      }
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setShowBanner(false);
      setShowInstallModal(false);
      setDeferredPrompt(null);
    };

    const handleManualTrigger = () => {
      if (deferredPrompt) {
        triggerNativeInstall();
      } else {
        setShowInstallModal(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('bs-open-pwa-install', handleManualTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('bs-open-pwa-install', handleManualTrigger);
    };
  }, [deferredPrompt]);

  const triggerNativeInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      setShowInstallModal(true);
    }
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch (e) {}
  };

  if (isExamAttemptRoute) {
    return null;
  }

  const navItems = [
    { href: '/', label: 'Home', icon: '🏠', match: (p: string) => p === '/' },
    {
      href: '/tests',
      label: 'Mocks',
      icon: '🚀',
      match: (p: string) => p.startsWith('/tests') || p.startsWith('/mock-test'),
    },
    {
      href: '/notebook',
      label: 'Vault',
      icon: '🔖',
      match: (p: string) => p.startsWith('/notebook'),
    },
    {
      href: '/calc-lab',
      label: 'Calc Lab',
      icon: '⚡',
      match: (p: string) => p.startsWith('/calc-lab'),
    },
    {
      href: '/profile',
      label: 'My Hub',
      icon: '📊',
      match: (p: string) => p.startsWith('/profile'),
    },
  ];

  return (
    <>
      {/* ==================== FLOATING "INSTALL APP" PROMPT BANNER ==================== */}
      {!isStandalone && showBanner && (
        <div className="fixed bottom-20 md:bottom-5 right-4 left-4 md:left-auto md:w-[410px] z-40 bg-slate-900/95 backdrop-blur-2xl border border-amber-400/40 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.75)] animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white p-1 shrink-0 shadow-md border border-slate-200 flex items-center justify-center">
                <img
                  src="/channel-logo.png"
                  alt="BankingSolutions App"
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                    📲 Official Web App
                  </span>
                </div>
                <h4 className="text-xs sm:text-sm font-black text-white mt-0.5">
                  Install BankingSolutions App
                </h4>
                <p className="text-[11px] text-slate-400">
                  1-tap access to Mocks, Mistake Vault &amp; Daily Quizzes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={triggerNativeInstall}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition"
              >
                Install
              </button>
              <button
                type="button"
                onClick={handleDismissBanner}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold flex items-center justify-center transition"
                aria-label="Dismiss install banner"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== STEP-BY-STEP "ADD TO HOME SCREEN" MODAL ==================== */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-amber-400/35 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold flex items-center justify-center"
            >
              ✕
            </button>

            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-lg shrink-0">
                <img
                  src="/channel-logo.png"
                  alt="BankingSolutions"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                  Progressive Web App (PWA)
                </span>
                <h3 className="text-lg font-black text-white">
                  Install BankingSolutions App
                </h3>
                <p className="text-xs text-slate-400">
                  Full-screen exam experience • Zero Play Store storage bloat
                </p>
              </div>
            </div>

            {isIos ? (
              <div className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-4 space-y-3 text-xs text-slate-300">
                <p className="font-black text-amber-300 uppercase tracking-wider text-[11px]">
                  🍎 How to Install on iPhone / iPad (Safari):
                </p>
                <ol className="space-y-2.5 list-decimal list-inside">
                  <li>
                    Tap the <strong className="text-white">Share</strong> button{' '}
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">
                      [↑]
                    </span>{' '}
                    at the bottom of Safari.
                  </li>
                  <li>
                    Scroll down and tap{' '}
                    <strong className="text-white">&ldquo;Add to Home Screen&rdquo;</strong>.
                  </li>
                  <li>
                    Tap <strong className="text-emerald-400">&ldquo;Add&rdquo;</strong> in the top
                    right corner to launch BankingSolutions like a native app!
                  </li>
                </ol>
              </div>
            ) : (
              <div className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-4 space-y-3 text-xs text-slate-300">
                <p className="font-black text-amber-300 uppercase tracking-wider text-[11px]">
                  🤖 How to Install on Android / Desktop Chrome:
                </p>
                <ol className="space-y-2.5 list-decimal list-inside">
                  <li>
                    Tap the browser menu icon{' '}
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">
                      ⋮
                    </span>{' '}
                    in the top-right corner of Chrome/Edge.
                  </li>
                  <li>
                    Select{' '}
                    <strong className="text-white">&ldquo;Install App&rdquo;</strong> or{' '}
                    <strong className="text-white">&ldquo;Add to Home screen&rdquo;</strong>.
                  </li>
                  <li>
                    Confirm to place the <strong className="text-amber-300">BankingSolutions</strong>{' '}
                    icon directly on your phone home screen or desktop!
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition"
            >
              Got It!
            </button>
          </div>
        </div>
      )}

      {/* ==================== MOBILE STICKY BOTTOM APP NAVIGATION BAR ==================== */}
      <div className="md:hidden h-16" aria-hidden="true" />
      <nav
        aria-label="Mobile Quick Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-white/[0.08] px-2 py-1.5 flex items-center justify-around shadow-[0_-10px_30px_rgba(0,0,0,0.6)]"
      >
        {navItems.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
                active
                  ? 'text-amber-400 bg-amber-400/10 font-black'
                  : 'text-slate-400 hover:text-slate-200 font-semibold'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

