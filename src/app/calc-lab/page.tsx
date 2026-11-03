'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  decodeChallengeToken,
  evaluateCalcLabDuel,
  formatCalcDurationLabel,
  getSavedChallengerName,
  saveChallengerName,
  type CalcLabChallengePayload,
} from '@/lib/headToHeadChallenge';
import {
  HeadToHeadIncomingBanner,
  HeadToHeadLiveTargetBar,
  HeadToHeadSharePanel,
  HeadToHeadVerdictBanner,
} from '@/components/HeadToHeadChallengeCard';

type ModuleType =
  | 'mixed'
  | 'simplification'
  | 'tables'
  | 'squares'
  | 'cubes'
  | 'percentages'
  | 'add_sub';

type DifficultyLevel = 'easy' | 'medium' | 'hard';

interface QuestionProblem {
  prompt: string;
  answer: number;
  explanation: string;
  tag: string;
}

interface AttemptHistoryItem {
  prompt: string;
  correctAnswer: number;
  userAnswer: number | string;
  isCorrect: boolean;
  timeMs: number;
}

interface LeaderboardEntry {
  id: string;
  user_id: string;
  student_name: string;
  module_type: string;
  score: number;
  total_attempted: number;
  accuracy: number;
  created_at: string;
}

interface CombatOpponent {
  name: string;
  elo: number;
  examBadge: string;
  avgSolveMs: number;
  accuracyRate: number;
}

const COMBAT_OPPONENTS: CombatOpponent[] = [
  { name: 'Aarav S.', elo: 1180, examBadge: 'SBI Clerk Aspirant', avgSolveMs: 4400, accuracyRate: 0.86 },
  { name: 'Neha Verma', elo: 1320, examBadge: 'IBPS PO Target', avgSolveMs: 3600, accuracyRate: 0.89 },
  { name: 'Rohit Kulkarni', elo: 1480, examBadge: 'SBI PO Mains', avgSolveMs: 2950, accuracyRate: 0.92 },
  { name: 'Priya Nair', elo: 1640, examBadge: 'RBI Assistant Topper', avgSolveMs: 2400, accuracyRate: 0.94 },
  { name: 'Vikramaditya', elo: 1820, examBadge: 'Quant Grandmaster', avgSolveMs: 1950, accuracyRate: 0.96 },
];

const fractionPercentagePool: QuestionProblem[] = [
  { prompt: '16.66% of 60', answer: 10, explanation: '16.66% = 1/6 → 60 ÷ 6 = 10', tag: 'Fraction %' },
  { prompt: '14.28% of 70', answer: 10, explanation: '14.28% = 1/7 → 70 ÷ 7 = 10', tag: 'Fraction %' },
  { prompt: '12.5% of 80', answer: 10, explanation: '12.5% = 1/8 → 80 ÷ 8 = 10', tag: 'Fraction %' },
  { prompt: '37.5% of 80', answer: 30, explanation: '37.5% = 3/8 → 3 × 10 = 30', tag: 'Fraction %' },
  { prompt: '62.5% of 80', answer: 50, explanation: '62.5% = 5/8 → 5 × 10 = 50', tag: 'Fraction %' },
  { prompt: '87.5% of 160', answer: 140, explanation: '87.5% = 7/8 → 7 × 20 = 140', tag: 'Fraction %' },
  { prompt: '83.33% of 60', answer: 50, explanation: '83.33% = 5/6 → 5 × 10 = 50', tag: 'Fraction %' },
  { prompt: '11.11% of 90', answer: 10, explanation: '11.11% = 1/9 → 90 ÷ 9 = 10', tag: 'Fraction %' },
  { prompt: '22.22% of 180', answer: 40, explanation: '22.22% = 2/9 → 2 × 20 = 40', tag: 'Fraction %' },
  { prompt: '9.09% of 110', answer: 10, explanation: '9.09% = 1/11 → 110 ÷ 11 = 10', tag: 'Fraction %' },
  { prompt: '27.27% of 110', answer: 30, explanation: '27.27% = 3/11 → 3 × 10 = 30', tag: 'Fraction %' },
  { prompt: '45.45% of 110', answer: 50, explanation: '45.45% = 5/11 → 5 × 10 = 50', tag: 'Fraction %' },
  { prompt: '33.33% of 90', answer: 30, explanation: '33.33% = 1/3 → 90 ÷ 3 = 30', tag: 'Fraction %' },
  { prompt: '66.66% of 90', answer: 60, explanation: '66.66% = 2/3 → 2 × 30 = 60', tag: 'Fraction %' },
  { prompt: '20% of 150', answer: 30, explanation: '20% = 1/5 → 150 ÷ 5 = 30', tag: 'Fraction %' },
  { prompt: '40% of 150', answer: 60, explanation: '40% = 2/5 → 2 × 30 = 60', tag: 'Fraction %' },
  { prompt: '60% of 150', answer: 90, explanation: '60% = 3/5 → 3 × 30 = 90', tag: 'Fraction %' },
  { prompt: '80% of 150', answer: 120, explanation: '80% = 4/5 → 4 × 30 = 120', tag: 'Fraction %' },
  { prompt: '28.57% of 70', answer: 20, explanation: '28.57% = 2/7 → 2 × 10 = 20', tag: 'Fraction %' },
  { prompt: '42.85% of 70', answer: 30, explanation: '42.85% = 3/7 → 3 × 10 = 30', tag: 'Fraction %' },
  { prompt: '57.14% of 70', answer: 40, explanation: '57.14% = 4/7 → 4 × 10 = 40', tag: 'Fraction %' },
  { prompt: '71.42% of 70', answer: 50, explanation: '71.42% = 5/7 → 5 × 10 = 50', tag: 'Fraction %' },
  { prompt: '85.71% of 70', answer: 60, explanation: '85.71% = 6/7 → 6 × 10 = 60', tag: 'Fraction %' },
  { prompt: '6.25% of 160', answer: 10, explanation: '6.25% = 1/16 → 160 ÷ 16 = 10', tag: 'Fraction %' },
  { prompt: '18.18% of 220', answer: 40, explanation: '18.18% = 2/11 → 2 × 20 = 40', tag: 'Fraction %' },
  { prompt: '75% of 240', answer: 180, explanation: '75% = 3/4 → 3 × 60 = 180', tag: 'Fraction %' },
];

function getEloLeagueBadge(elo: number): { label: string; icon: string; color: string } {
  if (elo >= 1800) {
    return { label: 'Grandmaster', icon: '👑', color: 'text-amber-300 bg-amber-400/15 border-amber-400/40' };
  }
  if (elo >= 1550) {
    return { label: 'Diamond League', icon: '💎', color: 'text-cyan-300 bg-cyan-400/15 border-cyan-400/40' };
  }
  if (elo >= 1350) {
    return { label: 'Gold League', icon: '🥇', color: 'text-yellow-300 bg-yellow-400/15 border-yellow-400/40' };
  }
  if (elo >= 1150) {
    return { label: 'Silver League', icon: '⚡', color: 'text-slate-200 bg-slate-700/60 border-slate-500/40' };
  }
  return { label: 'Bronze League', icon: '🛡️', color: 'text-orange-300 bg-orange-500/15 border-orange-500/40' };
}

