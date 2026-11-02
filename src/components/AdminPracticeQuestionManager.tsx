'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import AdminPracticePricing from './AdminPracticePricing';
import {
  DEFAULT_PRACTICE_TOPICS,
  NewPracticeQuestion,
  ParsedDocQuestion,
  PracticeDifficulty,
  PracticeQuestion,
  dataUrlToBlob,
  deletePracticeQuestions,
  fetchPracticeQuestionsByTopic,
  fetchTopicCounts,
  insertPracticeQuestions,
  normaliseDifficulty,
  normaliseTopic,
  parseCorrectOption,
  parseDocQuestionLines,
  updatePracticeQuestion,
  uploadPracticeImage,
  validatePracticeQuestion,
} from '@/lib/practice';

type SubTab = 'single' | 'excel' | 'word' | 'pool' | 'pricing';
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

const inputCls =
  'w-full bg-slate-950 border border-white/[0.1] focus:border-amber-400/60 rounded-xl px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600';
const labelCls = 'text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5';

// ---------------------------------------------------------------------------
// Image picker with click / drag-drop / Ctrl+V paste support
// ---------------------------------------------------------------------------
function ImagePicker({
  label,
  file,
  existingUrl,
  onChange,
  onClearExisting,
}: {
  label: string;
  file: File | null;
  existingUrl?: string | null;
  onChange: (f: File | null) => void;
  onClearExisting?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = preview || existingUrl || null;

  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && f.type.startsWith('image/')) onChange(f);
        }}
        onPaste={(e) => {
          const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
          const f = item?.getAsFile();
          if (f) {
            e.preventDefault();
            onChange(new File([f], `pasted_${Date.now()}.png`, { type: f.type }));
          }
        }}
        className="cursor-pointer border-2 border-dashed border-white/[0.12] hover:border-amber-400/50 focus:border-amber-400/70 outline-none rounded-2xl p-3 bg-slate-950/60 transition min-h-[96px] flex items-center justify-center"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={label} className="max-h-40 rounded-lg object-contain" />
        ) : (
          <div className="text-center text-xs text-slate-500 space-y-1">
            <div className="text-2xl">🖼️</div>
            <div>Click, drag &amp; drop, or click here and press Ctrl+V to paste a screenshot</div>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      {(file || existingUrl) && (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            if (!file && onClearExisting) onClearExisting();
          }}
          className="mt-1.5 text-[11px] font-bold text-rose-300 hover:text-rose-200"
        >
          ✕ Remove image
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Topic selector (default list + any custom topic)
// ---------------------------------------------------------------------------
function TopicSelect({
  value,
  onChange,
  counts,
  extraTopics,
}: {
  value: string;
  onChange: (v: string) => void;
  counts: Record<string, number>;
  extraTopics: string[];
}) {
  const known = DEFAULT_PRACTICE_TOPICS.map((t) => t.name);
  const all = Array.from(new Set([...known, ...extraTopics]));
  const isCustom = value !== '' && !all.includes(value);
  const [custom, setCustom] = useState(isCustom);

  return (
    <div className="space-y-2">
      <select
        value={custom ? '__custom' : value}
        onChange={(e) => {
          if (e.target.value === '__custom') {
            setCustom(true);
            onChange('');
          } else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
        className={inputCls}
      >
        <option value="">— Select topic —</option>
        {all.map((t) => (
          <option key={t} value={t}>
            {t} {counts[t] ? `(${counts[t]} Qs)` : ''}
          </option>
        ))}
        <option value="__custom">➕ New custom topic…</option>
      </select>
      {custom && (
        <input
          className={inputCls}
          placeholder="Type new topic name, e.g. Linear Equations"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function AdminPracticeQuestionManager() {
  const [subTab, setSubTab] = useState<SubTab>('single');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dbError, setDbError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // ---- single question form ----
  const [editingId, setEditingId] = useState<string | null>(null);
  const [topic, setTopic] = useState('Percentage');
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>('MEDIUM');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '', '']);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [solutionText, setSolutionText] = useState('');
  const [questionImg, setQuestionImg] = useState<File | null>(null);
  const [solutionImg, setSolutionImg] = useState<File | null>(null);
  const [existingQImg, setExistingQImg] = useState<string | null>(null);
  const [existingSImg, setExistingSImg] = useState<string | null>(null);

  // ---- excel ----
  const [excelTopic, setExcelTopic] = useState('');
  const [excelRows, setExcelRows] = useState<(NewPracticeQuestion & { error: string | null; rowNo: number })[]>([]);
  const [excelFileName, setExcelFileName] = useState('');

  // ---- word ----
  const [wordTopic, setWordTopic] = useState('');
  const [wordRows, setWordRows] = useState<ParsedDocQuestion[]>([]);
  const [wordFileName, setWordFileName] = useState('');

  // ---- pool ----
  const [poolTopic, setPoolTopic] = useState('');
  const [poolQuestions, setPoolQuestions] = useState<PracticeQuestion[]>([]);
  const [poolSearch, setPoolSearch] = useState('');
  const [poolLoading, setPoolLoading] = useState(false);

  const extraTopics = Object.keys(counts);

  async function refreshCounts() {
    const { counts: c, error } = await fetchTopicCounts();
    setCounts(c);
    setDbError(error || '');
  }

  useEffect(() => {
    refreshCounts();
  }, []);

  const totalQuestions = Object.values(counts).reduce((a, b) => a + b, 0);

  // =========================================================================
  // SINGLE ADD / EDIT
  // =========================================================================
  function resetSingleForm(keepTopic = true) {
    setEditingId(null);
    if (!keepTopic) setTopic('Percentage');
    setDifficulty('MEDIUM');
    setQuestionText('');
    setOptions(['', '', '', '', '']);
    setCorrectIdx(0);
    setSolutionText('');
    setQuestionImg(null);
    setSolutionImg(null);
    setExistingQImg(null);
    setExistingSImg(null);
  }

  function loadForEdit(q: PracticeQuestion) {
    setEditingId(q.id);
    setTopic(q.topic);
    setDifficulty(q.difficulty);
    setQuestionText(q.question_text);
    const opts = [...q.options];
    while (opts.length < 5) opts.push('');
    setOptions(opts.slice(0, 5));
    setCorrectIdx(q.correct_option_index);
    setSolutionText(q.solution_text || '');
    setQuestionImg(null);
    setSolutionImg(null);
    setExistingQImg(q.question_image_url || null);
    setExistingSImg(q.solution_image_url || null);
    setSubTab('single');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSaveSingle(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg('');

    // Keep option order, but drop empty trailing options (e.g. unused option E)
    const trimmed = options.map((o) => o.trim());
    while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') trimmed.pop();
    if (trimmed.some((o) => o === '')) {
      setStatusMsg('❌ Please fill options in order (A, B, C …) without gaps.');
      return;
    }

    const draft: NewPracticeQuestion = {
      topic: normaliseTopic(topic),
      difficulty,
      question_text: questionText.trim(),
      question_image_url: existingQImg,
      options: trimmed,
      correct_option_index: correctIdx,
      solution_text: solutionText.trim() || null,
      solution_image_url: existingSImg,
    };
    const err = validatePracticeQuestion({ ...draft, question_image_url: draft.question_image_url || (questionImg ? 'pending' : null) });
    if (err) {
      setStatusMsg(`❌ ${err}`);
      return;
    }

    setBusy(true);
    try {
      if (questionImg) draft.question_image_url = await uploadPracticeImage(questionImg, 'question', questionImg.name);
      if (solutionImg) draft.solution_image_url = await uploadPracticeImage(solutionImg, 'solution', solutionImg.name);

      if (editingId) {
        const upErr = await updatePracticeQuestion(editingId, draft);
        if (upErr) throw new Error(upErr);
        setStatusMsg('✅ Question updated.');
        setPoolQuestions((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...draft } : p)));
      } else {
        const { error } = await insertPracticeQuestions([draft]);
        if (error) throw new Error(error);
        setStatusMsg(`✅ Question added to "${draft.topic}" pool.`);
      }
      resetSingleForm(true);
      refreshCounts();
    } catch (ex: any) {
      setStatusMsg(`❌ ${ex.message || 'Failed to save question'}`);
    } finally {
      setBusy(false);
    }
  }

  // =========================================================================
  // EXCEL / CSV
  // =========================================================================
  function downloadExcelTemplate() {
    const rows = [
      {
        Topic: 'Percentage',
        Difficulty: 'Easy',
        Question: 'If 20% of a number is 40, what is the number?',
        'Option A': '100',
        'Option B': '200',
        'Option C': '300',
        'Option D': '400',
        'Option E': '',
        Answer: 'B',
        Solution: '20% = 40, so 100% = 40 × 5 = 200',
        'Question Image URL': '',
        'Solution Image URL': '',
      },
      {
        Topic: 'Time & Work',
        Difficulty: 'Medium',
        Question: 'A can do a work in 10 days and B in 15 days. In how many days can they finish it together?',
        'Option A': '5',
        'Option B': '6',
        'Option C': '8',
        'Option D': '12',
        'Option E': '',
        Answer: 'B',
        Solution: 'Total work = LCM(10,15) = 30 units. A = 3/day, B = 2/day → 30 / 5 = 6 days',
        'Question Image URL': '',
        'Solution Image URL': '',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 60 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 60 }, { wch: 30 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Practice Questions');
    XLSX.writeFile(wb, 'practice_questions_template.xlsx');
  }

  function pick(row: Record<string, any>, ...keys: string[]): string {
    const map: Record<string, any> = {};
    Object.keys(row).forEach((k) => (map[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = row[k]));
    for (const k of keys) {
      const v = map[k.toLowerCase().replace(/[^a-z0-9]/g, '')];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }

  async function handleExcelFile(file: File) {
    setStatusMsg('');
    setExcelFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const parsed: (NewPracticeQuestion & { error: string | null; rowNo: number })[] = [];

      wb.SheetNames.forEach((sheetName) => {
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[sheetName], { defval: '' });
        json.forEach((row, i) => {
          const opts = OPTION_LETTERS.map((L) => pick(row, `Option ${L}`, `Opt ${L}`, `Option${L}`, L));
          while (opts.length && opts[opts.length - 1] === '') opts.pop();
          const question = pick(row, 'Question', 'Question Text', 'Questions');
          if (!question && opts.length === 0) return; // blank row
          const q: NewPracticeQuestion = {
            topic: normaliseTopic(pick(row, 'Topic', 'Chapter') || excelTopic || (wb.SheetNames.length > 1 ? sheetName : '')),
            difficulty: normaliseDifficulty(pick(row, 'Difficulty', 'Level')),
            question_text: question,
            question_image_url: pick(row, 'Question Image URL', 'Question Image', 'Image URL') || null,
            options: opts,
            correct_option_index: parseCorrectOption(pick(row, 'Answer', 'Correct Answer', 'Correct Option', 'Correct', 'Key'), opts.length),
            solution_text: pick(row, 'Solution', 'Explanation') || null,
            solution_image_url: pick(row, 'Solution Image URL', 'Solution Image') || null,
          };
          parsed.push({ ...q, error: validatePracticeQuestion(q), rowNo: i + 2 });
        });
      });

      setExcelRows(parsed);
      if (parsed.length === 0) setStatusMsg('❌ No questions found. Please use the template column headers.');
    } catch (ex: any) {
      setStatusMsg(`❌ Could not read file: ${ex.message}`);
    }
  }

  async function importExcelRows() {
    const valid = excelRows.filter((r) => !r.error).map(({ error, rowNo, ...q }) => q);
    if (valid.length === 0) return;
    setBusy(true);
    const { inserted, error } = await insertPracticeQuestions(valid);
    setBusy(false);
    if (error) {
      setStatusMsg(`❌ Imported ${inserted} questions, then failed: ${error}`);
    } else {
      setStatusMsg(`✅ Imported ${inserted} questions from ${excelFileName}.`);
      setExcelRows([]);
      setExcelFileName('');
    }
    refreshCounts();
  }

  // =========================================================================
  // WORD (.docx)
  // =========================================================================
  async function handleWordFile(file: File) {
    setStatusMsg('');
    setWordFileName(file.name);
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setStatusMsg('❌ Only .docx files are supported. In Word use File → Save As → Word Document (.docx).');
      return;
    }
    setBusy(true);
    try {
      const mammoth: any = await import('mammoth');
      const lib = mammoth.default || mammoth;
      const arrayBuffer = await file.arrayBuffer();
      const { value: html } = await lib.convertToHtml({ arrayBuffer });

      const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
      const blocks = Array.from(doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li')).filter(
        (el) => !el.querySelector('p, h1, h2, h3, h4, h5, h6, li')
      );

      const lines: string[] = [];
      const images: string[] = [];
      blocks.forEach((block) => {
        let text = '';
        const walk = (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent || '';
          } else if (node.nodeName === 'IMG') {
            if (text.trim()) lines.push(text);
            text = '';
            const src = (node as HTMLImageElement).getAttribute('src') || '';
            if (src.startsWith('data:image')) {
              images.push(src);
              lines.push(`[[IMG:${images.length - 1}]]`);
            }
          } else if (node.nodeName === 'BR') {
            if (text.trim()) lines.push(text);
            text = '';
          } else {
            node.childNodes.forEach(walk);
          }
        };
        block.childNodes.forEach(walk);
        if (text.trim()) lines.push(text);
      });

      const parsed = parseDocQuestionLines(lines, images, wordTopic);
      setWordRows(parsed);
      if (parsed.length === 0) {
        setStatusMsg('❌ No questions detected. Make sure each question starts with "Q1." and has "Answer: B".');
      }
    } catch (ex: any) {
      setStatusMsg(`❌ Could not read Word file: ${ex.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function importWordRows() {
    const valid = wordRows.filter((r) => !r.error);
    if (valid.length === 0) return;
    setBusy(true);
    try {
      const rows: NewPracticeQuestion[] = [];
      for (let i = 0; i < valid.length; i++) {
        const r = valid[i];
        setStatusMsg(`⏳ Uploading images & preparing question ${i + 1} / ${valid.length}…`);
        let qUrl: string | null = null;
        let sUrl: string | null = null;
        if (r.questionImageData) {
          const { blob, ext } = dataUrlToBlob(r.questionImageData);
          qUrl = await uploadPracticeImage(blob, 'question', `q.${ext}`);
        }
        if (r.solutionImageData) {
          const { blob, ext } = dataUrlToBlob(r.solutionImageData);
          sUrl = await uploadPracticeImage(blob, 'solution', `s.${ext}`);
        }
        rows.push({
          topic: r.topic,
          difficulty: r.difficulty,
          question_text: r.question_text,
          question_image_url: qUrl,
          options: r.options,
          correct_option_index: r.correct_option_index,
          solution_text: r.solution_text || null,
          solution_image_url: sUrl,
        });
      }
      const { inserted, error } = await insertPracticeQuestions(rows);
      if (error) throw new Error(`Imported ${inserted}, then failed: ${error}`);
      setStatusMsg(`✅ Imported ${inserted} questions from ${wordFileName}.`);
      setWordRows([]);
      setWordFileName('');
      refreshCounts();
    } catch (ex: any) {
      setStatusMsg(`❌ ${ex.message}`);
    } finally {
      setBusy(false);
    }
  }

  // =========================================================================
  // POOL
  // =========================================================================
  async function loadPool(t: string) {
    setPoolTopic(t);
    if (!t) {
      setPoolQuestions([]);
      return;
    }
    setPoolLoading(true);
    const { data, error } = await fetchPracticeQuestionsByTopic(t);
    setPoolLoading(false);
    setPoolQuestions(data);
    if (error) setStatusMsg(`❌ ${error}`);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this question permanently?')) return;
    const err = await deletePracticeQuestions([id]);
    if (err) {
      setStatusMsg(`❌ ${err}`);
      return;
    }
    setPoolQuestions((prev) => prev.filter((q) => q.id !== id));
    refreshCounts();
  }

  async function handleQuickSolutionImage(q: PracticeQuestion, file: File) {
    setBusy(true);
    try {
      const url = await uploadPracticeImage(file, 'solution', file.name);
      const err = await updatePracticeQuestion(q.id, { solution_image_url: url });
      if (err) throw new Error(err);
      setPoolQuestions((prev) => prev.map((p) => (p.id === q.id ? { ...p, solution_image_url: url } : p)));
      setStatusMsg('✅ Solution image attached.');
    } catch (ex: any) {
      setStatusMsg(`❌ ${ex.message}`);
    } finally {
      setBusy(false);
    }
  }

  const filteredPool = poolQuestions.filter(
    (q) => !poolSearch.trim() || q.question_text.toLowerCase().includes(poolSearch.toLowerCase())
  );

  // =========================================================================
  // RENDER
  // =========================================================================
  const subTabs: { id: SubTab; label: string }[] = [
    { id: 'single', label: editingId ? '✏️ Edit Question' : '➕ Add One-by-One' },
    { id: 'excel', label: '📊 Excel / CSV Upload' },
    { id: 'word', label: '📝 Word (.docx) Upload' },
    { id: 'pool', label: '🗂️ Question Pool & Solutions' },
    { id: 'pricing', label: '💰 Pricing & Plans' },
  ];

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Topic-wise Practice</span>
          <h2 className="text-xl font-black text-white">🧮 Practice Question Pool</h2>
          <p className="text-xs text-slate-400 mt-1">
            Students pick a topic and get {10} random questions with a timer from this pool. Add questions with optional question &amp; solution images.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-3.5 py-2 text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 block">Cloud Status</span>
            <span className="text-xs font-black text-emerald-300">☁️ Active &amp; Synced</span>
          </div>
          <div className="bg-slate-950/70 border border-white/[0.08] rounded-2xl px-4 py-2.5 text-center">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Qs</span>
            <span className="text-xl font-black text-amber-400">{totalQuestions}</span>
          </div>
          <div className="bg-slate-950/70 border border-white/[0.08] rounded-2xl px-4 py-2.5 text-center">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Topics</span>
            <span className="text-xl font-black text-blue-400">{Object.keys(counts).length}</span>
          </div>
        </div>
      </div>

      {dbError && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-bold space-y-1">
          <div>ℹ️ {dbError}</div>
        </div>
      )}

      {/* Sub tabs */}
      <div className="flex flex-wrap gap-2">
        {subTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setSubTab(t.id);
              setStatusMsg('');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              subTab === t.id
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow'
                : 'bg-slate-950/80 text-slate-300 hover:text-white border border-white/[0.08]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-100 text-xs font-bold flex justify-between gap-4">
          <span>{statusMsg}</span>
          <button type="button" onClick={() => setStatusMsg('')} className="text-blue-300 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* ================= PRICING ================= */}
      {subTab === 'pricing' && <AdminPracticePricing />}

      {/* ================= SINGLE ================= */}
      {subTab === 'single' && (
        <form onSubmit={handleSaveSingle} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={labelCls}>Topic</span>
                <TopicSelect value={topic} onChange={setTopic} counts={counts} extraTopics={extraTopics} />
              </div>
              <div>
                <span className={labelCls}>Difficulty</span>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as PracticeDifficulty)} className={inputCls}>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
            </div>

            <div>
              <span className={labelCls}>Question</span>
              <textarea
                rows={4}
                className={inputCls}
                placeholder="Type the question…"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
              />
            </div>

            <ImagePicker
              label="Question image (optional – for DI charts, figures)"
              file={questionImg}
              existingUrl={existingQImg}
              onChange={setQuestionImg}
              onClearExisting={() => setExistingQImg(null)}
            />

            <div className="space-y-2">
              <span className={labelCls}>Options (select the correct one) – E is optional</span>
              {OPTION_LETTERS.map((L, i) => (
                <div key={L} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrectIdx(i)}
                    className={`w-9 h-9 shrink-0 rounded-xl text-xs font-black border transition ${
                      correctIdx === i
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-950 text-slate-400 border-white/[0.1] hover:border-emerald-400/50'
                    }`}
                    title="Mark as correct answer"
                  >
                    {correctIdx === i ? '✓' : L}
                  </button>
                  <input
                    className={inputCls}
                    placeholder={`Option ${L}${i === 4 ? ' (optional)' : ''}`}
                    value={options[i]}
                    onChange={(e) => setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <span className={labelCls}>Solution / Explanation (text)</span>
              <textarea
                rows={6}
                className={inputCls}
                placeholder="Step-by-step solution (optional if you upload a solution image)"
                value={solutionText}
                onChange={(e) => setSolutionText(e.target.value)}
              />
            </div>

            <ImagePicker
              label="Solution image (handwritten / typed solution screenshot)"
              file={solutionImg}
              existingUrl={existingSImg}
              onChange={setSolutionImg}
              onClearExisting={() => setExistingSImg(null)}
            />

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl shadow-lg transition"
              >
                {busy ? 'Saving…' : editingId ? '💾 Update Question' : '➕ Add to Pool'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => resetSingleForm(true)}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm rounded-xl transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {/* ================= EXCEL ================= */}
      {subTab === 'excel' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-slate-950/60 border border-white/[0.08] rounded-2xl p-4 text-xs text-slate-300 space-y-2">
              <p className="font-black text-white text-sm">Column headers</p>
              <p>
                <code className="text-amber-300">Topic</code>, <code className="text-amber-300">Difficulty</code>,{' '}
                <code className="text-amber-300">Question</code>, <code className="text-amber-300">Option A … Option E</code>,{' '}
                <code className="text-amber-300">Answer</code> (A/B/C/D/E or 1-5), <code className="text-amber-300">Solution</code>,{' '}
                <code className="text-amber-300">Question Image URL</code>, <code className="text-amber-300">Solution Image URL</code>
              </p>
              <p className="text-slate-400">
                Only Question, options and Answer are required. If Topic is empty, the default topic on the right is used. Solution images can
                also be attached later from the <b>Question Pool</b> tab.
              </p>
              <button
                type="button"
                onClick={downloadExcelTemplate}
                className="mt-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition"
              >
                ⬇️ Download Excel Template
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <span className={labelCls}>Default topic (when column is empty)</span>
                <TopicSelect value={excelTopic} onChange={setExcelTopic} counts={counts} extraTopics={extraTopics} />
              </div>
              <label className="block cursor-pointer border-2 border-dashed border-white/[0.12] hover:border-amber-400/50 rounded-2xl p-5 text-center text-xs text-slate-400 transition">
                <div className="text-2xl mb-1">📊</div>
                {excelFileName || 'Choose .xlsx / .xls / .csv file'}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleExcelFile(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          {excelRows.length > 0 && (
            <PreviewTable
              rows={excelRows.map((r) => ({
                key: `${r.rowNo}`,
                label: `Row ${r.rowNo}`,
                topic: r.topic,
                question: r.question_text,
                options: r.options,
                correct: r.correct_option_index,
                hasQImg: !!r.question_image_url,
                hasSImg: !!r.solution_image_url,
                hasSolution: !!r.solution_text,
                error: r.error,
              }))}
              busy={busy}
              onImport={importExcelRows}
              onClear={() => {
                setExcelRows([]);
                setExcelFileName('');
              }}
            />
          )}
        </div>
      )}

      {/* ================= WORD ================= */}
      {subTab === 'word' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-slate-950/60 border border-white/[0.08] rounded-2xl p-4 text-xs text-slate-300 space-y-2">
              <p className="font-black text-white text-sm">Word file format</p>
              <pre className="bg-slate-900 border border-white/[0.06] rounded-xl p-3 text-[11px] text-emerald-200 whitespace-pre-wrap leading-relaxed">{`Topic: Percentage
Q1. If 20% of a number is 40, find the number.
A) 100
B) 200
C) 300
D) 400
Answer: B
Difficulty: Easy
Solution: 20% = 40, so 100% = 200
[paste solution image here – optional]

Q2. ...`}</pre>
              <p className="text-slate-400">
                Start every question with <b>Q1.</b>, <b>Q2.</b> … · Options can be on separate lines or one line (A) 10 B) 20 …) ·
                Images placed <b>before the options</b> become the question image, images placed <b>after “Solution:”</b> become the solution
                image. <b>Topic:</b> lines switch the topic for the following questions.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <span className={labelCls}>Default topic (if file has no “Topic:” line)</span>
                <TopicSelect value={wordTopic} onChange={setWordTopic} counts={counts} extraTopics={extraTopics} />
              </div>
              <label className="block cursor-pointer border-2 border-dashed border-white/[0.12] hover:border-amber-400/50 rounded-2xl p-5 text-center text-xs text-slate-400 transition">
                <div className="text-2xl mb-1">📝</div>
                {busy && !wordRows.length ? 'Reading file…' : wordFileName || 'Choose .docx file'}
                <input
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleWordFile(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          {wordRows.length > 0 && (
            <PreviewTable
              rows={wordRows.map((r, i) => ({
                key: `${i}`,
                label: `Q${i + 1}`,
                topic: r.topic,
                question: r.question_text,
                options: r.options,
                correct: r.correct_option_index,
                hasQImg: !!r.questionImageData,
                hasSImg: !!r.solutionImageData,
                hasSolution: !!r.solution_text,
                error: r.error || null,
                qImgSrc: r.questionImageData,
                sImgSrc: r.solutionImageData,
              }))}
              busy={busy}
              onImport={importWordRows}
              onClear={() => {
                setWordRows([]);
                setWordFileName('');
              }}
            />
          )}
        </div>
      )}

      {/* ================= POOL ================= */}
      {subTab === 'pool' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {Object.keys(counts).length === 0 && <p className="text-xs text-slate-500">No questions in the pool yet.</p>}
            {Object.entries(counts)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([t, c]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => loadPool(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    poolTopic === t
                      ? 'bg-amber-400 text-slate-950 border-amber-400'
                      : 'bg-slate-950/80 text-slate-300 border-white/[0.08] hover:text-white'
                  }`}
                >
                  {t} <span className="opacity-70">({c})</span>
                </button>
              ))}
          </div>

          {poolTopic && (
            <>
              <input
                className={inputCls}
                placeholder={`Search in ${poolTopic}…`}
                value={poolSearch}
                onChange={(e) => setPoolSearch(e.target.value)}
              />
              {poolLoading ? (
                <p className="text-xs text-slate-400">Loading…</p>
              ) : (
                <div className="space-y-3">
                  {filteredPool.map((q, idx) => (
                    <div key={q.id} className="bg-slate-950/70 border border-white/[0.08] rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                            <span className="text-slate-500">#{idx + 1}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full border ${
                                q.difficulty === 'EASY'
                                  ? 'text-emerald-300 border-emerald-500/30'
                                  : q.difficulty === 'HARD'
                                  ? 'text-rose-300 border-rose-500/30'
                                  : 'text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {q.difficulty}
                            </span>
                            {!q.solution_text && !q.solution_image_url && (
                              <span className="px-2 py-0.5 rounded-full border text-rose-300 border-rose-500/30">No solution</span>
                            )}
                          </div>
                          <p className="text-sm text-white whitespace-pre-wrap">{q.question_text}</p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {q.options.map((o, i) => (
                              <span
                                key={i}
                                className={`text-[11px] px-2 py-1 rounded-lg border ${
                                  i === q.correct_option_index
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 font-bold'
                                    : 'border-white/[0.08] text-slate-400'
                                }`}
                              >
                                {OPTION_LETTERS[i]}) {o}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => loadForEdit(q)}
                            className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white"
                          >
                            ✏️ Edit
                          </button>
                          <label className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white cursor-pointer text-center">
                            🖼️ {q.solution_image_url ? 'Replace' : 'Add'} Sol. Img
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleQuickSolutionImage(q, f);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleDelete(q.id)}
                            className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                      {(q.question_image_url || q.solution_image_url) && (
                        <div className="flex gap-3">
                          {q.question_image_url && (
                            <a href={q.question_image_url} target="_blank" rel="noreferrer" className="block">
                              <span className="text-[10px] text-slate-500 block">Question image</span>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={q.question_image_url} alt="question" className="h-20 rounded-lg border border-white/[0.08]" />
                            </a>
                          )}
                          {q.solution_image_url && (
                            <a href={q.solution_image_url} target="_blank" rel="noreferrer" className="block">
                              <span className="text-[10px] text-slate-500 block">Solution image</span>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={q.solution_image_url} alt="solution" className="h-20 rounded-lg border border-white/[0.08]" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredPool.length === 0 && <p className="text-xs text-slate-500">No questions match.</p>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared preview table for Excel & Word imports
// ---------------------------------------------------------------------------
function PreviewTable({
  rows,
  busy,
  onImport,
  onClear,
}: {
  rows: {
    key: string;
    label: string;
    topic: string;
    question: string;
    options: string[];
    correct: number;
    hasQImg: boolean;
    hasSImg: boolean;
    hasSolution: boolean;
    error: string | null;
    qImgSrc?: string;
    sImgSrc?: string;
  }[];
  busy: boolean;
  onImport: () => void;
  onClear: () => void;
}) {
  const validCount = rows.filter((r) => !r.error).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-300">
          Preview: <span className="text-emerald-400">{validCount} ready</span>
          {invalidCount > 0 && <span className="text-rose-400"> · {invalidCount} with errors (will be skipped)</span>}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onClear} className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200">
            Clear
          </button>
          <button
            type="button"
            disabled={busy || validCount === 0}
            onClick={onImport}
            className="px-5 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 disabled:opacity-50"
          >
            {busy ? 'Importing…' : `⬆️ Import ${validCount} Questions`}
          </button>
        </div>
      </div>

      <div className="max-h-[520px] overflow-y-auto space-y-2 pr-1">
        {rows.map((r) => (
          <div
            key={r.key}
            className={`rounded-2xl border p-3 text-xs space-y-1.5 ${
              r.error ? 'bg-rose-500/5 border-rose-500/30' : 'bg-slate-950/70 border-white/[0.08]'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase">
              <span className="text-slate-500">{r.label}</span>
              <span className="text-amber-300">{r.topic || 'NO TOPIC'}</span>
              {r.hasQImg && <span className="text-blue-300">🖼️ Q-img</span>}
              {r.hasSolution && <span className="text-emerald-300">✓ Solution</span>}
              {r.hasSImg && <span className="text-emerald-300">🖼️ Sol-img</span>}
              {r.error && <span className="text-rose-300 normal-case">⚠️ {r.error}</span>}
            </div>
            <p className="text-slate-200 whitespace-pre-wrap">{r.question || <i className="text-slate-500">(image only)</i>}</p>
            <div className="flex flex-wrap gap-1.5">
              {r.options.map((o, i) => (
                <span
                  key={i}
                  className={`px-2 py-0.5 rounded-lg border ${
                    i === r.correct ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 font-bold' : 'border-white/[0.08] text-slate-400'
                  }`}
                >
                  {OPTION_LETTERS[i] || i + 1}) {o}
                </span>
              ))}
            </div>
            {(r.qImgSrc || r.sImgSrc) && (
              <div className="flex gap-2 pt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.qImgSrc && <img src={r.qImgSrc} alt="q" className="h-14 rounded border border-white/[0.08]" />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.sImgSrc && <img src={r.sImgSrc} alt="s" className="h-14 rounded border border-emerald-500/30" />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

