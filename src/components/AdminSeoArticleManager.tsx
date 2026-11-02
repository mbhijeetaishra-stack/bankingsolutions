'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  SeoExamArticle,
  ArticleCategory,
  ArticleHighlight,
  ArticleFaq,
  slugifyArticleTitle,
  getLocalSeoArticles,
  syncSeoArticlesFromSupabase,
  upsertSeoArticle,
  deleteSeoArticle,
  toggleSeoArticlePublished,
} from '@/lib/articles';

export default function AdminSeoArticleManager() {
  const [articles, setArticles] = useState<SeoExamArticle[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  // Form States
  const [title, setTitle] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [category, setCategory] = useState<ArticleCategory>('NOTIFICATION');
  const [examTag, setExamTag] = useState('SBI PO 2026');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [summary, setSummary] = useState('');
  const [officialLink, setOfficialLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [authorName, setAuthorName] = useState('Abhijeet Sir (BankingSolutions)');
  const [markdownContent, setMarkdownContent] = useState('');

  // Structured Key Highlights Table
  const [highlights, setHighlights] = useState<ArticleHighlight[]>([
    { label: 'Exam Name', value: 'SBI PO 2026' },
    { label: 'Total Vacancies', value: 'To Be Announced' },
    { label: 'Prelims Exam Date', value: 'Expected Oct–Nov 2026' },
    { label: 'Selection Process', value: 'Prelims + Mains + Interview' },
  ]);

  // Google Rich-Snippet FAQs
  const [faqs, setFaqs] = useState<ArticleFaq[]>([
    {
      question: 'When will the official notification be released?',
      answer: 'The official notification PDF is expected to be released on the official career portal.',
    },
  ]);

  useEffect(() => {
    setArticles(getLocalSeoArticles());
    syncSeoArticlesFromSupabase().then((remote) => {
      setArticles(remote);
    });
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setCustomSlug('');
    setCategory('NOTIFICATION');
    setExamTag('SBI PO 2026');
    setMetaTitle('');
    setMetaDescription('');
    setKeywords('');
    setSummary('');
    setOfficialLink('');
    setImageUrl('');
    setMarkdownContent('');
    setHighlights([
      { label: 'Exam Name', value: 'SBI PO 2026' },
      { label: 'Total Vacancies', value: 'To Be Announced' },
      { label: 'Prelims Exam Date', value: 'Expected 2026' },
    ]);
    setFaqs([
      {
        question: 'What is the negative marking in this exam?',
        answer: 'There is a negative marking of 0.25 marks (1/4th) for each wrong answer.',
      },
    ]);
  };

  // 1-Click SEO Templates
  const applyTemplate = (type: 'NOTIFICATION' | 'EXAM_DATE' | 'CUTOFF' | 'SYLLABUS') => {
    const exam = examTag.trim() || 'IBPS PO 2026';
    if (type === 'NOTIFICATION') {
      const t = `${exam} Notification Out: Check Exam Dates, Vacancy, Eligibility & Apply Online`;
      setTitle(t);
      setCustomSlug(slugifyArticleTitle(t));
      setCategory('NOTIFICATION');
      setMetaTitle(`${exam} Notification, Exam Date, Vacancy & Eligibility | BankingSolutions`);
      setMetaDescription(
        `Download ${exam} Official Notification PDF. Check category-wise vacancies, important registration dates, age limit, educational qualification, exam pattern, and syllabus.`
      );
      setKeywords(
        `${exam} notification, ${exam} vacancy, ${exam} apply online, ${exam} exam date, ${exam} eligibility criteria`
      );
      setSummary(
        `Complete official breakdown of ${exam} recruitment notification including registration dates, vacancy distribution, Prelims & Mains exam pattern, and preparation strategy.`
      );
      setHighlights([
        { label: 'Exam Name', value: exam },
        { label: 'Application Mode', value: 'Online Registration' },
        { label: 'Age Limit', value: '20 – 30 Years (Relaxation as per rules)' },
        { label: 'Selection Stages', value: 'Prelims → Mains → Interview' },
      ]);
      setMarkdownContent(`## 📢 ${exam} Notification Overview

The official recruitment process for **${exam}** provides a golden opportunity for graduates aspiring to join public sector banks. Read below for important dates, vacancy break-up, and selection criteria.

---

## 📅 ${exam} Important Dates

| Event | Tentative / Official Date |
| :--- | :--- |
| **Notification Release Date** | Announced |
| **Online Registration Window** | Check Official Portal |
| **Prelims Exam Date** | Upcoming |
| **Mains Exam Date** | Upcoming |

---

## 📋 ${exam} Prelims Exam Pattern

| Section | Questions | Marks | Duration |
| :--- | :---: | :---: | :---: |
| **English Language** | 30 | 30 | 20 Mins |
| **Quantitative Aptitude** | 35 | 35 | 20 Mins |
| **Reasoning Ability** | 35 | 35 | 20 Mins |
| **Total** | **100** | **100** | **60 Mins** |`);
      setFaqs([
        {
          question: `What is the educational qualification required for ${exam}?`,
          answer: `A candidate must hold a Graduation degree in any discipline from a recognized University.`,
        },
        {
          question: `Is there sectional timing in ${exam} Prelims?`,
          answer: `Yes, each section in Prelims has a dedicated 20-minute sectional timer.`,
        },
      ]);
    } else if (type === 'EXAM_DATE') {
      const t = `${exam} Exam Date Schedule: Prelims & Mains Shift Timings & Admit Card`;
      setTitle(t);
      setCustomSlug(slugifyArticleTitle(t));
      setCategory('EXAM_DATE');
      setMetaTitle(`${exam} Exam Date, Shift Timings & Admit Card Release Date | BankingSolutions`);
      setMetaDescription(
        `Check the complete ${exam} Prelims & Mains exam date schedule, reporting shift timings, admit card download link, and last-minute revision strategy.`
      );
      setKeywords(`${exam} exam date, ${exam} admit card, ${exam} shift timings, ${exam} prelims date`);
      setSummary(`Official Prelims and Mains exam calendar, shift reporting timings, and 15-day mock test revision plan for ${exam}.`);
      setHighlights([
        { label: 'Exam Name', value: exam },
        { label: 'Prelims Shifts', value: '4 Shifts Per Day (1 Hour Each)' },
        { label: 'Admit Card Release', value: '10–12 Days Before Exam' },
      ]);
      setMarkdownContent(`## 📅 ${exam} Exam Schedule & Shift Timings

Candidates appearing for **${exam}** should carefully verify their reporting time and shift schedule printed on their call letter.

| Shift | Reporting Time | Gate Closure | Exam Timing |
| :--- | :---: | :---: | :---: |
| **Shift 1** | 08:00 AM | 08:45 AM | 09:00 AM – 10:00 AM |
| **Shift 2** | 10:30 AM | 11:15 AM | 11:30 AM – 12:30 PM |
| **Shift 3** | 01:00 PM | 01:45 PM | 02:00 PM – 03:00 PM |
| **Shift 4** | 03:30 PM | 04:15 PM | 04:30 PM – 05:30 PM |`);
    } else if (type === 'CUTOFF') {
      const t = `${exam} Expected Cut-Off & Previous Year Category-Wise Cut-Off Marks`;
      setTitle(t);
      setCustomSlug(slugifyArticleTitle(t));
      setCategory('EXPECTED_CUTOFF');
      setMetaTitle(`${exam} Expected Cut-Off & Previous Year Cut-Off Analysis | BankingSolutions`);
      setMetaDescription(
        `Detailed ${exam} Expected Cut-Off based on exam difficulty, good attempts, vacancy comparison, and previous year category-wise (UR, OBC, EWS, SC, ST) cut-off marks.`
      );
      setKeywords(`${exam} expected cutoff, ${exam} previous year cutoff, ${exam} good attempts, ${exam} safe score`);
      setSummary(`Category-wise expected cut-off range, section-wise good attempts, and normalization impact for ${exam}.`);
      setHighlights([
        { label: 'Exam', value: exam },
        { label: 'Overall Good Attempts', value: '68 – 74 Questions (90%+ Accuracy)' },
        { label: 'Expected UR Cut-Off', value: '60.50 – 64.00 Marks' },
      ]);
      setMarkdownContent(`## 🎯 ${exam} Category-Wise Expected Cut-Off

Based on shift difficulty level, number of vacancies, and student attempt data on **BankingSolutions**, here is the expected cut-off range:

| Category | Expected Cut-Off Range | Safe Score Target |
| :--- | :---: | :---: |
| **General (UR)** | 60.50 – 63.50 | **65+ Marks** |
| **EWS** | 58.00 – 61.00 | **62+ Marks** |
| **OBC** | 58.50 – 61.50 | **62+ Marks** |
| **SC** | 52.00 – 55.00 | **56+ Marks** |
| **ST** | 46.50 – 49.50 | **51+ Marks** |`);
    } else if (type === 'SYLLABUS') {
      const t = `${exam} Latest Syllabus & Topic-Wise Weightage for Prelims and Mains`;
      setTitle(t);
      setCustomSlug(slugifyArticleTitle(t));
      setCategory('SYLLABUS_PATTERN');
      setMetaTitle(`${exam} Syllabus & Topic-Wise Weightage (Prelims + Mains) | BankingSolutions`);
      setMetaDescription(
        `Complete topic-wise ${exam} Prelims and Mains syllabus for Quantitative Aptitude, Reasoning, English, General/Banking Awareness, and Computer Knowledge.`
      );
      setKeywords(`${exam} syllabus, ${exam} topic wise weightage, ${exam} exam pattern`);
      setSummary(`Topic-by-topic Prelims and Mains syllabus with high-weightage chapters to prioritize for ${exam}.`);
      setMarkdownContent(`## 📚 ${exam} Topic-Wise Weightage & Syllabus

### 1. Reasoning Ability High-Weightage Topics
- **Puzzles & Seating Arrangement** (20–23 Marks in Prelims)
- **Syllogism & Inequality** (5–8 Marks)
- **Blood Relations, Direction Sense & Coding-Decoding** (5–7 Marks)
- **Critical Reasoning** (10–15 Marks in Mains)

### 2. Quantitative Aptitude High-Weightage Topics
- **Data Interpretation (Bar, Tabular, Caselet, Pie)** (15–20 Marks)
- **Simplification, Approximation & Number Series** (10–12 Marks)
- **Arithmetic Word Problems (Profit/Loss, SI/CI, Time & Work, Ratio)** (10–12 Marks)`);
    }
    showToast('✨ Loaded SEO Template! Customize any details below and click Publish.');
  };

  const handleEditArticle = (art: SeoExamArticle) => {
    setEditingId(art.id);
    setTitle(art.title);
    setCustomSlug(art.slug);
    setCategory(art.category);
    setExamTag(art.examTag);
    setMetaTitle(art.metaTitle);
    setMetaDescription(art.metaDescription);
    setKeywords(art.keywords);
    setSummary(art.summary);
    setOfficialLink(art.officialLink || '');
    setImageUrl(art.imageUrl || '');
    setAuthorName(art.authorName || 'Abhijeet Sir (BankingSolutions)');
    setMarkdownContent(art.markdownContent);
    setHighlights(art.quickHighlights?.length ? art.quickHighlights : [{ label: 'Exam', value: art.examTag }]);
    setFaqs(art.faqs?.length ? art.faqs : []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalSlug = customSlug.trim()
      ? slugifyArticleTitle(customSlug)
      : slugifyArticleTitle(title);

    const updated = await upsertSeoArticle({
      id: editingId || undefined,
      slug: finalSlug,
      title: title.trim(),
      metaTitle:
        metaTitle.trim() || `${title.trim()} | BankingSolutions`,
      metaDescription:
        metaDescription.trim() ||
        summary.trim() ||
        `Read complete details about ${title.trim()} including dates, cut-off, and exam pattern on BankingSolutions.`,
      keywords:
        keywords.trim() ||
        `${examTag}, ${title.trim()}, banking exams 2026, IBPS, SBI`,
      category,
      examTag: examTag.trim() || 'Banking Exam 2026',
      summary:
        summary.trim() ||
        `Complete exam guide and official update for ${title.trim()}.`,
      quickHighlights: highlights.filter((h) => h.label.trim() && h.value.trim()),
      markdownContent: markdownContent.trim(),
      faqs: faqs.filter((f) => f.question.trim() && f.answer.trim()),
      officialLink: officialLink.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      authorName: authorName.trim() || 'Abhijeet Sir (BankingSolutions)',
      isPublished: true,
    });

    setArticles(updated);
    showToast(`🎉 Published SEO Page: /articles/${finalSlug}`);
    resetForm();
  };

  const previewSlug = customSlug.trim()
    ? slugifyArticleTitle(customSlug)
    : slugifyArticleTitle(title || 'sbi-po-2026-notification-exam-date');

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-xl">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
            Search Engine Optimization (SSR + Google Schema.org + Sitemap)
          </span>
          <h2 className="text-xl font-black text-white mt-0.5">
            🔍 Publish Dedicated SEO Exam Pages (Notifications, Cut-Offs &amp; Dates)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Every article creates a server-rendered URL (<code className="text-amber-300">/articles/[slug]</code>) with Google NewsArticle + FAQ Rich Snippets &amp; auto-updates <code className="text-emerald-300">/sitemap.xml</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/articles"
            target="_blank"
            className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition"
          >
            🌐 View All SEO Exam Articles ↗
          </Link>
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-white/[0.1] text-emerald-300 font-bold text-xs transition"
          >
            🗺️ View /sitemap.xml ↗
          </a>
        </div>
      </div>

      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: SEO ARTICLE BUILDER FORM */}
        <form
          onSubmit={handleSaveArticle}
          className="lg:col-span-7 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-5 shadow-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {editingId ? '✏️ Edit SEO Exam Article' : '➕ Create New SEO Exam Article Page'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {/* 1-Click SEO Templates */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              ⚡ 1-Click SEO Article Templates (Auto-Fills Headings, Tables &amp; FAQs):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyTemplate('NOTIFICATION')}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 font-black text-[11px] transition"
              >
                📢 Notification
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('EXAM_DATE')}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-blue-500/30 text-blue-300 font-black text-[11px] transition"
              >
                📅 Exam Date
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('CUTOFF')}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-amber-400/30 text-amber-300 font-black text-[11px] transition"
              >
                🎯 Expected Cut-Off
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('SYLLABUS')}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-purple-500/30 text-purple-300 font-black text-[11px] transition"
              >
                📋 Syllabus &amp; Pattern
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Target Exam Tag *
              </label>
              <input
                type="text"
                value={examTag}
                onChange={(e) => setExamTag(e.target.value)}
                placeholder="e.g. SBI PO 2026"
                required
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-black text-amber-400 outline-none focus:border-amber-400"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Article Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ArticleCategory)}
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
              >
                <option value="NOTIFICATION">📢 Official Notification &amp; Vacancy</option>
                <option value="EXAM_DATE">📅 Exam Date &amp; Admit Card Schedule</option>
                <option value="EXPECTED_CUTOFF">🎯 Expected &amp; Previous Year Cut-Off</option>
                <option value="SYLLABUS_PATTERN">📋 Syllabus &amp; Exam Pattern</option>
                <option value="EXAM_ANALYSIS">📊 Shift-Wise Exam Analysis &amp; Good Attempts</option>
                <option value="RESULT">🏆 Result &amp; Scorecard Update</option>
                <option value="SALARY_JOB_PROFILE">💰 Salary, Perks &amp; Career Growth</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
              Page H1 Title (Main Headline) *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!editingId) {
                  setCustomSlug(slugifyArticleTitle(e.target.value));
                }
              }}
              placeholder="e.g. IBPS PO 2026 Notification, Exam Date, Vacancy & Expected Cut-Off"
              required
              className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                SEO URL Slug (<code className="text-amber-300">/articles/...</code>)
              </label>
              <input
                type="text"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
                placeholder="ibps-po-2026-notification-exam-date"
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-mono text-emerald-300 outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Target SEO Keywords (Comma separated)
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="SBI PO 2026 notification, SBI PO exam date, SBI PO cutoff"
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* LIVE GOOGLE SEARCH RESULT (SERP) PREVIEW */}
          <div className="bg-slate-950 border border-blue-500/25 rounded-2xl p-4 space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block">
              🔎 Live Google Search Result Preview:
            </span>
            <div className="text-[11px] text-emerald-400 truncate">
              bankingsolutions.in › articles › {previewSlug}
            </div>
            <div className="text-sm font-bold text-blue-400 leading-snug">
              {metaTitle || (title ? `${title} | BankingSolutions` : 'Exam Notification, Dates & Expected Cut-Off | BankingSolutions')}
            </div>
            <div className="text-xs text-slate-400 line-clamp-2">
              {metaDescription ||
                summary ||
                'Check complete exam notification details, Prelims & Mains exam dates, category-wise vacancy, syllabus, and expected cut-off marks on BankingSolutions.'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Custom Meta Title (Optional)
              </label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder="Defaults to Title | BankingSolutions"
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Official Apply / PDF Link (Optional)
              </label>
              <input
                type="text"
                value={officialLink}
                onChange={(e) => setOfficialLink(e.target.value)}
                placeholder="https://ibps.in or PDF URL"
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
              Meta Description &amp; Executive Summary (150–160 chars ideal for Google)
            </label>
            <textarea
              rows={2}
              value={metaDescription}
              onChange={(e) => {
                setMetaDescription(e.target.value);
                if (!summary) setSummary(e.target.value);
              }}
              placeholder="Write a crisp 2-line summary including your main keywords (e.g. Notification, Exam Date, Expected Cut-off)..."
              className="w-full bg-slate-950 border border-white/[0.1] rounded-xl p-3 text-xs text-white outline-none focus:border-amber-400"
            />
          </div>

          {/* Quick Exam Highlights Table Editor */}
          <div className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-amber-300">
                📊 Key Exam Highlights Table (Appears at Top of Page):
              </span>
              <button
                type="button"
                onClick={() =>
                  setHighlights([...highlights, { label: '', value: '' }])
                }
                className="text-xs font-black text-amber-400 hover:underline"
              >
                + Add Row
              </button>
            </div>
            <div className="space-y-2">
              {highlights.map((h, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={h.label}
                    onChange={(e) => {
                      const next = [...highlights];
                      next[idx] = { ...next[idx], label: e.target.value };
                      setHighlights(next);
                    }}
                    placeholder="e.g. Prelims Exam Date"
                    className="w-2/5 bg-slate-900 border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs font-bold text-slate-200"
                  />
                  <input
                    type="text"
                    value={h.value}
                    onChange={(e) => {
                      const next = [...highlights];
                      next[idx] = { ...next[idx], value: e.target.value };
                      setHighlights(next);
                    }}
                    placeholder="e.g. 17th & 18th October 2026"
                    className="flex-1 bg-slate-900 border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-amber-300 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setHighlights(highlights.filter((_, i) => i !== idx))
                    }
                    className="text-rose-400 hover:text-rose-300 text-xs font-bold px-1.5"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Full Article Body */}
          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
              📝 Full Article Content (Supports Markdown Headings, Cut-off Tables &amp; Bullet Points) *
            </label>
            <textarea
              rows={9}
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              placeholder="Write detailed sections on Notification, Vacancy Table, Exam Dates, Expected Cut-Offs, and Preparation Strategy..."
              required
              className="w-full bg-slate-950 border border-white/[0.1] rounded-2xl p-3.5 text-xs font-mono text-white outline-none focus:border-amber-400"
            />
          </div>

          {/* Google FAQ Schema Editor */}
          <div className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-black uppercase text-emerald-300 block">
                  ❓ Google Rich-Snippet FAQs (Generates FAQPage Schema.org)
                </span>
                <span className="text-[10px] text-slate-400">
                  Helps your page appear in Google&apos;s &ldquo;People Also Ask&rdquo; dropdowns!
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFaqs([...faqs, { question: '', answer: '' }])
                }
                className="text-xs font-black text-emerald-400 hover:underline"
              >
                + Add FAQ
              </button>
            </div>

            <div className="space-y-2.5">
              {faqs.map((f, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900 border border-white/[0.06] rounded-xl p-3 space-y-2"
                >
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={f.question}
                      onChange={(e) => {
                        const next = [...faqs];
                        next[idx] = { ...next[idx], question: e.target.value };
                        setFaqs(next);
                      }}
                      placeholder="Question (e.g. What is the expected cut-off for SBI PO 2026?)"
                      className="flex-1 bg-slate-950 border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setFaqs(faqs.filter((_, i) => i !== idx))}
                      className="text-rose-400 hover:text-rose-300 text-xs font-bold px-1.5"
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={f.answer}
                    onChange={(e) => {
                      const next = [...faqs];
                      next[idx] = { ...next[idx], answer: e.target.value };
                      setFaqs(next);
                    }}
                    placeholder="Direct, helpful answer..."
                    className="w-full bg-slate-950 border border-white/[0.1] rounded-lg p-2.5 text-xs text-slate-300"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/20 transition cursor-pointer"
          >
            {editingId
              ? 'Update Dedicated SEO Exam Page →'
              : '🚀 Publish Dedicated SEO Exam Page →'}
          </button>
        </form>

        {/* RIGHT: PUBLISHED SEO EXAM ARTICLES LIST */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Published SEO Exam Pages ({articles.length})
            </h3>
            <span className="text-[11px] text-emerald-400 font-bold">
              ✓ Indexed in Sitemap
            </span>
          </div>

          <div className="space-y-3.5 max-h-[85vh] overflow-y-auto pr-1">
            {articles.map((art) => (
              <div
                key={art.id}
                className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                      {art.examTag}
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/15 text-blue-300">
                      {art.category.replace('_', ' ')}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                      art.isPublished
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {art.isPublished ? '● Live on Google' : '○ Hidden'}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-black text-white leading-snug">
                    {art.title}
                  </h4>
                  <p className="text-[11px] font-mono text-emerald-400/90 truncate mt-1">
                    /articles/{art.slug}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06]">
                  <Link
                    href={`/articles/${art.slug}`}
                    target="_blank"
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition"
                  >
                    🔗 Open SEO Page ↗
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleEditArticle(art)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = await toggleSeoArticlePublished(art.id);
                      setArticles(next);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                  >
                    {art.isPublished ? 'Hide' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Delete SEO article "${art.title}"?`)) return;
                      const next = await deleteSeoArticle(art.id);
                      setArticles(next);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold text-xs transition"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

