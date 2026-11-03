'use client';

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import {
  HeadToHeadIncomingBanner,
  HeadToHeadLiveTargetBar,
  HeadToHeadSharePanel,
  HeadToHeadVerdictBanner,
} from '@/components/HeadToHeadChallengeCard';
import {
  decodeChallengeToken,
  evaluateWordMatrixDuel,
  getSavedChallengerName,
  saveChallengerName,
  type WordMatrixChallengePayload,
} from '@/lib/headToHeadChallenge';
import { supabase } from '@/lib/supabase';
import {
  BANKING_JARGON_PAIRS,
  DEFAULT_WORD_MATRIX_STATS,
  WORD_MATRIX_CUSTOM_PAIRS_KEY,
  WORD_MATRIX_LEADERBOARD_KEY,
  WORD_MATRIX_PLAYER_NAME_KEY,
  WORD_MATRIX_STATS_KEY,
  buildMatrixRound,
  getOrCreateGuestPlayerId,
  getPoolForMode,
  getUserWordMatrixRank,
  parseCustomWordPairs,
  parseWordMatrixLeaderboard,
  saveWordMatrixStats,
  shuffleArray,
  syncCustomWordPairsFromSupabase,
  syncWordMatrixLeaderboardFromSupabase,
  upsertWordMatrixLeaderboardEntry,
  type MatchRelationType,
  type MatrixTile,
  type WordMatrixMode,
  type WordMatrixStats,
  type WordPair,
} from '@/lib/wordMatrix';
import { toggleBookmarkQuestion } from '@/lib/notebook';

const ROUND_DURATION_MS = 45_000;
const MAX_LIVES = 3;
const NOTEBOOK_STORAGE_KEY = 'bs_revision_notebook_v1';

type GameStatus = 'ready' | 'playing' | 'won' | 'lost_time' | 'lost_lives';

interface ModeOption {
  id: WordMatrixMode;
  label: string;
  shortLabel: string;
  icon: string;
  badge: string;
  description: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    id: 'banking_jargon',
    label: 'Financial & Banking Jargon',
    shortLabel: 'Banking Jargon',
    icon: '🏦',
    badge: 'RBI / GA Hot',
    description:
      'Match RBI & Banking Awareness terms (Repo Rate, Haircut, NPA, CAMELS Rating, PCA, Nostro/Vostro) with concise definitions.',
  },
  {
    id: 'editorial_definitions',
    label: 'Editorial Vocabulary',
    shortLabel: 'Editorial Vocab',
    icon: '📰',
    badge: 'RC & Cloze',
    description:
      'High-frequency words from The Hindu & Economic Times editorials tested in SBI PO & IBPS PO Reading Comprehension.',
  },
  {
    id: 'synonyms',
    label: 'Power Synonyms',
    shortLabel: 'Synonyms',
    icon: '🔗',
    badge: 'Same Meaning',
    description:
      'Pair advanced editorial words with exact synonym twins for rapid Prelims & Mains elimination.',
  },
  {
    id: 'antonyms',
    label: 'Contrast Antonyms',
    shortLabel: 'Antonyms',
    icon: '⚖️',
    badge: 'Opposites',
    description:
      'Connect high-yield exam words with their sharp opposite meanings without falling for trap options.',
  },
  {
    id: 'mixed',
    label: 'Grandmaster Mix',
    shortLabel: 'All-in-One Mix',
    icon: '🔥',
    badge: '92 Terms',
    description:
      'Unpredictable 4×4 mix combining Banking Jargon, Editorial Definitions, Synonyms, and Antonyms.',
  },
];

function subscribeExternalStorage(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('bs_word_matrix_sync', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('bs_word_matrix_sync', callback);
  };
}

function getRawStatsSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(WORD_MATRIX_STATS_KEY);
  } catch {
    return null;
  }
}

function getRawNotebookSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(NOTEBOOK_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getRawCustomPairsSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(WORD_MATRIX_CUSTOM_PAIRS_KEY);
  } catch {
    return null;
  }
}

function getRawLeaderboardSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(WORD_MATRIX_LEADERBOARD_KEY);
  } catch {
    return null;
  }
}

function getNullServerSnapshot(): string | null {
  return null;
}

function parseStatsFromRaw(raw: string | null): WordMatrixStats {
  if (!raw) return DEFAULT_WORD_MATRIX_STATS;
  try {
    const parsed = JSON.parse(raw) as Partial<WordMatrixStats>;
    return {
      gamesPlayed: typeof parsed.gamesPlayed === 'number' ? parsed.gamesPlayed : 0,
      boardsCleared: typeof parsed.boardsCleared === 'number' ? parsed.boardsCleared : 0,
      bestClearTimeMs: typeof parsed.bestClearTimeMs === 'number' ? parsed.bestClearTimeMs : null,
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      currentWinStreak: typeof parsed.currentWinStreak === 'number' ? parsed.currentWinStreak : 0,
      bestWinStreak: typeof parsed.bestWinStreak === 'number' ? parsed.bestWinStreak : 0,
      masteredPairIds: Array.isArray(parsed.masteredPairIds) ? parsed.masteredPairIds : [],
      missedPairIds: Array.isArray(parsed.missedPairIds) ? parsed.missedPairIds : [],
    };
  } catch {
    return DEFAULT_WORD_MATRIX_STATS;
  }
}

function parseBookmarkedIdsFromRaw(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as Array<{ id?: string; isBookmarked?: boolean }>;
    if (!Array.isArray(parsed)) return new Set();
    const ids = new Set<string>();
    parsed.forEach((item) => {
      if (item && typeof item.id === 'string' && item.isBookmarked) {
        ids.add(item.id);
      }
    });
    return ids;
  } catch {
    return new Set();
  }
}

function relationLabel(relation: MatchRelationType, kind: 'term' | 'match'): string {
  if (kind === 'term') {
    return relation === 'JARGON' ? 'BANKING TERM' : 'WORD';
  }
  switch (relation) {
    case 'JARGON':
      return 'DEFINITION';
    case 'DEFINITION':
      return 'MEANING';
    case 'SYNONYM':
      return 'SYNONYM';
    case 'ANTONYM':
      return 'ANTONYM';
  }
}

