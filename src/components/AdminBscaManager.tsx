'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ThemeToggle from '@/components/ThemeToggle';
import {
  BSCA_CATEGORIES,
  BscaArticle,
  BscaCapsule,
  BscaCategory,
  BscaDayPdf,
  createBscaDayPdf,
  updateBscaDayPdf,
  deleteBscaDayPdf,
  extractTextFromUploadedDoc,
  fetchBscaArticles,
  fetchBscaCapsules,
  fetchBscaCourses,
  fetchBscaDayPdfs,
  getCategoryMeta,
  getPdfYearAndMonth,
  MONTH_NAMES,
  parseBscaDocText,
  SAMPLE_BSCA_ARTICLES_FORMAT,
  saveBscaArticles,
  saveBscaCapsules,
} from '@/lib/bsca';
import AdminBscaPricing from './AdminBscaPricing';

export type BscaAdminSubTab =
  | 'articles_doc'
  | 'quiz_word'
  | 'word'
  | 'paste'
  | 'manual'
  | 'daypdfs'
  | 'capsules'
  | 'pricing'
  | 'manage';

type SubTab = BscaAdminSubTab;

const SAMPLE_QUIZ_FORMAT_TEXT = `BSCA Daily Current Affairs & GA Quiz
Date: ${new Date().toISOString().slice(0, 10)}

Q1. Which regulatory body in India recently introduced the comprehensive regulatory framework on digital lending and unauthorized loan apps?
(A) Securities and Exchange Board of India (SEBI)
(B) Reserve Bank of India (RBI)
(C) Insurance Regulatory and Development Authority (IRDAI)
(D) Pension Fund Regulatory and Development Authority (PFRDA)
(E) National Bank for Agriculture and Rural Development (NABARD)
Ans: (B)
Explanation: The Reserve Bank of India (RBI) issued regulatory guidelines for digital lending to protect borrowers from predatory lending practices.

Q2. Who among the following has been appointed as the Executive Director for India at the International Monetary Fund (IMF)?
(A) Raghuram Rajan
(B) Viral Acharya
(C) Urjit Patel
(D) K.V. Subramanian
(E) Arvind Subramanian
Ans: (D)
Explanation: Former Chief Economic Adviser K.V. Subramanian was appointed as the Executive Director (India) at the International Monetary Fund (IMF).`;

interface ParsedQuizQuestion {
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation?: string;
}

interface PublishedQuizItem {
  id: string;
  title: string;
  quiz_date: string;
  duration_minutes: number;
}

function getErrMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const inputCls =
  'w-full bg-slate-950 border border-white/[0.1] focus:border-amber-400/60 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600';
const labelCls = 'text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5';

