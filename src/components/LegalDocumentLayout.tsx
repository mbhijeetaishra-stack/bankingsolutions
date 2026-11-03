'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export type LegalPageKey = 'terms' | 'privacy' | 'refund' | 'disclaimer';

export interface LegalClause {
  id: string;
  number: string;
  title: string;
  badge?: string;
  summary: string;
  paragraphs: string[];
  bullets?: Array<{ label: string; detail: string }>;
  callout?: {
    tone: 'amber' | 'rose' | 'emerald' | 'blue';
    title: string;
    body: string;
  };
}

export interface LegalHighlightCard {
  icon: string;
  title: string;
  description: string;
}

interface LegalDocumentLayoutProps {
  activePage: LegalPageKey;
  headerSubtitle: string;
  primaryBadge: string;
  complianceBadge: string;
  documentVersion?: string;
  effectiveDate?: string;
  lastUpdated?: string;
  jurisdiction?: string;
  title: string;
  leadDescription: React.ReactNode;
  highlights: LegalHighlightCard[];
  searchPlaceholder: string;
  clauses: LegalClause[];
}

const POLICY_TABS: Array<{
  key: LegalPageKey;
  shortLabel: string;
  mobileLabel: string;
  cardTitle: string;
  cardIcon: string;
  cardDesc: string;
  href: string;
}> = [
  {
    key: 'terms',
    shortLabel: 'Terms',
    mobileLabel: 'Terms & Conditions',
    cardTitle: 'Terms & Conditions',
    cardIcon: '⚖️',
    cardDesc: 'User eligibility, single-user license, anti-piracy rules, and platform governance.',
    href: '/terms',
  },
  {
    key: 'privacy',
    shortLabel: 'Privacy',
    mobileLabel: 'Privacy Policy',
    cardTitle: 'Privacy Policy',
    cardIcon: '🔒',
    cardDesc: 'How we collect, encrypt, store, and safeguard your personal & mock test data.',
    href: '/privacy',
  },
  {
    key: 'refund',
    shortLabel: 'Refunds',
    mobileLabel: 'Refund & Cancellation',
    cardTitle: 'Refund & Cancellation',
    cardIcon: '💳',
    cardDesc: 'Digital fulfillment terms, duplicate-debit protection, and Razorpay refund SLAs.',
    href: '/refund',
  },
  {
    key: 'disclaimer',
    shortLabel: 'Disclaimer',
    mobileLabel: 'Disclaimer',
    cardTitle: 'Educational Disclaimer',
    cardIcon: '📋',
    cardDesc: 'Non-affiliation with IBPS/SBI/RBI and accuracy disclosures for exam preparation.',
    href: '/disclaimer',
  },
];