function WordMatrixContent() {
  const searchParams = useSearchParams();
  const challengeTokenParam = searchParams.get('c');

  const incomingChallenge = useMemo<WordMatrixChallengePayload | null>(() => {
    const decoded = decodeChallengeToken(challengeTokenParam, 'word_matrix');
    return decoded && decoded.arena === 'word_matrix' ? decoded : null;
  }, [challengeTokenParam]);

  const [dismissedChallengeToken, setDismissedChallengeToken] = useState<string | null>(null);
  const [acceptedChallenge, setAcceptedChallenge] = useState<WordMatrixChallengePayload | null>(
    null
  );

  const pendingChallenge =
    incomingChallenge &&
    challengeTokenParam !== dismissedChallengeToken &&
    !acceptedChallenge
      ? incomingChallenge
      : null;

  const rawStats = useSyncExternalStore(
    subscribeExternalStorage,
    getRawStatsSnapshot,
    getNullServerSnapshot
  );
  const rawNotebook = useSyncExternalStore(
    subscribeExternalStorage,
    getRawNotebookSnapshot,
    getNullServerSnapshot
  );
  const rawCustomPairs = useSyncExternalStore(
    subscribeExternalStorage,
    getRawCustomPairsSnapshot,
    getNullServerSnapshot
  );
  const rawLeaderboard = useSyncExternalStore(
    subscribeExternalStorage,
    getRawLeaderboardSnapshot,
    getNullServerSnapshot
  );

  const stats = useMemo(() => parseStatsFromRaw(rawStats), [rawStats]);
  const bookmarkedIds = useMemo(() => parseBookmarkedIdsFromRaw(rawNotebook), [rawNotebook]);
  const customPairs = useMemo(
    () => parseCustomWordPairs(rawCustomPairs),
    [rawCustomPairs]
  );
  const leaderboard = useMemo(
    () => parseWordMatrixLeaderboard(rawLeaderboard),
    [rawLeaderboard]
  );

  const [activeTab, setActiveTab] = useState<'play' | 'leaderboard' | 'bank'>('play');
  const [mode, setMode] = useState<WordMatrixMode>('banking_jargon');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Player Identity for Global Leaderboard & Profile Rank
  const [playerUserId, setPlayerUserId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('Banking Aspirant');
  const [playerTargetExam, setPlayerTargetExam] = useState<string>('SBI PO & IBPS PO 2026');
  const [isSignedInUser, setIsSignedInUser] = useState<boolean>(false);
  const [editingGuestName, setEditingGuestName] = useState<boolean>(false);
  const [guestNameDraft, setGuestNameDraft] = useState<string>('');

  // Active Game State
  const [gameStatus, setGameStatus] = useState<GameStatus>('ready');
  const [roundPairs, setRoundPairs] = useState<WordPair[]>([]);
  const [tiles, setTiles] = useState<MatrixTile[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [draggedTileId, setDraggedTileId] = useState<string | null>(null);
  const [dragOverTileId, setDragOverTileId] = useState<string | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [poppingPairId, setPoppingPairId] = useState<string | null>(null);
  const [wrongTileIds, setWrongTileIds] = useState<[string, string] | null>(null);

  const [lives, setLives] = useState<number>(MAX_LIVES);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(ROUND_DURATION_MS);
  const [clearTimeMs, setClearTimeMs] = useState<number | null>(null);
  const [isNewBestTime, setIsNewBestTime] = useState<boolean>(false);
  const [combo, setCombo] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [attemptsCount, setAttemptsCount] = useState<number>(0);
  const [missedInRound, setMissedInRound] = useState<string[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Study Bank Filters
  const [bankFilter, setBankFilter] = useState<'ALL' | MatchRelationType>('ALL');
  const [bankSearch, setBankSearch] = useState<string>('');

  // Mutable refs for accurate timer & sound synthesis
  const deadlineRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const popTimerRef = useRef<number | null>(null);
  const wrongTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const roundEndedRef = useRef<boolean>(false);

  const allPairs = useMemo(() => getPoolForMode('mixed', customPairs), [customPairs]);

  useEffect(() => {
    void syncCustomWordPairsFromSupabase();
    void syncWordMatrixLeaderboardFromSupabase();

    const hydrateIdentity = async () => {
      if (typeof window !== 'undefined') {
        const tabParam = new URLSearchParams(window.location.search).get('tab');
        if (tabParam === 'leaderboard' || tabParam === 'bank') {
          setActiveTab(tabParam);
        }
      }

      const savedExam =
        typeof window !== 'undefined'
          ? localStorage.getItem('bs_student_target_exam') || 'SBI PO & IBPS PO 2026'
          : 'SBI PO & IBPS PO 2026';
      setPlayerTargetExam(savedExam);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const authUser = session.user;
          const { data: profileData } = await supabase
            .from('profiles')
            .select('student_name, full_name')
            .eq('id', authUser.id)
            .maybeSingle();

          const resolvedName =
            profileData?.student_name ||
            profileData?.full_name ||
            (typeof authUser.user_metadata?.full_name === 'string'
              ? authUser.user_metadata.full_name
              : '') ||
            authUser.email?.split('@')[0] ||
            'Banking Aspirant';

          setIsSignedInUser(true);
          setPlayerUserId(authUser.id);
          setPlayerName(resolvedName);
          return;
        }
      } catch {
        // Fallback to local guest player ID
      }

      const guestId = getOrCreateGuestPlayerId();
      const savedGuestName =
        typeof window !== 'undefined'
          ? localStorage.getItem(WORD_MATRIX_PLAYER_NAME_KEY) ||
            getSavedChallengerName('Banking Aspirant')
          : 'Banking Aspirant';
      setIsSignedInUser(false);
      setPlayerUserId(guestId);
      setPlayerName(savedGuestName);
      setGuestNameDraft(savedGuestName);
    };

    void hydrateIdentity();
  }, []);

  const filteredBankPairs = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    return allPairs.filter((pair) => {
      if (bankFilter !== 'ALL' && pair.relation !== bankFilter) return false;
      if (!q) return true;
      return (
        pair.term.toLowerCase().includes(q) ||
        pair.match.toLowerCase().includes(q) ||
        pair.examNote.toLowerCase().includes(q)
      );
    });
  }, [allPairs, bankFilter, bankSearch]);

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 2400);
  }, []);

  const playTone = useCallback(
    (type: 'match' | 'wrong' | 'win' | 'gameover') => {
      if (!soundEnabled || typeof window === 'undefined') return;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          void ctx.resume();
        }
        const now = ctx.currentTime;

        if (type === 'match') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.14);
          gain.gain.setValueAtTime(0.11, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.2);
        } else if (type === 'wrong') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(210, now);
          osc.frequency.linearRampToValueAtTime(145, now + 0.22);
          gain.gain.setValueAtTime(0.13, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.24);
        } else if (type === 'win') {
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            const start = now + idx * 0.07;
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.11, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.22);
          });
        } else {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.linearRampToValueAtTime(110, now + 0.35);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.36);
        }
      } catch {
        // Ignore audio context restrictions
      }
    },
    [soundEnabled]
  );

  const persistRoundOutcome = useCallback(
    (
      outcome: 'won' | 'lost_time' | 'lost_lives',
      finalScore: number,
      elapsedMs: number | null,
      roundPairList: WordPair[],
      roundMistakes: string[]
    ) => {
      const current = parseStatsFromRaw(getRawStatsSnapshot());
      const mistakeSet = new Set(roundMistakes);
      const cleanMasteredIds =
        outcome === 'won'
          ? roundPairList.filter((p) => !mistakeSet.has(p.id)).map((p) => p.id)
          : [];

      const nextMastered = Array.from(new Set([...current.masteredPairIds, ...cleanMasteredIds]));
      const nextMissedBase = current.missedPairIds.filter((id) => !cleanMasteredIds.includes(id));
      const nextMissed = Array.from(new Set([...roundMistakes, ...nextMissedBase])).slice(0, 40);

      const won = outcome === 'won';
      const nextStreak = won ? current.currentWinStreak + 1 : 0;
      const achievedNewBestTime =
        won &&
        elapsedMs !== null &&
        (current.bestClearTimeMs === null || elapsedMs < current.bestClearTimeMs);

      const updated: WordMatrixStats = {
        gamesPlayed: current.gamesPlayed + 1,
        boardsCleared: current.boardsCleared + (won ? 1 : 0),
        bestClearTimeMs: achievedNewBestTime
          ? elapsedMs
          : current.bestClearTimeMs,
        bestScore: Math.max(current.bestScore, finalScore),
        currentWinStreak: nextStreak,
        bestWinStreak: Math.max(current.bestWinStreak, nextStreak),
        masteredPairIds: nextMastered,
        missedPairIds: nextMissed,
      };

      setIsNewBestTime(achievedNewBestTime);
      saveWordMatrixStats(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('bs_word_matrix_sync'));
      }

      const activeId = playerUserId || getOrCreateGuestPlayerId();
      if (updated.bestScore > 0) {
        void upsertWordMatrixLeaderboardEntry({
          userId: activeId,
          name: playerName,
          targetExam: playerTargetExam,
          bestScore: updated.bestScore,
          bestClearTimeMs: updated.bestClearTimeMs,
          boardsCleared: updated.boardsCleared,
          bestWinStreak: updated.bestWinStreak,
        });
      }
    },
    [playerName, playerTargetExam, playerUserId]
  );

  const startRound = useCallback(
    (targetMode: WordMatrixMode, fixedPairs?: WordPair[]) => {
      if (popTimerRef.current !== null) window.clearTimeout(popTimerRef.current);
      if (wrongTimerRef.current !== null) window.clearTimeout(wrongTimerRef.current);

      const { pairs, tiles: dealtTiles } = buildMatrixRound(
        targetMode,
        fixedPairs,
        customPairs
      );
      roundEndedRef.current = false;
      deadlineRef.current = Date.now() + ROUND_DURATION_MS;

      setActiveTab('play');
      setMode(targetMode);
      setRoundPairs(pairs);
      setTiles(dealtTiles);
      setSelectedTileId(null);
      setDraggedTileId(null);
      setDragOverTileId(null);
      setMatchedPairIds([]);
      setPoppingPairId(null);
      setWrongTileIds(null);
      setLives(MAX_LIVES);
      setTimeLeftMs(ROUND_DURATION_MS);
      setClearTimeMs(null);
      setIsNewBestTime(false);
      setCombo(0);
      setScore(0);
      setAttemptsCount(0);
      setMissedInRound([]);
      setGameStatus('playing');
    },
    [customPairs]
  );

  const startMissedTermsDrill = useCallback(() => {
    setAcceptedChallenge(null);
    const missedSet = new Set(stats.missedPairIds);
    const missedPool = allPairs.filter((p) => missedSet.has(p.id));
    let selected = shuffleArray(missedPool).slice(0, 8);
    if (selected.length < 8) {
      const usedIds = new Set(selected.map((p) => p.id));
      const filler = shuffleArray(BANKING_JARGON_PAIRS).filter((p) => !usedIds.has(p.id));
      selected = [...selected, ...filler.slice(0, 8 - selected.length)];
    }
    startRound('mixed', selected);
  }, [allPairs, startRound, stats.missedPairIds]);

  const handleAcceptChallenge = useCallback(
    (challenge: WordMatrixChallengePayload) => {
      const pairMap = new Map(allPairs.map((p) => [p.id, p]));
      const matchedFixed = challenge.pairIds
        .map((id) => pairMap.get(id))
        .filter((p): p is WordPair => Boolean(p));
      setAcceptedChallenge(challenge);
      startRound(challenge.mode, matchedFixed.length === 8 ? matchedFixed : undefined);
    },
    [allPairs, startRound]
  );

  // 45-Second Countdown Interval
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const timerId = window.setInterval(() => {
      const remaining = Math.max(0, deadlineRef.current - Date.now());
      setTimeLeftMs(remaining);

      if (remaining <= 0 && !roundEndedRef.current) {
        roundEndedRef.current = true;
        window.clearInterval(timerId);
        setSelectedTileId(null);
        setDraggedTileId(null);
        setDragOverTileId(null);
        setGameStatus('lost_time');
        playTone('gameover');

        const unmatchedIds = roundPairs
          .filter((p) => !matchedPairIds.includes(p.id))
          .map((p) => p.id);
        const combinedMistakes = Array.from(new Set([...missedInRound, ...unmatchedIds]));
        setMissedInRound(combinedMistakes);
        persistRoundOutcome('lost_time', score, null, roundPairs, combinedMistakes);
      }
    }, 80);

    return () => {
      window.clearInterval(timerId);
    };
  }, [gameStatus, matchedPairIds, missedInRound, persistRoundOutcome, playTone, roundPairs, score]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (popTimerRef.current !== null) window.clearTimeout(popTimerRef.current);
      if (wrongTimerRef.current !== null) window.clearTimeout(wrongTimerRef.current);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Escape key to deselect active tile
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedTileId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameStatus]);

  const attemptPairMatch = useCallback(
    (firstTile: MatrixTile, secondTile: MatrixTile) => {
      if (gameStatus !== 'playing' || roundEndedRef.current) return;
      if (firstTile.tileId === secondTile.tileId) return;
      if (
        matchedPairIds.includes(firstTile.pairId) ||
        matchedPairIds.includes(secondTile.pairId)
      ) {
        return;
      }

      const nextAttempts = attemptsCount + 1;
      setAttemptsCount(nextAttempts);
      setSelectedTileId(null);
      setDraggedTileId(null);
      setDragOverTileId(null);

      const isCorrect =
        firstTile.pairId === secondTile.pairId && firstTile.kind !== secondTile.kind;

      if (isCorrect) {
        if (wrongTimerRef.current !== null) {
          window.clearTimeout(wrongTimerRef.current);
          setWrongTileIds(null);
        }

        const nextCombo = combo + 1;
        const multiplier =
          nextCombo >= 4 ? 2.5 : nextCombo === 3 ? 2 : nextCombo === 2 ? 1.5 : 1;
        const gained = Math.round(100 * multiplier);
        const nextMatched = [...matchedPairIds, firstTile.pairId];

        setMatchedPairIds(nextMatched);
        setPoppingPairId(firstTile.pairId);
        setCombo(nextCombo);

        if (popTimerRef.current !== null) window.clearTimeout(popTimerRef.current);
        popTimerRef.current = window.setTimeout(() => {
          setPoppingPairId(null);
        }, 230);

        if (nextMatched.length === 8) {
          // Board Cleared in under 45 seconds!
          roundEndedRef.current = true;
          const remainingNow = Math.max(0, deadlineRef.current - Date.now());
          const elapsed = Math.min(ROUND_DURATION_MS, Math.max(400, ROUND_DURATION_MS - remainingNow));
          const speedBonus = Math.round((remainingNow / 1000) * 15);
          const heartBonus = lives * 150;
          const finalTotalScore = score + gained + speedBonus + heartBonus;

          setTimeLeftMs(remainingNow);
          setClearTimeMs(elapsed);
          setScore(finalTotalScore);
          setGameStatus('won');
          playTone('win');
          persistRoundOutcome('won', finalTotalScore, elapsed, roundPairs, missedInRound);
        } else {
          setScore(score + gained);
          playTone('match');
        }
      } else {
        // Wrong Match -> Lose 1 Heart
        const nextLives = Math.max(0, lives - 1);
        const nextMistakes = Array.from(
          new Set([...missedInRound, firstTile.pairId, secondTile.pairId])
        );

        setLives(nextLives);
        setCombo(0);
        setMissedInRound(nextMistakes);
        setWrongTileIds([firstTile.tileId, secondTile.tileId]);

        if (wrongTimerRef.current !== null) window.clearTimeout(wrongTimerRef.current);
        wrongTimerRef.current = window.setTimeout(() => {
          setWrongTileIds(null);
        }, 400);

        if (nextLives <= 0) {
          roundEndedRef.current = true;
          setGameStatus('lost_lives');
          playTone('gameover');
          persistRoundOutcome('lost_lives', score, null, roundPairs, nextMistakes);
        } else {
          playTone('wrong');
        }
      }
    },
    [
      attemptsCount,
      combo,
      gameStatus,
      lives,
      matchedPairIds,
      missedInRound,
      persistRoundOutcome,
      playTone,
      roundPairs,
      score,
    ]
  );

  const handleTileClick = useCallback(
    (tile: MatrixTile) => {
      if (gameStatus !== 'playing' || matchedPairIds.includes(tile.pairId)) return;

      if (!selectedTileId) {
        setSelectedTileId(tile.tileId);
        return;
      }

      if (selectedTileId === tile.tileId) {
        setSelectedTileId(null);
        return;
      }

      const firstTile = tiles.find((t) => t.tileId === selectedTileId);
      if (!firstTile) {
        setSelectedTileId(tile.tileId);
        return;
      }

      attemptPairMatch(firstTile, tile);
    },
    [attemptPairMatch, gameStatus, matchedPairIds, selectedTileId, tiles]
  );

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, tile: MatrixTile) => {
    if (gameStatus !== 'playing' || matchedPairIds.includes(tile.pairId)) {
      e.preventDefault();
      return;
    }
    setDraggedTileId(tile.tileId);
    setSelectedTileId(tile.tileId);
    e.dataTransfer.setData('text/plain', tile.tileId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>, tile: MatrixTile) => {
    if (gameStatus !== 'playing' || matchedPairIds.includes(tile.pairId)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTileId !== tile.tileId && draggedTileId !== tile.tileId) {
      setDragOverTileId(tile.tileId);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>, targetTile: MatrixTile) => {
    e.preventDefault();
    if (gameStatus !== 'playing' || matchedPairIds.includes(targetTile.pairId)) return;

    const sourceId = draggedTileId || e.dataTransfer.getData('text/plain');
    setDraggedTileId(null);
    setDragOverTileId(null);

    if (!sourceId || sourceId === targetTile.tileId) return;
    const sourceTile = tiles.find((t) => t.tileId === sourceId);
    if (!sourceTile) return;

    attemptPairMatch(sourceTile, targetTile);
  };

  const handleSavePairToVault = useCallback(
    (pair: WordPair) => {
      const notebookId = `wm_${pair.id}`;
      const sameRelationPool = allPairs.filter(
        (p) => p.relation === pair.relation && p.id !== pair.id
      );
      const distractors = sameRelationPool.slice(0, 3).map((p) => p.match);
      const options = [pair.match, ...distractors];

      const promptPrefix =
        pair.relation === 'JARGON'
          ? 'Identify the accurate Banking & Financial Awareness definition of'
          : pair.relation === 'SYNONYM'
          ? 'Choose the closest Synonym for the editorial word'
          : pair.relation === 'ANTONYM'
          ? 'Choose the accurate Antonym (opposite) for'
          : 'Select the accurate meaning of the editorial vocabulary word';

      const result = toggleBookmarkQuestion({
        id: notebookId,
        sourceType: pair.relation === 'JARGON' ? 'GA_QUIZ' : 'MOCK_TEST',
        sourceId: 'word-matrix',
        sourceTitle: 'Word Matrix (Vocab & Banking Jargon)',
        section: pair.relation === 'JARGON' ? 'Banking Awareness' : 'English Vocabulary',
        questionText: `${promptPrefix}: "${pair.term}"`,
        options,
        correctOptionIndex: 0,
        explanation: `${pair.term} → ${pair.match}. Exam Insight: ${pair.examNote}`,
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('bs_word_matrix_sync'));
      }

      showToast(
        result.isNowBookmarked
          ? `Saved "${pair.term}" to Mistake & Vault Notebook!`
          : `Removed "${pair.term}" from Vault Notebook.`
      );
    },
    [allPairs, showToast]
  );

  const currentModeMeta =
    MODE_OPTIONS.find((m) => m.id === mode) ?? MODE_OPTIONS[0];
  const secondsDisplay = (timeLeftMs / 1000).toFixed(1);
  const timerPct = Math.max(0, Math.min(100, (timeLeftMs / ROUND_DURATION_MS) * 100));
  const accuracyPct =
    attemptsCount > 0 ? Math.round((matchedPairIds.length / attemptsCount) * 100) : 100;

  const myStanding = useMemo(
    () => getUserWordMatrixRank(playerUserId, leaderboard),
    [leaderboard, playerUserId]
  );
  const top100Entries = useMemo(() => leaderboard.slice(0, 100), [leaderboard]);

  const handleSaveGuestDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = guestNameDraft.trim();
    if (!cleaned) return;
    setPlayerName(cleaned);
    setEditingGuestName(false);
    saveChallengerName(cleaned);
    if (typeof window !== 'undefined') {
      localStorage.setItem(WORD_MATRIX_PLAYER_NAME_KEY, cleaned);
    }
    if (playerUserId && stats.bestScore > 0) {
      await upsertWordMatrixLeaderboardEntry({
        userId: playerUserId,
        name: cleaned,
        targetExam: playerTargetExam,
        bestScore: stats.bestScore,
        bestClearTimeMs: stats.bestClearTimeMs,
        boardsCleared: stats.boardsCleared,
        bestWinStreak: stats.bestWinStreak,
      });
    }
    showToast(`Display name updated to "${cleaned}"!`);
  };

  const handleChallengerNameSync = useCallback(
    (nextName: string) => {
      const clean = nextName.trim();
      if (!clean) return;
      saveChallengerName(clean);
      if (!isSignedInUser) {
        setPlayerName(clean);
        setGuestNameDraft(clean);
        if (typeof window !== 'undefined') {
          localStorage.setItem(WORD_MATRIX_PLAYER_NAME_KEY, clean);
        }
      }
    },
    [isSignedInUser]
  );

  const duelOutcome = useMemo(() => {
    if (
      !acceptedChallenge ||
      (gameStatus !== 'won' && gameStatus !== 'lost_time' && gameStatus !== 'lost_lives')
    ) {
      return null;
    }
    return evaluateWordMatrixDuel(
      acceptedChallenge,
      score,
      clearTimeMs,
      matchedPairIds.length
    );
  }, [acceptedChallenge, clearTimeMs, gameStatus, matchedPairIds.length, score]);

  const sharePayload = useMemo<WordMatrixChallengePayload>(
    () => ({
      arena: 'word_matrix',
      challenger: playerName,
      score,
      clearTimeMs,
      matchedPairs: matchedPairIds.length,
      totalPairs: 8,
      mode,
      pairIds: roundPairs.map((p) => p.id),
    }),
    [clearTimeMs, matchedPairIds.length, mode, playerName, roundPairs, score]
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col relative overflow-x-hidden">
      {/* Subtle Ambient Glows */}
      <div className="pointer-events-none fixed -top-32 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px]" />
      <div className="pointer-events-none fixed top-1/3 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px]" />

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-fade-in">
          <span>🔖</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* TOP STICKY HEADER */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5"
            >
              <span>←</span>
              <span className="hidden sm:inline">Home</span>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/20 to-emerald-500/20 border border-amber-400/30 flex items-center justify-center text-lg shadow-inner">
                🧩
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-black tracking-tight text-white">
                    Word Matrix
                  </h1>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                    4×4 Match &amp; Drag
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Interactive Banking Jargon &amp; Editorial Vocabulary Pairing Arena
                </p>
              </div>
            </div>
          </div>

          {/* Right Controls: Personal Stats + Sound + Theme + Vault */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className="hidden md:flex items-center gap-2 bg-slate-900/90 hover:bg-slate-800 border border-white/[0.07] px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer"
            >
              <span className="text-amber-300">
                🏆 Rank: {myStanding.rank !== null ? `#${myStanding.rank}` : 'Unranked'}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400">
                ⚡{' '}
                {stats.bestClearTimeMs !== null
                  ? `${(stats.bestClearTimeMs / 1000).toFixed(1)}s`
                  : '--'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              title={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
              aria-label={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
              className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.08] flex items-center justify-center text-sm transition cursor-pointer"
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>

            <ThemeToggle variant="switch" />

            <Link
              href="/notebook"
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-xs font-bold text-amber-300 transition flex items-center gap-1.5"
            >
              <span>🔖</span>
              <span className="hidden sm:inline">Vault</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Top Mode Switcher Tabs: Play Matrix vs Top 100 Leaderboard vs Study Bank */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap p-1 rounded-2xl bg-slate-900/90 border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setActiveTab('play')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'play'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>🎮</span>
              <span>4×4 Matrix Arena</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'leaderboard'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>🏆</span>
              <span>
                Top 100 Leaderboard
                {myStanding.rank !== null ? ` (#${myStanding.rank})` : ''}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bank')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'bank'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>📚</span>
              <span>Jargon &amp; Vocab Bank ({allPairs.length})</span>
            </button>
          </div>

          {stats.missedPairIds.length > 0 && (
            <button
              type="button"
              onClick={startMissedTermsDrill}
              className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-black transition cursor-pointer flex items-center gap-1.5"
            >
              <span>🎯</span>
              <span>Drill Missed Terms ({stats.missedPairIds.length})</span>
            </button>
          )}
        </div>

        {activeTab === 'play' ? (
          <div className="space-y-6">
            {pendingChallenge && gameStatus !== 'playing' && (
              <HeadToHeadIncomingBanner
                challenge={pendingChallenge}
                acceptButtonLabel="⚔️ Accept Same 8-Pair Matrix →"
                onAccept={() => handleAcceptChallenge(pendingChallenge)}
                onDismiss={() => setDismissedChallengeToken(challengeTokenParam)}
              />
            )}

            {/* CATEGORY / JARGON MODE PILLS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {MODE_OPTIONS.map((opt) => {
                const isSelected = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setMode(opt.id);
                      if (gameStatus !== 'ready') {
                        setAcceptedChallenge(null);
                        startRound(opt.id);
                      }
                    }}
                    className={`text-left p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-slate-900 border-amber-400/70 ring-1 ring-amber-400/30 shadow-lg'
                        : 'bg-slate-900/55 hover:bg-slate-900 border-white/[0.07]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-lg">{opt.icon}</span>
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {opt.id === 'mixed' ? `${allPairs.length} Terms` : opt.badge}
                      </span>
                    </div>
                    <div className="text-xs font-black text-white leading-snug">
                      {opt.shortLabel}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* LIVE HUD BAR */}
            <div className="bg-slate-900/90 border border-white/[0.08] rounded-3xl p-4 sm:p-5 shadow-xl space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* 3 Lives (Hearts) */}
                <div className="flex items-center gap-2.5 bg-slate-950/80 border border-white/[0.07] px-3.5 py-2 rounded-2xl">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Lives
                  </span>
                  <div className="flex items-center gap-1.5" aria-label={`${lives} of 3 lives remaining`}>
                    {[0, 1, 2].map((heartIdx) => {
                      const alive = heartIdx < lives;
                      return (
                        <span
                          key={heartIdx}
                          className={`text-base sm:text-lg transition-all duration-300 ${
                            alive
                              ? 'scale-100 drop-shadow-[0_0_6px_rgba(244,63,94,0.45)]'
                              : 'opacity-25 grayscale scale-90'
                          }`}
                        >
                          ❤️
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* 45s Countdown Clock */}
                <div className="flex items-center gap-2.5 bg-slate-950/80 border border-white/[0.07] px-4 py-2 rounded-2xl">
                  <span className="text-sm">⏱️</span>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                      Target &lt; 45s
                    </div>
                    <div
                      className={`text-base sm:text-xl font-black font-mono leading-tight ${
                        timeLeftMs <= 8_000 && gameStatus === 'playing'
                          ? 'text-rose-400 animate-pulse'
                          : timeLeftMs <= 15_000 && gameStatus === 'playing'
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {secondsDisplay}s
                    </div>
                  </div>
                </div>

                {/* Pairs Cleared & Combo */}
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="bg-slate-950/80 border border-white/[0.07] px-3.5 py-2 rounded-2xl text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                      Matched
                    </div>
                    <div className="text-sm sm:text-base font-black text-white leading-tight mt-0.5">
                      {matchedPairIds.length} <span className="text-slate-500">/ 8</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-white/[0.07] px-3.5 py-2 rounded-2xl text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                      Score
                    </div>
                    <div className="text-sm sm:text-base font-black text-amber-300 leading-tight mt-0.5 flex items-center gap-1.5">
                      <span>{score}</span>
                      {combo >= 2 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {combo}x
                        </span>
                      )}
                    </div>
                  </div>

                  {gameStatus === 'playing' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAcceptedChallenge(null);
                        startRound(mode);
                      }}
                      title="Deal a fresh 4×4 board"
                      className="px-3 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-white/[0.08] text-xs font-black text-slate-200 transition cursor-pointer"
                    >
                      🔄 Shuffle New
                    </button>
                  )}
                </div>
              </div>

              {/* Smooth Countdown Bar */}
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 rounded-full ${
                    timeLeftMs <= 8_000
                      ? 'bg-rose-500'
                      : timeLeftMs <= 15_000
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${timerPct}%` }}
                />
              </div>
            </div>

            {/* BOARD STAGE: READY LAUNCHPAD OR ACTIVE 4x4 GRID OR END SUMMARY */}
            {gameStatus === 'ready' ? (
              <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-10 text-center space-y-6 shadow-2xl">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-black">
                  <span>{currentModeMeta.icon}</span>
                  <span>{currentModeMeta.label}</span>
                </div>

                <div className="max-w-2xl mx-auto space-y-2.5">
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Clear the 4×4 Word Matrix in Under 45 Seconds
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {currentModeMeta.description}
                  </p>
                </div>

                {/* Mechanics Pills */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto text-left">
                  <div className="bg-slate-950/80 border border-white/[0.06] rounded-2xl p-4 space-y-1">
                    <div className="text-xs font-black text-amber-300">🖱️ Click or Drag &amp; Drop</div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Click any two tiles to pair a term with its meaning — or drag a term tile directly onto its matching card.
                    </p>
                  </div>
                  <div className="bg-slate-950/80 border border-white/[0.06] rounded-2xl p-4 space-y-1">
                    <div className="text-xs font-black text-emerald-400">✨ Vanishing 4×4 Matrix</div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      8 terms + 8 meanings (16 tiles). Correct pairs vanish in place; clear all 8 pairs before the 45s clock hits zero!
                    </p>
                  </div>
                  <div className="bg-slate-950/80 border border-white/[0.06] rounded-2xl p-4 space-y-1">
                    <div className="text-xs font-black text-rose-400">❤️❤️❤️ 3 Lives Guardrail</div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Every wrong pairing costs 1 heart. Precision beats blind guessing — save tricky terms to your Vault afterward!
                    </p>
                  </div>
                </div>

                {/* Sample Preview Strip */}
                <div className="max-w-3xl mx-auto pt-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                    Sample Pairs in {currentModeMeta.shortLabel}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {getPoolForMode(mode, customPairs)
                      .slice(0, 4)
                      .map((sample) => (
                        <span
                          key={sample.id}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-slate-950/90 border border-white/[0.07] text-slate-300"
                        >
                          <strong className="text-amber-300">{sample.term}</strong> →{' '}
                          {sample.match.length > 42
                            ? `${sample.match.slice(0, 42)}…`
                            : sample.match}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAcceptedChallenge(null);
                      startRound(mode);
                    }}
                    className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/20 transition transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    🚀 Start 45s Word Matrix
                  </button>
                </div>
              </div>
            ) : gameStatus === 'playing' ? (
              <div className="space-y-3">
                {acceptedChallenge && (
                  <HeadToHeadLiveTargetBar
                    challengerName={acceptedChallenge.challenger}
                    currentValue={score}
                    targetValue={acceptedChallenge.score}
                    unitLabel="pts"
                    extraTargetNote={
                      acceptedChallenge.clearTimeMs !== null
                        ? `${(acceptedChallenge.clearTimeMs / 1000).toFixed(1)}s clear`
                        : `${acceptedChallenge.matchedPairs}/${acceptedChallenge.totalPairs} pairs`
                    }
                  />
                )}
                <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
                  <span>
                    💡 <strong>Tip:</strong> Tap two tiles to match, or drag a{' '}
                    <span className="text-amber-300 font-bold">Term</span> onto its{' '}
                    <span className="text-cyan-300 font-bold">Meaning</span>.
                  </span>
                  {selectedTileId && (
                    <button
                      type="button"
                      onClick={() => setSelectedTileId(null)}
                      className="text-amber-300 hover:underline font-bold cursor-pointer"
                    >
                      Cancel Selection (Esc)
                    </button>
                  )}
                </div>

                {/* AUTHENTIC 4 x 4 INTERACTIVE MATRIX */}
                <div
                  className="grid grid-cols-4 gap-2 sm:gap-3.5 select-none"
                  role="grid"
                  aria-label="4 by 4 Vocabulary Match Matrix"
                >
                  {tiles.map((tile) => {
                    const isMatched = matchedPairIds.includes(tile.pairId);
                    const isPopping = poppingPairId === tile.pairId;
                    const isSelected = selectedTileId === tile.tileId;
                    const isDragTarget = dragOverTileId === tile.tileId;
                    const isWrong =
                      wrongTileIds !== null &&
                      (wrongTileIds[0] === tile.tileId || wrongTileIds[1] === tile.tileId);

                    // Vanished tile slot (keeps 4x4 positions locked without layout shift)
                    if (isMatched && !isPopping) {
                      return (
                        <div
                          key={tile.tileId}
                          aria-hidden="true"
                          className="min-h-[96px] sm:min-h-[122px] md:min-h-[132px] rounded-2xl border border-dashed border-white/[0.04] bg-slate-950/20 opacity-25 pointer-events-none transition-all duration-200 flex items-center justify-center"
                        >
                          <span className="text-emerald-500/40 text-xs font-black">✓</span>
                        </div>
                      );
                    }

                    const isTermTile = tile.kind === 'term';

                    return (
                      <button
                        key={tile.tileId}
                        type="button"
                        draggable={!isMatched}
                        onClick={() => handleTileClick(tile)}
                        onDragStart={(e) => handleDragStart(e, tile)}
                        onDragOver={(e) => handleDragOver(e, tile)}
                        onDragLeave={() => {
                          if (dragOverTileId === tile.tileId) setDragOverTileId(null);
                        }}
                        onDrop={(e) => handleDrop(e, tile)}
                        onDragEnd={() => {
                          setDraggedTileId(null);
                          setDragOverTileId(null);
                        }}
                        className={`min-h-[96px] sm:min-h-[122px] md:min-h-[132px] p-2 sm:p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between gap-1.5 transition-all duration-150 cursor-pointer relative overflow-hidden ${
                          isPopping
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 animate-tile-pop shadow-lg shadow-emerald-500/20'
                            : isWrong
                            ? 'bg-rose-500/25 border-rose-400 text-rose-200 animate-tile-shake shadow-lg shadow-rose-500/20'
                            : isDragTarget
                            ? 'bg-emerald-500/15 border-emerald-400 ring-2 ring-emerald-400/40 scale-[1.02]'
                            : isSelected
                            ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/40 -translate-y-0.5 shadow-lg shadow-amber-500/15'
                            : isTermTile
                            ? 'bg-slate-900/95 hover:bg-slate-800/95 border-white/[0.1] hover:border-amber-400/50 shadow-md'
                            : 'bg-slate-900/75 hover:bg-slate-800/90 border-white/[0.08] hover:border-cyan-400/50 shadow-md'
                        }`}
                      >
                        {/* Top Micro Badge */}
                        <span
                          className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                            isTermTile
                              ? 'bg-amber-400/15 text-amber-300 border border-amber-400/25'
                              : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25'
                          }`}
                        >
                          {relationLabel(tile.relation, tile.kind)}
                        </span>

                        {/* Main Tile Content */}
                        <span
                          className={`my-auto break-words line-clamp-4 ${
                            isTermTile
                              ? 'text-xs sm:text-sm md:text-base font-black text-white tracking-tight'
                              : 'text-[10px] sm:text-xs font-semibold text-slate-200 leading-snug'
                          }`}
                        >
                          {tile.text}
                        </span>

                        {/* Bottom subtle hint dot */}
                        <span className="w-4 h-0.5 rounded-full bg-white/10 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ROUND COMPLETE: VICTORY OR GAME OVER + 8-PAIR EXAM REVISION */
              <div className="space-y-6 animate-fade-in">
                <div
                  className={`rounded-3xl p-6 sm:p-8 border shadow-2xl text-center space-y-5 ${
                    gameStatus === 'won'
                      ? 'bg-gradient-to-b from-emerald-950/60 via-slate-900 to-slate-950 border-emerald-500/40'
                      : 'bg-gradient-to-b from-rose-950/50 via-slate-900 to-slate-950 border-rose-500/40'
                  }`}
                >
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black border bg-slate-950/80 border-white/10">
                    {gameStatus === 'won' ? (
                      <span className="text-emerald-400">
                        🏆 Matrix Cleared Under 45 Seconds!
                      </span>
                    ) : gameStatus === 'lost_lives' ? (
                      <span className="text-rose-400">💔 Out of Hearts (0 / 3 Lives Left)</span>
                    ) : (
                      <span className="text-amber-300">⏱️ 45.0s Time Expired!</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="text-2xl sm:text-3xl font-black text-white">
                      {gameStatus === 'won' && clearTimeMs !== null
                        ? `Cleared all 8 pairs in ${(clearTimeMs / 1000).toFixed(1)}s!`
                        : `Matched ${matchedPairIds.length} of 8 Pairs`}
                    </h2>
                    {isNewBestTime && (
                      <p className="text-xs font-black text-amber-300">
                        ⚡ NEW PERSONAL RECORD CLEAR TIME!
                      </p>
                    )}
                  </div>

                  {/* Round Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                    <div className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-3">
                      <div className="text-[10px] font-bold uppercase text-slate-400">
                        Clear Time
                      </div>
                      <div className="text-lg font-black text-emerald-400">
                        {clearTimeMs !== null ? `${(clearTimeMs / 1000).toFixed(1)}s` : '45.0s'}
                      </div>
                    </div>
                    <div className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-3">
                      <div className="text-[10px] font-bold uppercase text-slate-400">
                        Hearts Left
                      </div>
                      <div className="text-lg font-black text-rose-400">{lives} / 3 ❤️</div>
                    </div>
                    <div className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-3">
                      <div className="text-[10px] font-bold uppercase text-slate-400">
                        Accuracy
                      </div>
                      <div className="text-lg font-black text-cyan-300">{accuracyPct}%</div>
                    </div>
                    <div className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-3">
                      <div className="text-[10px] font-bold uppercase text-slate-400">
                        Final Score
                      </div>
                      <div className="text-lg font-black text-amber-300">{score}</div>
                    </div>
                  </div>

                  {/* Replay CTAs */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAcceptedChallenge(null);
                        startRound(mode);
                      }}
                      className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition cursor-pointer"
                    >
                      🎲 New 4×4 Matrix
                    </button>
                    <button
                      type="button"
                      onClick={() => startRound(mode, roundPairs)}
                      className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-white/[0.1] text-white font-black text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                      🔄 Retry Same 8 Pairs
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('leaderboard')}
                      className="px-5 py-3.5 rounded-2xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-amber-300 font-black text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                      🏆 {myStanding.rank !== null ? `Rank #${myStanding.rank} • Top 100` : 'View Top 100'}
                    </button>
                  </div>
                </div>

                {duelOutcome && (
                  <HeadToHeadVerdictBanner
                    outcome={duelOutcome}
                    onRematchSameSeed={() => startRound(mode, roundPairs)}
                  />
                )}

                <HeadToHeadSharePanel
                  payload={sharePayload}
                  onChallengerNameChange={handleChallengerNameSync}
                  conqueredChallenge={duelOutcome}
                />

                {/* POST-GAME 8-PAIR REVISION & VAULT SAVER */}
                <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-5 sm:p-7 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-white">
                        📖 Round Revision Sheet (8 Banking &amp; Editorial Pairs)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Bookmark tricky terms directly into your Mistake &amp; Vault Notebook for spaced revision.
                      </p>
                    </div>
                    <Link
                      href="/notebook"
                      className="text-xs font-black text-amber-300 hover:underline"
                    >
                      Open Vault Notebook →
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {roundPairs.map((pair) => {
                      const wasMissed = missedInRound.includes(pair.id);
                      const isSaved = bookmarkedIds.has(`wm_${pair.id}`);
                      return (
                        <div
                          key={pair.id}
                          className={`rounded-2xl p-4 border flex flex-col justify-between gap-3 ${
                            wasMissed
                              ? 'bg-rose-950/20 border-rose-500/35'
                              : 'bg-slate-950/70 border-white/[0.07]'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-amber-300">
                                  {pair.term}
                                </span>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                  {pair.relation}
                                </span>
                                {wasMissed && (
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                    Needs Review
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleSavePairToVault(pair)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer shrink-0 ${
                                  isSaved
                                    ? 'bg-amber-400/20 border-amber-400/40 text-amber-300'
                                    : 'bg-slate-900 hover:bg-slate-800 border-white/[0.08] text-slate-300'
                                }`}
                              >
                                {isSaved ? '🔖 Saved' : '+ Vault'}
                              </button>
                            </div>

                            <p className="text-xs font-bold text-white leading-snug">
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
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'leaderboard' ? (
          /* TAB: TOP 100 GLOBAL LEADERBOARD + INDIVIDUAL RANK */
          <div className="space-y-6 animate-fade-in">
            {/* Header & Personal Standing Banner */}
            <div className="bg-slate-900/90 border border-white/[0.08] rounded-3xl p-5 sm:p-7 space-y-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                    Global Speed &amp; Accuracy Standings
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                    🏆 Word Matrix Top 100 Leaderboard
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Top 100 aspirants are showcased publicly below. Beyond Top 100, every aspirant&apos;s exact individual rank is tracked on their{' '}
                    <Link href="/profile" className="text-amber-300 font-bold hover:underline">
                      Student Profile
                    </Link>
                    .
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      void syncWordMatrixLeaderboardFromSupabase();
                      showToast('Synced latest Top 100 Leaderboard!');
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/[0.1] text-xs font-bold text-slate-200 transition cursor-pointer"
                  >
                    🔄 Refresh Ranks
                  </button>
                  <Link
                    href="/profile"
                    className="px-4 py-2.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-amber-300 font-black text-xs transition"
                  >
                    📊 My Profile Rank →
                  </Link>
                  <button
                    type="button"
                    onClick={() => startRound(mode)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer"
                  >
                    🎮 Play to Climb
                  </button>
                </div>
              </div>

              {/* Individual Standing Summary Strip */}
              <div className="bg-slate-950/85 border border-amber-400/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-black text-base flex items-center justify-center shrink-0 shadow-md">
                    {myStanding.rank !== null ? `#${myStanding.rank}` : '—'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white">{playerName}</span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
                        {myStanding.rank === null
                          ? 'Play 1 Round to Rank'
                          : myStanding.rank <= 100
                          ? `Top 100 (#${myStanding.rank} of ${myStanding.totalPlayers})`
                          : `Individual Rank #${myStanding.rank} of ${myStanding.totalPlayers}`}
                      </span>
                      {!isSignedInUser && !editingGuestName && (
                        <button
                          type="button"
                          onClick={() => {
                            setGuestNameDraft(playerName);
                            setEditingGuestName(true);
                          }}
                          className="text-[11px] font-bold text-cyan-300 hover:underline cursor-pointer"
                        >
                          ✏️ Edit Name
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {myStanding.rank === null
                        ? 'Complete a 4×4 Matrix round to unlock your official global rank!'
                        : myStanding.rank > 100
                        ? `Score +${myStanding.pointsToTop100} more points in a round to enter the Top 100 board!`
                        : `Best Score: ${myStanding.entry?.bestScore ?? stats.bestScore} • Fastest Clear: ${
                            (myStanding.entry?.bestClearTimeMs ?? stats.bestClearTimeMs) !== null
                              ? `${(((myStanding.entry?.bestClearTimeMs ?? stats.bestClearTimeMs) as number) / 1000).toFixed(1)}s`
                              : '--'
                          }`}
                    </p>
                  </div>
                </div>

                {editingGuestName && !isSignedInUser ? (
                  <form onSubmit={handleSaveGuestDisplayName} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={guestNameDraft}
                      onChange={(e) => setGuestNameDraft(e.target.value)}
                      maxLength={32}
                      placeholder="Your name..."
                      className="px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-400/50 text-xs text-white outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingGuestName(false)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Best Score
                      </span>
                      <span className="font-black text-amber-300 text-sm">
                        {myStanding.entry?.bestScore ?? stats.bestScore}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Fastest Time
                      </span>
                      <span className="font-black text-emerald-400 text-sm">
                        {(myStanding.entry?.bestClearTimeMs ?? stats.bestClearTimeMs) !== null
                          ? `${(
                              ((myStanding.entry?.bestClearTimeMs ??
                                stats.bestClearTimeMs) as number) / 1000
                            ).toFixed(1)}s`
                          : '--'}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Cleared
                      </span>
                      <span className="font-black text-white text-sm">
                        {myStanding.entry?.boardsCleared ?? stats.boardsCleared}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* TOP 3 PODIUM CARDS */}
              {top100Entries.length >= 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                  {top100Entries.slice(0, 3).map((leader, idx) => {
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
                    const borderCls =
                      idx === 0
                        ? 'border-amber-400/50 bg-gradient-to-b from-amber-500/15 to-slate-950'
                        : idx === 1
                        ? 'border-slate-300/35 bg-gradient-to-b from-slate-400/10 to-slate-950'
                        : 'border-amber-700/45 bg-gradient-to-b from-amber-700/15 to-slate-950';
                    const isMe = leader.userId === playerUserId;
                    return (
                      <div
                        key={leader.userId}
                        className={`rounded-2xl p-4 border ${borderCls} flex items-center justify-between gap-3`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl shrink-0">{medal}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-black text-white truncate">
                              {leader.name} {isMe && <span className="text-amber-300">(You)</span>}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 truncate">
                              {leader.boardsCleared} Board{leader.boardsCleared === 1 ? '' : 's'} Cleared • 🔥 {leader.bestWinStreak} Streak
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-amber-300">
                            {leader.bestScore} pts
                          </div>
                          <div className="text-[10px] font-bold text-emerald-400">
                            ⚡{' '}
                            {leader.bestClearTimeMs !== null
                              ? `${(leader.bestClearTimeMs / 1000).toFixed(1)}s`
                              : '--'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* TOP 100 TABLE */}
            <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
              <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Word Matrix Top 100 ({top100Entries.length} / 100 Players)
                </h3>
                <span className="text-[11px] font-bold text-slate-400">
                  Real Word Matrix Players Only • Ranked by Score &amp; Speed
                </span>
              </div>

              {top100Entries.length === 0 ? (
                <div className="py-14 px-6 text-center space-y-3">
                  <div className="text-3xl">🏆</div>
                  <p className="text-sm font-black text-white">
                    No Word Matrix Scores Recorded Yet!
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Only real players who complete a Word Matrix game appear here. Play a 4×4 round right now to claim Rank #1!
                  </p>
                  <button
                    type="button"
                    onClick={() => startRound(mode)}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer"
                  >
                    🚀 Play &amp; Claim Rank #1
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-white/[0.07]">
                      <tr>
                        <th className="py-3.5 px-4">Rank</th>
                        <th className="py-3.5 px-4">Player</th>
                        <th className="py-3.5 px-4 text-right">Best Score</th>
                        <th className="py-3.5 px-4 text-right">Fastest 4×4</th>
                        <th className="py-3.5 px-4 text-right hidden sm:table-cell">Boards Cleared</th>
                        <th className="py-3.5 px-4 text-right hidden md:table-cell">Best Streak</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {top100Entries.map((entry, idx) => {
                        const rank = idx + 1;
                        const isMe = entry.userId === playerUserId;
                        return (
                          <tr
                            key={entry.userId}
                            className={`transition ${
                              isMe
                                ? 'bg-amber-400/10 hover:bg-amber-400/15'
                                : 'hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="py-3 px-4 font-black">
                              {rank === 1 ? (
                                <span className="text-amber-300">🥇 #1</span>
                              ) : rank === 2 ? (
                                <span className="text-slate-200">🥈 #2</span>
                              ) : rank === 3 ? (
                                <span className="text-amber-500">🥉 #3</span>
                              ) : (
                                <span className="text-slate-400">#{rank}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-bold text-white">
                              {entry.name}{' '}
                              {isMe && (
                                <span className="ml-1.5 text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                                  You
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-amber-300">
                              {entry.bestScore}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                              {entry.bestClearTimeMs !== null
                                ? `${(entry.bestClearTimeMs / 1000).toFixed(1)}s`
                                : '--'}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-300 hidden sm:table-cell">
                              {entry.boardsCleared}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-orange-300 hidden md:table-cell">
                              🔥 {entry.bestWinStreak}
                            </td>
                          </tr>
                        );
                      })}

                      {/* IF PLAYER IS RANKED BEYOND TOP 100 (> 100), APPEND THEIR INDIVIDUAL RANK ROW */}
                      {myStanding.rank !== null &&
                        myStanding.rank > 100 &&
                        myStanding.entry !== null && (
                          <>
                            <tr className="bg-slate-950/90">
                              <td
                                colSpan={6}
                                className="py-2 px-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-500"
                              >
                                ••• Your Individual Rank (Also Displayed on Your Profile) •••
                              </td>
                            </tr>
                            <tr className="bg-amber-400/15 border-t border-amber-400/40">
                              <td className="py-3.5 px-4 font-black text-amber-300">
                                #{myStanding.rank}
                              </td>
                              <td className="py-3.5 px-4 font-black text-white">
                                {myStanding.entry.name}{' '}
                                <span className="ml-1.5 text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                                  You
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right font-black text-amber-300">
                                {myStanding.entry.bestScore}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                                {myStanding.entry.bestClearTimeMs !== null
                                  ? `${(myStanding.entry.bestClearTimeMs / 1000).toFixed(1)}s`
                                  : '--'}
                              </td>
                              <td className="py-3.5 px-4 text-right font-bold text-white hidden sm:table-cell">
                                {myStanding.entry.boardsCleared}
                              </td>
                              <td className="py-3.5 px-4 text-right font-bold text-orange-300 hidden md:table-cell">
                                🔥 {myStanding.entry.bestWinStreak}
                              </td>
                            </tr>
                          </>
                        )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TAB 3: COMPLETE SEARCHABLE JARGON & VOCABULARY BANK */
          <div className="space-y-5 animate-fade-in">
            <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">
                    📚 Banking Awareness Jargon &amp; Editorial Vocabulary Deck
                  </h2>
                  <p className="text-xs text-slate-400">
                    Browse all {allPairs.length} curated RBI/Banking terms, Editorial meanings, Synonyms &amp; Antonyms, or save any card to your Vault.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startRound(mode)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shrink-0"
                >
                  🎮 Launch 4×4 Game
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  placeholder="Search Repo Rate, Haircut, CAMELS, Sanguine, Pragmatic..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-white/[0.1] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
                <div className="flex flex-wrap gap-1.5">
                  {(['ALL', 'JARGON', 'DEFINITION', 'SYNONYM', 'ANTONYM'] as const).map(
                    (rel) => (
                      <button
                        key={rel}
                        type="button"
                        onClick={() => setBankFilter(rel)}
                        className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition cursor-pointer ${
                          bankFilter === rel
                            ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                            : 'bg-slate-950 border-white/[0.07] text-slate-400 hover:text-white'
                        }`}
                      >
                        {rel === 'ALL' ? 'All' : rel}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredBankPairs.map((pair) => {
                const isSaved = bookmarkedIds.has(`wm_${pair.id}`);
                const isMastered = stats.masteredPairIds.includes(pair.id);
                return (
                  <div
                    key={pair.id}
                    className="bg-slate-900/80 border border-white/[0.07] rounded-2xl p-4 space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-amber-300">{pair.term}</span>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {pair.relation}
                          </span>
                          {isMastered && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                              ✓ Cleared
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSavePairToVault(pair)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                            isSaved
                              ? 'bg-amber-400/20 border-amber-400/40 text-amber-300'
                              : 'bg-slate-950 hover:bg-slate-800 border-white/[0.08] text-slate-300'
                          }`}
                        >
                          {isSaved ? '🔖 Saved' : '+ Vault'}
                        </button>
                      </div>
                      <p className="text-xs font-bold text-white leading-snug">↔ {pair.match}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        💡 {pair.examNote}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function WordMatrixPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-3xl animate-bounce">🧩</div>
            <p className="text-xs font-bold text-slate-400">Loading 4×4 Word Matrix Arena…</p>
          </div>
        </div>
      }
    >
      <WordMatrixContent />
    </Suspense>
  );
}

