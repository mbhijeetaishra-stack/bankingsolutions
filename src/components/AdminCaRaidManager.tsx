'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  BOSS_AVATAR_PRESETS,
  DEFAULT_DAILY_COMMUNITY_BOSS_HP,
  DEFAULT_MONTHLY_COMMUNITY_BOSS_HP,
  DEFAULT_PERFECT_TIME_LIMIT_SEC,
  deleteBossFightEdition,
  fetchBossFightCatalog,
  fetchBossFightEdition,
  formatMonthKeyLabel,
  makeRaidEditionId,
  parseAdminFormattedNews,
  parseAdminFormattedQuestions,
  RAID_MONTH_NAMES,
  RAID_NEWS_CATEGORIES,
  resetCommunityBossHp,
  saveBossFightEdition,
  type BossFightEdition,
  type BossFightIndexItem,
  type RaidNewsItem,
  type RaidQuestion,
  type RaidScope,
} from '@/lib/caRaid';

const SAMPLE_QUESTIONS_PASTE = `Q1. Which institution recently mandated a 2.5% operational buffer for project finance loans?
A) SEBI
B) Reserve Bank of India (RBI)
C) NABARD
D) IRDAI
Ans: B
Explanation: RBI mandated the operational provisioning buffer for infrastructure & project finance exposures.

Q2. What is the maximum deposit insurance cover provided by DICGC per depositor per insured bank?
A) Rs. 1 Lakh
B) Rs. 2 Lakh
C) Rs. 5 Lakh
D) Rs. 10 Lakh
Ans: C
Explanation: DICGC covers up to Rs. 5,00,000 (principal + interest) per depositor per bank.`;

const SAMPLE_NEWS_PASTE = `[Banking & RBI]
RBI updates Prudential Framework for Project Finance
- Mandated stricter provisioning during construction phase prior to DCCO.
- Applies to all Scheduled Commercial Banks and NBFC-Upper Layer entities.

[Economy & GDP]
India's GST Collections Cross Rs. 1.87 Lakh Crore
- Driven by domestic manufacturing and festive consumption momentum.
- Gross YoY growth recorded at 9.4%.`;