export default function LegalDocumentLayout({
  activePage,
  headerSubtitle,
  primaryBadge,
  complianceBadge,
  documentVersion = 'v2.4',
  effectiveDate = 'August 1, 2026',
  lastUpdated = 'November 3, 2026',
  jurisdiction = 'Republic of India',
  title,
  leadDescription,
  highlights,
  searchPlaceholder,
  clauses,
}: LegalDocumentLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeClauseId, setActiveClauseId] = useState<string>(clauses[0]?.id ?? '');

  const filteredClauses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clauses;
    return clauses.filter((clause) => {
      const inTitle = clause.title.toLowerCase().includes(q);
      const inSummary = clause.summary.toLowerCase().includes(q);
      const inParagraphs = clause.paragraphs.some((p) => p.toLowerCase().includes(q));
      const inBullets =
        clause.bullets?.some(
          (b) => b.label.toLowerCase().includes(q) || b.detail.toLowerCase().includes(q)
        ) ?? false;
      const inCallout =
        clause.callout !== undefined &&
        (clause.callout.title.toLowerCase().includes(q) ||
          clause.callout.body.toLowerCase().includes(q));
      return inTitle || inSummary || inParagraphs || inBullets || inCallout;
    });
  }, [clauses, searchQuery]);

  useEffect(() => {
    if (typeof window === 'undefined' || searchQuery.trim() || clauses.length === 0) return;

    const handleScroll = () => {
      const scrollOffset = window.scrollY + 180;
      let current = clauses[0].id;
      for (const clause of clauses) {
        const el = document.getElementById(clause.id);
        if (el && el.offsetTop <= scrollOffset) {
          current = clause.id;
        }
      }
      setActiveClauseId(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [clauses, searchQuery]);

  const scrollToClause = (id: string) => {
    setActiveClauseId(id);
    const target = document.getElementById(id);
    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const companionPolicies = POLICY_TABS.filter((tab) => tab.key !== activePage);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950 relative overflow-x-hidden">
      {/* Ambient Subtle Background Accents */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden print:hidden">
        <div className="absolute -top-44 left-1/2 -translate-x-1/2 w-[880px] h-[360px] bg-gradient-to-r from-amber-500/10 via-blue-600/10 to-indigo-500/10 blur-[140px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[460px] h-[360px] bg-emerald-500/5 blur-[140px] rounded-full" />
      </div>

      {/* TOP STICKY LEGAL HEADER */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-white/[0.08] print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5"
            >
              <span>←</span>
              <span>Home</span>
            </Link>

            <div className="h-4 w-px bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md shadow-amber-500/20">
                BS
              </div>
              <div>
                <div className="text-xs sm:text-sm font-black text-white leading-tight">
                  BankingSolutions Legal Center
                </div>
                <div className="text-[10px] font-semibold text-slate-400 hidden sm:block">
                  {headerSubtitle}
                </div>
              </div>
            </div>
          </div>

          {/* Sibling Policy Switcher + Print & Theme Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <nav
              aria-label="Legal policies"
              className="hidden md:flex items-center bg-slate-900/90 border border-white/[0.07] rounded-xl p-1 text-[11px] font-bold"
            >
              {POLICY_TABS.map((tab) => {
                const isCurrent = tab.key === activePage;
                return (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    className={
                      isCurrent
                        ? 'px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-black shadow-sm'
                        : 'px-3 py-1.5 rounded-lg text-slate-300 hover:text-white transition'
                    }
                  >
                    {tab.shortLabel}
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-xs font-bold text-slate-200 hover:text-white transition cursor-pointer flex items-center gap-1.5"
              title={`Print or save ${title} as PDF`}
            >
              <span>🖨️</span>
              <span className="hidden sm:inline">Print / PDF</span>
            </button>

            <ThemeToggle variant="icon-only" />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* HERO BANNER & METADATA */}
        <section className="rounded-3xl bg-gradient-to-br from-slate-900/95 via-slate-950 to-slate-900/90 border border-white/[0.09] p-6 sm:p-10 shadow-2xl space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="inline-flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-400/15 text-amber-300 border border-amber-400/30">
                  {primaryBadge}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800/90 text-slate-300 border border-white/[0.07]">
                  Document {documentVersion}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  {complianceBadge}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                {title}
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{leadDescription}</p>
            </div>

            {/* Metadata Stamp Box */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2.5 shrink-0 bg-slate-950/85 border border-white/[0.08] rounded-2xl p-4 text-xs min-w-[235px]">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400 font-medium">Effective Date:</span>
                <strong className="text-slate-200 font-bold">{effectiveDate}</strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400 font-medium">Last Updated:</span>
                <strong className="text-amber-300 font-bold">{lastUpdated}</strong>
              </div>
              <div className="flex items-center justify-between gap-4 col-span-2 sm:col-span-1">
                <span className="text-slate-400 font-medium">Jurisdiction:</span>
                <strong className="text-slate-200 font-bold">{jurisdiction}</strong>
              </div>
            </div>
          </div>

          {/* AT-A-GLANCE KEY HIGHLIGHTS */}
          <div className="pt-4 border-t border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
                ⚡ Plain-Language Summary (Key Highlights)
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Summary provided for convenience; the numbered clauses below govern formally.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {highlights.map((card, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-slate-950/80 border border-white/[0.07] p-4 space-y-1.5"
                >
                  <div className="text-xs font-black text-white flex items-center gap-2">
                    <span>{card.icon}</span>
                    <span>{card.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MOBILE QUICK POLICY SWITCHER */}
        <div className="flex md:hidden items-center gap-2 overflow-x-auto pb-1 print:hidden">
          {POLICY_TABS.map((tab) => {
            const isCurrent = tab.key === activePage;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={
                  isCurrent
                    ? 'px-3.5 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-black shrink-0'
                    : 'px-3.5 py-2 rounded-xl bg-slate-900 border border-white/[0.08] text-slate-300 text-xs font-bold shrink-0'
                }
              >
                {tab.mobileLabel}
              </Link>
            );
          })}
        </div>

        {/* MAIN 2-COLUMN LAYOUT: STICKY TOC SIDEBAR + CLAUSES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT STICKY TABLE OF CONTENTS & SEARCH */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-4 print:hidden">
            <div className="rounded-2xl bg-slate-900/85 border border-white/[0.08] p-4 space-y-2.5 shadow-lg">
              <label
                htmlFor={`${activePage}-search`}
                className="text-[11px] font-black uppercase tracking-wider text-slate-400 block"
              >
                🔍 Filter Clauses by Keyword
              </label>
              <div className="relative">
                <input
                  id={`${activePage}-search`}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-xl bg-slate-950 border border-white/[0.1] focus:border-amber-400/60 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              {searchQuery.trim() && (
                <p className="text-[11px] text-amber-300 font-semibold">
                  Showing {filteredClauses.length} of {clauses.length} sections
                </p>
              )}
            </div>

            <div className="hidden lg:block rounded-2xl bg-slate-900/85 border border-white/[0.08] p-4 shadow-lg">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-2 pb-3 border-b border-white/[0.07]">
                Table of Contents ({clauses.length} Sections)
              </div>
              <nav
                aria-label={`${title} table of contents`}
                className="mt-2.5 space-y-1 max-h-[60vh] overflow-y-auto pr-1"
              >
                {clauses.map((clause) => {
                  const isActive = activeClauseId === clause.id && !searchQuery.trim();
                  return (
                    <button
                      key={clause.id}
                      type="button"
                      onClick={() => {
                        if (searchQuery.trim()) setSearchQuery('');
                        window.setTimeout(() => scrollToClause(clause.id), 20);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center gap-2.5 cursor-pointer ${
                        isActive
                          ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30 font-black'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 font-semibold border border-transparent'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isActive
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : 'bg-slate-950 text-slate-400'
                        }`}
                      >
                        {clause.number}
                      </span>
                      <span className="truncate">{clause.title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* RIGHT LEGAL DOCUMENT BODY */}
          <div className="lg:col-span-8 space-y-5">
            {filteredClauses.length === 0 ? (
              <div className="rounded-3xl bg-slate-900/80 border border-white/[0.08] p-10 text-center space-y-3">
                <div className="text-3xl">🔎</div>
                <h2 className="text-base font-black text-white">
                  No sections matched &ldquo;{searchQuery}&rdquo;
                </h2>
                <p className="text-xs text-slate-400">
                  Try searching with a broader term or clear the filter to view all sections.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
                >
                  Show All {clauses.length} Sections
                </button>
              </div>
            ) : (
              filteredClauses.map((clause) => {
                const calloutStyle =
                  clause.callout?.tone === 'rose'
                    ? 'bg-rose-500/10 border-rose-500/35 text-rose-200'
                    : clause.callout?.tone === 'emerald'
                    ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-200'
                    : clause.callout?.tone === 'blue'
                    ? 'bg-sky-500/10 border-sky-500/35 text-sky-200'
                    : 'bg-amber-500/10 border-amber-500/35 text-amber-200';

                return (
                  <article
                    key={clause.id}
                    id={clause.id}
                    className="scroll-mt-28 rounded-3xl bg-slate-900/85 border border-white/[0.08] hover:border-white/[0.13] transition p-6 sm:p-8 shadow-xl space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-300 font-mono text-xs font-black">
                            Section {clause.number}
                          </span>
                          {clause.badge && (
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-white/[0.08] text-[10px] font-black uppercase tracking-wider text-slate-300">
                              {clause.badge}
                            </span>
                          )}
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                          {clause.title}
                        </h2>
                        <p className="text-xs text-slate-400 font-medium">{clause.summary}</p>
                      </div>
                    </div>

                    <div className="space-y-3.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {clause.paragraphs.map((para, idx) => (
                        <p key={idx}>{para}</p>
                      ))}
                    </div>

                    {clause.bullets && clause.bullets.length > 0 && (
                      <div className="grid grid-cols-1 gap-2.5 pt-1">
                        {clause.bullets.map((bullet, bIdx) => (
                          <div
                            key={bIdx}
                            className="rounded-2xl bg-slate-950/75 border border-white/[0.06] p-4 flex items-start gap-3"
                          >
                            <span className="w-5 h-5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                              ✓
                            </span>
                            <div className="text-xs sm:text-[13px] leading-relaxed text-slate-300">
                              <strong className="text-white font-bold">{bullet.label}: </strong>
                              {bullet.detail}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {clause.callout && (
                      <div className={`rounded-2xl border p-4 sm:p-5 space-y-1 ${calloutStyle}`}>
                        <div className="text-xs font-black uppercase tracking-wider text-white">
                          {clause.callout.title}
                        </div>
                        <p className="text-xs leading-relaxed opacity-95">{clause.callout.body}</p>
                      </div>
                    )}
                  </article>
                );
              })
            )}

            {/* COMPANION LEGAL POLICIES & SUPPORT FOOTER CARD */}
            <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-amber-400/25 p-6 sm:p-8 shadow-xl space-y-5 print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    Related Platform Policies
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Complete Legal &amp; Compliance Suite
                  </h3>
                  <p className="text-xs text-slate-400">
                    These companion policies form an integral part of your relationship with
                    BankingSolutions.
                  </p>
                </div>

                <Link
                  href="/"
                  className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider transition shrink-0 text-center shadow-lg shadow-amber-500/15"
                >
                  Return to Platform →
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/[0.07]">
                {companionPolicies.map((pol) => (
                  <Link
                    key={pol.key}
                    href={pol.href}
                    className="rounded-2xl bg-slate-950/85 hover:bg-slate-900 border border-white/[0.08] hover:border-amber-400/40 p-4 transition group"
                  >
                    <div className="text-xs font-black text-white group-hover:text-amber-300 transition">
                      {pol.cardIcon} {pol.cardTitle} →
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{pol.cardDesc}</p>
                  </Link>
                ))}
              </div>
            </section>

            <footer className="pt-2 pb-6 text-center text-[11px] text-slate-500">
              BankingSolutions © 2026 • All rights reserved • Official Community: @Banking_Solutions
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}

