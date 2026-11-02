'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  DEFAULT_PRACTICE_TOPICS,
  PRACTICE_SESSION_SIZE,
  PracticeDifficulty,
  PracticeHistoryEntry,
  PracticeQuestion,
  fetchRandomPracticeSet,
  fetchTopicCounts,
  getPracticeHistory,
  getTopicIcon,
  savePracticeHistory,
} from '@/lib/practice';
import { PracticeAccessState, checkPracticeAccess } from '@/lib/practiceAccess';
import PracticePaywall from '@/components/PracticePaywall';
import AuthModal from '@/components/AuthModal';

type Stage = 'select' | 'loading' | 'session' | 'result';
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const TIMER_CHOICES = [5, 10, 15, 20];

function formatClock(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatShort(sec: number) {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export default function TopicPracticePage() {
  const [stage, setStage] = useState<Stage>('select');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsLoading, setCountsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [history, setHistory] = useState<PracticeHistoryEntry[]>([]);

  // paid access
  const [access, setAccess] = useState<PracticeAccessState | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const pendingTopicRef = useRef<string>('');
  const accessRef = useRef<PracticeAccessState | null>(null);
  const isLocked = !!access && !access.hasAccess;

  async function refreshAccess() {
    const state = await checkPracticeAccess();
    accessRef.current = state;
    setAccess(state);
    return state;
  }

  // settings
  const [selectedTopic, setSelectedTopic] = useState('');
  const [timerMinutes, setTimerMinutes] = useState(10);
  const [difficulty, setDifficulty] = useState<PracticeDifficulty | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  // session
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [marked, setMarked] = useState<Record<number, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeSpent, setTimeSpent] = useState<Record<number, number>>({});
  const [totalTaken, setTotalTaken] = useState(0);
  const currentRef = useRef(0);
  const submittedRef = useRef(false);

  // result
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'WRONG' | 'CORRECT' | 'SKIPPED'>('ALL');
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    setHistory(getPracticeHistory());
    refreshAccess();
    fetchTopicCounts().then(({ counts: c, error }) => {
      setCounts(c);
      if (error) setLoadError(error);
      setCountsLoading(false);
    });
    // allow deep link: /practice?topic=Percentage
    const t = new URLSearchParams(window.location.search).get('topic');
    if (t) setSelectedTopic(t);
  }, []);

  // ---------------- timer ----------------
  useEffect(() => {
    if (stage !== 'session') return;
    const id = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
      setTimeSpent((prev) => ({ ...prev, [currentRef.current]: (prev[currentRef.current] || 0) + 1 }));
    }, 1000);
    return () => clearInterval(id);
  }, [stage]);

  // auto-submit when the clock hits zero
  useEffect(() => {
    if (stage === 'session' && timeLeft === 0 && questions.length > 0) {
      finishSession(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, stage]);

  // ---------------- topics list ----------------
  const topics = useMemo(() => {
    const defaults = DEFAULT_PRACTICE_TOPICS.map((t) => t.name);
    const all = Array.from(new Set([...Object.keys(counts), ...defaults]));
    return all
      .map((name) => ({ name, count: counts[name] || 0, icon: getTopicIcon(name) }))
      .filter((t) => !search.trim() || t.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.count > 0 ? 1 : 0) - (a.count > 0 ? 1 : 0) || a.name.localeCompare(b.name));
  }, [counts, search]);

  const lastByTopic = useMemo(() => {
    const map: Record<string, PracticeHistoryEntry> = {};
    history.forEach((h) => {
      if (!map[h.topic]) map[h.topic] = h;
    });
    return map;
  }, [history]);

  // ---------------- actions ----------------
  async function startSession(topic = selectedTopic) {
    if (!topic) return;
    setSelectedTopic(topic);

    // Paywall: access not checked yet, or locked
    const state = accessRef.current || (await refreshAccess());
    if (!state.hasAccess) {
      pendingTopicRef.current = topic;
      setPaywallOpen(true);
      return;
    }

    setStage('loading');
    setLoadError('');
    const { data, error } = await fetchRandomPracticeSet(topic, PRACTICE_SESSION_SIZE, difficulty);
    if (error || data.length === 0) {
      setLoadError(
        error ||
          ((counts[topic] || 0) > 0 && difficulty === 'ALL'
            ? 'Could not load questions. If you just purchased, please refresh the page.'
            : `No ${difficulty !== 'ALL' ? difficulty.toLowerCase() + ' ' : ''}questions available in "${topic}" yet.`)
      );
      setStage('select');
      return;
    }
    submittedRef.current = false;
    setQuestions(data);
    setAnswers({});
    setMarked({});
    setTimeSpent({});
    setCurrent(0);
    setTimeLeft(timerMinutes * 60);
    setReviewFilter('ALL');
    setStage('session');
    window.scrollTo({ top: 0 });
  }

  function finishSession(timedOut = false) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setTotalTaken(Math.max(0, timerMinutes * 60 - timeLeft));
    setStage('result');
    if (timedOut) {
      // small heads-up on time out
      setTimeout(() => alert('⏰ Time up! Your practice set has been submitted.'), 50);
    }
    window.scrollTo({ top: 0 });
  }

  function confirmSubmit() {
    const unanswered = questions.length - Object.keys(answers).length;
    if (unanswered > 0 && !confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) return;
    finishSession(false);
  }

  // ---------------- results ----------------
  const result = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    questions.forEach((q, i) => {
      const a = answers[i];
      if (a === undefined) skipped++;
      else if (a === q.correct_option_index) correct++;
      else wrong++;
    });
    const attempted = correct + wrong;
    return {
      correct,
      wrong,
      skipped,
      attempted,
      accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
      avgTime: attempted ? Math.round(Object.values(timeSpent).reduce((a, b) => a + b, 0) / Math.max(1, questions.length)) : 0,
    };
  }, [questions, answers, timeSpent]);

  // save history once per finished session
  const savedForRef = useRef<string>('');
  useEffect(() => {
    if (stage !== 'result' || questions.length === 0) return;
    const key = questions.map((q) => q.id).join(',');
    if (savedForRef.current === key) return;
    savedForRef.current = key;
    savePracticeHistory({
      topic: selectedTopic,
      correct: result.correct,
      wrong: result.wrong,
      skipped: result.skipped,
      total: questions.length,
      timeTakenSec: totalTaken,
      at: new Date().toISOString(),
    });
    setHistory(getPracticeHistory());
  }, [stage, questions, result, selectedTopic, totalTaken]);

  // =========================================================================
  // RENDER: SELECT
  // =========================================================================
  if (stage === 'select' || stage === 'loading') {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-2">
                <Link href="/" className="hover:text-amber-400">Home</Link>
                <span>/</span>
                <span className="text-amber-400">Topic Practice</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">🧮 Topic-wise Question Practice</h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Pick a topic and get {PRACTICE_SESSION_SIZE} random exam-level questions with a timer. Every attempt brings a fresh set,
                with step-by-step solutions after you submit.
              </p>
            </div>
            <Link
              href="/calc-lab"
              className="self-start md:self-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 font-bold text-xs rounded-xl transition"
            >
              ⚡ Need speed? Open Calc Lab →
            </Link>
          </div>

          {/* Access banner */}
          {access && access.isPaid && (
            access.hasAccess ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] px-5 py-3 text-xs font-bold text-emerald-200 flex flex-wrap items-center justify-between gap-2">
                <span>
                  ✅ Practice unlocked
                  {access.source === 'PRO_PASS' && ' via PRO Pass'}
                  {access.source === 'ADMIN' && ' (admin)'}
                  {access.expiresAt
                    ? ` · valid till ${new Date(access.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : access.source !== 'ADMIN' ? ' · lifetime access' : ''}
                </span>
                {access.source === 'PURCHASE' && (
                  <button type="button" onClick={() => setPaywallOpen(true)} className="text-amber-300 hover:text-amber-200 underline">
                    Extend plan
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-amber-400/40 bg-gradient-to-r from-amber-400/10 to-orange-500/10 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-black text-white">🔒 Unlock unlimited topic-wise practice</h2>
                  <p className="text-xs text-slate-300 mt-1">
                    Browse all topics for free. Buy a practice pass to start timed sets and see full solutions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaywallOpen(true)}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs shrink-0"
                >
                  👑 View plans
                </button>
              </div>
            )
          )}

          {/* Settings */}
          <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">⏱️ Timer for {PRACTICE_SESSION_SIZE} questions</span>
              <div className="flex gap-2">
                {TIMER_CHOICES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTimerMinutes(m)}
                    className={`flex-1 py-2 rounded-xl text-xs font-black border transition ${
                      timerMinutes === m
                        ? 'bg-amber-400 text-slate-950 border-amber-400'
                        : 'bg-slate-950 text-slate-300 border-white/[0.08] hover:border-amber-400/40'
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">🎯 Difficulty</span>
              <div className="flex gap-2">
                {(['ALL', 'EASY', 'MEDIUM', 'HARD'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2 rounded-xl text-xs font-black border transition ${
                      difficulty === d
                        ? 'bg-blue-500 text-white border-blue-400'
                        : 'bg-slate-950 text-slate-300 border-white/[0.08] hover:border-blue-400/40'
                    }`}
                  >
                    {d === 'ALL' ? 'Mixed' : d.charAt(0) + d.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">🔍 Find topic</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. Time & Work"
                className="w-full bg-slate-950 border border-white/[0.1] focus:border-amber-400/60 rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          {loadError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm font-bold">⚠️ {loadError}</div>
          )}

          {/* Featured Section: Mixed Arithmetic Speed Drill */}
          {(!search || 'mixed arithmetic'.includes(search.toLowerCase())) && (
            <div className="relative overflow-hidden rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-950/40 via-slate-900/95 to-slate-950 p-6 sm:p-7 shadow-2xl shadow-amber-500/5">
              <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 shadow-sm">
                      🎯 Featured Drill
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold text-amber-300 border border-amber-400/30 bg-amber-400/10">
                      ⚡ Real Exam Simulation
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-300 border border-emerald-500/30 bg-emerald-500/10">
                      {counts['Mixed Arithmetic'] || 0} Questions Available
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                      <span>🎯 Mixed Arithmetic Speed Drill</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                      Simulate the real Banking Prelims &amp; Mains Quant section! Randomly draws {PRACTICE_SESSION_SIZE} diversified questions across
                      all chapters — Percentages, Profit &amp; Loss, SI/CI, Time &amp; Work, Speed &amp; Distance, Ratio, Mixture, and more.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-400">⏱️</span>
                      <span>{timerMinutes} min timer</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-400">📊</span>
                      <span>{difficulty === 'ALL' ? 'Mixed difficulty' : `${difficulty.toLowerCase()} only`}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-400">💡</span>
                      <span>Detailed step-by-step solutions</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2.5">
                  <button
                    type="button"
                    disabled={stage === 'loading' || (counts['Mixed Arithmetic'] || 0) === 0}
                    onClick={() => startSession('Mixed Arithmetic')}
                    className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                  >
                    {stage === 'loading' && selectedTopic === 'Mixed Arithmetic' ? (
                      'Preparing your drill…'
                    ) : isLocked ? (
                      <>🔒 Unlock to Start Mixed Drill</>
                    ) : (
                      <>▶ Start Mixed Drill ({PRACTICE_SESSION_SIZE} Qs)</>
                    )}
                  </button>
                  {lastByTopic['Mixed Arithmetic'] && (
                    <div className="text-[11px] text-center text-slate-400">
                      Last score:{' '}
                      <span className="text-emerald-400 font-bold">
                        {lastByTopic['Mixed Arithmetic'].correct}/{lastByTopic['Mixed Arithmetic'].total}
                      </span>{' '}
                      in {formatShort(lastByTopic['Mixed Arithmetic'].timeTakenSec)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Topics grid */}
          {countsLoading ? (
            <div className="py-16 text-center text-xs font-bold uppercase tracking-widest text-slate-500">Loading topics…</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {topics.map((t) => {
                const isMixed = t.name.toLowerCase() === 'mixed arithmetic';
                const last = lastByTopic[t.name];
                const available = t.count > 0;
                const isLoadingThis = stage === 'loading' && selectedTopic === t.name;
                return (
                  <div
                    key={t.name}
                    className={`relative rounded-3xl border p-5 flex flex-col justify-between gap-4 transition ${
                      isMixed
                        ? 'bg-gradient-to-b from-amber-500/[0.08] to-slate-900/80 border-amber-400/40 shadow-lg shadow-amber-500/5 hover:border-amber-400 hover:-translate-y-0.5'
                        : available
                        ? 'bg-slate-900/70 border-white/[0.08] hover:border-amber-400/50 hover:-translate-y-0.5'
                        : 'bg-slate-900/30 border-white/[0.04] opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 ${
                          isMixed
                            ? 'bg-amber-400/20 border border-amber-400/40 text-amber-300'
                            : 'bg-amber-400/10 border border-amber-400/25 text-amber-300'
                        }`}
                      >
                        {t.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-black text-white truncate">{t.name}</h3>
                          {isMixed && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40">
                              ★ All Chapters
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {available
                            ? isMixed
                              ? `${t.count} total arithmetic Qs`
                              : `${t.count} questions in pool`
                            : 'Questions coming soon'}
                        </p>
                        {last && (
                          <p className="text-[11px] text-emerald-300 mt-0.5">
                            Last: {last.correct}/{last.total} · {formatShort(last.timeTakenSec)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!available || stage === 'loading'}
                      onClick={() => startSession(t.name)}
                      className="w-full py-2.5 rounded-xl text-xs font-black transition bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 hover:to-amber-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500"
                    >
                      {isLoadingThis
                        ? 'Preparing your set…'
                        : !available
                        ? 'Not available yet'
                        : isLocked
                        ? `🔒 Unlock to start ${Math.min(PRACTICE_SESSION_SIZE, t.count)} Qs`
                        : `▶ Start ${Math.min(PRACTICE_SESSION_SIZE, t.count)} Qs · ${timerMinutes} min`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent history */}
          {history.length > 0 && (
            <div className="bg-slate-900/60 border border-white/[0.08] rounded-3xl p-5 space-y-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">📈 Your recent practice</h2>
              <div className="divide-y divide-white/[0.05]">
                {history.slice(0, 8).map((h, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <span className="font-bold text-white truncate">{h.topic}</span>
                    <span className="text-slate-400 shrink-0">
                      <span className="text-emerald-400 font-black">{h.correct}</span>/{h.total} correct ·{' '}
                      {Math.round((h.correct / Math.max(1, h.correct + h.wrong)) * 100)}% acc · {formatShort(h.timeTakenSec)} ·{' '}
                      {new Date(h.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <PracticePaywall
          isOpen={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          user={access?.user || null}
          onRequireLogin={() => setAuthOpen(true)}
          onUnlocked={async () => {
            setPaywallOpen(false);
            await refreshAccess();
            const pending = pendingTopicRef.current;
            pendingTopicRef.current = '';
            if (pending) startSession(pending);
          }}
        />
        <AuthModal
          isOpen={authOpen}
          onClose={() => setAuthOpen(false)}
          onSuccess={async () => {
            setAuthOpen(false);
            const state = await refreshAccess();
            // Already has access (e.g. PRO Pass)? close paywall and continue
            if (state.hasAccess) {
              setPaywallOpen(false);
              const pending = pendingTopicRef.current;
              pendingTopicRef.current = '';
              if (pending) startSession(pending);
            }
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // RENDER: SESSION
  // =========================================================================
  if (stage === 'session') {
    const q = questions[current];
    const lowTime = timeLeft <= 60;
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="min-h-screen bg-[#020617] text-slate-100">
        {/* Sticky header */}
        <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-white/[0.08]">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">Practice · {selectedTopic}</span>
              <span className="text-xs text-slate-400">
                Question {current + 1} of {questions.length} · {answeredCount} answered
              </span>
            </div>
            <div
              className={`px-4 py-2 rounded-xl font-mono font-black text-lg border ${
                lowTime ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 animate-pulse' : 'bg-slate-900 text-white border-white/[0.1]'
              }`}
            >
              ⏱️ {formatClock(timeLeft)}
            </div>
            <button
              type="button"
              onClick={confirmSubmit}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition shrink-0"
            >
              Submit
            </button>
          </div>
          <div className="h-1 bg-slate-900">
            <div
              className="h-1 bg-gradient-to-r from-amber-400 to-emerald-400 transition-all"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-6 pb-28 md:pb-8 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6">
          {/* Question card */}
          <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400">Q{current + 1}.</span>
                {q.topic && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300">
                    {q.topic}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  q.difficulty === 'EASY'
                    ? 'text-emerald-300 border-emerald-500/30'
                    : q.difficulty === 'HARD'
                    ? 'text-rose-300 border-rose-500/30'
                    : 'text-amber-300 border-amber-500/30'
                }`}
              >
                {q.difficulty}
              </span>
            </div>

            {q.question_text && <p className="text-base sm:text-lg text-white leading-relaxed whitespace-pre-wrap">{q.question_text}</p>}
            {q.question_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={q.question_image_url}
                alt="Question figure"
                onClick={() => setZoomImg(q.question_image_url!)}
                className="max-h-80 rounded-2xl border border-white/[0.08] bg-white cursor-zoom-in"
              />
            )}

            <div className="space-y-2.5">
              {q.options.map((opt, i) => {
                const selected = answers[current] === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [current]: i }))}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl border transition ${
                      selected
                        ? 'bg-amber-400/15 border-amber-400 text-white'
                        : 'bg-slate-950/70 border-white/[0.08] text-slate-200 hover:border-amber-400/40'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-xs font-black ${
                        selected ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {OPTION_LETTERS[i]}
                    </span>
                    <span className="text-sm">{opt}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMarked((p) => ({ ...p, [current]: !p[current] }))}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                    marked[current] ? 'bg-purple-500/20 border-purple-400 text-purple-200' : 'bg-slate-950 border-white/[0.08] text-slate-300'
                  }`}
                >
                  🔖 {marked[current] ? 'Marked' : 'Mark for review'}
                </button>
                {answers[current] !== undefined && (
                  <button
                    type="button"
                    onClick={() =>
                      setAnswers((prev) => {
                        const n = { ...prev };
                        delete n[current];
                        return n;
                      })
                    }
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-950 border border-white/[0.08] text-slate-300"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={current === 0}
                  onClick={() => setCurrent((c) => c - 1)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 disabled:opacity-40"
                >
                  ← Prev
                </button>
                {current < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrent((c) => c + 1)}
                    className="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={confirmSubmit}
                    className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Submit ✓
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Palette */}
          <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-4 h-fit space-y-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">Question palette</span>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((_, i) => {
                const isAns = answers[i] !== undefined;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrent(i)}
                    className={`relative h-10 rounded-xl text-xs font-black border transition ${
                      i === current ? 'ring-2 ring-amber-400 ' : ''
                    }${
                      isAns
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                        : 'bg-slate-950 border-white/[0.08] text-slate-400'
                    }`}
                  >
                    {i + 1}
                    {marked[i] && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-purple-400" />}
                  </button>
                );
              })}
            </div>
            <div className="space-y-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500/40" /> Answered</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-slate-800" /> Not answered</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-400" /> Marked for review</div>
            </div>
          </div>
        </div>

        {zoomImg && <ImageZoom src={zoomImg} onClose={() => setZoomImg(null)} />}
      </div>
    );
  }

  // =========================================================================
  // RENDER: RESULT
  // =========================================================================
  const reviewList = questions
    .map((q, i) => ({ q, i, a: answers[i] }))
    .filter(({ q, a }) => {
      if (reviewFilter === 'CORRECT') return a === q.correct_option_index;
      if (reviewFilter === 'WRONG') return a !== undefined && a !== q.correct_option_index;
      if (reviewFilter === 'SKIPPED') return a === undefined;
      return true;
    });

  const verdict =
    result.correct >= Math.ceil(questions.length * 0.8)
      ? { text: 'Excellent! Exam-ready on this topic 🏆', cls: 'text-emerald-300' }
      : result.correct >= Math.ceil(questions.length * 0.5)
      ? { text: 'Good effort – review the mistakes below 💪', cls: 'text-amber-300' }
      : { text: 'Needs more practice – go through each solution 📘', cls: 'text-rose-300' };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Score card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/[0.08] rounded-3xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Practice result · {selectedTopic}</span>
              <h1 className="text-3xl font-black text-white mt-1">
                {result.correct} <span className="text-slate-500 text-xl">/ {questions.length}</span>
              </h1>
              <p className={`text-sm font-bold mt-1 ${verdict.cls}`}>{verdict.text}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => startSession(selectedTopic)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs rounded-xl"
              >
                🔄 New 10 Qs – {selectedTopic}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStage('select');
                  setQuestions([]);
                }}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl"
              >
                Change topic
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Correct', value: result.correct, cls: 'text-emerald-400' },
              { label: 'Wrong', value: result.wrong, cls: 'text-rose-400' },
              { label: 'Skipped', value: result.skipped, cls: 'text-slate-300' },
              { label: 'Accuracy', value: `${result.accuracy}%`, cls: 'text-blue-400' },
              { label: 'Time taken', value: formatShort(totalTaken), cls: 'text-amber-400' },
            ].map((s) => (
              <div key={s.label} className="bg-slate-950/70 border border-white/[0.06] rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">{s.label}</span>
                <span className={`text-xl font-black ${s.cls}`}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Review filters */}
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'WRONG', 'CORRECT', 'SKIPPED'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setReviewFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                reviewFilter === f ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-900 text-slate-300 border-white/[0.08]'
              }`}
            >
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Solutions */}
        <div className="space-y-4">
          {reviewList.map(({ q, i, a }) => {
            const status = a === undefined ? 'SKIPPED' : a === q.correct_option_index ? 'CORRECT' : 'WRONG';
            return (
              <div key={q.id} className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400">Q{i + 1}.</span>
                    {q.topic && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300">
                        {q.topic}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">⏱️ {formatShort(timeSpent[i] || 0)}</span>
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                        status === 'CORRECT'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : status === 'WRONG'
                          ? 'bg-rose-500/15 text-rose-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {status === 'CORRECT' ? '✓ Correct' : status === 'WRONG' ? '✗ Wrong' : 'Skipped'}
                    </span>
                  </div>
                </div>

                {q.question_text && <p className="text-white whitespace-pre-wrap leading-relaxed">{q.question_text}</p>}
                {q.question_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={q.question_image_url}
                    alt="Question figure"
                    onClick={() => setZoomImg(q.question_image_url!)}
                    className="max-h-64 rounded-2xl border border-white/[0.08] bg-white cursor-zoom-in"
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oi) => {
                    const isCorrect = oi === q.correct_option_index;
                    const isMine = oi === a;
                    return (
                      <div
                        key={oi}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm ${
                          isCorrect
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-100'
                            : isMine
                            ? 'bg-rose-500/15 border-rose-500/50 text-rose-100'
                            : 'bg-slate-950/60 border-white/[0.06] text-slate-400'
                        }`}
                      >
                        <span className="font-black text-xs">{OPTION_LETTERS[oi]}</span>
                        <span className="flex-1">{opt}</span>
                        {isCorrect && <span className="text-[10px] font-black">✓ ANSWER</span>}
                        {isMine && !isCorrect && <span className="text-[10px] font-black">YOUR PICK</span>}
                      </div>
                    );
                  })}
                </div>

                {(q.solution_text || q.solution_image_url) ? (
                  <div className="bg-blue-500/[0.06] border border-blue-500/25 rounded-2xl p-4 space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-300 block">💡 Solution</span>
                    {q.solution_text && <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{q.solution_text}</p>}
                    {q.solution_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={q.solution_image_url}
                        alt="Solution"
                        onClick={() => setZoomImg(q.solution_image_url!)}
                        className="max-h-96 rounded-xl border border-white/[0.08] bg-white cursor-zoom-in"
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Solution will be added soon.</p>
                )}
              </div>
            );
          })}
          {reviewList.length === 0 && <p className="text-sm text-slate-500 text-center py-8">No questions in this filter.</p>}
        </div>
      </div>

      {zoomImg && <ImageZoom src={zoomImg} onClose={() => setZoomImg(null)} />}
    </div>
  );
}

function ImageZoom({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Zoomed" className="max-w-full max-h-full rounded-xl bg-white" />
      <button type="button" onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-900 text-white font-black">
        ✕
      </button>
    </div>
  );
}