export default function AdminCaRaidManager() {
  const [catalog, setCatalog] = useState<BossFightIndexItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [savingEdition, setSavingEdition] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Edition Target: Specific Date OR Specific Month
  const [scope, setScope] = useState<RaidScope>('DATE');
  const [targetDate, setTargetDate] = useState<string>('2026-11-02');
  const [targetYear, setTargetYear] = useState<string>('2026');
  const [targetMonthNum, setTargetMonthNum] = useState<string>('11');

  // Boss Metadata
  const [editionTitle, setEditionTitle] = useState<string>(
    '02 Nov 2026 Daily CA Boss Fight'
  );
  const [bossAvatar, setBossAvatar] = useState<string>('🐉');
  const [bossName, setBossName] = useState<string>('Mint-Lord Repo Leviathan');
  const [bossSubtitle, setBossSubtitle] = useState<string>(
    'Guardian of RBI Circulars & Banking Mandates'
  );
  const [communityMaxHp, setCommunityMaxHp] = useState<number>(
    DEFAULT_DAILY_COMMUNITY_BOSS_HP
  );
  const [perfectTimeLimitSec, setPerfectTimeLimitSec] = useState<number>(
    DEFAULT_PERFECT_TIME_LIMIT_SEC
  );
  const [customSummaryPdfUrl, setCustomSummaryPdfUrl] = useState<string>('');
  const [uploadingSummaryPdf, setUploadingSummaryPdf] = useState(false);

  // Curated News List + Single/Bulk Form
  const [newsItems, setNewsItems] = useState<RaidNewsItem[]>([]);
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [newsCategory, setNewsCategory] = useState<string>(RAID_NEWS_CATEGORIES[0]);
  const [newsHeadline, setNewsHeadline] = useState<string>('');
  const [newsKeyStat, setNewsKeyStat] = useState<string>('');
  const [newsPointsText, setNewsPointsText] = useState<string>('');
  const [showBulkNewsPaste, setShowBulkNewsPaste] = useState<boolean>(false);
  const [bulkNewsText, setBulkNewsText] = useState<string>('');

  // Curated Questions List + Single/Bulk Form
  const [questions, setQuestions] = useState<RaidQuestion[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [qCategoryTag, setQCategoryTag] = useState<string>('Banking & RBI');
  const [qText, setQText] = useState<string>('');
  const [qOptA, setQOptA] = useState<string>('');
  const [qOptB, setQOptB] = useState<string>('');
  const [qOptC, setQOptC] = useState<string>('');
  const [qOptD, setQOptD] = useState<string>('');
  const [qOptE, setQOptE] = useState<string>('');
  const [qCorrectIdx, setQCorrectIdx] = useState<number>(0);
  const [qExplanation, setQExplanation] = useState<string>('');
  const [showBulkQuestionImport, setShowBulkQuestionImport] = useState<boolean>(false);
  const [bulkQuestionsText, setBulkQuestionsText] = useState<string>('');

  // Archive Filters
  const [archiveScopeFilter, setArchiveScopeFilter] = useState<'ALL' | RaidScope>('ALL');
  const [archiveYearFilter, setArchiveYearFilter] = useState<string>('ALL');
  const [archiveMonthFilter, setArchiveMonthFilter] = useState<string>('ALL');

  // Derived Target Key & ID
  const resolvedMonthKey =
    scope === 'MONTH' ? `${targetYear}-${targetMonthNum}` : targetDate.slice(0, 7);
  const resolvedDateKey = scope === 'MONTH' ? resolvedMonthKey : targetDate;
  const resolvedYear = resolvedMonthKey.slice(0, 4);
  const currentEditionId = makeRaidEditionId(scope, resolvedDateKey);

  const matchingExistingIndex = useMemo(
    () => catalog.find((it) => it.id === currentEditionId) || null,
    [catalog, currentEditionId]
  );

  // Initial load of catalog + today's date in client effect
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const todayIso = new Date().toISOString().slice(0, 10);
      const list = await fetchBossFightCatalog();
      if (!cancelled) {
        setTargetDate(todayIso);
        setTargetYear(todayIso.slice(0, 4));
        setTargetMonthNum(todayIso.slice(5, 7));
        setEditionTitle(`${todayIso} Daily CA Boss Fight`);
        setCatalog(list);
        setLoadingCatalog(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleScopeSwitch = (nextScope: RaidScope) => {
    setScope(nextScope);
    if (nextScope === 'MONTH') {
      const mKey = `${targetYear}-${targetMonthNum}`;
      setEditionTitle(`${formatMonthKeyLabel(mKey)} Monthly CA Boss Fight`);
      setCommunityMaxHp(DEFAULT_MONTHLY_COMMUNITY_BOSS_HP);
      setBossAvatar('👑');
      setBossName('Grand Monthly Emperor');
      setBossSubtitle('Supreme Monthly Current Affairs Raid Boss');
    } else {
      setEditionTitle(`${targetDate} Daily CA Boss Fight`);
      setCommunityMaxHp(DEFAULT_DAILY_COMMUNITY_BOSS_HP);
      setBossAvatar('🐉');
      setBossName('Mint-Lord Repo Leviathan');
      setBossSubtitle('Guardian of RBI Circulars & Banking Mandates');
    }
  };

  const handleLoadEditionForEdit = async (raidId: string) => {
    setStatusMsg('Loading Boss Fight edition…');
    const ed = await fetchBossFightEdition(raidId);
    if (!ed) {
      setStatusMsg('⚠️ Could not find saved data for this Boss Fight.');
      return;
    }

    setScope(ed.scope);
    if (ed.scope === 'MONTH') {
      const [y, m] = ed.monthKey.split('-');
      if (y) setTargetYear(y);
      if (m) setTargetMonthNum(m);
    } else {
      setTargetDate(ed.dateKey);
      setTargetYear(ed.year);
      setTargetMonthNum(ed.monthKey.slice(5, 7));
    }

    setEditionTitle(ed.title);
    setBossAvatar(ed.bossAvatar || '🐉');
    setBossName(ed.bossName);
    setBossSubtitle(ed.bossSubtitle || '');
    setCommunityMaxHp(ed.communityMaxHp || DEFAULT_DAILY_COMMUNITY_BOSS_HP);
    setPerfectTimeLimitSec(ed.perfectTimeLimitSec || DEFAULT_PERFECT_TIME_LIMIT_SEC);
    setCustomSummaryPdfUrl(ed.customSummaryPdfUrl || '');
    setNewsItems(ed.newsItems || []);
    setQuestions(ed.questions || []);
    setEditingNewsId(null);
    setEditingQuestionId(null);
    setStatusMsg(`✅ Loaded "${ed.title}" (${ed.newsItems.length} News, ${ed.questions.length} Qs) for editing.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearEditor = () => {
    setNewsItems([]);
    setQuestions([]);
    setEditingNewsId(null);
    setEditingQuestionId(null);
    setCustomSummaryPdfUrl('');
    setStatusMsg('Cleared current draft News & Questions.');
  };

  // ---------------- Upload Optional Custom 1-Page Summary PDF ----------------
  const handleUploadCustomSummaryPdf = async (file: File) => {
    try {
      setUploadingSummaryPdf(true);
      setStatusMsg('Uploading custom 1-Page Revision PDF…');
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `bsca-raid-summary/${Date.now()}_${cleanName}`;
      const { error } = await supabase.storage.from('course_pdfs').upload(filePath, file);
      if (error) {
        setStatusMsg(`❌ PDF Upload Error: ${error.message}`);
        return;
      }
      const { data } = supabase.storage.from('course_pdfs').getPublicUrl(filePath);
      if (data?.publicUrl) {
        setCustomSummaryPdfUrl(data.publicUrl);
        setStatusMsg('✅ Custom 1-Page Revision PDF uploaded!');
      }
    } catch (err: unknown) {
      setStatusMsg(
        `❌ Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setUploadingSummaryPdf(false);
    }
  };

  // ---------------- News Management ----------------
  const handleSaveNewsItem = () => {
    if (!newsHeadline.trim()) {
      setStatusMsg('⚠️ Please enter a News Headline.');
      return;
    }
    const pts = newsPointsText
      .split('\n')
      .map((l) => l.replace(/^[•\-*▪▸\s]+/, '').trim())
      .filter(Boolean);

    const newItem: RaidNewsItem = {
      id: editingNewsId || `news_${Date.now()}_${newsItems.length + 1}`,
      category: newsCategory,
      headline: newsHeadline.trim(),
      keyStat: newsKeyStat.trim() || undefined,
      points: pts.length > 0 ? pts : [newsHeadline.trim()],
    };

    if (editingNewsId) {
      setNewsItems((prev) => prev.map((n) => (n.id === editingNewsId ? newItem : n)));
      setEditingNewsId(null);
      setStatusMsg('✅ Updated News item.');
    } else {
      setNewsItems((prev) => [...prev, newItem]);
      setStatusMsg('✅ Added News item to Boss Fight.');
    }

    setNewsHeadline('');
    setNewsKeyStat('');
    setNewsPointsText('');
  };

  const handleEditNewsClick = (item: RaidNewsItem) => {
    setEditingNewsId(item.id);
    setNewsCategory(item.category);
    setNewsHeadline(item.headline);
    setNewsKeyStat(item.keyStat || '');
    setNewsPointsText(item.points.join('\n'));
  };

  const handleBulkAddNews = () => {
    const parsed = parseAdminFormattedNews(bulkNewsText, newsCategory);
    if (parsed.length === 0) {
      setStatusMsg('⚠️ Could not find any news items in pasted text.');
      return;
    }
    setNewsItems((prev) => [...prev, ...parsed]);
    setBulkNewsText('');
    setShowBulkNewsPaste(false);
    setStatusMsg(`✅ Added ${parsed.length} News items from pasted notes!`);
  };

  // ---------------- Question Management ----------------
  const handleSaveQuestionItem = () => {
    if (!qText.trim()) {
      setStatusMsg('⚠️ Please enter the Question Text.');
      return;
    }
    const rawOpts = [qOptA, qOptB, qOptC, qOptD, qOptE]
      .map((o) => o.trim())
      .filter((o, idx) => idx < 4 || o.length > 0);

    if (rawOpts.filter(Boolean).length < 2) {
      setStatusMsg('⚠️ Please enter at least Options A and B.');
      return;
    }

    const finalOpts = rawOpts.map((o, idx) => o || `Option ${String.fromCharCode(65 + idx)}`);
    const safeCorrect = Math.max(0, Math.min(finalOpts.length - 1, qCorrectIdx));

    const item: RaidQuestion = {
      id: editingQuestionId || `q_${Date.now()}_${questions.length + 1}`,
      categoryTag: qCategoryTag.trim() || 'Current Affairs',
      questionText: qText.trim(),
      options: finalOpts,
      correctOptionIndex: safeCorrect,
      explanation: qExplanation.trim() || 'Refer to the Boss Fight Current Affairs notes.',
    };

    if (editingQuestionId) {
      setQuestions((prev) => prev.map((q) => (q.id === editingQuestionId ? item : q)));
      setEditingQuestionId(null);
      setStatusMsg('✅ Updated Boss Fight Question.');
    } else {
      setQuestions((prev) => [...prev, item]);
      setStatusMsg(`✅ Added Question #${questions.length + 1} to Boss Fight.`);
    }

    setQText('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQOptE('');
    setQCorrectIdx(0);
    setQExplanation('');
  };

  const handleEditQuestionClick = (q: RaidQuestion) => {
    setEditingQuestionId(q.id);
    setQCategoryTag(q.categoryTag);
    setQText(q.questionText);
    setQOptA(q.options[0] || '');
    setQOptB(q.options[1] || '');
    setQOptC(q.options[2] || '');
    setQOptD(q.options[3] || '');
    setQOptE(q.options[4] || '');
    setQCorrectIdx(q.correctOptionIndex);
    setQExplanation(q.explanation);
  };

  const handleBulkAddQuestionsFromPaste = () => {
    const parsed = parseAdminFormattedQuestions(bulkQuestionsText, qCategoryTag);
    if (parsed.length === 0) {
      setStatusMsg('⚠️ No valid MCQs detected. Use Q1. ... A) ... B) ... C) ... D) ... Ans: B format.');
      return;
    }
    setQuestions((prev) => [...prev, ...parsed]);
    setBulkQuestionsText('');
    setShowBulkQuestionImport(false);
    setStatusMsg(`✅ Imported ${parsed.length} questions into this Boss Fight!`);
  };

  const handleImportQuestionsWordFile = async (file: File) => {
    try {
      setStatusMsg(`Reading "${file.name}"…`);
      let rawText = '';
      if (file.name.toLowerCase().endsWith('.docx')) {
        const mammoth = await import('mammoth');
        const lib = (mammoth.default || mammoth) as {
          extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
        };
        const arrayBuffer = await file.arrayBuffer();
        const { value } = await lib.extractRawText({ arrayBuffer });
        rawText = value;
      } else {
        rawText = await file.text();
      }
      const parsed = parseAdminFormattedQuestions(rawText, qCategoryTag);
      if (parsed.length === 0) {
        setStatusMsg('⚠️ Could not detect formatted MCQs in file.');
        return;
      }
      setQuestions((prev) => [...prev, ...parsed]);
      setShowBulkQuestionImport(false);
      setStatusMsg(`✅ Added ${parsed.length} questions from "${file.name}"!`);
    } catch (err: unknown) {
      setStatusMsg(
        `❌ Error reading file: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  };

  // ---------------- Publish Full Boss Fight Edition ----------------
  const handlePublishEdition = async () => {
    if (!editionTitle.trim()) {
      setStatusMsg('⚠️ Please enter an Edition Title.');
      return;
    }
    if (questions.length === 0) {
      setStatusMsg('⚠️ Please add at least 1 question for the Boss Fight before publishing.');
      return;
    }

    setSavingEdition(true);
    setStatusMsg('Publishing Boss Fight edition to Supabase…');

    const payload: BossFightEdition = {
      id: currentEditionId,
      scope,
      dateKey: resolvedDateKey,
      monthKey: resolvedMonthKey,
      year: resolvedYear,
      title: editionTitle.trim(),
      bossName: bossName.trim() || 'Mint-Lord Repo Leviathan',
      bossSubtitle: bossSubtitle.trim() || 'Current Affairs Raid Boss',
      bossAvatar: bossAvatar || '🐉',
      communityMaxHp: Math.max(200, Number(communityMaxHp) || DEFAULT_DAILY_COMMUNITY_BOSS_HP),
      perfectTimeLimitSec: Math.max(
        30,
        Number(perfectTimeLimitSec) || DEFAULT_PERFECT_TIME_LIMIT_SEC
      ),
      newsItems,
      questions,
      customSummaryPdfUrl: customSummaryPdfUrl.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    const res = await saveBossFightEdition(payload);
    setCatalog(res.catalog);
    setSavingEdition(false);

    if (res.success) {
      setStatusMsg(
        `🚀 Published "${payload.title}" (${payload.scope === 'MONTH' ? 'Monthly' : 'Date'} Boss Fight: ${payload.dateKey}) with ${payload.questions.length} Qs & ${payload.newsItems.length} News items!`
      );
    } else {
      setStatusMsg(`⚠️ Saved locally, Supabase returned: ${res.error}`);
    }
  };

  const handleDeleteEdition = async (item: BossFightIndexItem) => {
    if (!confirm(`Delete Boss Fight "${item.title}" (${item.dateKey})?`)) return;
    const res = await deleteBossFightEdition(item.id);
    setCatalog(res.catalog);
    setStatusMsg(`🗑️ Deleted "${item.title}".`);
  };

  const handleResetHp = async (item: BossFightIndexItem) => {
    if (!confirm(`Reset Community Boss HP back to ${item.communityMaxHp} for "${item.title}"?`)) {
      return;
    }
    await resetCommunityBossHp(item.id, item.communityMaxHp);
    setStatusMsg(`🔄 Reset Community Boss HP to ${item.communityMaxHp.toLocaleString()} for "${item.title}".`);
  };

  const filteredCatalog = useMemo(() => {
    return catalog.filter((it) => {
      if (archiveScopeFilter !== 'ALL' && it.scope !== archiveScopeFilter) return false;
      if (archiveYearFilter !== 'ALL' && it.year !== archiveYearFilter) return false;
      if (archiveMonthFilter !== 'ALL' && it.monthKey.slice(5, 7) !== archiveMonthFilter) {
        return false;
      }
      return true;
    });
  }, [archiveMonthFilter, archiveScopeFilter, archiveYearFilter, catalog]);

  const inputCls =
    'w-full bg-slate-950 border border-white/[0.12] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white outline-none transition';
  const labelCls =
    'block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-rose-950/50 via-slate-900 to-amber-950/35 border border-rose-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/35 text-rose-300 text-[10px] font-black uppercase tracking-widest">
              ⚔️ CA Boss Fight Studio
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              100% Admin-Curated News &amp; Questions (Date-Wise &amp; Month-Wise)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Manage Specific Date &amp; Monthly Current Affairs Boss Fights
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Create Boss Fights for any specific <strong>Date (YYYY-MM-DD)</strong> or{' '}
            <strong>Month (YYYY-MM)</strong>. Add your own Current Affairs News &amp; Questions —
            students pick any Date or Month from the Raid Selection Bar!
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-2xl bg-slate-950/90 border border-white/[0.08] text-center">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              Published Raids
            </span>
            <strong className="text-lg font-black text-amber-400">{catalog.length}</strong>
          </div>
          <a
            href={`/ca-raid?raid=${currentEditionId}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg transition"
          >
            Open Live Boss Raid ↗
          </a>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-amber-400/35 text-amber-200 text-xs sm:text-sm font-bold flex items-center justify-between">
          <span>{statusMsg}</span>
          <button
            type="button"
            onClick={() => setStatusMsg('')}
            className="text-slate-400 hover:text-white ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* STEP 1: TARGET PERIOD (DATE OR MONTH) & BOSS CONFIGURATION          */}
      {/* =================================================================== */}
      <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
              Step 1 of 3
            </span>
            <h3 className="text-base sm:text-lg font-black text-white">
              Select Date or Month &amp; Configure Boss
            </h3>
          </div>

          {/* Scope Toggle: Specific Date vs Full Month */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-white/[0.08]">
            <button
              type="button"
              onClick={() => handleScopeSwitch('DATE')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                scope === 'DATE'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              📅 Specific Date Boss Fight
            </button>
            <button
              type="button"
              onClick={() => handleScopeSwitch('MONTH')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                scope === 'MONTH'
                  ? 'bg-rose-500 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🗓️ Monthly Boss Fight
            </button>
          </div>
        </div>

        {/* If an edition already exists for this Date/Month, offer 1-click load */}
        {matchingExistingIndex && (
          <div className="p-3.5 rounded-2xl bg-amber-400/10 border border-amber-400/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-amber-200 font-semibold">
              ⚡ Published Boss Fight already exists for <strong>{resolvedDateKey}</strong>:{' '}
              <strong>{matchingExistingIndex.title}</strong> ({matchingExistingIndex.questionCount}{' '}
              Qs, {matchingExistingIndex.newsCount} News)
            </span>
            <button
              type="button"
              onClick={() => void handleLoadEditionForEdit(matchingExistingIndex.id)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shrink-0 cursor-pointer"
            >
              📥 Load Existing to Edit
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scope === 'DATE' ? (
            <div>
              <label className={labelCls}>Boss Fight Date (YYYY-MM-DD)</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setTargetDate(val);
                  if (val) {
                    setTargetYear(val.slice(0, 4));
                    setTargetMonthNum(val.slice(5, 7));
                    setEditionTitle(`${val} Daily CA Boss Fight`);
                  }
                }}
                className={inputCls}
              />
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls}>Boss Fight Month</label>
                <select
                  value={targetMonthNum}
                  onChange={(e) => {
                    const m = e.target.value;
                    setTargetMonthNum(m);
                    setEditionTitle(
                      `${formatMonthKeyLabel(`${targetYear}-${m}`)} Monthly CA Boss Fight`
                    );
                  }}
                  className={inputCls}
                >
                  {RAID_MONTH_NAMES.map((name, i) => {
                    const val = String(i + 1).padStart(2, '0');
                    return (
                      <option key={val} value={val} className="bg-slate-950 text-white">
                        {name}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className={labelCls}>Boss Fight Year</label>
                <select
                  value={targetYear}
                  onChange={(e) => {
                    const y = e.target.value;
                    setTargetYear(y);
                    setEditionTitle(
                      `${formatMonthKeyLabel(`${y}-${targetMonthNum}`)} Monthly CA Boss Fight`
                    );
                  }}
                  className={inputCls}
                >
                  {['2025', '2026', '2027', '2028'].map((yr) => (
                    <option key={yr} value={yr} className="bg-slate-950 text-white">
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className={scope === 'DATE' ? 'md:col-span-2' : ''}>
            <label className={labelCls}>Edition Display Title</label>
            <input
              type="text"
              value={editionTitle}
              onChange={(e) => setEditionTitle(e.target.value)}
              placeholder="e.g. 02 Nov 2026 Daily CA Boss Fight"
              className={inputCls}
            />
          </div>
        </div>

        {/* Boss Persona & HP Settings */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Boss Avatar Preset</label>
            <div className="flex flex-wrap gap-1.5">
              {BOSS_AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.avatar}
                  type="button"
                  onClick={() => {
                    setBossAvatar(preset.avatar);
                    setBossName(preset.defaultName);
                    setBossSubtitle(preset.defaultSub);
                  }}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border transition cursor-pointer ${
                    bossAvatar === preset.avatar
                      ? 'bg-rose-500/25 border-rose-400 scale-105'
                      : 'bg-slate-950 border-white/[0.08] hover:border-white/25'
                  }`}
                  title={preset.defaultName}
                >
                  {preset.avatar}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Boss Name</label>
            <input
              type="text"
              value={bossName}
              onChange={(e) => setBossName(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Community Boss Max HP</label>
            <input
              type="number"
              min={200}
              step={100}
              value={communityMaxHp}
              onChange={(e) => setCommunityMaxHp(Number(e.target.value))}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Perfect Speed Badge Window (Sec)</label>
            <input
              type="number"
              min={30}
              step={30}
              value={perfectTimeLimitSec}
              onChange={(e) => setPerfectTimeLimitSec(Number(e.target.value))}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Boss Subtitle / Tagline</label>
            <input
              type="text"
              value={bossSubtitle}
              onChange={(e) => setBossSubtitle(e.target.value)}
              placeholder="e.g. Guardian of RBI Circulars & Banking Mandates"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              Optional Custom Unlocked 1-Page PDF (Auto-generated from News &amp; Qs if blank)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={customSummaryPdfUrl}
                onChange={(e) => setCustomSummaryPdfUrl(e.target.value)}
                placeholder="Leave blank to auto-build PDF from News + Questions"
                className={inputCls}
              />
              <label className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/[0.12] hover:border-amber-400 text-xs font-bold text-amber-300 shrink-0 cursor-pointer flex items-center">
                {uploadingSummaryPdf ? '⏳' : '📎 PDF'}
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  disabled={uploadingSummaryPdf}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadCustomSummaryPdf(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* STEP 2: ADD CURRENT AFFAIRS NEWS / STUDY POINTS                     */}
      {/* =================================================================== */}
      <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 block">
              Step 2 of 3 • News &amp; Study Points ({newsItems.length} Added)
            </span>
            <h3 className="text-base sm:text-lg font-black text-white">
              Add Current Affairs News for {resolvedDateKey}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setShowBulkNewsPaste((v) => !v)}
            className="px-3.5 py-2 rounded-xl bg-slate-950 border border-sky-500/35 text-sky-300 hover:bg-slate-900 text-xs font-bold transition cursor-pointer"
          >
            {showBulkNewsPaste ? '✕ Close Bulk News Paste' : '📋 Bulk Paste Multiple News'}
          </button>
        </div>

        {showBulkNewsPaste && (
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-sky-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-300">
                Paste News Blocks (Separate each news item with an empty line)
              </span>
              <button
                type="button"
                onClick={() => setBulkNewsText(SAMPLE_NEWS_PASTE)}
                className="text-[11px] font-bold text-amber-300 hover:underline cursor-pointer"
              >
                Load Sample Format
              </button>
            </div>
            <textarea
              rows={6}
              value={bulkNewsText}
              onChange={(e) => setBulkNewsText(e.target.value)}
              placeholder={SAMPLE_NEWS_PASTE}
              className={`${inputCls} font-mono text-xs`}
            />
            <button
              type="button"
              onClick={handleBulkAddNews}
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs transition cursor-pointer"
            >
              ➕ Add Pasted News Items
            </button>
          </div>
        )}

        {/* Single News Adder */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Category</label>
            <select
              value={newsCategory}
              onChange={(e) => setNewsCategory(e.target.value)}
              className={inputCls}
            >
              {RAID_NEWS_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-slate-950 text-white">
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Headline</label>
            <input
              type="text"
              value={newsHeadline}
              onChange={(e) => setNewsHeadline(e.target.value)}
              placeholder="e.g. RBI issues updated Project Finance Directions"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Key Figure / Stat Chip (Optional)</label>
            <input
              type="text"
              value={newsKeyStat}
              onChange={(e) => setNewsKeyStat(e.target.value)}
              placeholder="e.g. 2.5% Buffer / Rs. 50,000 Cr"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Key Bullet Points (One per line)</label>
          <textarea
            rows={3}
            value={newsPointsText}
            onChange={(e) => setNewsPointsText(e.target.value)}
            placeholder={`Lenders must maintain 2.5% operational provisioning.\nEffective across all Scheduled Commercial Banks.`}
            className={inputCls}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveNewsItem}
            className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs transition cursor-pointer"
          >
            {editingNewsId ? '💾 Update News Item' : '➕ Add News Item'}
          </button>
          {editingNewsId && (
            <button
              type="button"
              onClick={() => {
                setEditingNewsId(null);
                setNewsHeadline('');
                setNewsKeyStat('');
                setNewsPointsText('');
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
            >
              Cancel Edit
            </button>
          )}
        </div>

        {/* Added News Preview List */}
        {newsItems.length > 0 && (
          <div className="space-y-2.5 pt-2 max-h-80 overflow-y-auto pr-1">
            {newsItems.map((item, idx) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-slate-950/85 border border-white/[0.07] flex flex-col sm:flex-row sm:items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25">
                      #{idx + 1} • {item.category}
                    </span>
                    {item.keyStat && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-400/15 text-amber-300">
                        {item.keyStat}
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">{item.headline}</h4>
                  <ul className="text-[11px] text-slate-400 space-y-0.5">
                    {item.points.map((pt, pIdx) => (
                      <li key={pIdx}>• {pt}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditNewsClick(item)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/[0.08] text-xs text-amber-300 font-bold cursor-pointer"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNewsItems((prev) => prev.filter((n) => n.id !== item.id))
                    }
                    className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-xs text-rose-300 font-bold cursor-pointer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* STEP 3: ADD BOSS FIGHT QUESTIONS (SINGLE + WORD/PASTE IMPORT)       */}
      {/* =================================================================== */}
      <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
              Step 3 of 3 • Boss Fight Questions ({questions.length} Added)
            </span>
            <h3 className="text-base sm:text-lg font-black text-white">
              Add Boss Fight Questions for {resolvedDateKey}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setShowBulkQuestionImport((v) => !v)}
            className="px-3.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/35 text-emerald-300 hover:bg-slate-900 text-xs font-bold transition cursor-pointer"
          >
            {showBulkQuestionImport
              ? '✕ Close Bulk Import'
              : '📄 Bulk Import via Word (.docx) / Paste'}
          </button>
        </div>

        {showBulkQuestionImport && (
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-300">
                Upload Word (.docx / .txt) or Paste Formatted MCQs
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBulkQuestionsText(SAMPLE_QUESTIONS_PASTE)}
                  className="text-[11px] font-bold text-amber-300 hover:underline cursor-pointer"
                >
                  Load Sample MCQs
                </button>
                <label className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black cursor-pointer">
                  📎 Upload .docx / .txt
                  <input
                    type="file"
                    accept=".docx,.txt,.md"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleImportQuestionsWordFile(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            <textarea
              rows={7}
              value={bulkQuestionsText}
              onChange={(e) => setBulkQuestionsText(e.target.value)}
              placeholder={SAMPLE_QUESTIONS_PASTE}
              className={`${inputCls} font-mono text-xs`}
            />

            <button
              type="button"
              onClick={handleBulkAddQuestionsFromPaste}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer"
            >
              ➕ Add Pasted Questions to Boss Fight
            </button>
          </div>
        )}

        {/* Single Question Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Category Tag</label>
            <select
              value={qCategoryTag}
              onChange={(e) => setQCategoryTag(e.target.value)}
              className={inputCls}
            >
              {RAID_NEWS_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-slate-950 text-white">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Question Stem</label>
            <input
              type="text"
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Enter Current Affairs MCQ question…"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Option A</label>
            <input
              type="text"
              value={qOptA}
              onChange={(e) => setQOptA(e.target.value)}
              placeholder="Option A"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Option B</label>
            <input
              type="text"
              value={qOptB}
              onChange={(e) => setQOptB(e.target.value)}
              placeholder="Option B"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Option C</label>
            <input
              type="text"
              value={qOptC}
              onChange={(e) => setQOptC(e.target.value)}
              placeholder="Option C"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Option D</label>
            <input
              type="text"
              value={qOptD}
              onChange={(e) => setQOptD(e.target.value)}
              placeholder="Option D"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Option E (Optional)</label>
            <input
              type="text"
              value={qOptE}
              onChange={(e) => setQOptE(e.target.value)}
              placeholder="Leave blank for 4 options"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Correct Answer</label>
            <select
              value={qCorrectIdx}
              onChange={(e) => setQCorrectIdx(Number(e.target.value))}
              className={inputCls}
            >
              <option value={0} className="bg-slate-950 text-white">Option A</option>
              <option value={1} className="bg-slate-950 text-white">Option B</option>
              <option value={2} className="bg-slate-950 text-white">Option C</option>
              <option value={3} className="bg-slate-950 text-white">Option D</option>
              {qOptE.trim() && (
                <option value={4} className="bg-slate-950 text-white">Option E</option>
              )}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Explanation / Revision Note</label>
          <textarea
            rows={2}
            value={qExplanation}
            onChange={(e) => setQExplanation(e.target.value)}
            placeholder="Brief exam explanation shown after student attacks…"
            className={inputCls}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveQuestionItem}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer"
            >
              {editingQuestionId
                ? '💾 Update Question'
                : `➕ Add Question (#${questions.length + 1})`}
            </button>
            {editingQuestionId && (
              <button
                type="button"
                onClick={() => {
                  setEditingQuestionId(null);
                  setQText('');
                  setQOptA('');
                  setQOptB('');
                  setQOptC('');
                  setQOptD('');
                  setQOptE('');
                  setQExplanation('');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {questions.length > 0 && (
            <button
              type="button"
              onClick={handleClearEditor}
              className="text-xs font-bold text-rose-400 hover:underline cursor-pointer"
            >
              Clear Draft ({newsItems.length} News, {questions.length} Qs)
            </button>
          )}
        </div>

        {/* Added Questions Preview List */}
        {questions.length > 0 && (
          <div className="space-y-2.5 pt-2 max-h-96 overflow-y-auto pr-1">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="p-3.5 rounded-2xl bg-slate-950/85 border border-white/[0.07] flex flex-col sm:flex-row sm:items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                      Q{idx + 1}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {q.categoryTag}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-white">{q.questionText}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                    {q.options.map((opt, oIdx) => (
                      <span
                        key={oIdx}
                        className={
                          oIdx === q.correctOptionIndex
                            ? 'text-emerald-400 font-black'
                            : 'text-slate-400'
                        }
                      >
                        ({String.fromCharCode(65 + oIdx)}) {opt}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditQuestionClick(q)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/[0.08] text-xs text-amber-300 font-bold cursor-pointer"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQuestions((prev) => prev.filter((item) => item.id !== q.id))
                    }
                    className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-xs text-rose-300 font-bold cursor-pointer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PUBLISH BUTTON */}
        <div className="pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            Target:{' '}
            <strong className="text-amber-300">
              {scope === 'MONTH' ? `Month (${resolvedDateKey})` : `Date (${resolvedDateKey})`}
            </strong>{' '}
            • <strong>{newsItems.length}</strong> News • <strong>{questions.length}</strong>{' '}
            Questions • Boss HP: <strong>{communityMaxHp.toLocaleString()}</strong>
          </div>

          <button
            type="button"
            disabled={savingEdition}
            onClick={() => void handlePublishEdition()}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-rose-500 via-amber-500 to-amber-400 hover:from-rose-400 hover:to-amber-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-rose-500/20 transition cursor-pointer disabled:opacity-50"
          >
            {savingEdition
              ? 'Publishing Boss Fight…'
              : matchingExistingIndex
              ? `🚀 Update ${scope === 'MONTH' ? 'Monthly' : 'Date'} Boss Fight (${resolvedDateKey})`
              : `🚀 Publish ${scope === 'MONTH' ? 'Monthly' : 'Date'} Boss Fight (${resolvedDateKey})`}
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* PUBLISHED BOSS FIGHTS ARCHIVE (FILTER BY DATE / MONTH / YEAR)       */}
      {/* =================================================================== */}
      <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white">
              🗄️ Published Boss Fights ({filteredCatalog.length} / {catalog.length})
            </h3>
            <p className="text-xs text-slate-400">
              Click Edit to modify questions/news, Reset HP to restart community raid, or Preview live.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={archiveScopeFilter}
              onChange={(e) => setArchiveScopeFilter(e.target.value as 'ALL' | RaidScope)}
              className="bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-white font-bold"
            >
              <option value="ALL">All Types (Date + Month)</option>
              <option value="DATE">📅 Date Boss Fights</option>
              <option value="MONTH">🗓️ Monthly Boss Fights</option>
            </select>

            <select
              value={archiveMonthFilter}
              onChange={(e) => setArchiveMonthFilter(e.target.value)}
              className="bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-white font-bold"
            >
              <option value="ALL">All Months</option>
              {RAID_MONTH_NAMES.map((m, i) => {
                const v = String(i + 1).padStart(2, '0');
                return (
                  <option key={v} value={v}>
                    {m}
                  </option>
                );
              })}
            </select>

            <select
              value={archiveYearFilter}
              onChange={(e) => setArchiveYearFilter(e.target.value)}
              className="bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-white font-bold"
            >
              <option value="ALL">All Years</option>
              {['2025', '2026', '2027', '2028'].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingCatalog ? (
          <p className="text-xs text-slate-400 py-6 text-center">Loading published Boss Fights…</p>
        ) : filteredCatalog.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <div className="text-3xl">⚔️</div>
            <p className="text-sm font-bold text-white">No Boss Fights Published Yet</p>
            <p className="text-xs text-slate-400">
              Use the studio above to add News &amp; Questions for a Date or Month and click Publish!
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
            {filteredCatalog.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-950/80 border border-white/[0.07] hover:border-amber-400/35 flex flex-col md:flex-row md:items-center justify-between gap-3 transition"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-2xl shrink-0">
                    {item.bossAvatar || '🐉'}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                          item.scope === 'MONTH'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/35'
                            : 'bg-amber-400/20 text-amber-300 border border-amber-400/35'
                        }`}
                      >
                        {item.scope === 'MONTH'
                          ? `🗓️ Month: ${formatMonthKeyLabel(item.monthKey)}`
                          : `📅 Date: ${item.dateKey}`}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-400">
                        {item.questionCount} Qs • {item.newsCount} News
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Max HP: {item.communityMaxHp.toLocaleString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-white mt-0.5">
                      {item.title}{' '}
                      <span className="text-xs font-semibold text-slate-400">
                        ({item.bossName})
                      </span>
                    </h4>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href={`/ca-raid?raid=${item.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/[0.1] text-xs font-bold text-slate-200 hover:text-amber-300"
                  >
                    Live ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleLoadEditionForEdit(item.id)}
                    className="px-3 py-1.5 rounded-xl bg-amber-400/20 border border-amber-400/35 text-xs font-black text-amber-300 hover:bg-amber-400/30 cursor-pointer"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResetHp(item)}
                    className="px-3 py-1.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-xs font-bold text-sky-300 hover:bg-sky-500/25 cursor-pointer"
                  >
                    🔄 Reset HP
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteEdition(item)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-bold text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

