'use client';

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  SAMPLE_WORD_MATRIX_DOC_TEXT,
  WORD_MATRIX_CUSTOM_PAIRS_KEY,
  getBuiltInPoolForMode,
  getPoolForMode,
  normalizeRelationType,
  parseCustomWordPairs,
  parseWordMatrixBulkText,
  saveCustomWordPairs,
  syncCustomWordPairsFromSupabase,
  type MatchRelationType,
  type WordPair,
} from '@/lib/wordMatrix';

type AdminSubTab = 'single' | 'bulk' | 'manage';

function subscribeCustomWords(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('bs_word_matrix_sync', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('bs_word_matrix_sync', callback);
  };
}

function getRawCustomSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(WORD_MATRIX_CUSTOM_PAIRS_KEY);
  } catch {
    return null;
  }
}

function getNullSnapshot(): string | null {
  return null;
}

const RELATION_META: Record<
  MatchRelationType,
  { label: string; icon: string; badgeCls: string; placeholderTerm: string; placeholderMatch: string }
> = {
  JARGON: {
    label: 'Financial & Banking Jargon',
    icon: '🏦',
    badgeCls: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
    placeholderTerm: 'e.g. Liquidity Coverage Ratio (LCR)',
    placeholderMatch:
      'e.g. High-quality liquid assets banks hold to survive a 30-day cash stress scenario',
  },
  DEFINITION: {
    label: 'Editorial Vocabulary Definition',
    icon: '📰',
    badgeCls: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    placeholderTerm: 'e.g. Ameliorate',
    placeholderMatch: 'e.g. Make something unsatisfactory or painful noticeably better',
  },
  SYNONYM: {
    label: 'Power Synonym Pair',
    icon: '🔗',
    badgeCls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    placeholderTerm: 'e.g. Inadvertent',
    placeholderMatch: 'e.g. Unintentional & Accidental',
  },
  ANTONYM: {
    label: 'Contrast Antonym Pair',
    icon: '⚖️',
    badgeCls: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    placeholderTerm: 'e.g. Ephemeral',
    placeholderMatch: 'e.g. Opposite: Perpetual / Enduring',
  },
};