function stepLcgSeed(seed: number): { nextSeed: number; value: number } {
  const nextSeed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return { nextSeed, value: nextSeed / 4294967296 };
}

function hashCodeToSeed(text: string): number {
  let hash = 2166136261;
  const clean = text.trim().toUpperCase();
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1234567;
}

function readStoredNumber(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  try {
    const val = Number(localStorage.getItem(key));
    return Number.isFinite(val) && val >= 0 ? val : fallback;
  } catch {
    return fallback;
  }
}

function shufflePoolWithSeed(pool: QuestionProblem[], seedRef: { current: number }): QuestionProblem[] {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const stepped = stepLcgSeed(seedRef.current);
    seedRef.current = stepped.nextSeed;
    const j = Math.floor(stepped.value * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function generateSeededProblem(
  moduleType: ModuleType,
  diff: DifficultyLevel,
  seedRef: { current: number },
  queueRef: { current: QuestionProblem[] }
): QuestionProblem {
  const nextRand = (): number => {
    const stepped = stepLcgSeed(seedRef.current);
    seedRef.current = stepped.nextSeed;
    return stepped.value;
  };

  const randInt = (min: number, max: number): number =>
    Math.floor(nextRand() * (max - min + 1)) + min;

  if (moduleType === 'add_sub') {
    const isAdd = nextRand() > 0.45;
    const maxVal = diff === 'easy' ? 60 : diff === 'medium' ? 180 : 450;
    const minVal = diff === 'easy' ? 12 : 25;
    if (isAdd) {
      const a = randInt(minVal, maxVal);
      const b = randInt(minVal, maxVal);
      return {
        prompt: `${a} + ${b}`,
        answer: a + b,
        explanation: `${a} + ${b} = ${a + b}`,
        tag: 'Rapid Addition',
      };
    }
    const a = randInt(minVal + 30, maxVal + 50);
    const b = randInt(minVal, a - 5);
    return {
      prompt: `${a} − ${b}`,
      answer: a - b,
      explanation: `${a} − ${b} = ${a - b}`,
      tag: 'Rapid Subtraction',
    };
  }

  if (moduleType === 'simplification') {
    const pattern = randInt(1, 3);
    if (pattern === 1) {
      const a = randInt(6, 18);
      const b = randInt(3, 9);
      const c = randInt(10, 45);
      const ans = a * b + c;
      return {
        prompt: `(${a} × ${b}) + ${c}`,
        answer: ans,
        explanation: `${a * b} + ${c} = ${ans}`,
        tag: 'BODMAS Simplification',
      };
    }
    if (pattern === 2) {
      const n = randInt(8, 22);
      const sub = randInt(10, 40);
      const ans = n * n - sub;
      return {
        prompt: `${n}² − ${sub}`,
        answer: ans,
        explanation: `${n * n} − ${sub} = ${ans}`,
        tag: 'Square Simplification',
      };
    }
    const divisor = randInt(3, 12);
    const quotient = randInt(6, 18);
    const add = randInt(12, 48);
    const dividend = divisor * quotient;
    const ans = quotient + add;
    return {
      prompt: `(${dividend} ÷ ${divisor}) + ${add}`,
      answer: ans,
      explanation: `${quotient} + ${add} = ${ans}`,
      tag: 'BODMAS Division',
    };
  }

  if (moduleType === 'tables') {
    const maxA = diff === 'easy' ? 20 : diff === 'medium' ? 29 : 36;
    const num1 = randInt(12, maxA);
    const num2 = randInt(3, diff === 'hard' ? 14 : 9);
    return {
      prompt: `${num1} × ${num2}`,
      answer: num1 * num2,
      explanation: `${num1} × ${num2} = ${num1 * num2}`,
      tag: 'Multiplication Table',
    };
  }

  if (moduleType === 'squares') {
    const maxSq = diff === 'easy' ? 30 : diff === 'medium' ? 50 : 65;
    const num = randInt(11, maxSq);
    return {
      prompt: `${num}²`,
      answer: num * num,
      explanation: `${num} × ${num} = ${num * num}`,
      tag: 'Perfect Square',
    };
  }

  if (moduleType === 'cubes') {
    const maxCube = diff === 'easy' ? 15 : diff === 'medium' ? 22 : 28;
    const num = randInt(5, maxCube);
    return {
      prompt: `${num}³`,
      answer: num * num * num,
      explanation: `${num} × ${num} × ${num} = ${num * num * num}`,
      tag: 'Perfect Cube',
    };
  }

  if (moduleType === 'percentages') {
    if (queueRef.current.length === 0) {
      queueRef.current = shufflePoolWithSeed(fractionPercentagePool, seedRef);
    }
    return queueRef.current.pop()!;
  }

  const ops = ['+', '-', '×', '÷', 'sq', 'pct'];
  const chosenOp = ops[Math.floor(nextRand() * ops.length)];

  if (chosenOp === '+') {
    const a = randInt(14, diff === 'hard' ? 185 : 95);
    const b = randInt(14, diff === 'hard' ? 185 : 95);
    return {
      prompt: `${a} + ${b}`,
      answer: a + b,
      explanation: `${a} + ${b} = ${a + b}`,
      tag: 'Addition',
    };
  }
  if (chosenOp === '-') {
    const a = randInt(35, diff === 'hard' ? 220 : 120);
    const b = randInt(11, a - 4);
    return {
      prompt: `${a} − ${b}`,
      answer: a - b,
      explanation: `${a} − ${b} = ${a - b}`,
      tag: 'Subtraction',
    };
  }
  if (chosenOp === '×') {
    const a = randInt(11, diff === 'hard' ? 28 : 22);
    const b = randInt(3, 9);
    return {
      prompt: `${a} × ${b}`,
      answer: a * b,
      explanation: `${a} × ${b} = ${a * b}`,
      tag: 'Multiplication',
    };
  }
  if (chosenOp === 'sq') {
    const n = randInt(11, 32);
    return {
      prompt: `${n}²`,
      answer: n * n,
      explanation: `${n} × ${n} = ${n * n}`,
      tag: 'Squares',
    };
  }
  if (chosenOp === 'pct') {
    return fractionPercentagePool[Math.floor(nextRand() * fractionPercentagePool.length)];
  }

  const divisor = randInt(3, 15);
  const quotient = randInt(4, 21);
  const dividend = divisor * quotient;
  return {
    prompt: `${dividend} ÷ ${divisor}`,
    answer: quotient,
    explanation: `${dividend} ÷ ${divisor} = ${quotient}`,
    tag: 'Division',
  };
}

function readMonotonicMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function createFreshSessionSeed(salt: number): number {
  return ((Math.floor(readMonotonicMs() * 1000) ^ salt) >>> 0) || 24681357;
}

function CalcLabContent() {
  const searchParams = useSearchParams();
  const challengeTokenParam = searchParams.get('c');

  const decodedUrlChallenge = useMemo(() => {
    const parsed = decodeChallengeToken(challengeTokenParam, 'calc_lab');
    return parsed?.arena === 'calc_lab' ? parsed : null;
  }, [challengeTokenParam]);

  const [dismissedToken, setDismissedToken] = useState<string | null>(null);
  const [acceptedChallenge, setAcceptedChallenge] = useState<CalcLabChallengePayload | null>(null);

  const pendingChallenge =
    decodedUrlChallenge && challengeTokenParam !== dismissedToken ? decodedUrlChallenge : null;

  const [activeTab, setActiveTab] = useState<'practice' | 'combat' | 'leaderboard'>('practice');

  // Practice Configuration States (Default 1 Min = 60s Blitz!)
  const [selectedModule, setSelectedModule] = useState<ModuleType>('mixed');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [selectedMinutes, setSelectedMinutes] = useState<number>(1);
  const [customMinutesInput, setCustomMinutesInput] = useState<string>('');

  // Combat Configuration States
  const [combatDurationSec, setCombatDurationSec] = useState<number>(60);
  const [combatDifficulty, setCombatDifficulty] = useState<DifficultyLevel>('medium');
  const [friendRoomCode, setFriendRoomCode] = useState<string>('');
  const [isSearchingOpponent, setIsSearchingOpponent] = useState(false);
  const [activeOpponent, setActiveOpponent] = useState<CombatOpponent | null>(null);
  const [opponentScore, setOpponentScore] = useState(0);
  const [playerElo, setPlayerElo] = useState<number>(() => {
    const v = readStoredNumber('bs_calc_combat_elo', 1200);
    return v > 0 ? v : 1200;
  });
  const [eloDelta, setEloDelta] = useState<number>(0);
  const [combatWins, setCombatWins] = useState<number>(() =>
    readStoredNumber('bs_calc_combat_wins', 0)
  );
  const [combatLosses, setCombatLosses] = useState<number>(() =>
    readStoredNumber('bs_calc_combat_losses', 0)
  );

  // Active Game Arena States
  const [gameModeType, setGameModeType] = useState<'practice' | 'combat'>('practice');
  const [isGameActive, setIsGameActive] = useState(false);
  const [isGameFinished, setIsGameFinished] = useState(false);

  // Session Seed & Active Settings Snapshot (used to generate deterministic 1v1 Challenge Link!)
  const [sessionSeed, setSessionSeed] = useState<number>(104729);
  const [playedModule, setPlayedModule] = useState<ModuleType>('mixed');
  const [playedDifficulty, setPlayedDifficulty] = useState<DifficultyLevel>('medium');

  // Game Metrics
  const [totalDurationSec, setTotalDurationSec] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [totalAttempted, setTotalAttempted] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreakInSession, setBestStreakInSession] = useState(0);
  const [attemptHistory, setAttemptHistory] = useState<AttemptHistoryItem[]>([]);

  const questionStartTimeRef = useRef<number>(0);
  const sessionQueueRef = useRef<QuestionProblem[]>([]);
  const rngSeedRef = useRef<number>(104729);
  const scoreRef = useRef<number>(0);
  const totalAttemptedRef = useRef<number>(0);
  const opponentScoreRef = useRef<number>(0);

  // User, Challenger Name & Leaderboard States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [challengerDisplayName, setChallengerDisplayName] = useState<string>(() =>
    getSavedChallengerName('Banking Aspirant')
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [currentUserRank, setCurrentUserRank] = useState<{
    rank: number;
    score: number;
    accuracy: number;
    student_name: string;
    module_type: string;
  } | null>(null);

  // Current Question
  const [currentProblem, setCurrentProblem] = useState<QuestionProblem | null>(null);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');

  const inputRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);

  const fetchUserRankOutsideTop50 = useCallback(async (userId: string) => {
    const { data: userData, error: userErr } = await supabase
      .from('calculation_lab_scores')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (userErr || !userData) {
      setCurrentUserRank(null);
      return;
    }

    const { count, error: countErr } = await supabase
      .from('calculation_lab_scores')
      .select('*', { count: 'exact', head: true })
      .or(
        `score.gt.${userData.score},and(score.eq.${userData.score},accuracy.gt.${userData.accuracy})`
      );

    if (!countErr && count !== null) {
      setCurrentUserRank({
        rank: count + 1,
        score: userData.score,
        accuracy: userData.accuracy,
        student_name: userData.student_name || 'You',
        module_type: userData.module_type || 'GENERAL',
      });
    } else {
      setCurrentUserRank(null);
    }
  }, []);

  const fetchLeaderboard = useCallback(
    async (userId?: string) => {
      setLoadingLeaderboard(true);
      const activeUserId = userId || currentUser?.id;

      const { data, error } = await supabase
        .from('calculation_lab_scores')
        .select('*')
        .order('score', { ascending: false })
        .order('accuracy', { ascending: false })
        .limit(50);

      if (!error && data) {
        setLeaderboard(data as LeaderboardEntry[]);

        if (activeUserId) {
          const foundIndex = data.findIndex((entry) => entry.user_id === activeUserId);
          if (foundIndex !== -1) {
            setCurrentUserRank(null);
          } else {
            await fetchUserRankOutsideTop50(activeUserId);
          }
        }
      }
      setLoadingLeaderboard(false);
    },
    [currentUser?.id, fetchUserRankOutsideTop50]
  );

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      const user = session?.user || null;
      setCurrentUser(user);
      if (user) {
        const metaName =
          (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
          user.email?.split('@')[0] ||
          '';
        if (metaName) {
          setChallengerDisplayName((prev) =>
            prev === 'Banking Aspirant' ? metaName.slice(0, 28) : prev
          );
        }
      }
      void fetchLeaderboard(user?.id);
    });
    return () => {
      active = false;
    };
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (isGameActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isGameActive, currentProblem]);

  const finishSession = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    const finalScore = scoreRef.current;
    const finalAttempted = totalAttemptedRef.current;
    const finalOppScore = opponentScoreRef.current;

    setIsGameActive(false);
    setIsGameFinished(true);

    if (gameModeType === 'combat' && activeOpponent) {
      let delta = 0;
      if (finalScore > finalOppScore) {
        delta = 24;
        setCombatWins((prevWins) => {
          const nextWins = prevWins + 1;
          try {
            localStorage.setItem('bs_calc_combat_wins', String(nextWins));
          } catch {}
          return nextWins;
        });
      } else if (finalScore < finalOppScore) {
        delta = -16;
        setCombatLosses((prevLosses) => {
          const nextLosses = prevLosses + 1;
          try {
            localStorage.setItem('bs_calc_combat_losses', String(nextLosses));
          } catch {}
          return nextLosses;
        });
      } else {
        delta = 4;
      }
      setEloDelta(delta);
      setPlayerElo((prevElo) => {
        const nextElo = Math.max(800, prevElo + delta);
        try {
          localStorage.setItem('bs_calc_combat_elo', String(nextElo));
        } catch {}
        return nextElo;
      });
    }

    const session = (await supabase.auth.getSession()).data.session;
    if (session?.user && finalScore > 0) {
      const studentName =
        session.user.user_metadata?.full_name ||
        session.user.email?.split('@')[0] ||
        'Aspirant';

      const accNum =
        finalAttempted > 0 ? Number(((finalScore / finalAttempted) * 100).toFixed(1)) : 100;

      const modLabel =
        gameModeType === 'combat' ? '1V1_COMBAT' : playedModule.toUpperCase();

      await supabase.from('calculation_lab_scores').upsert(
        [
          {
            user_id: session.user.id,
            student_name: studentName,
            module_type: modLabel,
            score: finalScore,
            total_attempted: finalAttempted,
            accuracy: accNum,
            created_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'user_id,module_type' }
      );

      void fetchLeaderboard(session.user.id);
    }
  }, [activeOpponent, fetchLeaderboard, gameModeType, playedModule]);

  // Main Countdown Timer
  useEffect(() => {
    if (!isGameActive) return;
    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          void finishSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [finishSession, isGameActive]);

  // Simulated Live Opponent Tick in Combat Mode
  useEffect(() => {
    if (!isGameActive || gameModeType !== 'combat' || !activeOpponent) return;

    const tickMs = Math.max(1400, activeOpponent.avgSolveMs);
    const botTimer = window.setInterval(() => {
      const jitter = (Math.random() - 0.5) * 0.35;
      const didSolve = Math.random() < activeOpponent.accuracyRate + jitter * 0.1;
      if (didSolve) {
        setOpponentScore((prev) => {
          const next = prev + 1;
          opponentScoreRef.current = next;
          return next;
        });
      }
    }, tickMs);

    return () => window.clearInterval(botTimer);
  }, [isGameActive, gameModeType, activeOpponent]);

  const launchSeededDrill = (opts: {
    durationSeconds: number;
    mod: ModuleType;
    diff: DifficultyLevel;
    seed: number;
    modeType: 'practice' | 'combat';
    opponent: CombatOpponent | null;
    challengeContext: CalcLabChallengePayload | null;
  }) => {
    isSavingRef.current = false;
    scoreRef.current = 0;
    totalAttemptedRef.current = 0;
    opponentScoreRef.current = 0;
    rngSeedRef.current = opts.seed;

    setSessionSeed(opts.seed);
    setPlayedModule(opts.mod);
    setPlayedDifficulty(opts.diff);
    setAcceptedChallenge(opts.challengeContext);

    setGameModeType(opts.modeType);
    setActiveOpponent(opts.opponent);
    setOpponentScore(0);
    setEloDelta(0);

    setScore(0);
    setTotalAttempted(0);
    setCurrentStreak(0);
    setBestStreakInSession(0);
    setAttemptHistory([]);
    setTotalDurationSec(opts.durationSeconds);
    setTimeLeft(opts.durationSeconds);
    setUserInput('');
    setIsGameFinished(false);
    setIsGameActive(true);

    sessionQueueRef.current = shufflePoolWithSeed(fractionPercentagePool, rngSeedRef);
    questionStartTimeRef.current = readMonotonicMs();
    setCurrentProblem(
      generateSeededProblem(opts.mod, opts.diff, rngSeedRef, sessionQueueRef)
    );
  };

  // Start Solo Practice Mode with user-selected minutes
  const startPracticeSession = () => {
    const customMins = Number(customMinutesInput);
    const finalMinutes =
      customMins && customMins >= 1 && customMins <= 60 ? customMins : selectedMinutes;
    const durationSeconds = Math.max(30, Math.round(finalMinutes * 60));
    const freshSeed = createFreshSessionSeed(0x5f3759df);

    launchSeededDrill({
      durationSeconds,
      mod: selectedModule,
      diff: difficulty,
      seed: freshSeed,
      modeType: 'practice',
      opponent: null,
      challengeContext: null,
    });
  };

  // Accept Incoming Head-to-Head Challenge (exact same seed, module, difficulty & duration!)
  const handleAcceptChallenge = (challenge: CalcLabChallengePayload) => {
    setSelectedModule(challenge.module);
    setDifficulty(challenge.difficulty);
    if (challenge.durationSec % 60 === 0 && [1, 2, 3, 5, 10, 15].includes(challenge.durationSec / 60)) {
      setSelectedMinutes(challenge.durationSec / 60);
      setCustomMinutesInput('');
    }
    launchSeededDrill({
      durationSeconds: challenge.durationSec,
      mod: challenge.module,
      diff: challenge.difficulty,
      seed: challenge.seed,
      modeType: 'practice',
      opponent: null,
      challengeContext: challenge,
    });
  };

  // Start 1v1 Combat Mode (Ranked Speed Duel)
  const startCombatMatchmaking = () => {
    setIsSearchingOpponent(true);

    let chosenOpponent =
      COMBAT_OPPONENTS.find((o) => Math.abs(o.elo - playerElo) <= 180) || COMBAT_OPPONENTS[1];
    let duelSeed = createFreshSessionSeed(0x9e3779b9);

    if (friendRoomCode.trim()) {
      const cleanCode = friendRoomCode.trim().toUpperCase();
      duelSeed = hashCodeToSeed(cleanCode);
      chosenOpponent = {
        name: `Room #${cleanCode} Challenger`,
        elo: playerElo,
        examBadge: 'Synced Seeded Duel',
        avgSolveMs: 3100,
        accuracyRate: 0.9,
      };
    }

    window.setTimeout(() => {
      setIsSearchingOpponent(false);
      launchSeededDrill({
        durationSeconds: combatDurationSec,
        mod: 'mixed',
        diff: combatDifficulty,
        seed: duelSeed,
        modeType: 'combat',
        opponent: chosenOpponent,
        challengeContext: null,
      });
    }, 900);
  };

  const recordCorrectAnswer = (problem: QuestionProblem) => {
    const elapsed = Math.max(80, Math.round(readMonotonicMs() - questionStartTimeRef.current));
    setFeedback('correct');
    const newScore = scoreRef.current + 1;
    const newTotal = totalAttemptedRef.current + 1;
    const newStreak = currentStreak + 1;

    scoreRef.current = newScore;
    totalAttemptedRef.current = newTotal;

    setScore(newScore);
    setTotalAttempted(newTotal);
    setCurrentStreak(newStreak);
    setBestStreakInSession((prev) => Math.max(prev, newStreak));
    setAttemptHistory((prev) => [
      ...prev,
      {
        prompt: problem.prompt,
        correctAnswer: problem.answer,
        userAnswer: problem.answer,
        isCorrect: true,
        timeMs: elapsed,
      },
    ]);

    window.setTimeout(() => {
      setFeedback('none');
      setUserInput('');
      questionStartTimeRef.current = readMonotonicMs();
      setCurrentProblem(
        generateSeededProblem(playedModule, playedDifficulty, rngSeedRef, sessionQueueRef)
      );
    }, 150);
  };

  const handleSkipQuestion = () => {
    if (!currentProblem || !isGameActive) return;
    const elapsed = Math.max(80, Math.round(readMonotonicMs() - questionStartTimeRef.current));
    totalAttemptedRef.current += 1;
    setCurrentStreak(0);
    setTotalAttempted(totalAttemptedRef.current);
    setAttemptHistory((prev) => [
      ...prev,
      {
        prompt: currentProblem.prompt,
        correctAnswer: currentProblem.answer,
        userAnswer: 'Skipped',
        isCorrect: false,
        timeMs: elapsed,
      },
    ]);
    setUserInput('');
    questionStartTimeRef.current = readMonotonicMs();
    setCurrentProblem(
      generateSeededProblem(playedModule, playedDifficulty, rngSeedRef, sessionQueueRef)
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUserInput(val);

    if (!currentProblem) return;

    if (parseInt(val, 10) === currentProblem.answer) {
      recordCorrectAnswer(currentProblem);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProblem || !userInput) return;

    if (parseInt(userInput, 10) !== currentProblem.answer) {
      const elapsed = Math.max(80, Math.round(performance.now() - questionStartTimeRef.current));
      totalAttemptedRef.current += 1;
      setFeedback('wrong');
      setCurrentStreak(0);
      setTotalAttempted(totalAttemptedRef.current);
      setAttemptHistory((prev) => [
        ...prev,
        {
          prompt: currentProblem.prompt,
          correctAnswer: currentProblem.answer,
          userAnswer: userInput,
          isCorrect: false,
          timeMs: elapsed,
        },
      ]);

      window.setTimeout(() => {
        setFeedback('none');
        setUserInput('');
      }, 320);
    }
  };

  const handleNumpadClick = (numStr: string) => {
    if (!isGameActive) return;
    if (numStr === 'CLEAR') {
      setUserInput('');
      return;
    }
    if (numStr === 'SKIP') {
      handleSkipQuestion();
      return;
    }
    const newVal = userInput + numStr;
    setUserInput(newVal);

    if (currentProblem && parseInt(newVal, 10) === currentProblem.answer) {
      recordCorrectAnswer(currentProblem);
    }
  };

  const accuracyNum =
    totalAttempted > 0 ? Math.round((score / totalAttempted) * 100) : 100;
  const accuracy = String(accuracyNum);
  const elapsedSeconds = Math.max(1, totalDurationSec - timeLeft);
  const questionsPerMinute = ((score / elapsedSeconds) * 60).toFixed(1);
  const formatClock = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const leagueBadge = getEloLeagueBadge(playerElo);

  const duelOutcome = useMemo(() => {
    if (!isGameFinished || !acceptedChallenge) return null;
    return evaluateCalcLabDuel(acceptedChallenge, score, accuracyNum);
  }, [acceptedChallenge, accuracyNum, isGameFinished, score]);

  const outgoingChallengePayload = useMemo<CalcLabChallengePayload>(
    () => ({
      arena: 'calc_lab',
      challenger: challengerDisplayName,
      score,
      durationSec: totalDurationSec,
      module: playedModule,
      difficulty: playedDifficulty,
      accuracy: accuracyNum,
      seed: sessionSeed,
    }),
    [accuracyNum, challengerDisplayName, playedDifficulty, playedModule, score, sessionSeed, totalDurationSec]
  );

  const MODULE_CARDS: {
    id: ModuleType;
    icon: string;
    title: string;
    desc: string;
    badge: string;
  }[] = [
    {
      id: 'mixed',
      icon: '⚡',
      title: 'All-In-One Speed Mix',
      desc: '+, −, ×, ÷, Squares & Fraction % rapid-fire',
      badge: 'MOST POPULAR',
    },
    {
      id: 'simplification',
      icon: '🎯',
      title: 'Banking BODMAS & Simplification',
      desc: '(A × B) + C, N² − X & Prelims speed expressions',
      badge: 'SBI / IBPS PRELIMS',
    },
    {
      id: 'tables',
      icon: '✖️',
      title: 'High-Speed Tables (12 to 36)',
      desc: 'Instant mental multiplication up to 36 × 14',
      badge: 'CORE SPEED',
    },
    {
      id: 'squares',
      icon: '🔲',
      title: 'Power Squares (11² to 65²)',
      desc: 'Essential for Quadratic & Number Series',
      badge: 'QUANT BOOSTER',
    },
    {
      id: 'cubes',
      icon: '🧊',
      title: 'Power Cubes (5³ to 28³)',
      desc: 'Essential for DI, CI/SI & Missing Series',
      badge: 'HIGH YIELD',
    },
    {
      id: 'percentages',
      icon: '📊',
      title: 'Fraction-to-Percentage Drill',
      desc: '14.28%, 16.66%, 37.5%, 83.33% instant values',
      badge: 'DI MASTER',
    },
    {
      id: 'add_sub',
      icon: '➕',
      title: 'Rapid Addition & Subtraction',
      desc: '2-digit & 3-digit mental sum & difference',
      badge: 'WARMUP',
    },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans p-4 sm:p-6 select-none flex flex-col justify-between relative overflow-x-hidden">
      {/* Ambient Background Glow */}
      <div className="pointer-events-none fixed -top-36 left-1/2 -translate-x-1/2 w-[750px] h-[320px] bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-blue-600/10 blur-[130px] rounded-full z-0" />

      <div className="max-w-4xl mx-auto w-full space-y-6 relative z-10">
        {/* TOP HEADER */}
        <header className="flex flex-wrap justify-between items-center gap-3 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shadow-amber-500/20">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  Speed Calculation &amp; 1v1 Blitz Arena
                </h1>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border bg-amber-400/15 text-amber-300 border-amber-400/30">
                  H2H Challenges
                </span>
              </div>
              <p className="text-xs text-slate-400">
                60s Mental Math Blitz, Live 1v1 Duels &amp; Shareable Telegram / WhatsApp Challenge Links
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 ${leagueBadge.color}`}
            >
              <span>{leagueBadge.icon}</span>
              <span>{playerElo} ELO</span>
              <span className="hidden sm:inline text-[10px] opacity-80">
                ({leagueBadge.label})
              </span>
            </div>

            <Link
              href="/"
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold px-3.5 py-2 rounded-xl border border-white/[0.08] transition"
            >
              ← Exit Arena
            </Link>
          </div>
        </header>

        {/* INCOMING HEAD-TO-HEAD CHALLENGE BANNER FROM TELEGRAM / WHATSAPP */}
        {!isGameActive && !isGameFinished && pendingChallenge && (
          <HeadToHeadIncomingBanner
            challenge={pendingChallenge}
            acceptButtonLabel={`⚔️ Accept ${formatCalcDurationLabel(pendingChallenge.durationSec)} Challenge →`}
            onAccept={() => handleAcceptChallenge(pendingChallenge)}
            onDismiss={() => setDismissedToken(challengeTokenParam)}
          />
        )}

        {/* TOP 3-MODE SWITCHER (HIDDEN DURING ACTIVE GAME) */}
        {!isGameActive && (
          <div className="grid grid-cols-3 bg-slate-900/90 p-1.5 rounded-2xl border border-white/[0.08] text-xs font-black gap-1.5 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setIsGameFinished(false);
                setActiveTab('practice');
              }}
              className={`py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'practice'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⏱️</span>
              <span>60s Blitz &amp; Solo Drill</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsGameFinished(false);
                setActiveTab('combat');
              }}
              className={`py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'combat'
                  ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⚔️</span>
              <span>1v1 Combat Mode</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsGameFinished(false);
                setActiveTab('leaderboard');
                void fetchLeaderboard();
              }}
              className={`py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🏆</span>
              <span>Leaderboard</span>
            </button>
          </div>
        )}

        {/* =================================================================== */}
        {/* ACTIVE GAME ARENA (SHARED BY SOLO BLITZ, H2H CHALLENGE & 1V1 COMBAT) */}
        {/* =================================================================== */}
        {isGameActive ? (
          <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
            {/* Top Live Telemetry Strip */}
            <div className="grid grid-cols-4 gap-3 bg-slate-900/90 p-4 rounded-2xl border border-white/[0.08] shadow-xl">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  Time Remaining
                </span>
                <span
                  className={`font-black text-xl sm:text-2xl font-mono ${
                    timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-amber-400'
                  }`}
                >
                  {formatClock(timeLeft)}
                </span>
              </div>

              <div className="text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  Your Score
                </span>
                <span className="font-black text-emerald-400 text-xl sm:text-2xl font-mono">
                  {score}
                </span>
              </div>

              <div className="text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  Speed / Streak
                </span>
                <span className="font-black text-orange-400 text-sm sm:text-base block mt-0.5">
                  🔥 {currentStreak}x • {questionsPerMinute}/m
                </span>
              </div>

              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  Accuracy
                </span>
                <span className="font-black text-blue-400 text-xl sm:text-2xl font-mono">
                  {accuracy}%
                </span>
              </div>
            </div>

            {/* HEAD-TO-HEAD TARGET SCORE BAR WHEN PLAYING AN ACCEPTED CHALLENGE */}
            {acceptedChallenge && (
              <HeadToHeadLiveTargetBar
                challengerName={acceptedChallenge.challenger}
                currentValue={score}
                targetValue={acceptedChallenge.score}
                unitLabel="pts"
                extraTargetNote={formatCalcDurationLabel(acceptedChallenge.durationSec)}
              />
            )}

            {/* 1V1 COMBAT LIVE TUG-OF-WAR BAR */}
            {gameModeType === 'combat' && activeOpponent && (
              <div className="bg-slate-900/95 border border-rose-500/35 rounded-2xl p-4 space-y-3 shadow-xl">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black text-[10px]">
                      YOU ({playerElo})
                    </span>
                    <span className="text-lg font-black text-white">{score} pts</span>
                  </div>

                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/30">
                    ⚔️ Live 1v1 Duel
                  </span>

                  <div className="flex items-center gap-2 text-right">
                    <span className="text-lg font-black text-rose-400">
                      {opponentScore} pts
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-black text-[10px]">
                      {activeOpponent.name} ({activeOpponent.elo})
                    </span>
                  </div>
                </div>

                {(() => {
                  const totalPts = score + opponentScore;
                  const myRatio =
                    totalPts === 0 ? 50 : Math.round((score / totalPts) * 100);
                  return (
                    <div className="w-full h-3 bg-rose-500/30 rounded-full overflow-hidden flex border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-300"
                        style={{ width: `${myRatio}%` }}
                      />
                    </div>
                  );
                })()}
              </div>
            )}

            {/* QUESTION DISPLAY CARD */}
            <div
              className={`bg-slate-900/95 border-2 rounded-3xl p-7 sm:p-9 text-center transition-all shadow-2xl relative ${
                feedback === 'correct'
                  ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
                  : feedback === 'wrong'
                  ? 'border-rose-500 bg-rose-500/10'
                  : 'border-white/[0.1]'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                  {currentProblem?.tag || 'Speed Math'}
                </span>
                <button
                  type="button"
                  onClick={handleSkipQuestion}
                  className="text-[11px] font-bold text-slate-400 hover:text-amber-300 transition cursor-pointer"
                >
                  Skip Question →
                </button>
              </div>

              <p className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-wide my-6 font-mono">
                {currentProblem?.prompt}
              </p>

              <form onSubmit={handleFormSubmit} className="flex justify-center items-center gap-3">
                <input
                  ref={inputRef}
                  type="number"
                  value={userInput}
                  onChange={handleInputChange}
                  placeholder="?"
                  className="w-44 text-center text-3xl sm:text-4xl font-black bg-slate-950 border-2 border-slate-700 rounded-2xl p-3.5 text-amber-400 focus:outline-none focus:border-amber-400 font-mono shadow-inner"
                  autoFocus
                />
              </form>
              <p className="text-[11px] text-slate-500 mt-3">
                Auto-submits the instant you type the right answer!
              </p>
            </div>

            {/* TOUCH NUMPAD + END SESSION BUTTON */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0', 'SKIP'].map(
                (btn) => (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => handleNumpadClick(btn)}
                    className={`p-3.5 font-black rounded-2xl text-lg transition active:scale-95 cursor-pointer ${
                      btn === 'CLEAR'
                        ? 'bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs font-sans'
                        : btn === 'SKIP'
                        ? 'bg-slate-800 border border-slate-700 text-amber-300 text-xs font-sans'
                        : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-100'
                    }`}
                  >
                    {btn}
                  </button>
                )
              )}
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => void finishSession()}
                className="text-xs font-bold text-slate-400 hover:text-rose-400 transition cursor-pointer"
              >
                ⏹ End Session Early &amp; View Report
              </button>
            </div>
          </div>
        ) : isGameFinished ? (
          /* ================================================================= */
          /* POST-SESSION PERFORMANCE, DUEL VERDICT & SHARE CHALLENGE SCREEN   */
          /* ================================================================= */
          <div className="max-w-2xl mx-auto bg-slate-900/95 border border-white/[0.1] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl animate-fade-in">
            {/* HEAD-TO-HEAD DUEL VERDICT (IF PLAYING AN ACCEPTED CHALLENGE LINK) */}
            {duelOutcome && acceptedChallenge && (
              <HeadToHeadVerdictBanner
                outcome={duelOutcome}
                onRematchSameSeed={() => handleAcceptChallenge(acceptedChallenge)}
              />
            )}

            {gameModeType === 'combat' && activeOpponent ? (
              <div className="text-center space-y-3 border-b border-slate-800 pb-6">
                <span className="text-5xl block">
                  {score > opponentScore ? '🏆' : score < opponentScore ? '⚔️' : '🤝'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  {score > opponentScore
                    ? 'Victory! You Won the 1v1 Speed Duel!'
                    : score < opponentScore
                    ? `Defeat vs ${activeOpponent.name}`
                    : 'Draw Match! Neck-and-Neck Speed!'}
                </h2>
                <div className="inline-flex items-center gap-3 bg-slate-950 border border-slate-800 px-5 py-2.5 rounded-2xl text-xs font-black">
                  <span className="text-emerald-400 text-base">You: {score}</span>
                  <span className="text-slate-500">vs</span>
                  <span className="text-rose-400 text-base">
                    {activeOpponent.name}: {opponentScore}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg ${
                      eloDelta >= 0
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {eloDelta >= 0 ? `+${eloDelta}` : eloDelta} ELO (Now {playerElo})
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-2 border-b border-slate-800 pb-5">
                <span className="text-4xl block">🎉</span>
                <h2 className="text-2xl font-black text-white">
                  {formatCalcDurationLabel(totalDurationSec)} Complete!
                </h2>
                <p className="text-xs text-slate-400">
                  Solved <strong className="text-emerald-400">{score}</strong> problems in{' '}
                  {formatCalcDurationLabel(totalDurationSec)} • Challenge friends below!
                </p>
              </div>
            )}

            {/* 4-Metric Telemetry Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Correct Solved
                </span>
                <span className="text-2xl font-black text-emerald-400 mt-1 block">
                  {score}
                </span>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Speed (QPM)
                </span>
                <span className="text-2xl font-black text-amber-400 mt-1 block">
                  {questionsPerMinute}/m
                </span>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Best Streak
                </span>
                <span className="text-2xl font-black text-orange-400 mt-1 block">
                  🔥 {bestStreakInSession}x
                </span>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Accuracy
                </span>
                <span className="text-2xl font-black text-blue-400 mt-1 block">
                  {accuracy}%
                </span>
              </div>
            </div>

            {/* SHAREABLE HEAD-TO-HEAD CHALLENGE CARD FOR TELEGRAM & WHATSAPP */}
            <HeadToHeadSharePanel
              payload={outgoingChallengePayload}
              conqueredChallenge={duelOutcome}
              onChallengerNameChange={(nextName) => {
                saveChallengerName(nextName);
                setChallengerDisplayName(nextName);
              }}
            />

            {/* Question-by-Question Speed Log */}
            {attemptHistory.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  📋 Session Question Log &amp; Response Time ({attemptHistory.length})
                </h3>
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {attemptHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between px-3.5 py-2 rounded-xl text-xs border ${
                        item.isCorrect
                          ? 'bg-slate-950/80 border-slate-800 text-slate-200'
                          : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 font-mono">
                        <span className="text-[10px] text-slate-500">#{idx + 1}</span>
                        <span className="font-bold">{item.prompt}</span>
                        <span className="text-emerald-400 font-black">
                          = {item.correctAnswer}
                        </span>
                        {!item.isCorrect && (
                          <span className="text-rose-400 text-[11px]">
                            (You: {item.userAnswer})
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-mono font-bold ${
                          item.timeMs <= 2500
                            ? 'text-emerald-400'
                            : item.timeMs <= 5000
                            ? 'text-amber-300'
                            : 'text-rose-400'
                        }`}
                      >
                        {(item.timeMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  gameModeType === 'combat'
                    ? startCombatMatchmaking()
                    : startPracticeSession()
                }
                className="flex-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black py-3.5 rounded-2xl transition text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                {gameModeType === 'combat' ? '⚔️ Play Rematch / Next Duel' : '🔄 Play New Blitz'}
              </button>
              <button
                type="button"
                onClick={() => setIsGameFinished(false)}
                className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl transition text-xs cursor-pointer"
              >
                ⚙️ Change Time / Module
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsGameFinished(false);
                  setActiveTab('leaderboard');
                  void fetchLeaderboard();
                }}
                className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-2xl transition text-xs cursor-pointer"
              >
                🏆 Leaderboard
              </button>
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* SETUP SCREENS FOR TAB 1 (PRACTICE), TAB 2 (COMBAT), TAB 3 (BOARD) */
          /* ================================================================= */
          <>
            {/* TAB 1: SOLO PRACTICE SETUP WITH USER-SELECTABLE MINUTES */}
            {activeTab === 'practice' && (
              <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-7">
                {/* STEP 1: SELECT HOW MANY MINUTES YOU WANT TO PRACTICE */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                      <span>⏱️ Step 1: Select Duration (60s Blitz or Custom Sprint)</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-semibold">
                      Selected:{' '}
                      <strong className="text-white">
                        {customMinutesInput
                          ? `${customMinutesInput} Min(s)`
                          : selectedMinutes === 1
                          ? '60s Blitz (1 Minute)'
                          : `${selectedMinutes} Minutes`}
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                    {[1, 2, 3, 5, 10, 15].map((mins) => {
                      const isActive = !customMinutesInput && selectedMinutes === mins;
                      return (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            setSelectedMinutes(mins);
                            setCustomMinutesInput('');
                          }}
                          className={`py-3 px-3 rounded-2xl font-black text-xs border transition flex flex-col items-center justify-center cursor-pointer ${
                            isActive
                              ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/20'
                              : 'bg-slate-950/90 border-slate-800 text-slate-300 hover:border-amber-400/40 hover:text-white'
                          }`}
                        >
                          <span className="text-base">{mins === 1 ? '60s' : `${mins} Min`}</span>
                          <span className="text-[9px] opacity-75 font-bold uppercase mt-0.5">
                            {mins === 1
                              ? 'Blitz'
                              : mins <= 3
                              ? 'Sprint'
                              : mins <= 5
                              ? 'Standard'
                              : 'Endurance'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Minutes Input */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <span className="text-xs font-bold text-slate-400">
                      Or enter custom duration (1–60 mins):
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={customMinutesInput}
                      onChange={(e) => setCustomMinutesInput(e.target.value)}
                      placeholder="Custom mins (e.g. 7)"
                      className="w-44 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 font-bold"
                    />
                  </div>
                </div>

                {/* STEP 2: SELECT DIFFICULTY LEVEL */}
                <div className="space-y-3 border-t border-white/[0.06] pt-6">
                  <label className="text-xs font-black uppercase tracking-widest text-amber-400 block">
                    🎚️ Step 2: Choose Calculation Difficulty
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(
                      [
                        {
                          id: 'easy',
                          label: '🟢 Clerk Prelims',
                          sub: 'Fast 2-digit numbers & tables up to 20',
                        },
                        {
                          id: 'medium',
                          label: '🟡 PO Prelims',
                          sub: 'Standard exam speed & squares up to 50²',
                        },
                        {
                          id: 'hard',
                          label: '🔴 Mains / Speed Pro',
                          sub: 'Heavy 3-digit numbers & tables up to 36',
                        },
                      ] as { id: DifficultyLevel; label: string; sub: string }[]
                    ).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDifficulty(d.id)}
                        className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                          difficulty === d.id
                            ? 'bg-blue-600/20 border-blue-400 text-white shadow-lg'
                            : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-black">{d.label}</div>
                        <div className="text-[10px] text-slate-400 mt-1">{d.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* STEP 3: SELECT PRACTICE MODULE */}
                <div className="space-y-3 border-t border-white/[0.06] pt-6">
                  <label className="text-xs font-black uppercase tracking-widest text-amber-400 block">
                    🧮 Step 3: Select Calculation Module
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {MODULE_CARDS.map((mod) => (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => setSelectedModule(mod.id)}
                        className={`p-4 rounded-2xl border text-left transition flex items-start justify-between gap-3 cursor-pointer ${
                          selectedModule === mod.id
                            ? 'bg-amber-400/15 border-amber-400 text-white shadow-lg shadow-amber-500/10'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{mod.icon}</span>
                            <span className="text-xs sm:text-sm font-black text-white">
                              {mod.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">{mod.desc}</p>
                        </div>
                        <span className="shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-400/30">
                          {mod.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startPracticeSession}
                  className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black py-4 rounded-2xl transition text-sm sm:text-base uppercase tracking-wider shadow-xl shadow-amber-500/25 cursor-pointer"
                >
                  🚀 Start{' '}
                  {customMinutesInput
                    ? `${customMinutesInput}-Minute Speed Drill`
                    : selectedMinutes === 1
                    ? '60s Blitz (Generate Challenge Link After)'
                    : `${selectedMinutes}-Minute Speed Drill`}{' '}
                  →
                </button>
              </div>
            )}

            {/* TAB 2: 1V1 COMBAT MODE (RANKED DUEL ARENA) */}
            {activeTab === 'combat' && (
              <div className="bg-gradient-to-b from-slate-900/95 to-slate-950 border border-rose-500/35 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                      ⚔️ 1v1 Ranked Speed Combat
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                      Head-to-Head Mental Math Duel
                    </h2>
                    <p className="text-xs text-slate-400">
                      Race an ELO-matched rival, enter a Room Code, or finish a match to share a 1-click Telegram / WhatsApp Challenge Link!
                    </p>
                  </div>

                  {/* Combat Record Card */}
                  <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 px-4 py-3 rounded-2xl">
                    <div className="text-center pr-3 border-r border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Rating
                      </span>
                      <span className="text-base font-black text-amber-300">
                        {playerElo} ELO
                      </span>
                    </div>
                    <div className="text-center pr-3 border-r border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Wins
                      </span>
                      <span className="text-base font-black text-emerald-400">
                        {combatWins}W
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Losses
                      </span>
                      <span className="text-base font-black text-rose-400">
                        {combatLosses}L
                      </span>
                    </div>
                  </div>
                </div>

                {/* Combat Duration, Difficulty & Room Code */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 block">
                      ⏱️ Combat Duration
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { sec: 60, label: '60s Blitz' },
                        { sec: 120, label: '2m Duel' },
                        { sec: 180, label: '3m Clash' },
                      ].map((item) => (
                        <button
                          key={item.sec}
                          type="button"
                          onClick={() => setCombatDurationSec(item.sec)}
                          className={`py-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                            combatDurationSec === item.sec
                              ? 'bg-rose-500 text-white border-rose-400 shadow'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 block">
                      🎚️ Combat Difficulty
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'easy', label: 'Clerk' },
                          { id: 'medium', label: 'PO' },
                          { id: 'hard', label: 'Mains' },
                        ] as { id: DifficultyLevel; label: string }[]
                      ).map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => setCombatDifficulty(lvl.id)}
                          className={`py-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                            combatDifficulty === lvl.id
                              ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 block">
                      🔗 Friend Room Code
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={friendRoomCode}
                        onChange={(e) => setFriendRoomCode(e.target.value.toUpperCase())}
                        placeholder="e.g. BANK88"
                        className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase placeholder-slate-500 outline-none focus:border-rose-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const num = 100 + Math.floor((performance.now() * 17) % 900);
                          setFriendRoomCode(`BS${num}`);
                        }}
                        className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px] rounded-xl whitespace-nowrap cursor-pointer"
                      >
                        Code
                      </button>
                    </div>
                  </div>
                </div>

                {isSearchingOpponent ? (
                  <div className="bg-slate-950 border border-rose-500/40 rounded-2xl p-8 text-center space-y-3">
                    <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <div className="text-sm font-black text-white">
                      Finding Opponent near {playerElo} ELO...
                    </div>
                    <p className="text-xs text-slate-400">
                      Preparing synchronized mental math deck...
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startCombatMatchmaking}
                    className="w-full py-4 bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white font-black text-sm sm:text-base rounded-2xl uppercase tracking-wider shadow-xl shadow-rose-500/25 transition cursor-pointer"
                  >
                    ⚔️ Find 1v1 Opponent &amp; Start {formatCalcDurationLabel(combatDurationSec)} →
                  </button>
                )}
              </div>
            )}

            {/* TAB 3: TOP SCORERS LEADERBOARD */}
            {activeTab === 'leaderboard' && (
              <div className="bg-slate-900/90 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span>🏆 Top Speed Calculators &amp; Combat Champions</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => void fetchLeaderboard()}
                    className="text-xs text-amber-400 hover:underline font-bold cursor-pointer"
                  >
                    🔄 Refresh
                  </button>
                </div>

                {loadingLeaderboard ? (
                  <div className="text-center py-12 text-slate-400 text-xs font-bold">
                    Loading Leaderboard...
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No scores recorded yet. Be the first to complete a drill!
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800 sticky top-0">
                          <tr>
                            <th className="p-3 text-center">Rank</th>
                            <th className="p-3">Aspirant</th>
                            <th className="p-3 text-center">Module</th>
                            <th className="p-3 text-center">Score</th>
                            <th className="p-3 text-right">Accuracy</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                          {leaderboard.map((entry, idx) => {
                            const isCurrentUser = currentUser?.id === entry.user_id;
                            let rankBadge = `#${idx + 1}`;
                            if (idx === 0) rankBadge = '🥇 1st';
                            if (idx === 1) rankBadge = '🥈 2nd';
                            if (idx === 2) rankBadge = '🥉 3rd';

                            return (
                              <tr
                                key={entry.id}
                                className={`hover:bg-slate-800/40 transition ${
                                  isCurrentUser
                                    ? 'bg-amber-500/10 border-l-4 border-amber-400'
                                    : ''
                                }`}
                              >
                                <td className="p-3 text-center font-bold text-amber-400">
                                  {rankBadge}
                                </td>
                                <td className="p-3 font-bold text-white flex items-center gap-2">
                                  <span>{entry.student_name}</span>
                                  {isCurrentUser && (
                                    <span className="text-[9px] bg-amber-400/20 text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded font-extrabold">
                                      YOU
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center text-slate-400 text-[10px] uppercase font-mono">
                                  {entry.module_type}
                                </td>
                                <td className="p-3 text-center font-black text-emerald-400 text-sm">
                                  {entry.score}
                                </td>
                                <td className="p-3 text-right font-bold text-blue-400">
                                  {entry.accuracy}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {currentUserRank && (
                      <div className="pt-3 border-t border-slate-800">
                        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider text-center">
                          Your Standings
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-xl bg-amber-500/10 border border-amber-400/40 text-amber-300 text-xs font-bold shadow-inner">
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-black shadow">
                              #{currentUserRank.rank}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-white">
                                {currentUserRank.student_name}
                              </span>
                              <span className="text-[9px] bg-amber-400/20 text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded font-extrabold">
                                YOU
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 font-mono">
                            <span className="text-[10px] uppercase text-slate-400 font-sans">
                              {currentUserRank.module_type}
                            </span>
                            <span className="text-emerald-400 font-black text-sm">
                              {currentUserRank.score} pts
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CalcLabPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#020617] text-slate-300 flex items-center justify-center text-sm font-bold">
          Loading Speed Calculation Arena…
        </div>
      }
    >
      <CalcLabContent />
    </Suspense>
  );
}