export default function AdminBscaManager({
  initialSubTab = 'quiz_word',
}: {
  initialSubTab?: BscaAdminSubTab;
} = {}) {
  const [subTab, setSubTab] = useState<SubTab>(initialSubTab);
  const [statusMsg, setStatusMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Dedicated BSCA Articles Doc (.doc / .docx) Upload & Update States
  const [docArticlesFileName, setDocArticlesFileName] = useState('');
  const [docArticlesDate, setDocArticlesDate] = useState(new Date().toISOString().slice(0, 10));
  const [docArticlesUpdateMode, setDocArticlesUpdateMode] = useState<'replace' | 'append'>('replace');
  const [docAutoDetectDate, setDocAutoDetectDate] = useState(true);
  const [docParsedArticles, setDocParsedArticles] = useState<Omit<BscaArticle, 'id'>[]>([]);
  const [copiedArticlesFormat, setCopiedArticlesFormat] = useState(false);
  const [showArticlesFormatGuide, setShowArticlesFormatGuide] = useState(false);

  // Inline Edit State for Already-Published Articles
  const [editingPubId, setEditingPubId] = useState<string | null>(null);
  const [editPubTitle, setEditPubTitle] = useState('');
  const [editPubCategory, setEditPubCategory] = useState<BscaCategory>('BANKING_FINANCE');
  const [editPubBullets, setEditPubBullets] = useState('');
  const [editPubKeyStats, setEditPubKeyStats] = useState('');
  const [editPubStaticGk, setEditPubStaticGk] = useState('');

  // Dedicated BSCA Quiz Word Upload States
  const [quizWordFileName, setQuizWordFileName] = useState('');
  const [quizWordDate, setQuizWordDate] = useState(new Date().toISOString().slice(0, 10));
  const [quizWordTitle, setQuizWordTitle] = useState(`BSCA Daily GA Quiz – ${new Date().toISOString().slice(0, 10)}`);
  const [quizWordDuration, setQuizWordDuration] = useState(10);
  const [quizWordQuestions, setQuizWordQuestions] = useState<ParsedQuizQuestion[]>([]);
  const [copiedFormat, setCopiedFormat] = useState(false);
  const [showFormatGuide, setShowFormatGuide] = useState(false);

  // Word Upload & Parsed States
  const [fileName, setFileName] = useState('');
  const [parsedDate, setParsedDate] = useState(new Date().toISOString().slice(0, 10));
  const [quizDuration, setQuizDuration] = useState(10);
  const [parsedArticles, setParsedArticles] = useState<Omit<BscaArticle, 'id'>[]>([]);
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuizQuestion[]>([]);

  // Direct Text Paste States
  const [rawTextPaste, setRawTextPaste] = useState('');

  // Manual Article Entry States
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualTitle, setManualTitle] = useState('');
  const [manualCategory, setManualCategory] = useState<BscaCategory>('BANKING_FINANCE');
  const [manualBulletsText, setManualBulletsText] = useState('');
  const [manualStaticGkText, setManualStaticGkText] = useState('');
  const [manualKeyStats, setManualKeyStats] = useState('');

  // Day-Wise CA PDFs (AffairsCloud style)
  const [dayPdfs, setDayPdfs] = useState<BscaDayPdf[]>([]);
  const [bscaCourses, setBscaCourses] = useState<{ id: string; title: string }[]>([]);
  const [dayFilterMonth, setDayFilterMonth] = useState('ALL');
  const [dayFilterYear, setDayFilterYear] = useState('ALL');
  const [daySearchQuery, setDaySearchQuery] = useState('');
  const [newDayCourseId, setNewDayCourseId] = useState('');
  const [newDayNumber, setNewDayNumber] = useState(25);
  const [newDayDate, setNewDayDate] = useState(new Date().toISOString().slice(0, 10));
  const [newDayTitle, setNewDayTitle] = useState('');
  const [newDayPdfUrl, setNewDayPdfUrl] = useState('');
  const [newDayHindiPdfUrl, setNewDayHindiPdfUrl] = useState('');
  const [newDayTopics, setNewDayTopics] = useState('');
  const [isUploadingDayFile, setIsUploadingDayFile] = useState(false);
  const [isUploadingDayHindiFile, setIsUploadingDayHindiFile] = useState(false);
  const [editingDayPdfId, setEditingDayPdfId] = useState<string | null>(null);
  const [editingDayHindiUrl, setEditingDayHindiUrl] = useState<string>('');

  // Capsules
  const [capsules, setCapsules] = useState<BscaCapsule[]>([]);
  const [newCapTitle, setNewCapTitle] = useState('');
  const [newCapMonth, setNewCapMonth] = useState('');
  const [newCapCategory, setNewCapCategory] = useState<'MONTHLY_FULL' | 'BANKING_AWARENESS' | 'RBI_CIRCULARS' | 'BUDGET_SCHEMES'>('MONTHLY_FULL');
  const [newCapUrl, setNewCapUrl] = useState('');
  const [newCapBadge, setNewCapBadge] = useState('MUST REVISE');
  const [newCapHighlights, setNewCapHighlights] = useState('');
  const [isUploadingCapFile, setIsUploadingCapFile] = useState(false);

  // Existing Published
  const [publishedArticles, setPublishedArticles] = useState<BscaArticle[]>([]);
  const [publishedQuizzes, setPublishedQuizzes] = useState<PublishedQuizItem[]>([]);
  const [manageFilterDate, setManageFilterDate] = useState('ALL');

  const refreshPublishedData = useCallback(async () => {
    setBusy(true);
    const [arts, caps, dPdfs, courses] = await Promise.all([
      fetchBscaArticles(),
      fetchBscaCapsules(),
      fetchBscaDayPdfs(),
      fetchBscaCourses(),
    ]);
    setPublishedArticles(arts);
    setCapsules(caps.filter((c: BscaCapsule) => c.pdf_url && c.pdf_url !== '/courses'));
    setDayPdfs(dPdfs);
    setBscaCourses(courses);
    if (courses.length > 0 && !newDayCourseId) {
      setNewDayCourseId(courses[0].id);
    }

    const { data: qData } = await supabase
      .from('bsca_quizzes')
      .select('*')
      .order('quiz_date', { ascending: false });

    if (qData) setPublishedQuizzes(qData as PublishedQuizItem[]);
    setBusy(false);
  }, [newDayCourseId]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const [arts, caps, dPdfs, courses] = await Promise.all([
        fetchBscaArticles(),
        fetchBscaCapsules(),
        fetchBscaDayPdfs(),
        fetchBscaCourses(),
      ]);
      if (!mounted) return;
      setPublishedArticles(arts);
      setCapsules(caps.filter((c: BscaCapsule) => c.pdf_url && c.pdf_url !== '/courses'));
      setDayPdfs(dPdfs);
      setBscaCourses(courses);
      if (courses.length > 0 && !newDayCourseId) {
        setNewDayCourseId(courses[0].id);
      }

      const { data: qData } = await supabase
        .from('bsca_quizzes')
        .select('*')
        .order('quiz_date', { ascending: false });

      if (qData && mounted) setPublishedQuizzes(qData as PublishedQuizItem[]);
    };

    void init();

    return () => {
      mounted = false;
    };
  }, [newDayCourseId]);

  // =========================================================================
  // 0A. DEDICATED BSCA ARTICLES DOC (.doc / .docx) UPLOADER & UPDATER
  // =========================================================================
  function handleCopyArticlesFormat() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(SAMPLE_BSCA_ARTICLES_FORMAT);
      setCopiedArticlesFormat(true);
      setTimeout(() => setCopiedArticlesFormat(false), 2500);
    }
  }

  async function handleArticlesDocFile(file: File) {
    setStatusMsg('');
    setDocArticlesFileName(file.name);
    setBusy(true);

    try {
      const rawText = await extractTextFromUploadedDoc(file);
      const result = parseBscaDocText(rawText, docArticlesDate, 'articles_only');

      const effectiveDate = docAutoDetectDate && result.date ? result.date : docArticlesDate;
      if (docAutoDetectDate && result.date) {
        setDocArticlesDate(result.date);
      }

      const normalizedArticles = result.articles.map((a) => ({
        ...a,
        date: effectiveDate,
      }));
      setDocParsedArticles(normalizedArticles);

      if (normalizedArticles.length === 0) {
        setStatusMsg(
          '⚠️ No articles were detected in the uploaded doc file. Check the Sample Doc Format Guide above for category headers, headlines, and bullets.'
        );
      } else {
        const existingCount = publishedArticles.filter((a) => a.date === effectiveDate).length;
        setStatusMsg(
          `✅ Extracted ${normalizedArticles.length} current affairs articles from "${file.name}" for ${effectiveDate}` +
            (existingCount > 0 && docArticlesUpdateMode === 'replace'
              ? ` (ready to update & replace ${existingCount} existing articles on ${effectiveDate}).`
              : existingCount > 0
                ? ` (ready to append alongside ${existingCount} existing articles on ${effectiveDate}).`
                : '!')
        );
      }
    } catch (err: unknown) {
      setStatusMsg(`❌ Error reading doc file: ${getErrMsg(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function handleUpdateDocParsedArticle(index: number, patch: Partial<Omit<BscaArticle, 'id'>>) {
    setDocParsedArticles((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function handleRemoveDocParsedArticle(index: number) {
    setDocParsedArticles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddBlankDocArticle() {
    setDocParsedArticles((prev) => [
      ...prev,
      {
        date: docArticlesDate,
        title: 'New Current Affairs Headline',
        category: 'BANKING_FINANCE',
        bullets: ['Key exam-relevant takeaway point 1.'],
        staticGk: [],
        readTimeMin: 1,
        importance: 'HIGH',
      },
    ]);
  }

  async function handlePublishDocArticles() {
    if (docParsedArticles.length === 0) {
      return setStatusMsg('❌ No extracted articles to publish. Upload a .doc / .docx file first.');
    }
    if (!docArticlesDate) {
      return setStatusMsg('❌ Please choose a target publication date.');
    }

    setBusy(true);
    setStatusMsg(
      docArticlesUpdateMode === 'replace'
        ? `🔄 Updating BSCA articles for ${docArticlesDate}…`
        : `➕ Appending BSCA articles to ${docArticlesDate}…`
    );

    try {
      const nowIso = new Date().toISOString();
      const newRecords: BscaArticle[] = docParsedArticles
        .filter((a) => a.title.trim().length > 0)
        .map((art, idx) => ({
          ...art,
          id: `art_${docArticlesDate}_${Date.now()}_${idx}`,
          date: docArticlesDate,
          title: art.title.trim(),
          bullets: art.bullets.filter((b) => b.trim().length > 0),
          created_at: nowIso,
        }));

      const oldOnDate = publishedArticles.filter((a) => a.date === docArticlesDate);
      const otherDates = publishedArticles.filter((a) => a.date !== docArticlesDate);

      let mergedArticles: BscaArticle[];
      if (docArticlesUpdateMode === 'replace') {
        mergedArticles = [...newRecords, ...otherDates];
        await saveBscaArticles(mergedArticles, {
          replaceDate: docArticlesDate,
          deletedIds: oldOnDate.map((a) => a.id),
        });
      } else {
        mergedArticles = [...newRecords, ...publishedArticles];
        await saveBscaArticles(mergedArticles);
      }

      setPublishedArticles(mergedArticles);
      setDocParsedArticles([]);
      setDocArticlesFileName('');
      setStatusMsg(
        docArticlesUpdateMode === 'replace'
          ? `🎉 Updated ${docArticlesDate} with ${newRecords.length} articles (replaced ${oldOnDate.length} previous articles)!`
          : `🎉 Appended ${newRecords.length} new articles to ${docArticlesDate}!`
      );
      await refreshPublishedData();
    } catch (err: unknown) {
      setStatusMsg(`❌ Error updating articles: ${getErrMsg(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function handleStartEditPublishedArticle(art: BscaArticle) {
    setEditingPubId(art.id);
    setEditPubTitle(art.title);
    setEditPubCategory(art.category);
    setEditPubBullets(art.bullets.join('\n'));
    setEditPubKeyStats((art.keyStats || []).join(' | '));
    setEditPubStaticGk(art.staticGk.map((g) => `${g.key}: ${g.value}`).join('\n'));
  }

  async function handleSavePublishedArticleEdit(articleId: string) {
    if (!editPubTitle.trim()) {
      return setStatusMsg('❌ Article headline cannot be empty.');
    }
    setBusy(true);
    try {
      const bullets = editPubBullets
        .split('\n')
        .map((b) => b.trim())
        .filter((b) => b.length > 0);
      const keyStats = editPubKeyStats
        .split(/[|,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const staticGk = editPubStaticGk
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.includes(':'))
        .map((l) => {
          const [k, ...rest] = l.split(':');
          return { key: k.trim(), value: rest.join(':').trim() };
        })
        .filter((g) => g.key && g.value);

      const updated = publishedArticles.map((a) =>
        a.id === articleId
          ? {
              ...a,
              title: editPubTitle.trim(),
              category: editPubCategory,
              bullets: bullets.length > 0 ? bullets : [editPubTitle.trim()],
              keyStats: keyStats.length > 0 ? keyStats : undefined,
              staticGk,
              readTimeMin: Math.max(1, Math.round((bullets.join(' ').split(/\s+/).length + 20) / 100)),
            }
          : a
      );

      await saveBscaArticles(updated);
      setPublishedArticles(updated);
      setEditingPubId(null);
      setStatusMsg('✅ Article updated successfully!');
    } catch (err: unknown) {
      setStatusMsg(`❌ Error saving article edit: ${getErrMsg(err)}`);
    } finally {
      setBusy(false);
    }
  }

  // =========================================================================
  // 0B. DEDICATED BSCA QUIZ WORD (.docx) PARSER & PUBLISHER
  // =========================================================================
  function handleCopyFormat() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(SAMPLE_QUIZ_FORMAT_TEXT);
      setCopiedFormat(true);
      setTimeout(() => setCopiedFormat(false), 2500);
    }
  }

  async function handleQuizWordFile(file: File) {
    setStatusMsg('');
    setQuizWordFileName(file.name);
    setBusy(true);

    try {
      let rawText = '';
      if (file.name.toLowerCase().endsWith('.docx')) {
        const mammoth = await import('mammoth');
        const lib = (mammoth.default || mammoth) as { extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };
        const arrayBuffer = await file.arrayBuffer();
        const { value } = await lib.extractRawText({ arrayBuffer });
        rawText = value;
      } else if (file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
        rawText = await file.text();
      } else {
        setStatusMsg('❌ Please upload a Word (.docx), Text (.txt), or Markdown (.md) file.');
        setBusy(false);
        return;
      }

      const result = parseBscaDocText(rawText, quizWordDate, 'quiz_only');
      if (result.date) {
        setQuizWordDate(result.date);
        setQuizWordTitle(result.quizTitle || `BSCA Daily GA Quiz – ${result.date}`);
      }
      setQuizWordQuestions(result.questions);

      if (result.questions.length === 0) {
        setStatusMsg('⚠️ No quiz questions were detected. Please ensure questions follow the sample format (e.g. "Q1.", "(A)-(E)", "Ans: (B)").');
      } else {
        setStatusMsg(`✅ Successfully extracted ${result.questions.length} quiz questions from "${file.name}"!`);
      }
    } catch (err: unknown) {
      setStatusMsg(`❌ Error parsing quiz Word document: ${getErrMsg(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handlePublishQuizOnly() {
    if (quizWordQuestions.length === 0) {
      return setStatusMsg('❌ No questions to publish. Upload a Word file first.');
    }
    if (!quizWordTitle.trim()) {
      return setStatusMsg('❌ Quiz title cannot be empty.');
    }

    setBusy(true);
    setStatusMsg('🚀 Publishing BSCA Daily GA Quiz...');

    try {
      const existing = publishedQuizzes.find((q) => q.quiz_date === quizWordDate);
      let quizId = existing?.id;

      if (quizId) {
        // Update quiz container & remove old questions
        const { error: updErr } = await supabase
          .from('bsca_quizzes')
          .update({
            title: quizWordTitle.trim(),
            duration_minutes: Number(quizWordDuration) || 10,
          })
          .eq('id', quizId);

        if (updErr) throw updErr;

        await supabase.from('bsca_quiz_questions').delete().eq('quiz_id', quizId);
      } else {
        // Insert new quiz container
        const { data: newQuiz, error: qErr } = await supabase
          .from('bsca_quizzes')
          .insert([
            {
              title: quizWordTitle.trim(),
              quiz_date: quizWordDate,
              duration_minutes: Number(quizWordDuration) || 10,
            },
          ])
          .select()
          .single();

        if (qErr) throw qErr;
        quizId = newQuiz.id;
      }

      // Insert all extracted questions
      const payload = quizWordQuestions.map((q) => ({
        quiz_id: quizId,
        question_text: q.question_text,
        options: q.options,
        correct_option_index: q.correct_option_index,
        explanation: q.explanation || '',
      }));

      const { error: insErr } = await supabase.from('bsca_quiz_questions').insert(payload);
      if (insErr) throw insErr;

      setStatusMsg(`🎉 Successfully published "${quizWordTitle.trim()}" with ${payload.length} questions for ${quizWordDate}!`);
      setQuizWordQuestions([]);
      setQuizWordFileName('');
      refreshPublishedData();
    } catch (err: unknown) {
      setStatusMsg(`❌ Error publishing quiz: ${getErrMsg(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteQuiz(quizId: string, title?: string) {
    if (!confirm(`Are you sure you want to delete quiz "${title || quizId}" and all its questions?`)) return;
    setBusy(true);
    try {
      await supabase.from('bsca_quiz_questions').delete().eq('quiz_id', quizId);
      const { error } = await supabase.from('bsca_quizzes').delete().eq('id', quizId);
      if (error) throw error;
      setStatusMsg(`🗑️ Deleted quiz "${title || quizId}".`);
      refreshPublishedData();
    } catch (err: unknown) {
      setStatusMsg(`❌ Error deleting quiz: ${getErrMsg(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function handleRemoveQuizQuestion(index: number) {
    setQuizWordQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSetCorrectOption(qIndex: number, optIndex: number) {
    setQuizWordQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, correct_option_index: optIndex } : q))
    );
  }

  // =========================================================================
  // 1. WORD (.docx) / TEXT PARSER HANDLER
  // =========================================================================
  async function handleWordFile(file: File) {
    setStatusMsg('');
    setFileName(file.name);
    setBusy(true);

    try {
      if (file.name.toLowerCase().endsWith('.docx')) {
        const mammoth = await import('mammoth');
        const lib = (mammoth.default || mammoth) as { extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };
        const arrayBuffer = await file.arrayBuffer();
        const { value: rawText } = await lib.extractRawText({ arrayBuffer });

        const result = parseBscaDocText(rawText);
        setParsedDate(result.date);
        setParsedArticles(result.articles);
        setParsedQuestions(result.questions);
        setStatusMsg(`✅ Successfully parsed ${result.articles.length} news articles & ${result.questions.length} quiz questions for ${result.date}!`);
      } else if (file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
        const text = await file.text();
        const result = parseBscaDocText(text);
        setParsedDate(result.date);
        setParsedArticles(result.articles);
        setParsedQuestions(result.questions);
        setStatusMsg(`✅ Successfully parsed ${result.articles.length} news articles & ${result.questions.length} quiz questions for ${result.date}!`);
      } else {
        setStatusMsg('❌ Please upload a Word (.docx) or Text (.txt) file.');
      }
    } catch (err: unknown) {
      setStatusMsg(`❌ Error parsing file: ${getErrMsg(err)}`);
    } finally {
      setBusy(false);
    }
  }

  // =========================================================================
  // 2. DIRECT PASTE TEXT PARSER
  // =========================================================================
  function handleParseRawPaste() {
    if (!rawTextPaste.trim()) return setStatusMsg('❌ Paste document text first.');
    setBusy(true);
    try {
      const result = parseBscaDocText(rawTextPaste, parsedDate);
      setParsedDate(result.date);
      setParsedArticles(result.articles);
      setParsedQuestions(result.questions);
      setStatusMsg(`✅ Extracted: ${result.articles.length} news articles & ${result.questions.length} quiz questions!`);
      setSubTab('word'); // Switch to preview tab
    } catch (err: unknown) {
      setStatusMsg(`❌ Error parsing text: ${getErrMsg(err)}`);
    } finally {
      setBusy(false);
    }
  }

  // =========================================================================
  // 3. PUBLISH PARSED CONTENT (ARTICLES + DAILY QUIZ)
  // =========================================================================
  async function handlePublishParsedContent() {
    if (parsedArticles.length === 0 && parsedQuestions.length === 0) {
      setStatusMsg('❌ No content to publish. Please upload a file first.');
      return;
    }

    setBusy(true);
    setStatusMsg('Publishing to BSCA Hub…');

    try {
      // 1. Save Articles
      if (parsedArticles.length > 0) {
        const articlesToSave: BscaArticle[] = parsedArticles.map((art, idx) => ({
          ...art,
          id: `art_${parsedDate}_${Date.now()}_${idx}`,
          date: parsedDate,
          created_at: new Date().toISOString(),
        }));

        const otherDatesArticles = publishedArticles.filter((a) => a.date !== parsedDate);
        const mergedArticles = [...articlesToSave, ...otherDatesArticles];
        await saveBscaArticles(mergedArticles, { replaceDate: parsedDate });
        setPublishedArticles(mergedArticles);
      }

      // 2. Save Quiz Questions
      if (parsedQuestions.length > 0) {
        const quizTitle = `BSCA Daily GA Quiz – ${parsedDate}`;
        const existing = publishedQuizzes.find((q) => q.quiz_date === parsedDate);
        let quizId = existing?.id;

        if (!quizId) {
          const { data: newQuiz, error: qErr } = await supabase
            .from('bsca_quizzes')
            .insert([
              {
                title: quizTitle,
                quiz_date: parsedDate,
                duration_minutes: Number(quizDuration) || 10,
              },
            ])
            .select()
            .single();

          if (qErr) throw qErr;
          quizId = newQuiz.id;
        }

        const questionsPayload = parsedQuestions.map((q) => ({
          quiz_id: quizId,
          question_text: q.question_text,
          options: q.options,
          correct_option_index: q.correct_option_index,
          explanation: q.explanation || '',
        }));

        const { error: insErr } = await supabase.from('bsca_quiz_questions').insert(questionsPayload);
        if (insErr) throw insErr;
      }

      setStatusMsg(`🎉 Successfully published ${parsedArticles.length} articles & ${parsedQuestions.length} quiz questions for ${parsedDate}!`);
      setParsedArticles([]);
      setParsedQuestions([]);
      setFileName('');
      setRawTextPaste('');
      refreshPublishedData();
    } catch (err: unknown) {
      setStatusMsg(`❌ Error publishing: ${getErrMsg(err)}`);
    } finally {
      setBusy(false);
    }
  }

  // =========================================================================
  // 4. MANUAL ARTICLE SAVE
  // =========================================================================
  async function handleSaveManualArticle(e: React.FormEvent) {
    e.preventDefault();
    if (!manualTitle.trim()) return setStatusMsg('❌ Enter article headline.');

    const bullets = manualBulletsText
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    const staticGk = manualStaticGkText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.includes(':'))
      .map((l) => {
        const [k, ...v] = l.split(':');
        return { key: k.trim(), value: v.join(':').trim() };
      });

    const keyStats = manualKeyStats
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const newArticle: BscaArticle = {
      id: `art_${manualDate}_${Date.now()}`,
      date: manualDate,
      title: manualTitle.trim(),
      category: manualCategory,
      bullets: bullets.length > 0 ? bullets : [manualTitle.trim()],
      staticGk: staticGk,
      keyStats: keyStats.length > 0 ? keyStats : undefined,
      readTimeMin: Math.max(1, Math.round(bullets.join(' ').split(/\s+/).length / 100)),
      importance: manualCategory === 'BANKING_FINANCE' ? 'HIGH' : 'MEDIUM',
      created_at: new Date().toISOString(),
    };

    setBusy(true);
    const updated = [newArticle, ...publishedArticles];
    await saveBscaArticles(updated);
    setPublishedArticles(updated);
    setManualTitle('');
    setManualBulletsText('');
    setManualStaticGkText('');
    setManualKeyStats('');
    setStatusMsg(`✅ Added article to ${manualDate}!`);
    setBusy(false);
  }

  // =========================================================================
  // 5. MONTHLY CAPSULES
  // =========================================================================
  async function handleAddCapsule(e: React.FormEvent) {
    e.preventDefault();
    if (!newCapTitle.trim() || !newCapUrl.trim()) return setStatusMsg('❌ Title and PDF URL are required.');

    const highlights = newCapHighlights
      .split('\n')
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    const cap: BscaCapsule = {
      id: `cap_${Date.now()}`,
      title: newCapTitle.trim(),
      month: newCapMonth.trim() || 'Current 2026',
      category: newCapCategory,
      pdf_url: newCapUrl.trim(),
      badge: newCapBadge.trim() || undefined,
      highlights: highlights.length > 0 ? highlights : undefined,
      download_count: 0,
      created_at: new Date().toISOString(),
    };

    setBusy(true);
    const updated = [cap, ...capsules];
    await saveBscaCapsules(updated);
    setCapsules(updated);
    setNewCapTitle('');
    setNewCapUrl('');
    setNewCapMonth('');
    setNewCapHighlights('');
    setStatusMsg('✅ Monthly Capsule published!');
    setBusy(false);
  }

  async function handleUploadCapPdf(file: File) {
    try {
      setIsUploadingCapFile(true);
      setStatusMsg('Uploading Monthly Capsule PDF to cloud storage…');
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `bsca-capsules/${Date.now()}_${cleanName}`;
      const { error: uploadErr } = await supabase.storage.from('course_pdfs').upload(filePath, file);
      if (uploadErr) {
        setStatusMsg(`❌ Upload failed: ${uploadErr.message}`);
        return;
      }
      const { data } = supabase.storage.from('course_pdfs').getPublicUrl(filePath);
      if (data?.publicUrl) {
        setNewCapUrl(data.publicUrl);
        if (!newCapTitle) {
          const autoTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          setNewCapTitle(autoTitle);
        }
        setStatusMsg('✅ Monthly Capsule PDF uploaded successfully!');
      }
    } catch (err: unknown) {
      setStatusMsg(`❌ Error uploading PDF: ${getErrMsg(err)}`);
    } finally {
      setIsUploadingCapFile(false);
    }
  }

  async function handleDeleteCapsule(id: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    setBusy(true);
    const updated = capsules.filter((c) => c.id !== id);
    await saveBscaCapsules(updated);
    setCapsules(updated);
    setStatusMsg('✅ Monthly Capsule deleted.');
    setBusy(false);
  }

  async function handleDeleteArticle(id: string) {
    if (!confirm('Are you sure you want to delete this article?')) return;
    const updated = publishedArticles.filter((a) => a.id !== id);
    await saveBscaArticles(updated, { deletedIds: [id] });
    setPublishedArticles(updated);
    setStatusMsg('Article deleted.');
  }

  // =========================================================================
  // 6. DAY-WISE CA PDFS (AffairsCloud style with Bilingual English & Hindi)
  // =========================================================================
  async function handleUploadDayPdf(file: File) {
    try {
      setIsUploadingDayFile(true);
      setStatusMsg('Uploading English PDF to storage…');
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `bsca-daily/${Date.now()}_${cleanName}`;
      const { error: uploadErr } = await supabase.storage.from('course_pdfs').upload(filePath, file);
      if (uploadErr) {
        setStatusMsg(`❌ Upload failed: ${uploadErr.message}`);
        return;
      }
      const { data } = supabase.storage.from('course_pdfs').getPublicUrl(filePath);
      if (data?.publicUrl) {
        setNewDayPdfUrl(data.publicUrl);
        if (!newDayTitle) {
          const autoTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          setNewDayTitle(autoTitle);
        }
        setStatusMsg('✅ English PDF uploaded successfully to storage!');
      }
    } catch (err: unknown) {
      setStatusMsg(`❌ Error uploading PDF: ${getErrMsg(err)}`);
    } finally {
      setIsUploadingDayFile(false);
    }
  }

  async function handleUploadDayHindiPdf(file: File) {
    try {
      setIsUploadingDayHindiFile(true);
      setStatusMsg('Uploading Hindi PDF to storage…');
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `bsca-daily/${Date.now()}_hindi_${cleanName}`;
      const { error: uploadErr } = await supabase.storage.from('course_pdfs').upload(filePath, file);
      if (uploadErr) {
        setStatusMsg(`❌ Hindi PDF upload failed: ${uploadErr.message}`);
        return;
      }
      const { data } = supabase.storage.from('course_pdfs').getPublicUrl(filePath);
      if (data?.publicUrl) {
        setNewDayHindiPdfUrl(data.publicUrl);
        setStatusMsg('✅ Hindi PDF (हिन्दी) uploaded successfully!');
      }
    } catch (err: unknown) {
      setStatusMsg(`❌ Error uploading Hindi PDF: ${getErrMsg(err)}`);
    } finally {
      setIsUploadingDayHindiFile(false);
    }
  }

  async function handleUploadInlineHindiPdf(file: File, targetPdf: BscaDayPdf) {
    try {
      setBusy(true);
      setStatusMsg(`Uploading Hindi PDF for "${targetPdf.title}"…`);
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `bsca-daily/${Date.now()}_hindi_${cleanName}`;
      const { error: uploadErr } = await supabase.storage.from('course_pdfs').upload(filePath, file);
      if (uploadErr) {
        setStatusMsg(`❌ Upload failed: ${uploadErr.message}`);
        setBusy(false);
        return;
      }
      const { data } = supabase.storage.from('course_pdfs').getPublicUrl(filePath);
      if (data?.publicUrl) {
        const res = await updateBscaDayPdf(targetPdf.id, {
          pdf_hindi_url: data.publicUrl,
          topic_list: targetPdf.topic_list,
        });
        if (res.success) {
          setStatusMsg(`✅ Hindi PDF attached to "${targetPdf.title}"!`);
          const refreshed = await fetchBscaDayPdfs();
          setDayPdfs(refreshed);
          setEditingDayPdfId(null);
        } else {
          setStatusMsg(`❌ Update error: ${res.error}`);
        }
      }
    } catch (err: unknown) {
      setStatusMsg(`❌ Error: ${getErrMsg(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEditingDayHindi(pdf: BscaDayPdf) {
    if (!editingDayHindiUrl.trim()) return setStatusMsg('⚠️ Please enter or upload a Hindi PDF URL.');
    setBusy(true);
    const res = await updateBscaDayPdf(pdf.id, {
      pdf_hindi_url: editingDayHindiUrl.trim(),
      topic_list: pdf.topic_list,
    });
    if (res.success) {
      setStatusMsg(`✅ Attached Hindi PDF to "${pdf.title}"!`);
      setEditingDayPdfId(null);
      setEditingDayHindiUrl('');
      const refreshed = await fetchBscaDayPdfs();
      setDayPdfs(refreshed);
    } else {
      setStatusMsg(`❌ Error: ${res.error}`);
    }
    setBusy(false);
  }

  async function handleCreateDayPdf(e: React.FormEvent) {
    e.preventDefault();
    if (!newDayCourseId) return setStatusMsg('❌ Please select a Month Course.');
    if (!newDayPdfUrl.trim()) return setStatusMsg('❌ Please provide a PDF URL or upload a file.');
    if (!newDayTitle.trim()) return setStatusMsg('❌ Please enter a title for the Day PDF.');

    setBusy(true);
    const res = await createBscaDayPdf({
      course_id: newDayCourseId,
      day_number: Number(newDayNumber) || 1,
      release_date: newDayDate || new Date().toISOString().slice(0, 10),
      title: newDayTitle.trim(),
      pdf_url: newDayPdfUrl.trim(),
      pdf_hindi_url: newDayHindiPdfUrl.trim() || undefined,
      topic_list: newDayTopics.trim() || undefined,
    });

    if (res.success) {
      setStatusMsg('✅ Day-Wise Current Affairs PDF published successfully!');
      setNewDayTitle('');
      setNewDayPdfUrl('');
      setNewDayHindiPdfUrl('');
      setNewDayTopics('');
      const refreshed = await fetchBscaDayPdfs();
      setDayPdfs(refreshed);
    } else {
      setStatusMsg(`❌ Error adding Day PDF: ${res.error}`);
    }
    setBusy(false);
  }

  async function handleDeleteDayPdf(id: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    setBusy(true);
    const ok = await deleteBscaDayPdf(id);
    if (ok) {
      setDayPdfs((prev) => prev.filter((p) => p.id !== id));
      setStatusMsg('✅ Day PDF deleted.');
    } else {
      setStatusMsg('❌ Failed to delete Day PDF.');
    }
    setBusy(false);
  }

  // Filter Day PDFs
  const dayMonths = Array.from(new Set(dayPdfs.map((p) => p.monthTitle))).filter(Boolean);
  const availableYears = Array.from(
    new Set([...dayPdfs.map((p) => getPdfYearAndMonth(p).year), '2026'])
  ).sort((a, b) => b.localeCompare(a));

  const filteredDayPdfs = dayPdfs.filter((p) => {
    const { year, monthIndex, monthName } = getPdfYearAndMonth(p);
    if (dayFilterYear !== 'ALL' && year !== dayFilterYear) return false;
    if (dayFilterMonth !== 'ALL') {
      const matchIndex = String(monthIndex) === dayFilterMonth;
      const matchName = monthName.toLowerCase() === dayFilterMonth.toLowerCase();
      const matchTitle = p.monthTitle.toLowerCase().includes(dayFilterMonth.toLowerCase());
      if (!matchIndex && !matchName && !matchTitle) return false;
    }
    if (daySearchQuery.trim()) {
      const q = daySearchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchDate = p.release_date.toLowerCase().includes(q);
      const matchTopics = (p.topic_list || '').toLowerCase().includes(q);
      const matchMonth = (p.monthTitle || '').toLowerCase().includes(q);
      return matchTitle || matchDate || matchTopics || matchMonth;
    }
    return true;
  });

  // Derived dates for filter
  const articleDates = Array.from(new Set(publishedArticles.map((a) => a.date))).sort((a, b) => b.localeCompare(a));
  const filteredArticles = manageFilterDate === 'ALL' ? publishedArticles : publishedArticles.filter((a) => a.date === manageFilterDate);

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold border transition animate-fadeIn ${
            statusMsg.includes('❌')
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
          }`}
        >
          {statusMsg}
        </div>
      )}

      {/* 2-Column Responsive Layout with Sticky Left Sidebar */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Left Sidebar */}
        <aside className="w-full lg:w-72 shrink-0 bg-slate-900 border border-white/[0.08] p-5 rounded-3xl space-y-5 shadow-xl lg:sticky lg:top-4">
          <div className="space-y-1.5 border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-sm font-black text-white">BSCA Editorial Suite</h3>
            </div>
            <p className="text-[11px] text-slate-400">Manage daily news, day PDFs, quizzes &amp; pricing</p>

            <a
              href="/bsca"
              target="_blank"
              rel="noreferrer"
              className="mt-2 w-full py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
            >
              <span>Live Student Hub</span>
              <span>↗</span>
            </a>

            <div className="pt-1">
              <ThemeToggle variant="sidebar" />
            </div>
          </div>

          {/* Quick Counter Badges */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-white/[0.06] text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Articles</span>
              <strong className="text-sm font-black text-amber-400">{publishedArticles.length}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-white/[0.06] text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Day PDFs</span>
              <strong className="text-sm font-black text-sky-400">{dayPdfs.length}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-white/[0.06] text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Quizzes</span>
              <strong className="text-sm font-black text-emerald-400">{publishedQuizzes.length}</strong>
            </div>
          </div>

          {/* Vertical Sub-Tab Navigation */}
          <nav className="space-y-1.5">
            {[
              { id: 'articles_doc', label: 'Update Articles (.doc/.docx)', icon: '📰', count: publishedArticles.length },
              { id: 'quiz_word', label: 'Upload BSCA Quiz (.docx)', icon: '💡', count: publishedQuizzes.length },
              { id: 'word', label: '1-Click Articles & Quiz', icon: '📄', count: null },
              { id: 'paste', label: 'Paste Raw News Text', icon: '📋', count: null },
              { id: 'manual', label: 'Single Article Form', icon: '✍️', count: null },
              { id: 'daypdfs', label: 'Day-Wise CA PDFs', icon: '📑', count: dayPdfs.length },
              { id: 'capsules', label: 'Monthly Capsules', icon: '📚', count: capsules.length },
              { id: 'pricing', label: 'Plans & Pricing', icon: '💳', count: null },
              { id: 'manage', label: 'Manage Archive', icon: '🗄️', count: publishedArticles.length },
            ].map((t) => {
              const isSelected = subTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSubTab(t.id as SubTab);
                    setStatusMsg('');
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between border text-left ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 border-amber-400 font-black shadow-md shadow-amber-500/10'
                      : 'bg-slate-950/70 text-slate-300 border-white/[0.06] hover:border-amber-400/40 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </span>
                  {t.count !== null && (
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-slate-950 text-amber-300'
                          : 'bg-slate-900 text-slate-400 border border-white/[0.06]'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Content Pane */}
        <div className="flex-1 min-w-0 space-y-6">

      {/* ========================================================================= */}
      {/* SUB-TAB 0A: DEDICATED BSCA ARTICLES DOC (.DOC / .DOCX) UPDATER            */}
      {/* ========================================================================= */}
      {subTab === 'articles_doc' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
            {/* Header & Sample Format Downloads */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                    Dedicated Articles Updater
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2 mt-1.5">
                  <span>📰</span>
                  <span>Update BSCA Daily Articles via Doc File (.doc / .docx)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Upload a Word document (<code>.doc</code> or <code>.docx</code>), plain text (<code>.txt</code>), or Markdown (<code>.md</code>) file to publish new BSCA current affairs articles or cleanly replace/update an existing date&apos;s articles without touching quizzes.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href="/samples/bsca_articles_sample.docx"
                  download="BSCA_Articles_Sample.docx"
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition shadow-md flex items-center gap-1.5 shrink-0"
                  title="Download sample BSCA Articles Word (.docx) template"
                >
                  <span>📥</span>
                  <span>Sample Doc (.docx)</span>
                </a>
                <a
                  href="/samples/bsca_articles_sample.txt"
                  download="BSCA_Articles_Sample.txt"
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/[0.08] font-bold text-xs transition flex items-center gap-1.5 shrink-0"
                  title="Download plain text sample template"
                >
                  <span>📄</span>
                  <span>Sample (.txt)</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyArticlesFormat}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/[0.08] font-bold text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                  title="Copy standard BSCA articles format to clipboard"
                >
                  <span>{copiedArticlesFormat ? '✓' : '📋'}</span>
                  <span>{copiedArticlesFormat ? 'Copied!' : 'Copy Format'}</span>
                </button>
              </div>
            </div>

            {/* Collapsible Format Guide */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/[0.06] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>📝</span> Standard BSCA Articles Format in Word (.doc / .docx)
                </span>
                <button
                  type="button"
                  onClick={() => setShowArticlesFormatGuide(!showArticlesFormatGuide)}
                  className="text-slate-400 hover:text-white underline text-[11px] cursor-pointer"
                >
                  {showArticlesFormatGuide ? 'Hide Guide ▲' : 'Show Guide ▼'}
                </button>
              </div>

              {showArticlesFormatGuide && (
                <div className="pt-2 text-slate-300 space-y-2 border-t border-white/[0.06] font-mono text-[11px] leading-relaxed bg-slate-950/90 p-3.5 rounded-xl">
                  <p className="text-slate-400">Date: 2026-11-02</p>
                  <p className="text-amber-300 font-bold">BANKING &amp; FINANCE</p>
                  <p className="text-white font-bold">RBI Introduces Unified Lending Interface (ULI) for Frictionless Credit Delivery</p>
                  <p className="text-sky-300">Key Stats: ₹50,000 Cr Credit Target | 100% Digital KYC | MSME &amp; Agri Focus</p>
                  <p>
                    - The Reserve Bank of India (RBI) announced the nationwide rollout of ULI...
                    <br />- ULI operates on standardized APIs connecting lenders to digital land &amp; GSTN records.
                  </p>
                  <p className="text-emerald-400 font-bold">Static GK:</p>
                  <p className="text-emerald-200">
                    RBI Headquarters: Mumbai, Maharashtra
                    <br />
                    RBI Established: 1 April 1935
                  </p>
                </div>
              )}
            </div>

            {/* Target Date, Update Mode & Quick Existing Date Picker */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-4">
                <span className={labelCls}>Target Edition Date</span>
                <input
                  type="date"
                  value={docArticlesDate}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setDocArticlesDate(nextDate);
                    setDocParsedArticles((prev) => prev.map((a) => ({ ...a, date: nextDate })));
                  }}
                  className={inputCls}
                />
              </div>

              <div className="md:col-span-5">
                <span className={labelCls}>Update Action on Publish</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDocArticlesUpdateMode('replace')}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      docArticlesUpdateMode === 'replace'
                        ? 'bg-amber-400 text-slate-950 border-amber-400 font-black shadow'
                        : 'bg-slate-950 text-slate-300 border-white/[0.1] hover:border-amber-400/40'
                    }`}
                  >
                    🔄 Replace Date&apos;s Articles
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocArticlesUpdateMode('append')}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      docArticlesUpdateMode === 'append'
                        ? 'bg-emerald-400 text-slate-950 border-emerald-400 font-black shadow'
                        : 'bg-slate-950 text-slate-300 border-white/[0.1] hover:border-emerald-400/40'
                    }`}
                  >
                    ➕ Append to Date
                  </button>
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950 border border-white/[0.08] cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={docAutoDetectDate}
                    onChange={(e) => setDocAutoDetectDate(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-400"
                  />
                  <span className="font-semibold leading-tight">Auto-read Date from Doc</span>
                </label>
              </div>
            </div>

            {/* Quick Select Existing Dates Strip */}
            {articleDates.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-400 mr-1">Quick Select Published Date to Update:</span>
                {articleDates.slice(0, 8).map((d) => {
                  const countOnDate = publishedArticles.filter((a) => a.date === d).length;
                  const active = docArticlesDate === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDocArticlesDate(d);
                        setDocAutoDetectDate(false);
                        setDocParsedArticles((prev) => prev.map((a) => ({ ...a, date: d })));
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        active
                          ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                          : 'bg-slate-950 border-white/[0.08] text-slate-400 hover:text-white'
                      }`}
                    >
                      {d} ({countOnDate})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Doc File Upload Dropzone */}
            <label className="block cursor-pointer border-2 border-dashed border-emerald-400/40 hover:border-emerald-400 rounded-3xl p-8 sm:p-10 text-center bg-slate-950/60 hover:bg-slate-950/90 transition group shadow-inner">
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">📰</div>
              <span className="text-sm sm:text-base font-black text-white block">
                {busy
                  ? 'Extracting articles from document…'
                  : docArticlesFileName || 'Click or drag & drop BSCA Articles Doc (.doc / .docx) file'}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">
                Supports Word (<code>.doc</code>, <code>.docx</code>), Text (<code>.txt</code>), and Markdown (<code>.md</code>). Extracts Categories, Headlines, Key Stats, Bullets &amp; Static GK only.
              </span>
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                <span>📎 Browse .doc / .docx File</span>
              </div>
              <input
                type="file"
                accept=".doc,.docx,.txt,.md,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleArticlesDocFile(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {/* Extracted Articles Preview, Inline Editor & Publish/Update Button */}
          {docParsedArticles.length > 0 && (
            <div className="bg-slate-900/90 border border-emerald-400/30 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div>
                  <h4 className="text-lg font-black text-white flex items-center gap-2">
                    <span>✨</span>
                    <span>Review &amp; Edit Extracted Articles ({docParsedArticles.length})</span>
                  </h4>
                  <span className="text-xs text-emerald-300">
                    Target Date: <b>{docArticlesDate}</b> · Mode:{' '}
                    <b>
                      {docArticlesUpdateMode === 'replace'
                        ? `Replace existing (${publishedArticles.filter((a) => a.date === docArticlesDate).length} live articles will be updated)`
                        : 'Append to existing articles'}
                    </b>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleAddBlankDocArticle}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/[0.1] font-bold text-xs transition cursor-pointer"
                  >
                    + Add Article Row
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handlePublishDocArticles}
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>
                      {busy
                        ? 'Updating…'
                        : docArticlesUpdateMode === 'replace'
                          ? `🚀 Update ${docParsedArticles.length} Articles for ${docArticlesDate}`
                          : `🚀 Append ${docParsedArticles.length} Articles to ${docArticlesDate}`}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-4 max-h-[650px] overflow-y-auto pr-1 scrollbar-thin">
                {docParsedArticles.map((art, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950/85 border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-6 h-6 rounded-lg bg-emerald-400/20 text-emerald-300 font-black text-xs flex items-center justify-center border border-emerald-400/30">
                          {idx + 1}
                        </span>
                        <select
                          value={art.category}
                          onChange={(e) =>
                            handleUpdateDocParsedArticle(idx, { category: e.target.value as BscaCategory })
                          }
                          className="bg-slate-900 border border-white/[0.12] rounded-lg px-2.5 py-1 text-xs font-bold text-amber-300 outline-none"
                        >
                          {BSCA_CATEGORIES.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.icon} {c.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={art.importance || 'MEDIUM'}
                          onChange={(e) =>
                            handleUpdateDocParsedArticle(idx, {
                              importance: e.target.value as 'HIGH' | 'MEDIUM',
                            })
                          }
                          className="bg-slate-900 border border-white/[0.12] rounded-lg px-2.5 py-1 text-xs font-bold text-slate-300 outline-none"
                        >
                          <option value="HIGH">🔥 High Priority</option>
                          <option value="MEDIUM">📌 Standard</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveDocParsedArticle(idx)}
                        className="text-[11px] text-rose-400 hover:text-rose-300 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 font-bold transition self-end sm:self-auto cursor-pointer"
                      >
                        ✕ Remove
                      </button>
                    </div>

                    <div>
                      <span className={labelCls}>Headline</span>
                      <input
                        type="text"
                        value={art.title}
                        onChange={(e) => handleUpdateDocParsedArticle(idx, { title: e.target.value })}
                        className={inputCls}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <span className={labelCls}>Bullet Points (One per line)</span>
                        <textarea
                          rows={3}
                          value={art.bullets.join('\n')}
                          onChange={(e) =>
                            handleUpdateDocParsedArticle(idx, {
                              bullets: e.target.value.split('\n'),
                            })
                          }
                          className={inputCls}
                        />
                      </div>
                      <div className="space-y-2.5">
                        <div>
                          <span className={labelCls}>Key Stats (Pipe | separated)</span>
                          <input
                            type="text"
                            value={(art.keyStats || []).join(' | ')}
                            placeholder="e.g. ₹50,000 Cr | 100% Digital KYC"
                            onChange={(e) =>
                              handleUpdateDocParsedArticle(idx, {
                                keyStats: e.target.value
                                  .split('|')
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <span className={labelCls}>Static GK (Key: Value per line)</span>
                          <textarea
                            rows={2}
                            value={art.staticGk.map((g) => `${g.key}: ${g.value}`).join('\n')}
                            placeholder={'RBI Headquarters: Mumbai\nGovernor: Sanjay Malhotra'}
                            onChange={(e) => {
                              const nextGk = e.target.value
                                .split('\n')
                                .filter((l) => l.includes(':'))
                                .map((l) => {
                                  const [k, ...rest] = l.split(':');
                                  return { key: k.trim(), value: rest.join(':').trim() };
                                });
                              handleUpdateDocParsedArticle(idx, { staticGk: nextGk });
                            }}
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Currently Published Articles on Selected Date (Inline Edit / Quick Inspect) */}
          <div className="bg-slate-900/70 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
              <div>
                <h4 className="text-sm sm:text-base font-black text-white">
                  Live BSCA Articles on {docArticlesDate} (
                  {publishedArticles.filter((a) => a.date === docArticlesDate).length})
                </h4>
                <p className="text-xs text-slate-400">
                  Upload a <code>.doc</code> / <code>.docx</code> file above in Replace mode to overwrite this date, or edit individual articles inline below.
                </p>
              </div>
              <a
                href="/bsca"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-white/[0.08] transition flex items-center gap-1 shrink-0"
              >
                <span>View on BSCA Hub</span>
                <span>↗</span>
              </a>
            </div>

            {publishedArticles.filter((a) => a.date === docArticlesDate).length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No articles published yet for <b>{docArticlesDate}</b>. Upload a Word (.doc / .docx) file above to publish articles for this date.
              </p>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
                {publishedArticles
                  .filter((a) => a.date === docArticlesDate)
                  .map((art) => {
                    const meta = getCategoryMeta(art.category);
                    const isEditing = editingPubId === art.id;
                    return (
                      <div
                        key={art.id}
                        className="bg-slate-950/75 border border-white/[0.07] rounded-2xl p-4 space-y-3"
                      >
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="sm:col-span-2">
                                <span className={labelCls}>Headline</span>
                                <input
                                  type="text"
                                  value={editPubTitle}
                                  onChange={(e) => setEditPubTitle(e.target.value)}
                                  className={inputCls}
                                />
                              </div>
                              <div>
                                <span className={labelCls}>Category</span>
                                <select
                                  value={editPubCategory}
                                  onChange={(e) => setEditPubCategory(e.target.value as BscaCategory)}
                                  className={inputCls}
                                >
                                  {BSCA_CATEGORIES.map((c) => (
                                    <option key={c.key} value={c.key}>
                                      {c.icon} {c.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div>
                              <span className={labelCls}>Bullets (One per line)</span>
                              <textarea
                                rows={3}
                                value={editPubBullets}
                                onChange={(e) => setEditPubBullets(e.target.value)}
                                className={inputCls}
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <span className={labelCls}>Key Stats (Pipe | separated)</span>
                                <input
                                  type="text"
                                  value={editPubKeyStats}
                                  onChange={(e) => setEditPubKeyStats(e.target.value)}
                                  className={inputCls}
                                />
                              </div>
                              <div>
                                <span className={labelCls}>Static GK (Key: Value per line)</span>
                                <textarea
                                  rows={2}
                                  value={editPubStaticGk}
                                  onChange={(e) => setEditPubStaticGk(e.target.value)}
                                  className={inputCls}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setEditingPubId(null)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleSavePublishedArticleEdit(art.id)}
                                className="px-4 py-1.5 rounded-lg bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer"
                              >
                                Save Article Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${meta.badgeCls}`}>
                                  {meta.icon} {meta.label}
                                </span>
                                {art.keyStats && art.keyStats.length > 0 && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-400/20">
                                    {art.keyStats.length} Key Stats
                                  </span>
                                )}
                              </div>
                              <h5 className="font-bold text-white text-sm">{art.title}</h5>
                              <p className="text-xs text-slate-400">
                                {art.bullets.length} bullets · {art.staticGk.length} static GK notes
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditPublishedArticle(art)}
                                className="px-3 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 text-xs font-bold transition cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteArticle(art.id)}
                                className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold transition cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 0B: DEDICATED BSCA QUIZ WORD (.DOCX) UPLOADER                     */}
      {/* ========================================================================= */}
      {subTab === 'quiz_word' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
            {/* Header with Title & Direct Download Options */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span>💡</span>
                  <span>Upload BSCA Daily GA Quiz via Word Document (.docx)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Upload daily MS Word (.docx) files with your questions. Questions, 5 options (A-E), correct answers, and explanations are automatically extracted and published directly to the live Daily GA Quiz CBT simulator.
                </p>
              </div>

              {/* Sample Download Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href="/samples/bsca_quiz_sample.docx"
                  download="BSCA_Daily_GA_Quiz_Sample.docx"
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition shadow-md flex items-center gap-1.5 shrink-0"
                  title="Download standard sample Microsoft Word (.docx) file"
                >
                  <span>📥</span>
                  <span>Sample Word (.docx)</span>
                </a>
                <a
                  href="/samples/bsca_quiz_sample.txt"
                  download="BSCA_Daily_GA_Quiz_Sample.txt"
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/[0.08] font-bold text-xs transition flex items-center gap-1.5 shrink-0"
                  title="Download plain text sample template"
                >
                  <span>📄</span>
                  <span>Sample (.txt)</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyFormat}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/[0.08] font-bold text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                  title="Copy standard question template to clipboard"
                >
                  <span>{copiedFormat ? '✓' : '📋'}</span>
                  <span>{copiedFormat ? 'Copied!' : 'Copy Format'}</span>
                </button>
              </div>
            </div>

            {/* Quick Format Reference Box */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/[0.06] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>📝</span> Standard Question Format in Word (.docx)
                </span>
                <button
                  type="button"
                  onClick={() => setShowFormatGuide(!showFormatGuide)}
                  className="text-slate-400 hover:text-white underline text-[11px] cursor-pointer"
                >
                  {showFormatGuide ? 'Hide Guide ▲' : 'Show Guide ▼'}
                </button>
              </div>

              {showFormatGuide && (
                <div className="pt-2 text-slate-300 space-y-2 border-t border-white/[0.06] font-mono text-[11px] leading-relaxed bg-slate-950/90 p-3.5 rounded-xl">
                  <p className="text-slate-400"># Format each question in your Word document as follows:</p>
                  <p className="text-white font-bold">Q1. Which regulatory body in India recently introduced the digital lending framework?</p>
                  <p>(A) SEBI<br />(B) Reserve Bank of India (RBI)<br />(C) IRDAI<br />(D) PFRDA<br />(E) NABARD</p>
                  <p className="text-emerald-400 font-bold">Ans: (B)</p>
                  <p className="text-amber-300">Explanation: The Reserve Bank of India (RBI) issued regulatory guidelines to protect borrowers...</p>
                </div>
              )}
            </div>

            {/* Quiz Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className={labelCls}>Quiz Date</span>
                <input
                  type="date"
                  value={quizWordDate}
                  onChange={(e) => {
                    setQuizWordDate(e.target.value);
                    if (!quizWordTitle || quizWordTitle.startsWith('BSCA Daily GA Quiz –')) {
                      setQuizWordTitle(`BSCA Daily GA Quiz – ${e.target.value}`);
                    }
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <span className={labelCls}>Quiz Title</span>
                <input
                  type="text"
                  value={quizWordTitle}
                  onChange={(e) => setQuizWordTitle(e.target.value)}
                  placeholder="e.g. BSCA Daily GA Quiz – 2026-10-26"
                  className={inputCls}
                />
              </div>
              <div>
                <span className={labelCls}>Duration (Minutes)</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={quizWordDuration}
                  onChange={(e) => setQuizWordDuration(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Word Document Dropzone */}
            <label className="block cursor-pointer border-2 border-dashed border-amber-400/40 hover:border-amber-400 rounded-3xl p-8 sm:p-10 text-center bg-slate-950/60 hover:bg-slate-950/90 transition group shadow-inner">
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">📄</div>
              <span className="text-sm sm:text-base font-black text-white block">
                {busy ? 'Extracting questions from Word document…' : quizWordFileName || 'Click or drag & drop BSCA Quiz Word (.docx) file'}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">
                Supports Microsoft Word (.docx), plain text (.txt), and Markdown (.md). Auto-parses Q1..Q20, Options A-E, Answers &amp; Explanations.
              </span>
              <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-bold">
                <span>📎 Browse Word File</span>
              </div>
              <input
                type="file"
                accept=".docx,.txt,.md"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleQuizWordFile(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {/* Extracted Questions Preview & Publish Panel */}
          {quizWordQuestions.length > 0 && (
            <div className="bg-slate-900/90 border border-amber-400/30 rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div>
                  <h4 className="text-lg font-black text-white flex items-center gap-2">
                    <span>💡</span>
                    <span>Review Extracted Quiz ({quizWordQuestions.length} Questions)</span>
                  </h4>
                  <span className="text-xs text-amber-300">
                    Ready to publish for <b>{quizWordDate}</b> as <strong>&ldquo;{quizWordTitle}&rdquo;</strong> ({quizWordDuration} mins)
                  </span>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={handlePublishQuizOnly}
                  className="px-7 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <span>{busy ? 'Publishing…' : '🚀 Publish BSCA Daily GA Quiz'}</span>
                </button>
              </div>

              {/* Questions List */}
              <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
                {quizWordQuestions.map((q, qIdx) => (
                  <div key={qIdx} className="bg-slate-950/80 border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 font-black text-xs flex items-center justify-center shrink-0 border border-amber-400/30">
                          {qIdx + 1}
                        </span>
                        <p className="text-sm text-white font-semibold leading-snug">{q.question_text}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuizQuestion(qIdx)}
                        className="text-[11px] text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 transition shrink-0 cursor-pointer"
                        title="Remove this question"
                      >
                        ✕ Remove
                      </button>
                    </div>

                    {/* Options Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-9">
                      {q.options.map((opt, optIdx) => {
                        const isCorrect = q.correct_option_index === optIdx;
                        return (
                          <div
                            key={optIdx}
                            onClick={() => handleSetCorrectOption(qIdx, optIdx)}
                            className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center gap-2 ${
                              isCorrect
                                ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-300 font-bold'
                                : 'bg-slate-900/60 border-white/[0.06] text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                                isCorrect ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="truncate">{opt}</span>
                            {isCorrect && <span className="ml-auto text-emerald-400 text-xs font-bold">✓ Correct</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="pl-9 pt-1">
                        <div className="p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-xs text-slate-300">
                          <strong className="text-amber-300">Explanation: </strong>
                          {q.explanation}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Published Quizzes Management Section */}
          <div className="bg-slate-900/70 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h4 className="text-sm sm:text-base font-black text-white">Published BSCA Daily GA Quizzes ({publishedQuizzes.length})</h4>
                <p className="text-xs text-slate-400">Live quizzes available to candidates on the BSCA Hub</p>
              </div>
              <a
                href="/bsca?tab=quiz"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-white/[0.08] transition flex items-center gap-1"
              >
                <span>Preview Student Quiz</span>
                <span>↗</span>
              </a>
            </div>

            {publishedQuizzes.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No quizzes published yet. Upload your first Word document above!</p>
            ) : (
              <div className="divide-y divide-white/[0.06] max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                {publishedQuizzes.map((q) => (
                  <div key={q.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-400/10 text-amber-300">
                          📅 {q.quiz_date}
                        </span>
                        <span className="font-bold text-white truncate">{q.title}</span>
                      </div>
                      <span className="text-slate-400 text-[11px] mt-0.5 block">
                        ⏱️ {q.duration_minutes || 10} Minutes Duration
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteQuiz(q.id, q.title)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold transition shrink-0 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 1: WORD (.DOCX) AUTO PARSER                                       */}
      {/* ========================================================================= */}
      {subTab === 'word' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
            {/* Visual Process Steps & Sample Download */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div className="grid grid-cols-3 gap-2 text-xs flex-1">
                <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/[0.06] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-amber-400/20 text-amber-300 font-black flex items-center justify-center text-[10px]">1</span>
                  <span className="font-bold text-white text-[11px]">Upload .docx</span>
                </div>
                <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/[0.06] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-amber-400/20 text-amber-300 font-black flex items-center justify-center text-[10px]">2</span>
                  <span className="font-bold text-white text-[11px]">Auto-Extract</span>
                </div>
                <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/[0.06] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-amber-400/20 text-amber-300 font-black flex items-center justify-center text-[10px]">3</span>
                  <span className="font-bold text-white text-[11px]">1-Click Publish</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="/samples/bsca_quiz_sample.docx"
                  download="BSCA_Daily_GA_Quiz_Sample.docx"
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition shadow flex items-center gap-1.5"
                  title="Download sample Word (.docx) file"
                >
                  <span>📥</span>
                  <span>Sample Word (.docx)</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className={labelCls}>Publication Date</span>
                <input
                  type="date"
                  value={parsedDate}
                  onChange={(e) => setParsedDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <span className={labelCls}>Quiz Duration (Minutes)</span>
                <input
                  type="number"
                  value={quizDuration}
                  onChange={(e) => setQuizDuration(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Dropzone */}
            <label className="block cursor-pointer border-2 border-dashed border-white/[0.15] hover:border-amber-400/50 rounded-2xl p-10 text-center bg-slate-950/60 transition group">
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">📄</div>
              <span className="text-sm font-black text-white block">
                {busy ? 'Extracting text and questions…' : fileName || 'Click or drag & drop daily Word (.docx) file'}
              </span>
              <span className="text-xs text-slate-500 mt-1 block">
                Supports Microsoft Word (.docx), plain text (.txt), and Markdown (.md)
              </span>
              <input
                type="file"
                accept=".docx,.txt,.md"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleWordFile(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {/* Parsed Preview Table & Publish Button */}
          {(parsedArticles.length > 0 || parsedQuestions.length > 0) && (
            <div className="bg-slate-900/90 border border-amber-400/30 rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div>
                  <h4 className="text-lg font-black text-white">Review Extracted Content</h4>
                  <span className="text-xs text-amber-300">
                    Ready to publish for <b>{parsedDate}</b>: <strong>{parsedArticles.length}</strong> News Articles · <strong>{parsedQuestions.length}</strong> Quiz Questions
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handlePublishParsedContent}
                  className="px-7 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
                >
                  {busy ? 'Publishing…' : '🚀 Publish All (Articles + Daily Quiz)'}
                </button>
              </div>

              {/* Articles Accordion */}
              {parsedArticles.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                    📰 Extracted Articles ({parsedArticles.length})
                  </span>
                  <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                    {parsedArticles.map((art, idx) => {
                      const meta = getCategoryMeta(art.category);
                      return (
                        <div key={idx} className="bg-slate-950/80 border border-white/[0.06] rounded-2xl p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400/10 text-amber-300">
                                #{idx + 1}
                              </span>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${meta.badgeCls}`}>
                                {meta.label}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {art.bullets.length} points · {art.staticGk.length} static notes
                            </span>
                          </div>
                          <h5 className="font-bold text-white text-sm">{art.title}</h5>
                          <p className="text-xs text-slate-300">{art.bullets[0]}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quiz Accordion */}
              {parsedQuestions.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                    💡 Extracted Daily Quiz Questions ({parsedQuestions.length})
                  </span>
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {parsedQuestions.map((q, idx) => (
                      <div key={idx} className="bg-slate-950/80 border border-white/[0.06] rounded-2xl p-3.5 space-y-1">
                        <span className="text-[10px] font-bold text-amber-400 uppercase">Q{idx + 1}</span>
                        <p className="text-xs text-white font-medium">{q.question_text}</p>
                        <span className="text-[11px] text-emerald-400 font-bold block">
                          Correct: Option {String.fromCharCode(65 + q.correct_option_index)} ({q.options[q.correct_option_index]})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: DIRECT TEXT / TELEGRAM PASTE                                   */}
      {/* ========================================================================= */}
      {subTab === 'paste' && (
        <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
          <div>
            <h3 className="text-base font-black text-white">Paste Raw Current Affairs Notes</h3>
            <p className="text-xs text-slate-400 mt-1">
              Quickly import notes copied from Telegram, Word, or news summaries. The AI parser will automatically organize categories, headlines, bullets, and quiz questions.
            </p>
          </div>

          <div>
            <span className={labelCls}>Publication Date</span>
            <input
              type="date"
              value={parsedDate}
              onChange={(e) => setParsedDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <span className={labelCls}>Paste Document Content</span>
            <textarea
              rows={12}
              placeholder={`Date: 25 October 2026\n\nBANKING & FINANCE\nRBI issues new guidelines on Project Finance\n- Lenders must maintain 2.5% buffer...\nStatic GK:\nHeadquarters: Mumbai\nGovernor: Shaktikanta Das\n\nDAILY CURRENT AFFAIRS QUIZ\nQ1. What is the newly mandated buffer?\nA) 1.5%\nB) 2.0%\nC) 2.5%\nD) 3.0%\nAnswer: C\nExplanation: RBI mandated 2.5% buffer.`}
              value={rawTextPaste}
              onChange={(e) => setRawTextPaste(e.target.value)}
              className={`${inputCls} font-mono text-xs`}
            />
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleParseRawPaste}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg transition"
          >
            {busy ? 'Parsing…' : '⚡ Auto-Parse Text into Articles & Quiz Preview'}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: MANUAL ARTICLE ENTRY                                           */}
      {/* ========================================================================= */}
      {subTab === 'manual' && (
        <form onSubmit={handleSaveManualArticle} className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
          <h3 className="text-base font-black text-white">Add Single Current Affairs Article</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className={labelCls}>Publication Date</span>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div>
              <span className={labelCls}>Category</span>
              <select
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value as BscaCategory)}
                className={inputCls}
              >
                {BSCA_CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className={labelCls}>Headline / Title</span>
            <input
              type="text"
              placeholder="e.g. RBI hikes project finance buffer to 2.5%"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              className={inputCls}
              required
            />
          </div>

          <div>
            <span className={labelCls}>Key Stats Chips (Comma separated)</span>
            <input
              type="text"
              placeholder="e.g. 2.5% Buffer, COD Amortization, ₹50,000 Cr"
              value={manualKeyStats}
              onChange={(e) => setManualKeyStats(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <span className={labelCls}>Bullet Points (One per line)</span>
            <textarea
              rows={4}
              placeholder="Point 1&#10;Point 2&#10;Point 3"
              value={manualBulletsText}
              onChange={(e) => setManualBulletsText(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <span className={labelCls}>Static GK Notes (Key: Value per line)</span>
            <textarea
              rows={3}
              placeholder="Headquarters: Mumbai&#10;Governor: Shaktikanta Das&#10;Established: 1935"
              value={manualStaticGkText}
              onChange={(e) => setManualStaticGkText(e.target.value)}
              className={inputCls}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md transition"
          >
            {busy ? 'Saving…' : '➕ Save Article to Daily Digest'}
          </button>
        </form>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: DAY-WISE CA PDFS (AFFAIRSCLOUD STYLE)                          */}
      {/* ========================================================================= */}
      {subTab === 'daypdfs' && (
        <div className="space-y-6">
          {/* Top Info Banner */}
          <div className="bg-gradient-to-r from-sky-950/40 via-slate-900 to-amber-950/30 border border-sky-500/20 rounded-3xl p-6 sm:p-7 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-black text-[11px] border border-sky-500/30">
                    AFFAIRSCLOUD STYLE
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">100% Free for Students to View &amp; Download</span>
                </div>
                <h3 className="text-lg font-black text-white">Day-Wise Current Affairs PDF Bank</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Manage the daily current affairs PDF sheets organized by month and day. Each PDF features a clean DAY badge, release date, and topic checklist tags for high-speed revision.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-white/[0.08] text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total PDFs</span>
                  <span className="text-lg font-black text-sky-400">{dayPdfs.length}</span>
                </div>
                <div className="px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-white/[0.08] text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Months</span>
                  <span className="text-lg font-black text-amber-400">{dayMonths.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Upload New Day PDF Form */}
          <form onSubmit={handleCreateDayPdf} className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                ➕ Publish New Day-Wise Current Affairs PDF
              </h3>
              <span className="text-[11px] text-slate-400">Stored in Supabase Course PDFs</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className={labelCls}>Month Course</span>
                <select
                  value={newDayCourseId}
                  onChange={(e) => setNewDayCourseId(e.target.value)}
                  className={inputCls}
                  required
                >
                  {bscaCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      📁 {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={labelCls}>Day Number</span>
                <input
                  type="number"
                  placeholder="e.g. 26"
                  value={newDayNumber}
                  onChange={(e) => setNewDayNumber(Number(e.target.value))}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <span className={labelCls}>Release Date</span>
                <input
                  type="date"
                  value={newDayDate}
                  onChange={(e) => setNewDayDate(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
            </div>

            <div>
              <span className={labelCls}>Title / Headline</span>
              <input
                type="text"
                placeholder="e.g. 25-10-2026 BSCA Current Affairs Daily Sheet"
                value={newDayTitle}
                onChange={(e) => setNewDayTitle(e.target.value)}
                className={inputCls}
                required
              />
            </div>

            {/* Bilingual PDF Upload: English & Hindi */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-950/70 border border-white/[0.08]">
              {/* English PDF */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <span>🇬🇧</span> English Current Affairs PDF (Required)
                  </span>
                  {newDayPdfUrl && (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded">
                      ✓ Ready
                    </span>
                  )}
                </div>
                <input
                  type="url"
                  placeholder="https://... or upload file below"
                  value={newDayPdfUrl}
                  onChange={(e) => setNewDayPdfUrl(e.target.value)}
                  className={inputCls}
                  required
                />
                <label className="flex items-center justify-center gap-2 w-full bg-slate-900 border border-white/[0.1] hover:border-amber-400/60 rounded-xl px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition">
                  <span>{isUploadingDayFile ? '⏳ Uploading English PDF...' : '📎 Upload English .pdf to Cloud'}</span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    disabled={isUploadingDayFile}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadDayPdf(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {/* Hindi PDF */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <span>🇮🇳</span> Hindi Current Affairs PDF (हिन्दी PDF - Optional)
                  </span>
                  {newDayHindiPdfUrl && (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded">
                      ✓ Ready
                    </span>
                  )}
                </div>
                <input
                  type="url"
                  placeholder="https://... or upload Hindi file below"
                  value={newDayHindiPdfUrl}
                  onChange={(e) => setNewDayHindiPdfUrl(e.target.value)}
                  className={inputCls}
                />
                <label className="flex items-center justify-center gap-2 w-full bg-slate-900 border border-emerald-500/30 hover:border-emerald-400 rounded-xl px-3.5 py-2 text-xs font-bold text-emerald-300 cursor-pointer transition">
                  <span>{isUploadingDayHindiFile ? '⏳ Uploading Hindi PDF...' : '🇮🇳 Upload Hindi .pdf to Cloud'}</span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    disabled={isUploadingDayHindiFile}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadDayHindiPdf(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            <div>
              <span className={labelCls}>Topics Covered (Comma or Newline separated)</span>
              <textarea
                rows={3}
                placeholder="e.g.&#10;RBI Project Finance Guidelines&#10;NaBFID Chairman K.V. Kamath Extension&#10;Moody's India GDP Growth Forecast&#10;National Sports Awards 2026"
                value={newDayTopics}
                onChange={(e) => setNewDayTopics(e.target.value)}
                className={inputCls}
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                These topics will appear as clean topic checklist chips (✅) under the day card in the student hub.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={busy || isUploadingDayFile}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition disabled:opacity-50"
              >
                {busy ? 'Publishing…' : '💾 Publish Day-Wise PDF'}
              </button>
            </div>
          </form>

          {/* Published Day PDFs Bank */}
          <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-base font-black text-white">All Day-Wise PDFs</h3>
                <span className="text-xs text-slate-400">Showing {filteredDayPdfs.length} of {dayPdfs.length} PDFs</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search title, date, topic…"
                  value={daySearchQuery}
                  onChange={(e) => setDaySearchQuery(e.target.value)}
                  className="bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-white outline-none w-44"
                />

                <select
                  value={dayFilterMonth}
                  onChange={(e) => setDayFilterMonth(e.target.value)}
                  className="bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                >
                  <option value="ALL">All Months</option>
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={String(idx)}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  value={dayFilterYear}
                  onChange={(e) => setDayFilterYear(e.target.value)}
                  className="bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                >
                  <option value="ALL">All Years</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>

                {(dayFilterMonth !== 'ALL' || dayFilterYear !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setDayFilterMonth('ALL');
                      setDayFilterYear('ALL');
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30 hover:bg-amber-400/25 transition"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredDayPdfs.map((pdf) => {
                const topicItems = (pdf.topic_list || '')
                  .split(/[,\n]/)
                  .map((t) => t.trim())
                  .filter((t) => t.length > 0);

                return (
                  <div
                    key={pdf.id}
                    className="bg-slate-950/70 border border-white/[0.06] hover:border-amber-400/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 font-black text-xs border border-amber-400/30">
                          DAY {pdf.day_number}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 bg-white/[0.05] px-2 py-0.5 rounded">
                          📁 {pdf.monthTitle}
                        </span>
                        <span className="text-[11px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded">
                          📅 {pdf.release_date}
                        </span>
                      </div>

                      <h4 className="font-bold text-white text-sm">{pdf.title}</h4>

                      {topicItems.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {topicItems.slice(0, 4).map((top, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-medium text-slate-400 bg-slate-900 border border-white/[0.06] px-2 py-0.5 rounded-md"
                            >
                              ✓ {top}
                            </span>
                          ))}
                          {topicItems.length > 4 && (
                            <span className="text-[10px] font-bold text-amber-400 px-1 py-0.5">
                              +{topicItems.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/[0.06] items-end">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* English PDF Link */}
                        <a
                          href={pdf.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 text-xs font-bold border border-amber-400/30 transition flex items-center gap-1"
                          title="Open English Current Affairs PDF"
                        >
                          <span>🇬🇧 EN PDF</span>
                          <span>↗</span>
                        </a>

                        {/* Hindi PDF Link / Add Button */}
                        {pdf.pdf_hindi_url ? (
                          <a
                            href={pdf.pdf_hindi_url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold border border-emerald-500/30 transition flex items-center gap-1"
                            title="Open Hindi Current Affairs PDF (हिन्दी PDF)"
                          >
                            <span>🇮🇳 हिन्दी PDF</span>
                            <span>↗</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDayPdfId(editingDayPdfId === pdf.id ? null : pdf.id);
                              setEditingDayHindiUrl('');
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] font-bold border border-dashed border-white/[0.15] transition"
                            title="Attach Hindi PDF to this day sheet"
                          >
                            + Hindi PDF
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteDayPdf(pdf.id, pdf.title)}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold border border-rose-500/30 transition"
                        >
                          Delete
                        </button>
                      </div>

                      {/* Inline Drawer to Add or Replace Hindi PDF */}
                      {editingDayPdfId === pdf.id && (
                        <div className="w-full max-w-sm p-3 bg-slate-900 border border-emerald-500/30 rounded-xl space-y-2 mt-1">
                          <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">
                            Attach Hindi PDF (हिन्दी) to Day {pdf.day_number}
                          </span>
                          <input
                            type="url"
                            placeholder="Paste Hindi PDF URL or upload below…"
                            value={editingDayHindiUrl}
                            onChange={(e) => setEditingDayHindiUrl(e.target.value)}
                            className="w-full bg-slate-950 border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <label className="flex-1 text-center bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-2 py-1 text-[11px] font-bold cursor-pointer transition">
                              <span>📎 Upload .pdf</span>
                              <input
                                type="file"
                                accept=".pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadInlineHindiPdf(f, pdf);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleSaveEditingDayHindi(pdf)}
                              disabled={!editingDayHindiUrl.trim()}
                              className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-[11px] font-black transition disabled:opacity-40"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDayPdfId(null)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-[11px] transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quizzes Archive */}
          <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-base font-black text-white">Published Daily GA Quizzes</h3>
                <span className="text-xs text-slate-400">Total: {publishedQuizzes.length} Quizzes</span>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('quiz_word')}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition shadow flex items-center gap-1.5 cursor-pointer"
              >
                <span>➕</span>
                <span>Upload New Quiz (.docx)</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
              {publishedQuizzes.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No quizzes published yet.</p>
              ) : (
                publishedQuizzes.map((q) => (
                  <div
                    key={q.id}
                    className="bg-slate-950/70 border border-white/[0.06] rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-400/10 text-amber-300">
                          📅 {q.quiz_date}
                        </span>
                        <h4 className="font-bold text-white text-sm">{q.title}</h4>
                      </div>
                      <span className="text-xs text-slate-400 mt-0.5 block">
                        ⏱️ {q.duration_minutes || 10} Mins Duration
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href="/bsca?tab=quiz"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition flex items-center gap-1"
                      >
                        <span>View</span>
                        <span>↗</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuiz(q.id, q.title)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold transition cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 5: MONTHLY CAPSULES                                               */}
      {/* ========================================================================= */}
      {subTab === 'capsules' && (
        <div className="space-y-6">
          <form onSubmit={handleAddCapsule} className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
            <h3 className="text-base font-black text-white">Publish Monthly PDF Capsule / Master Book</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className={labelCls}>Capsule Title</span>
                <input
                  type="text"
                  placeholder="e.g. BSCA October 2026 Master Capsule"
                  value={newCapTitle}
                  onChange={(e) => setNewCapTitle(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <span className={labelCls}>Month / Edition</span>
                <input
                  type="text"
                  placeholder="e.g. October 2026"
                  value={newCapMonth}
                  onChange={(e) => setNewCapMonth(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className={labelCls}>Category</span>
                <select
                  value={newCapCategory}
                  onChange={(e) =>
                    setNewCapCategory(
                      e.target.value as 'MONTHLY_FULL' | 'BANKING_AWARENESS' | 'RBI_CIRCULARS' | 'BUDGET_SCHEMES'
                    )
                  }
                  className={inputCls}
                >
                  <option value="MONTHLY_FULL">Monthly Full Capsule</option>
                  <option value="BANKING_AWARENESS">Banking Awareness Special</option>
                  <option value="RBI_CIRCULARS">RBI Circulars Digest</option>
                  <option value="BUDGET_SCHEMES">Budget &amp; Schemes</option>
                </select>
              </div>
              <div>
                <span className={labelCls}>Badge (Optional)</span>
                <input
                  type="text"
                  placeholder="e.g. MUST REVISE"
                  value={newCapBadge}
                  onChange={(e) => setNewCapBadge(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <span className={labelCls}>PDF Public URL</span>
                <input
                  type="url"
                  placeholder="https://... or upload PDF on right"
                  value={newCapUrl}
                  onChange={(e) => setNewCapUrl(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <span className={labelCls}>Or Upload Monthly PDF to Cloud</span>
                <label className="flex items-center justify-center gap-2 w-full bg-slate-950 border border-white/[0.1] hover:border-amber-400/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white cursor-pointer transition">
                  <span>{isUploadingCapFile ? '⏳ Uploading...' : '📎 Upload .pdf to Cloud'}</span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    disabled={isUploadingCapFile}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadCapPdf(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            <div>
              <span className={labelCls}>Bullet Highlights (One per line)</span>
              <textarea
                rows={3}
                placeholder="300+ Curated Banking Current Affairs&#10;Static GK Quick Tables&#10;50 High-Yield MCQs"
                value={newCapHighlights}
                onChange={(e) => setNewCapHighlights(e.target.value)}
                className={inputCls}
              />
            </div>

            <button
              type="submit"
              disabled={busy || isUploadingCapFile}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs shadow-md disabled:opacity-50"
            >
              {busy ? 'Publishing…' : '➕ Publish Capsule'}
            </button>
          </form>

          {/* Published Capsules List */}
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-3xl p-6 space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Published Capsules ({capsules.length})</h4>
            {capsules.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No capsules published yet. Upload your first monthly PDF capsule above.</p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {capsules.map((cap) => (
                  <div key={cap.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-white block">{cap.title}</span>
                      <span className="text-slate-400">{cap.month} · {cap.category}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a href={cap.pdf_url} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">
                        View PDF ↗
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteCapsule(cap.id, cap.title)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-bold transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 6: CURRENT AFFAIRS PRICING & PLANS                                */}
      {/* ========================================================================= */}
      {subTab === 'pricing' && <AdminBscaPricing />}

      {/* ========================================================================= */}
      {/* SUB-TAB 7: MANAGE ARCHIVE                                                 */}
      {/* ========================================================================= */}
      {subTab === 'manage' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-base font-black text-white">Published Articles Archive</h3>
                <span className="text-xs text-slate-400">Total: {publishedArticles.length} Articles</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Filter Date:</span>
                <select
                  value={manageFilterDate}
                  onChange={(e) => setManageFilterDate(e.target.value)}
                  className="bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                >
                  <option value="ALL">All Dates</option>
                  {articleDates.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (manageFilterDate !== 'ALL') {
                      setDocArticlesDate(manageFilterDate);
                      setDocAutoDetectDate(false);
                    }
                    setSubTab('articles_doc');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs transition shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <span>📰</span>
                  <span>Update Articles via Doc (.doc/.docx)</span>
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredArticles.map((art) => {
                const meta = getCategoryMeta(art.category);
                return (
                  <div
                    key={art.id}
                    className="bg-slate-950/70 border border-white/[0.06] rounded-2xl p-4 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-400/10 text-amber-300">
                          📅 {art.date}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${meta.badgeCls}`}>
                          {meta.label}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-sm truncate">{art.title}</h4>
                      <p className="text-xs text-slate-400">{art.bullets.length} bullets · {art.staticGk.length} static GK notes</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteArticle(art.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold shrink-0 transition"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quizzes Archive */}
          <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-base font-black text-white">Published Daily GA Quizzes</h3>
                <span className="text-xs text-slate-400">Total: {publishedQuizzes.length} Quizzes</span>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('quiz_word')}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition shadow flex items-center gap-1.5 cursor-pointer"
              >
                <span>➕</span>
                <span>Upload New Quiz (.docx)</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
              {publishedQuizzes.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No quizzes published yet.</p>
              ) : (
                publishedQuizzes.map((q) => (
                  <div
                    key={q.id}
                    className="bg-slate-950/70 border border-white/[0.06] rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-400/10 text-amber-300">
                          📅 {q.quiz_date}
                        </span>
                        <h4 className="font-bold text-white text-sm">{q.title}</h4>
                      </div>
                      <span className="text-xs text-slate-400 mt-0.5 block">
                        ⏱️ {q.duration_minutes || 10} Mins Duration
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href="/bsca?tab=quiz"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition flex items-center gap-1"
                      >
                        <span>View</span>
                        <span>↗</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuiz(q.id, q.title)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold transition cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