export default function AdminWordMatrixManager() {
  const rawCustom = useSyncExternalStore(
    subscribeCustomWords,
    getRawCustomSnapshot,
    getNullSnapshot
  );
  const customPairs = useMemo(() => parseCustomWordPairs(rawCustom), [rawCustom]);
  const builtInPairs = useMemo(() => getBuiltInPoolForMode('mixed'), []);
  const totalMergedPairs = useMemo(() => getPoolForMode('mixed', customPairs), [customPairs]);

  const [subTab, setSubTab] = useState<AdminSubTab>('single');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Single Add / Edit Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [relation, setRelation] = useState<MatchRelationType>('JARGON');
  const [term, setTerm] = useState<string>('');
  const [matchText, setMatchText] = useState<string>('');
  const [examNote, setExamNote] = useState<string>('');

  // Bulk Upload State
  const [bulkDefaultRelation, setBulkDefaultRelation] = useState<MatchRelationType>('JARGON');
  const [bulkPasteText, setBulkPasteText] = useState<string>('');

  // Pool Manager Filter State
  const [poolScope, setPoolScope] = useState<'custom' | 'all'>('custom');
  const [poolCategory, setPoolCategory] = useState<'ALL' | MatchRelationType>('ALL');
  const [poolSearch, setPoolSearch] = useState<string>('');
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  useEffect(() => {
    void syncCustomWordPairsFromSupabase();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTerm('');
    setMatchText('');
    setExamNote('');
  };

  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTerm = term.trim();
    const cleanMatch = matchText.trim();
    if (!cleanTerm || !cleanMatch) {
      setStatusMsg('⚠️ Both Term/Word and Matching Definition/Meaning are required.');
      return;
    }

    setSaving(true);
    const record: WordPair = {
      id: editingId || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      term: cleanTerm,
      match: cleanMatch,
      relation,
      examNote: examNote.trim() || `${cleanTerm} → ${cleanMatch}`,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    const nextCustom = editingId
      ? customPairs.map((item) => (item.id === editingId ? record : item))
      : [record, ...customPairs];

    await saveCustomWordPairs(nextCustom);
    setSaving(false);
    setStatusMsg(
      editingId
        ? `✅ Updated "${cleanTerm}" & synced live to Word Matrix!`
        : `✅ Added "${cleanTerm}" (${relation}) & synced live to Word Matrix!`
    );
    resetForm();
  };

  const handleEditPair = (pair: WordPair) => {
    setEditingId(pair.id);
    setRelation(pair.relation);
    setTerm(pair.term);
    setMatchText(pair.match);
    setExamNote(pair.examNote);
    setSubTab('single');
    setStatusMsg(`✏️ Editing "${pair.term}" — make changes and click Update.`);
  };

  const handleDeletePair = async (pair: WordPair) => {
    const nextCustom = customPairs.filter((item) => item.id !== pair.id);
    await saveCustomWordPairs(nextCustom);
    setStatusMsg(`🗑️ Removed "${pair.term}" from custom Word Matrix pool.`);
  };

  const handleClearAllCustom = async () => {
    await saveCustomWordPairs([]);
    setConfirmClearAll(false);
    setStatusMsg('🗑️ Cleared all custom-added Word Matrix pairs (built-in 92 pairs remain intact).');
  };

  const mergeAndSaveImported = async (imported: WordPair[], sourceLabel: string) => {
    if (imported.length === 0) {
      setStatusMsg(
        `⚠️ No valid pairs detected in ${sourceLabel}. Check format or download the sample file.`
      );
      return;
    }
    setSaving(true);
    const existingKeys = new Set(
      customPairs.map((c) => `${c.relation}:${c.term.toLowerCase()}`)
    );
    const freshUnique: WordPair[] = [];
    const updatedExisting = [...customPairs];

    imported.forEach((inc) => {
      const key = `${inc.relation}:${inc.term.toLowerCase()}`;
      if (existingKeys.has(key)) {
        const idx = updatedExisting.findIndex(
          (e) => `${e.relation}:${e.term.toLowerCase()}` === key
        );
        if (idx >= 0) {
          updatedExisting[idx] = { ...updatedExisting[idx], ...inc, id: updatedExisting[idx].id };
        }
      } else {
        existingKeys.add(key);
        freshUnique.push(inc);
      }
    });

    const combined = [...freshUnique, ...updatedExisting];
    await saveCustomWordPairs(combined);
    setSaving(false);
    setStatusMsg(
      `🎉 Imported ${imported.length} Word Matrix pair(s) from ${sourceLabel} & synced live to all students!`
    );
  };

  const handleBulkPasteImport = async () => {
    if (!bulkPasteText.trim()) {
      setStatusMsg('⚠️ Paste at least one word pair before importing.');
      return;
    }
    const parsed = parseWordMatrixBulkText(bulkPasteText, bulkDefaultRelation);
    await mergeAndSaveImported(parsed, 'pasted text');
    if (parsed.length > 0) {
      setBulkPasteText('');
    }
  };

  const handleBulkFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const lower = file.name.toLowerCase();
    setStatusMsg(`⏳ Reading "${file.name}"...`);

    try {
      if (lower.endsWith('.docx')) {
        const mammoth = await import('mammoth');
        const lib = (mammoth.default || mammoth) as {
          extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
        };
        const arrayBuffer = await file.arrayBuffer();
        const { value } = await lib.extractRawText({ arrayBuffer });
        const parsed = parseWordMatrixBulkText(value, bulkDefaultRelation);
        await mergeAndSaveImported(parsed, file.name);
      } else if (lower.endsWith('.txt') || lower.endsWith('.md')) {
        const text = await file.text();
        const parsed = parseWordMatrixBulkText(text, bulkDefaultRelation);
        await mergeAndSaveImported(parsed, file.name);
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        const extracted: WordPair[] = [];

        rows.forEach((row, idx) => {
          const rawTerm = String(
            row.Term ?? row.term ?? row.Word ?? row.word ?? row['Banking Term'] ?? ''
          ).trim();
          const rawMatch = String(
            row.Match ??
              row.match ??
              row.Definition ??
              row.definition ??
              row.Meaning ??
              row.meaning ??
              row.Synonym ??
              row.Antonym ??
              ''
          ).trim();
          const rawCat = String(
            row.Category ?? row.category ?? row.Type ?? row.type ?? row.Mode ?? ''
          ).trim();
          const rawNote = String(
            row.Note ??
              row.note ??
              row['Exam Note'] ??
              row.examNote ??
              row.Explanation ??
              row.explanation ??
              ''
          ).trim();

          if (rawTerm && rawMatch) {
            extracted.push({
              id: `custom_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
              term: rawTerm,
              match: rawMatch,
              relation: rawCat
                ? normalizeRelationType(rawCat, bulkDefaultRelation)
                : bulkDefaultRelation,
              examNote: rawNote || `${rawTerm} → ${rawMatch}`,
              isCustom: true,
              createdAt: new Date().toISOString(),
            });
          }
        });

        await mergeAndSaveImported(extracted, file.name);
      } else {
        setStatusMsg(
          '❌ Unsupported file type. Upload MS Word (.docx), Excel (.xlsx/.csv), or Text (.txt).'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse uploaded file.';
      setStatusMsg(`❌ File Upload Error: ${msg}`);
    }
  };

  const downloadSampleTxt = () => {
    const blob = new Blob([SAMPLE_WORD_MATRIX_DOC_TEXT], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'word_matrix_sample_format.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleCsv = () => {
    const csvContent = [
      'Category,Term,Match,Exam Note',
      '"JARGON","Liquidity Coverage Ratio (LCR)","High-quality liquid assets banks hold for a 30-day stress scenario","Mandated under Basel III framework to prevent short-term liquidity crunch."',
      '"JARGON","Ways and Means Advances","Temporary RBI overdraft facility bridging Govt revenue-expenditure gaps","Replaced ad-hoc Treasury Bills in 1997."',
      '"DEFINITION","Ameliorate","Make something unsatisfactory or painful noticeably better","Common RC verb: policy steps to ameliorate rural distress."',
      '"SYNONYM","Inadvertent","Unintentional & Accidental","Frequently tested in banking cloze passages."',
      '"ANTONYM","Ephemeral","Opposite: Perpetual / Enduring","Ephemeral = short-lived; Perpetual = everlasting."',
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'word_matrix_sample_sheet.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const visiblePool = useMemo(() => {
    const source = poolScope === 'custom' ? customPairs : totalMergedPairs;
    const q = poolSearch.trim().toLowerCase();
    return source.filter((p) => {
      if (poolCategory !== 'ALL' && p.relation !== poolCategory) return false;
      if (!q) return true;
      return (
        p.term.toLowerCase().includes(q) ||
        p.match.toLowerCase().includes(q) ||
        p.examNote.toLowerCase().includes(q)
      );
    });
  }, [customPairs, poolCategory, poolScope, poolSearch, totalMergedPairs]);

  const currentMeta = RELATION_META[relation];

  return (
    <div className="space-y-6">
      {/* HEADER + KPI CARDS */}
      <div className="bg-slate-900 border border-white/[0.08] rounded-3xl p-6 space-y-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 block">
              4×4 Interactive Vocab &amp; Banking Jargon Engine
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
              🧩 Word Matrix — Admin Word &amp; Jargon Manager
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Add Banking Awareness Jargon, Editorial Vocabulary, Synonyms, or Antonyms individually or via MS Word / Excel. Syncs live to all students.
            </p>
          </div>

          <Link
            href="/word-matrix"
            target="_blank"
            className="px-4 py-2.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-amber-300 font-black text-xs transition flex items-center gap-1.5"
          >
            <span>🎮</span>
            <span>Open Live Word Matrix ↗</span>
          </Link>
        </div>

        {/* Pool Breakdown Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-3.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              Total Active Pool
            </span>
            <span className="text-xl font-black text-white mt-0.5 block">
              {totalMergedPairs.length}
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold">
              {builtInPairs.length} Built-in + {customPairs.length} Custom
            </span>
          </div>
          <div className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-3.5">
            <span className="text-[10px] font-bold uppercase text-amber-300 block">
              🏦 Banking Jargon
            </span>
            <span className="text-xl font-black text-white mt-0.5 block">
              {getPoolForMode('banking_jargon', customPairs).length}
            </span>
          </div>
          <div className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-3.5">
            <span className="text-[10px] font-bold uppercase text-blue-300 block">
              📰 Editorial Vocab
            </span>
            <span className="text-xl font-black text-white mt-0.5 block">
              {getPoolForMode('editorial_definitions', customPairs).length}
            </span>
          </div>
          <div className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-3.5">
            <span className="text-[10px] font-bold uppercase text-emerald-300 block">
              🔗 Synonyms
            </span>
            <span className="text-xl font-black text-white mt-0.5 block">
              {getPoolForMode('synonyms', customPairs).length}
            </span>
          </div>
          <div className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-3.5">
            <span className="text-[10px] font-bold uppercase text-purple-300 block">
              ⚖️ Antonyms
            </span>
            <span className="text-xl font-black text-white mt-0.5 block">
              {getPoolForMode('antonyms', customPairs).length}
            </span>
          </div>
        </div>

        {/* Sub-Navigation Pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { id: 'single' as const, label: editingId ? '✏️ Edit Word Pair' : '➕ Add Single Word / Jargon' },
            { id: 'bulk' as const, label: '📄 Bulk Upload (Word .docx / Excel / Paste)' },
            { id: 'manage' as const, label: `📚 Manage Word Pool (${customPairs.length} Custom)` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                subTab === tab.id
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-300 hover:text-white border border-white/[0.07]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* STATUS BANNER */}
      {statusMsg && (
        <div className="p-4 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-200 text-xs font-bold flex items-center justify-between">
          <span>{statusMsg}</span>
          <button
            type="button"
            onClick={() => setStatusMsg('')}
            className="text-blue-300 hover:text-white ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* SUB-TAB 1: ADD / EDIT SINGLE PAIR */}
      {subTab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSaveSingle}
            className="lg:col-span-2 bg-slate-900 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-black text-white">
                {editingId ? '✏️ Update Custom Word Pair' : '➕ Add New Word / Banking Jargon Pair'}
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {/* Category Selector */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Select Game Mode / Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['JARGON', 'DEFINITION', 'SYNONYM', 'ANTONYM'] as const).map((relKey) => {
                  const meta = RELATION_META[relKey];
                  const active = relation === relKey;
                  return (
                    <button
                      key={relKey}
                      type="button"
                      onClick={() => setRelation(relKey)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        active
                          ? 'bg-amber-400/15 border-amber-400 text-white'
                          : 'bg-slate-950 border-white/[0.08] text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="text-base">{meta.icon}</div>
                      <div className="text-[11px] font-black mt-1 leading-tight">{relKey}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Term Input */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Tile 1 — Term / Vocabulary Word *
              </label>
              <input
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={currentMeta.placeholderTerm}
                maxLength={60}
                required
                className="w-full bg-slate-950 border border-white/[0.12] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
              />
            </div>

            {/* Match Input */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Tile 2 — Concise Definition / Synonym / Antonym (Keep crisp for 4×4 Tile) *
              </label>
              <input
                type="text"
                value={matchText}
                onChange={(e) => setMatchText(e.target.value)}
                placeholder={currentMeta.placeholderMatch}
                maxLength={115}
                required
                className="w-full bg-slate-950 border border-white/[0.12] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                {matchText.length}/115 characters (under 90 chars looks sharpest on mobile 4×4 tiles)
              </span>
            </div>

            {/* Exam Insight Note */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Post-Round Exam Insight / Usage Example (Optional)
              </label>
              <textarea
                rows={2}
                value={examNote}
                onChange={(e) => setExamNote(e.target.value)}
                placeholder="Shown on the post-game revision sheet & saved into the student's Vault Notebook..."
                className="w-full bg-slate-950 border border-white/[0.12] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {saving
                ? 'Syncing to Supabase...'
                : editingId
                ? '💾 Update Word Pair & Sync Live'
                : '➕ Add to Word Matrix & Sync Live'}
            </button>
          </form>

          {/* LIVE 4x4 TILE PREVIEW CARD */}
          <div className="bg-slate-900 border border-white/[0.08] rounded-3xl p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                Live 4×4 Tile Preview
              </span>
              <p className="text-xs text-slate-400">
                Preview how these two partner tiles will appear inside the student&apos;s 4×4 Word Matrix grid:
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="min-h-[120px] p-3 rounded-2xl border border-amber-400/40 bg-slate-950 flex flex-col items-center justify-between text-center">
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/25">
                    {relation === 'JARGON' ? 'BANKING TERM' : 'WORD'}
                  </span>
                  <span className="text-sm font-black text-white break-words line-clamp-3 my-auto">
                    {term.trim() || 'Repo Rate'}
                  </span>
                  <span className="w-4 h-0.5 rounded-full bg-white/10" />
                </div>

                <div className="min-h-[120px] p-3 rounded-2xl border border-cyan-400/40 bg-slate-950 flex flex-col items-center justify-between text-center">
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                    {relation === 'JARGON'
                      ? 'DEFINITION'
                      : relation === 'DEFINITION'
                      ? 'MEANING'
                      : relation}
                  </span>
                  <span className="text-xs font-semibold text-slate-200 break-words line-clamp-4 leading-snug my-auto">
                    {matchText.trim() ||
                      'Rate at which RBI lends short-term funds to banks against G-Secs'}
                  </span>
                  <span className="w-4 h-0.5 rounded-full bg-white/10" />
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-white/[0.06] rounded-2xl p-3.5 text-[11px] text-slate-400 leading-relaxed">
              💡 <strong className="text-slate-200">Exam Note Preview:</strong>{' '}
              {examNote.trim() ||
                (term.trim() && matchText.trim()
                  ? `${term.trim()} → ${matchText.trim()}`
                  : 'Primary policy rate decided by RBI MPC.')}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BULK UPLOAD (MS WORD / EXCEL / PASTE) */}
      {subTab === 'bulk' && (
        <div className="bg-slate-900 border border-white/[0.08] rounded-3xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div>
              <h3 className="text-base font-black text-white">
                📄 Bulk Import via MS Word (.docx), Excel (.xlsx / .csv), or Quick Paste
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload dozens of Banking Jargon or Editorial Vocab pairs in one click. Duplicate terms in the same category update cleanly.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadSampleTxt}
                className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-amber-400/30 text-amber-300 text-xs font-bold transition cursor-pointer"
              >
                ⬇ Sample Word / Text (.txt)
              </button>
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-emerald-400/30 text-emerald-300 text-xs font-bold transition cursor-pointer"
              >
                ⬇ Sample Excel / CSV (.csv)
              </button>
            </div>
          </div>

          {/* Default Category Fallback */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                1. Default Category (if not specified inside file)
              </label>
              <select
                value={bulkDefaultRelation}
                onChange={(e) => setBulkDefaultRelation(e.target.value as MatchRelationType)}
                className="w-full bg-slate-950 border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-sm text-white font-bold"
              >
                <option value="JARGON">🏦 Financial &amp; Banking Jargon (JARGON)</option>
                <option value="DEFINITION">📰 Editorial Vocabulary Meaning (DEFINITION)</option>
                <option value="SYNONYM">🔗 Power Synonyms (SYNONYM)</option>
                <option value="ANTONYM">⚖️ Contrast Antonyms (ANTONYM)</option>
              </select>

              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block pt-2">
                2. Upload MS Word (.docx), Excel (.xlsx/.csv), or .txt File
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-amber-400/35 hover:border-amber-400 rounded-2xl p-6 bg-slate-950/70 cursor-pointer transition text-center space-y-1.5">
                <span className="text-2xl">📤</span>
                <span className="text-xs font-black text-amber-300">
                  Click to Choose .docx, .xlsx, .csv, or .txt File
                </span>
                <span className="text-[11px] text-slate-400">
                  Automatically extracts Term, Match, Category &amp; Exam Note
                </span>
                <input
                  type="file"
                  accept=".docx,.xlsx,.xls,.csv,.txt,.md"
                  onChange={handleBulkFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Direct Paste Area */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Or Paste Pairs Directly (Block Format or Term :: Match :: Note)
              </label>
              <textarea
                rows={7}
                value={bulkPasteText}
                onChange={(e) => setBulkPasteText(e.target.value)}
                placeholder={`Term: Liquidity Coverage Ratio\nMatch: High-quality liquid assets banks hold for 30-day cash stress\nNote: Mandated under Basel III.\n\nOr one-liner:\nAmeliorate :: Make a bad situation better :: Common editorial verb :: DEFINITION`}
                className="w-full bg-slate-950 border border-white/[0.12] focus:border-amber-400 rounded-2xl p-3.5 text-xs font-mono text-white outline-none"
              />
              <button
                type="button"
                disabled={saving}
                onClick={handleBulkPasteImport}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
              >
                ⚡ Parse &amp; Import Pasted Words
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: MANAGE WORD POOL */}
      {subTab === 'manage' && (
        <div className="bg-slate-900 border border-white/[0.08] rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setPoolScope('custom')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  poolScope === 'custom'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Custom Added ({customPairs.length})
              </button>
              <button
                type="button"
                onClick={() => setPoolScope('all')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  poolScope === 'all'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Active ({totalMergedPairs.length})
              </button>
            </div>

            {customPairs.length > 0 && poolScope === 'custom' && (
              <div>
                {confirmClearAll ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-300 font-bold">Delete all custom words?</span>
                    <button
                      type="button"
                      onClick={handleClearAllCustom}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-black cursor-pointer"
                    >
                      Yes, Clear All
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition cursor-pointer"
                  >
                    🗑️ Clear Custom Words
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={poolSearch}
              onChange={(e) => setPoolSearch(e.target.value)}
              placeholder="Search term, definition, synonym, antonym..."
              className="flex-1 bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-amber-400"
            />
            <div className="flex flex-wrap gap-1.5">
              {(['ALL', 'JARGON', 'DEFINITION', 'SYNONYM', 'ANTONYM'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setPoolCategory(cat)}
                  className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase border transition cursor-pointer ${
                    poolCategory === cat
                      ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                      : 'bg-slate-950 border-white/[0.07] text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {visiblePool.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/60 rounded-2xl border border-white/[0.05] space-y-2">
              <p className="text-sm font-bold text-slate-300">
                {poolScope === 'custom'
                  ? 'No custom words added yet.'
                  : 'No matching word pairs found.'}
              </p>
              {poolScope === 'custom' && (
                <button
                  type="button"
                  onClick={() => setSubTab('single')}
                  className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                >
                  ➕ Add Your First Custom Word Pair
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto pr-1 custom-scrollbar">
              {visiblePool.map((pair) => {
                const badge = RELATION_META[pair.relation].badgeCls;
                return (
                  <div
                    key={pair.id}
                    className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-4 flex flex-col justify-between gap-2.5"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-white">{pair.term}</span>
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${badge}`}
                          >
                            {pair.relation}
                          </span>
                          {pair.isCustom ? (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              Admin Custom
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                              Built-in
                            </span>
                          )}
                        </div>

                        {pair.isCustom && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditPair(pair)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold cursor-pointer"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeletePair(pair)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[11px] font-bold cursor-pointer"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>

                      <p className="text-xs font-bold text-cyan-200 leading-snug">
                        ↔ {pair.match}
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        💡 {pair.examNote}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

