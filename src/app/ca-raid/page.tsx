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
import { supabase } from '@/lib/supabase';
import ThemeToggle from '@/components/ThemeToggle';
import {
  HeadToHeadIncomingBanner,
  HeadToHeadLiveTargetBar,
  HeadToHeadSharePanel,
  HeadToHeadVerdictBanner,
} from '@/components/HeadToHeadChallengeCard';
import {
  decodeChallengeToken,
  evaluateCaRaidDuel,
  getSavedChallengerName,
  saveChallengerName,
  type CaRaidChallengePayload,
} from '@/lib/headToHeadChallenge';
import {
  getNotebookItems,
  recordMistakeQuestions,
  toggleBookmarkQuestion,
} from '@/lib/notebook';
import {
  BASE_HIT_DAMAGE,
  createInitialCommunityState,
  DEFAULT_DAILY_COMMUNITY_BOSS_HP,
  DEFAULT_PERFECT_TIME_LIMIT_SEC,
  downloadOnePageRevisionPdf,
  fetchBossFightCatalog,
  fetchBossFightEdition,
  formatDateChipLabel,
  formatMonthKeyLabel,
  getOrCreateVisitorRaiderId,
  getServerPlayerRaidStatsSnapshot,
  loadPlayerRaidStats,
  makeRaidEditionId,
  RAID_MONTH_SHORT,
  recordCommunityBossDamage,
  recordPlayerRaidCompletion,
  STREAK_CRIT_BONUS_DAMAGE,
  subscribePlayerRaidStats,
  syncCommunityRaidState,
  type BossFightEdition,
  type BossFightIndexItem,
  type CommunityRaidState,
  type PerfectRaidBadge,
  type RaidQuestion,
  type RaidScope,
} from '@/lib/caRaid';

type RaidTab = 'arena' | 'news' | 'summary' | 'badges';
type BattlePhase = 'lobby' | 'battling' | 'victory';

interface DamagePopup {
  id: number;
  amount: number;
  isCrit: boolean;
  isMiss: boolean;
}

function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function CaBossRaidContent() {
  const searchParams = useSearchParams();
  const challengeTokenParam = searchParams.get('c');

  const incomingChallenge = useMemo<CaRaidChallengePayload | null>(() => {
    const decoded = decodeChallengeToken(challengeTokenParam, 'ca_raid');
    return decoded && decoded.arena === 'ca_raid' ? decoded : null;
  }, [challengeTokenParam]);

  const [dismissedChallengeToken, setDismissedChallengeToken] = useState<string | null>(null);
  const [acceptedChallenge, setAcceptedChallenge] = useState<CaRaidChallengePayload | null>(null);

  const pendingChallenge =
    incomingChallenge &&
    challengeTokenParam !== dismissedChallengeToken &&
    !acceptedChallenge
      ? incomingChallenge
      : null;

  const initialRaidParam = searchParams.get('raid') || incomingChallenge?.raidId || '';
  const initialDateParam = searchParams.get('date') || '';
  const initialMonthParam = searchParams.get('month') || '';
  const initialTabParam = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<RaidTab>(
    initialTabParam === 'badges'
      ? 'badges'
      : initialTabParam === 'summary'
      ? 'summary'
      : initialTabParam === 'news'
      ? 'news'
      : 'arena'
  );

  // Selection Bar States (Year, Month, Scope, Specific Date)
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonthNum, setSelectedMonthNum] = useState<string>('11');
  const [selectedScope, setSelectedScope] = useState<RaidScope>('DATE');
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-02');

  // Catalog & Active Edition
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingEdition, setLoadingEdition] = useState(false);
  const [catalog, setCatalog] = useState<BossFightIndexItem[]>([]);
  const [activeEdition, setActiveEdition] = useState<BossFightEdition | null>(null);
  const [communityState, setCommunityState] = useState<CommunityRaidState>(() =>
    createInitialCommunityState('date_2026-11-02', DEFAULT_DAILY_COMMUNITY_BOSS_HP)
  );
  const [syncingHp, setSyncingHp] = useState(false);

  // User Identity
  const [raiderName, setRaiderName] = useState('Aspirant Raider');
  const [visitorId, setVisitorId] = useState('anon_raider');

  // Persistent Player Stats & Perfect Badges
  const playerStats = useSyncExternalStore(
    subscribePlayerRaidStats,
    loadPlayerRaidStats,
    getServerPlayerRaidStatsSnapshot
  );

  // Battle State
  const [phase, setPhase] = useState<BattlePhase>('lobby');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [lockedCurrent, setLockedCurrent] = useState(false);
  const [personalDamage, setPersonalDamage] = useState(0);
  const [comboStreak, setComboStreak] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalTimeMs, setFinalTimeMs] = useState(0);
  const [earnedBadgeThisRun, setEarnedBadgeThisRun] = useState<PerfectRaidBadge | null>(null);

  // Boss Hit FX & Vault Bookmarks
  const [bossShakeKey, setBossShakeKey] = useState(0);
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});

  const battleStartMsRef = useRef<number>(0);
  const popupCounterRef = useRef<number>(1);

  // Load user session & bookmark map on mount
  useEffect(() => {
    let cancelled = false;
    async function initUser() {
      const vid = getOrCreateVisitorRaiderId();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      let resolvedName = getSavedChallengerName('Aspirant Raider');
      let resolvedId = vid;

      if (session?.user) {
        resolvedId = session.user.id;
        const { data: prof } = await supabase
          .from('profiles')
          .select('student_name, full_name')
          .eq('id', session.user.id)
          .maybeSingle();
        resolvedName =
          prof?.student_name ||
          prof?.full_name ||
          session.user.user_metadata?.full_name ||
          session.user.email?.split('@')[0] ||
          'Aspirant Raider';
      }

      const nbItems = getNotebookItems();
      const bMap: Record<string, boolean> = {};
      nbItems.forEach((it) => {
        if (it.isBookmarked) bMap[it.id] = true;
      });

      if (!cancelled) {
        setVisitorId(resolvedId);
        setRaiderName(resolvedName);
        setBookmarkedMap(bMap);
      }
    }
    void initUser();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load Admin-Published Boss Fights Catalog on mount & determine initial Date/Month
  useEffect(() => {
    let cancelled = false;
    async function initCatalog() {
      setLoadingCatalog(true);
      const todayIso = new Date().toISOString().slice(0, 10);
      const list = await fetchBossFightCatalog();
      if (cancelled) return;

      setCatalog(list);

      // Resolve initial selection priority: URL ?raid -> URL ?month -> URL ?date -> Latest published item -> Today
      if (initialRaidParam) {
        if (initialRaidParam.startsWith('month_')) {
          const mKey = initialRaidParam.replace('month_', '').slice(0, 7);
          setSelectedScope('MONTH');
          setSelectedYear(mKey.slice(0, 4));
          setSelectedMonthNum(mKey.slice(5, 7));
        } else {
          const dKey = initialRaidParam.replace('date_', '').slice(0, 10);
          setSelectedScope('DATE');
          setSelectedDate(dKey);
          setSelectedYear(dKey.slice(0, 4));
          setSelectedMonthNum(dKey.slice(5, 7));
        }
      } else if (initialMonthParam && initialMonthParam.length >= 7) {
        const mKey = initialMonthParam.slice(0, 7);
        setSelectedScope('MONTH');
        setSelectedYear(mKey.slice(0, 4));
        setSelectedMonthNum(mKey.slice(5, 7));
      } else if (initialDateParam && initialDateParam.length >= 10) {
        const dKey = initialDateParam.slice(0, 10);
        setSelectedScope('DATE');
        setSelectedDate(dKey);
        setSelectedYear(dKey.slice(0, 4));
        setSelectedMonthNum(dKey.slice(5, 7));
      } else if (list.length > 0) {
        const first = list[0];
        setSelectedScope(first.scope);
        setSelectedYear(first.year);
        setSelectedMonthNum(first.monthKey.slice(5, 7));
        if (first.scope === 'DATE') {
          setSelectedDate(first.dateKey);
        } else {
          setSelectedDate(`${first.monthKey}-01`);
        }
      } else {
        setSelectedScope('DATE');
        setSelectedDate(todayIso);
        setSelectedYear(todayIso.slice(0, 4));
        setSelectedMonthNum(todayIso.slice(5, 7));
      }

      setLoadingCatalog(false);
    }
    void initCatalog();
    return () => {
      cancelled = true;
    };
  }, [initialDateParam, initialMonthParam, initialRaidParam]);

  // Derived active Raid ID from Selection Bar
  const activeMonthKey = `${selectedYear}-${selectedMonthNum}`;
  const targetRaidId = useMemo(() => {
    if (selectedScope === 'MONTH') {
      return makeRaidEditionId('MONTH', activeMonthKey);
    }
    return makeRaidEditionId('DATE', selectedDate);
  }, [activeMonthKey, selectedDate, selectedScope]);

  // Load selected Boss Fight Edition whenever `targetRaidId` changes
  useEffect(() => {
    if (loadingCatalog) return;
    let cancelled = false;
    async function loadSelectedEdition() {
      setLoadingEdition(true);
      const edition = await fetchBossFightEdition(targetRaidId);
      if (cancelled) return;

      if (edition) {
        const comm = await syncCommunityRaidState(edition.id, edition.communityMaxHp);
        if (cancelled) return;
        setActiveEdition(edition);
        setCommunityState(comm);
      } else {
        setActiveEdition(null);
      }
      setPhase('lobby');
      setLoadingEdition(false);
    }
    void loadSelectedEdition();
    return () => {
      cancelled = true;
    };
  }, [loadingCatalog, targetRaidId]);

  // Live Community HP background sync every 20s when an edition is loaded
  useEffect(() => {
    if (!activeEdition) return;
    const rid = activeEdition.id;
    const maxHp = activeEdition.communityMaxHp;
    const interval = setInterval(() => {
      void syncCommunityRaidState(rid, maxHp).then((fresh) => {
        setCommunityState(fresh);
      });
    }, 20_000);
    return () => clearInterval(interval);
  }, [activeEdition]);

  // Battle Stopwatch Timer
  useEffect(() => {
    if (phase !== 'battling') return;
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - battleStartMsRef.current);
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  // Selection Bar Helper Computations
  const availableYears = useMemo(() => {
    const yrs = new Set<string>(['2025', '2026', '2027']);
    catalog.forEach((it) => yrs.add(it.year));
    return Array.from(yrs).sort((a, b) => b.localeCompare(a));
  }, [catalog]);

  const monthCountsForSelectedYear = useMemo(() => {
    const map: Record<string, number> = {};
    catalog.forEach((it) => {
      if (it.year === selectedYear) {
        const m = it.monthKey.slice(5, 7);
        map[m] = (map[m] || 0) + 1;
      }
    });
    return map;
  }, [catalog, selectedYear]);

  const monthEditionForActiveMonth = useMemo(
    () =>
      catalog.find((it) => it.scope === 'MONTH' && it.monthKey === activeMonthKey) || null,
    [activeMonthKey, catalog]
  );

  const dateEditionsForActiveMonth = useMemo(
    () =>
      catalog
        .filter((it) => it.scope === 'DATE' && it.monthKey === activeMonthKey)
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    [activeMonthKey, catalog]
  );

  const handleSelectYear = (yr: string) => {
    if (phase === 'battling') return;
    setSelectedYear(yr);
    const raidsInYearMonth = catalog.filter(
      (it) => it.year === yr && it.monthKey.slice(5, 7) === selectedMonthNum
    );
    if (raidsInYearMonth.length > 0) {
      const first = raidsInYearMonth[0];
      setSelectedScope(first.scope);
      if (first.scope === 'DATE') setSelectedDate(first.dateKey);
    } else {
      setSelectedDate(`${yr}-${selectedMonthNum}-01`);
    }
  };

  const handleSelectMonth = (monthNumStr: string) => {
    if (phase === 'battling') return;
    setSelectedMonthNum(monthNumStr);
    const mKey = `${selectedYear}-${monthNumStr}`;
    const datesInMonth = catalog
      .filter((it) => it.scope === 'DATE' && it.monthKey === mKey)
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    const monthlyRaid = catalog.find(
      (it) => it.scope === 'MONTH' && it.monthKey === mKey
    );

    if (datesInMonth.length > 0) {
      setSelectedScope('DATE');
      setSelectedDate(datesInMonth[0].dateKey);
    } else if (monthlyRaid) {
      setSelectedScope('MONTH');
    } else {
      setSelectedScope('DATE');
      setSelectedDate(`${mKey}-01`);
    }
  };

  const handlePickSpecificDate = (dateIso: string) => {
    if (phase === 'battling' || !dateIso) return;
    setSelectedScope('DATE');
    setSelectedDate(dateIso);
    setSelectedYear(dateIso.slice(0, 4));
    setSelectedMonthNum(dateIso.slice(5, 7));
  };

  const handlePickMonthlyBoss = () => {
    if (phase === 'battling') return;
    setSelectedScope('MONTH');
  };

  const handleManualSyncHp = async () => {
    if (!activeEdition || syncingHp) return;
    setSyncingHp(true);
    const fresh = await syncCommunityRaidState(
      activeEdition.id,
      activeEdition.communityMaxHp
    );
    setCommunityState(fresh);
    setSyncingHp(false);
  };

  const handleStartRaid = () => {
    if (!activeEdition || activeEdition.questions.length === 0) return;
    battleStartMsRef.current = Date.now();
    setCurrentIndex(0);
    setSelectedAnswers({});
    setLockedCurrent(false);
    setPersonalDamage(0);
    setComboStreak(0);
    setBestCombo(0);
    setElapsedMs(0);
    setFinalTimeMs(0);
    setEarnedBadgeThisRun(null);
    setDamagePopups([]);
    setActiveTab('arena');
    setPhase('battling');
  };

  const handleAcceptRaidChallenge = (challenge: CaRaidChallengePayload) => {
    setAcceptedChallenge(challenge);
    if (activeEdition && activeEdition.id === challenge.raidId) {
      handleStartRaid();
      return;
    }
    if (challenge.raidId.startsWith('month_')) {
      const mKey = challenge.raidId.replace('month_', '').slice(0, 7);
      setSelectedScope('MONTH');
      setSelectedYear(mKey.slice(0, 4));
      setSelectedMonthNum(mKey.slice(5, 7));
      setSelectedDate(`${mKey}-01`);
    } else if (challenge.raidId.startsWith('date_')) {
      const dKey = challenge.raidId.replace('date_', '').slice(0, 10);
      setSelectedScope('DATE');
      setSelectedYear(dKey.slice(0, 4));
      setSelectedMonthNum(dKey.slice(5, 7));
      setSelectedDate(dKey);
    }
  };

  const triggerDamagePopup = useCallback(
    (amount: number, isCrit: boolean, isMiss: boolean) => {
      const id = popupCounterRef.current++;
      setDamagePopups((prev) => [...prev.slice(-3), { id, amount, isCrit, isMiss }]);
      setTimeout(() => {
        setDamagePopups((prev) => prev.filter((p) => p.id !== id));
      }, 1100);
    },
    []
  );

  const handleSelectOption = useCallback(
    async (optIdx: number) => {
      if (phase !== 'battling' || lockedCurrent || !activeEdition) return;
      const question = activeEdition.questions[currentIndex];
      if (!question) return;

      setLockedCurrent(true);
      setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: optIdx }));

      const isCorrect = optIdx === question.correctOptionIndex;

      if (isCorrect) {
        const nextStreak = comboStreak + 1;
        const isCrit = nextStreak >= 3;
        const hitDamage = BASE_HIT_DAMAGE + (isCrit ? STREAK_CRIT_BONUS_DAMAGE : 0);

        setComboStreak(nextStreak);
        setBestCombo((prev) => Math.max(prev, nextStreak));
        setPersonalDamage((prev) => prev + hitDamage);
        setBossShakeKey((k) => k + 1);
        triggerDamagePopup(hitDamage, isCrit, false);

        setCommunityState((prev) => {
          const nextTotalDmg = prev.totalDamageDealt + hitDamage;
          const nextHp = Math.max(0, prev.maxHp - nextTotalDmg);
          return {
            ...prev,
            totalDamageDealt: nextTotalDmg,
            currentHp: nextHp,
            defeatedAt:
              nextHp === 0 ? prev.defeatedAt || new Date().toISOString() : null,
          };
        });

        const synced = await recordCommunityBossDamage({
          raidId: activeEdition.id,
          expectedMaxHp: activeEdition.communityMaxHp,
          damage: hitDamage,
          visitorId,
          raiderName,
        });
        setCommunityState(synced);
      } else {
        setComboStreak(0);
        triggerDamagePopup(0, false, true);
      }
    },
    [
      activeEdition,
      comboStreak,
      currentIndex,
      lockedCurrent,
      phase,
      raiderName,
      triggerDamagePopup,
      visitorId,
    ]
  );

  const finishRaidBattle = useCallback(
    (finalAnswers: Record<number, number>, finalPersonalDmg: number) => {
      if (!activeEdition) return;
      const durationMs = Math.max(1000, Date.now() - battleStartMsRef.current);
      setFinalTimeMs(durationMs);

      let correctCount = 0;
      const wrongForVault: {
        id: string;
        sourceType: 'GA_QUIZ';
        sourceId: string;
        sourceTitle: string;
        section: string;
        questionText: string;
        options: string[];
        correctOptionIndex: number;
        userSelectedOption?: number;
        explanation?: string;
      }[] = [];

      activeEdition.questions.forEach((q, idx) => {
        const chosen = finalAnswers[idx];
        if (chosen === q.correctOptionIndex) {
          correctCount++;
        } else {
          wrongForVault.push({
            id: `ca_raid_${activeEdition.id}_${q.id}`,
            sourceType: 'GA_QUIZ',
            sourceId: activeEdition.id,
            sourceTitle: activeEdition.title,
            section: 'GA',
            questionText: q.questionText,
            options: q.options,
            correctOptionIndex: q.correctOptionIndex,
            userSelectedOption: chosen,
            explanation: q.explanation,
          });
        }
      });

      if (wrongForVault.length > 0) {
        recordMistakeQuestions(wrongForVault);
      }

      const perfectLimitMs =
        (activeEdition.perfectTimeLimitSec || DEFAULT_PERFECT_TIME_LIMIT_SEC) * 1000;

      const completion = recordPlayerRaidCompletion({
        raidId: activeEdition.id,
        scope: activeEdition.scope,
        dateKey: activeEdition.dateKey,
        bossName: activeEdition.bossName,
        editionTitle: activeEdition.title,
        score: correctCount,
        totalQuestions: activeEdition.questions.length,
        damageDealt: finalPersonalDmg,
        timeTakenMs: durationMs,
        perfectLimitMs,
      });

      setEarnedBadgeThisRun(completion.newlyEarnedBadge);
      setPhase('victory');
    },
    [activeEdition]
  );

  const handleNextQuestion = useCallback(() => {
    if (!activeEdition || !lockedCurrent) return;
    if (currentIndex + 1 < activeEdition.questions.length) {
      setCurrentIndex((i) => i + 1);
      setLockedCurrent(false);
    } else {
      finishRaidBattle(selectedAnswers, personalDamage);
    }
  }, [
    activeEdition,
    currentIndex,
    finishRaidBattle,
    lockedCurrent,
    personalDamage,
    selectedAnswers,
  ]);

  // Keyboard shortcuts during battle
  useEffect(() => {
    if (phase !== 'battling' || !activeEdition) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const q = activeEdition.questions[currentIndex];
      if (!q) return;

      if (!lockedCurrent) {
        const key = e.key.toUpperCase();
        if (key >= '1' && key <= '5') {
          const idx = Number(key) - 1;
          if (idx < q.options.length) void handleSelectOption(idx);
        } else if (key >= 'A' && key <= 'E') {
          const idx = key.charCodeAt(0) - 65;
          if (idx < q.options.length) void handleSelectOption(idx);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleNextQuestion();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeEdition,
    currentIndex,
    handleNextQuestion,
    handleSelectOption,
    lockedCurrent,
    phase,
  ]);

  const handleToggleVaultBookmark = (q: RaidQuestion, qIdx: number) => {
    if (!activeEdition) return;
    const vaultId = `ca_raid_${activeEdition.id}_${q.id}`;
    const { isNowBookmarked } = toggleBookmarkQuestion({
      id: vaultId,
      sourceType: 'GA_QUIZ',
      sourceId: activeEdition.id,
      sourceTitle: activeEdition.title,
      section: 'GA',
      questionText: q.questionText,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      userSelectedOption: selectedAnswers[qIdx],
      explanation: q.explanation,
    });
    setBookmarkedMap((prev) => ({ ...prev, [vaultId]: isNowBookmarked }));
  };

  // Derived Battle Metrics
  const isBossDefeated = communityState.currentHp <= 0;
  const communityHpPct =
    communityState.maxHp > 0
      ? Math.max(0, Math.min(100, (communityState.currentHp / communityState.maxHp) * 100))
      : 0;
  const communityDrainedPct = Math.round(100 - communityHpPct);

  const totalQCount = activeEdition?.questions.length || 10;
  const personalQuotaMax = totalQCount * BASE_HIT_DAMAGE;
  const personalBossRemainingHp = Math.max(0, personalQuotaMax - personalDamage);
  const personalBossHpPct =
    personalQuotaMax > 0
      ? Math.max(0, Math.min(100, (personalBossRemainingHp / personalQuotaMax) * 100))
      : 100;

  const perfectLimitMs =
    ((activeEdition?.perfectTimeLimitSec || DEFAULT_PERFECT_TIME_LIMIT_SEC) * 1000);
  const currentQuestion = activeEdition?.questions[currentIndex] || null;
  const correctSoFar = activeEdition
    ? activeEdition.questions.reduce(
        (acc, q, idx) => (selectedAnswers[idx] === q.correctOptionIndex ? acc + 1 : acc),
        0
      )
    : 0;
  const answeredCount = Object.keys(selectedAnswers).length;
  const stillOnPerfectTrack =
    correctSoFar === answeredCount && elapsedMs <= perfectLimitMs;
  const speedTimeRemainingMs = Math.max(0, perfectLimitMs - elapsedMs);

  const raidAttempt = activeEdition
    ? playerStats.attemptsByRaidId[activeEdition.id]
    : undefined;

  const activeRaidChallenge =
    acceptedChallenge && activeEdition && acceptedChallenge.raidId === activeEdition.id
      ? acceptedChallenge
      : null;

  const duelOutcome = useMemo(() => {
    if (!activeRaidChallenge || phase !== 'victory') return null;
    return evaluateCaRaidDuel(
      activeRaidChallenge,
      correctSoFar,
      personalDamage,
      finalTimeMs
    );
  }, [activeRaidChallenge, correctSoFar, finalTimeMs, personalDamage, phase]);

  const raidSharePayload = useMemo<CaRaidChallengePayload | null>(() => {
    if (!activeEdition) return null;
    return {
      arena: 'ca_raid',
      challenger: raiderName,
      score: correctSoFar,
      totalQuestions: activeEdition.questions.length,
      damage: personalDamage,
      timeMs: finalTimeMs,
      raidId: activeEdition.id,
      bossName: activeEdition.bossName,
    };
  }, [activeEdition, correctSoFar, finalTimeMs, personalDamage, raiderName]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans relative overflow-x-hidden selection:bg-amber-400 selection:text-slate-950">
      {/* Ambient Raid Glows */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[920px] h-[380px] bg-gradient-to-r from-rose-600/15 via-amber-500/12 to-purple-600/15 blur-[145px] rounded-full z-0" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-[520px] h-[360px] bg-emerald-500/8 blur-[140px] rounded-full z-0" />

      {/* TOP NAVIGATION HEADER */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/bsca"
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5"
            >
              <span>←</span>
              <span className="hidden sm:inline">BSCA Hub</span>
            </Link>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 via-amber-500 to-orange-500 text-slate-950 font-black text-base flex items-center justify-center shadow-lg shadow-rose-500/20">
                ⚔️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-black text-white tracking-tight">
                    Current Affairs Raid
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    The CA Boss Fight
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 hidden sm:block">
                  Date-Wise &amp; Month-Wise Boss Raids • Community HP • Perfect Speed Badges
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('badges')}
              className="px-3 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>🏅</span>
              <span>{playerStats.perfectBadges.length} Badges</span>
            </button>

            <ThemeToggle variant="switch" />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* ================================================================= */}
        {/* DATE & MONTH SELECTION BAR FOR SPECIFIC DATE / MONTH BOSS FIGHT   */}
        {/* ================================================================= */}
        <section className="bg-slate-900/85 backdrop-blur-xl border border-white/[0.09] rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
          {/* Row 1: Title + Year Selector + Quick Calendar Date Picker */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span>🗓️</span>
                <span>Select Date or Month Boss Fight:</span>
              </span>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/[0.08]">
                {availableYears.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    disabled={phase === 'battling'}
                    onClick={() => handleSelectYear(yr)}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer disabled:opacity-50 ${
                      selectedYear === yr
                        ? 'bg-amber-400 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Date Input Picker */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-1.5">
                <span className="text-[11px] font-bold text-slate-400">📅 Jump to Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  disabled={phase === 'battling'}
                  onChange={(e) => handlePickSpecificDate(e.target.value)}
                  className="bg-transparent text-xs font-black text-amber-300 outline-none cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Row 2: 12-Month Horizontal Selection Bar */}
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
            {RAID_MONTH_SHORT.map((mLabel, idx) => {
              const mNum = String(idx + 1).padStart(2, '0');
              const isSelectedMonth = selectedMonthNum === mNum;
              const count = monthCountsForSelectedYear[mNum] || 0;

              return (
                <button
                  key={mNum}
                  type="button"
                  disabled={phase === 'battling'}
                  onClick={() => handleSelectMonth(mNum)}
                  className={`px-2 py-2 rounded-xl text-xs font-black border transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
                    isSelectedMonth
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 border-amber-400 shadow-md'
                      : count > 0
                      ? 'bg-slate-950 hover:bg-slate-800 text-white border-amber-400/35'
                      : 'bg-slate-950/60 hover:bg-slate-900 text-slate-400 border-white/[0.06]'
                  }`}
                >
                  <span>{mLabel}</span>
                  {count > 0 && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                        isSelectedMonth
                          ? 'bg-slate-950 text-amber-300'
                          : 'bg-amber-400/20 text-amber-300'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Row 3: Monthly Boss Fight Toggle + Published Specific Dates in Selected Month */}
          <div className="pt-2 border-t border-white/[0.08] flex flex-wrap items-center gap-2">
            {/* Monthly Boss Fight Pill */}
            <button
              type="button"
              disabled={phase === 'battling'}
              onClick={handlePickMonthlyBoss}
              className={`px-3.5 py-2 rounded-xl text-xs font-black border transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                selectedScope === 'MONTH'
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 border-rose-400 shadow-md'
                  : monthEditionForActiveMonth
                  ? 'bg-rose-950/40 hover:bg-rose-900/50 text-rose-200 border-rose-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-white border-white/[0.08]'
              }`}
            >
              <span>👑</span>
              <span>{formatMonthKeyLabel(activeMonthKey)} Month Boss Fight</span>
              {monthEditionForActiveMonth && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/30 text-amber-200">
                  {monthEditionForActiveMonth.questionCount} Qs
                </span>
              )}
            </button>

            <span className="text-slate-600 text-xs hidden sm:inline">|</span>

            {/* Specific Date Boss Fight Pills in This Month */}
            {dateEditionsForActiveMonth.length > 0 ? (
              dateEditionsForActiveMonth.map((dItem) => {
                const isSelectedDate =
                  selectedScope === 'DATE' && selectedDate === dItem.dateKey;
                return (
                  <button
                    key={dItem.id}
                    type="button"
                    disabled={phase === 'battling'}
                    onClick={() => handlePickSpecificDate(dItem.dateKey)}
                    className={`px-3 py-2 rounded-xl text-xs font-black border transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      isSelectedDate
                        ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md'
                        : 'bg-slate-950 hover:bg-slate-900 text-slate-200 border-white/[0.1]'
                    }`}
                  >
                    <span>⚔️</span>
                    <span>{formatDateChipLabel(dItem.dateKey)}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded ${
                        isSelectedDate
                          ? 'bg-slate-950 text-amber-300'
                          : 'bg-white/[0.07] text-slate-400'
                      }`}
                    >
                      {dItem.questionCount}Q
                    </span>
                  </button>
                );
              })
            ) : (
              <span className="text-[11px] text-slate-400 pl-1">
                No date-wise Boss Fights published in {formatMonthKeyLabel(activeMonthKey)} yet.
              </span>
            )}
          </div>
        </section>

        {/* LOADING OR EMPTY EDITION STATE */}
        {loadingCatalog || loadingEdition ? (
          <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-12 text-center space-y-3">
            <div className="text-4xl animate-bounce">⚔️</div>
            <h2 className="text-lg font-black text-white">Summoning Boss Arena…</h2>
            <p className="text-xs text-slate-400">
              Loading Boss Fight News &amp; Questions…
            </p>
          </div>
        ) : !activeEdition ? (
          <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-10 sm:p-12 text-center space-y-5 shadow-xl">
            <div className="w-20 h-20 rounded-3xl bg-slate-950 border border-white/[0.08] flex items-center justify-center text-4xl mx-auto">
              🛡️
            </div>
            <div className="space-y-1.5 max-w-lg mx-auto">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-400/15 text-amber-300 border border-amber-400/30">
                {selectedScope === 'MONTH'
                  ? `Month: ${formatMonthKeyLabel(activeMonthKey)}`
                  : `Date: ${selectedDate}`}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white pt-1">
                No Boss Fight Published for{' '}
                {selectedScope === 'MONTH'
                  ? formatMonthKeyLabel(activeMonthKey)
                  : selectedDate}{' '}
                Yet
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Select any highlighted Month or Date pill in the bar above to enter an active
                Current Affairs Boss Fight!
              </p>
            </div>

            {catalog.length > 0 && (
              <div className="pt-2 space-y-2.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                  🔥 Available Boss Fights Ready to Challenge:
                </span>
                <div className="flex flex-wrap justify-center gap-2">
                  {catalog.slice(0, 8).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedYear(item.year);
                        setSelectedMonthNum(item.monthKey.slice(5, 7));
                        setSelectedScope(item.scope);
                        if (item.scope === 'DATE') setSelectedDate(item.dateKey);
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500/20 to-amber-500/20 hover:from-rose-500/30 hover:to-amber-500/30 border border-amber-400/35 text-xs font-black text-amber-200 transition cursor-pointer"
                    >
                      {item.bossAvatar}{' '}
                      {item.scope === 'MONTH'
                        ? `${formatMonthKeyLabel(item.monthKey)} (Month)`
                        : item.dateKey}{' '}
                      • {item.questionCount} Qs
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ================================================================= */}
            {/* GLOBAL COMMUNITY BOSS PROGRESS BAR & 1-PAGE PDF UNLOCK BANNER     */}
            {/* ================================================================= */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-rose-950/25 border border-rose-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div
                    key={`hero_${bossShakeKey}`}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border flex items-center justify-center text-4xl sm:text-5xl shrink-0 shadow-xl ${
                      isBossDefeated
                        ? 'bg-emerald-500/15 border-emerald-400/40 grayscale'
                        : 'bg-gradient-to-br from-rose-500/20 via-amber-500/15 to-slate-900 border-rose-500/40 animate-boss-float'
                    }`}
                  >
                    {isBossDefeated ? '💀' : activeEdition.bossAvatar}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          isBossDefeated
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {isBossDefeated
                          ? '🔓 COMMUNITY BOSS DEFEATED!'
                          : activeEdition.scope === 'MONTH'
                          ? `👑 MONTHLY BOSS • ${formatMonthKeyLabel(activeEdition.monthKey)}`
                          : `👹 DATE BOSS • ${activeEdition.dateKey}`}
                      </span>

                      <span className="text-[11px] font-bold text-amber-300 bg-amber-400/10 border border-amber-400/25 px-2.5 py-0.5 rounded-full">
                        {activeEdition.questions.length} Qs • {activeEdition.newsItems.length}{' '}
                        Curated News
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {activeEdition.bossName}{' '}
                      <span className="text-sm sm:text-base font-bold text-amber-300">
                        — {activeEdition.title}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">{activeEdition.bossSubtitle}</p>
                  </div>
                </div>

                {/* Quick Actions: Read News + Download Unlocked 1-Page Revision PDF */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {activeEdition.newsItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('news')}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.12] text-sky-300 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>📰</span>
                      <span>Read Raid News ({activeEdition.newsItems.length})</span>
                    </button>
                  )}

                  {isBossDefeated ? (
                    <button
                      type="button"
                      onClick={() => downloadOnePageRevisionPdf(activeEdition)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>⬇</span>
                      <span>Download 1-Page Revision PDF</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab('summary')}
                      className="px-4 py-2.5 rounded-xl bg-slate-950/90 border border-amber-400/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 hover:border-amber-400/60 transition cursor-pointer"
                    >
                      <span>🔒</span>
                      <span>
                        1-Page PDF ({communityState.currentHp.toLocaleString()} HP Left)
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* GLOBAL COMMUNITY PROGRESS BAR */}
              <div className="bg-slate-950/85 border border-white/[0.08] rounded-2xl p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span>Global Community Boss HP</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      • ⚔️ <strong className="text-white">{communityState.totalContributors}</strong>{' '}
                      Raiders
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-white">
                      {communityState.currentHp.toLocaleString()}{' '}
                      <span className="text-slate-500">
                        / {communityState.maxHp.toLocaleString()} HP
                      </span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 font-black text-[10px]">
                      {communityDrainedPct}% Drained
                    </span>
                    <button
                      type="button"
                      onClick={handleManualSyncHp}
                      disabled={syncingHp}
                      className="text-[11px] font-bold text-slate-400 hover:text-amber-300 transition cursor-pointer"
                    >
                      {syncingHp ? 'Syncing…' : '🔄 Sync'}
                    </button>
                  </div>
                </div>

                <div className="relative w-full h-4 bg-slate-900 rounded-full overflow-hidden border border-white/[0.08]">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isBossDefeated
                        ? 'bg-emerald-500'
                        : communityHpPct <= 30
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                        : 'bg-gradient-to-r from-rose-600 via-red-500 to-amber-500'
                    }`}
                    style={{ width: `${isBossDefeated ? 100 : communityHpPct}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px]">
                  <span className="text-slate-400">
                    {isBossDefeated
                      ? '🎉 Community Boss Defeated! The 1-Page Revision Summary PDF is unlocked for all visitors!'
                      : `Every correct hit deals ${BASE_HIT_DAMAGE}–${
                          BASE_HIT_DAMAGE + STREAK_CRIT_BONUS_DAMAGE
                        } DMG toward unlocking the 1-Page Revision PDF!`}
                  </span>

                  {communityState.recentHits.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {communityState.recentHits.slice(0, 3).map((hit) => (
                        <span
                          key={hit.id}
                          className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-200 text-[10px] font-bold"
                        >
                          ⚔️ {hit.raiderName}: -{hit.damage} HP
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* SUB-NAVIGATION TABS */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-3">
              {[
                {
                  id: 'arena' as const,
                  label: `⚔️ Boss Fight Arena (${activeEdition.questions.length} Qs)`,
                  badge: `${Math.round(
                    (activeEdition.perfectTimeLimitSec || DEFAULT_PERFECT_TIME_LIMIT_SEC) / 60
                  )}-Min Target`,
                },
                {
                  id: 'news' as const,
                  label: '📰 Raid Current Affairs News',
                  badge: `${activeEdition.newsItems.length}`,
                },
                {
                  id: 'summary' as const,
                  label: isBossDefeated
                    ? '🔓 1-Page Revision PDF'
                    : '🔒 1-Page Revision PDF',
                  badge: isBossDefeated ? 'Unlocked' : 'Community Goal',
                },
                {
                  id: 'badges' as const,
                  label: '🏅 My Perfect Badges',
                  badge: `${playerStats.perfectBadges.length}`,
                },
              ].map((tab) => {
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 border cursor-pointer ${
                      selected
                        ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/15'
                        : 'bg-slate-900/75 hover:bg-slate-900 text-slate-300 border-white/[0.08]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                        selected
                          ? 'bg-slate-950 text-amber-300'
                          : 'bg-slate-950 text-slate-400 border border-white/[0.08]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ================================================================= */}
            {/* TAB 1: BOSS FIGHT ARENA                                           */}
            {/* ================================================================= */}
            {activeTab === 'arena' && (
              <>
                {phase === 'lobby' && (
                  <div className="space-y-6 animate-fade-in">
                    {pendingChallenge && (
                      <HeadToHeadIncomingBanner
                        challenge={pendingChallenge}
                        acceptButtonLabel={
                          activeEdition.id === pendingChallenge.raidId
                            ? '⚔️ Accept Boss Duel & Start →'
                            : '⚔️ Load Challenged Boss Fight →'
                        }
                        onAccept={() => handleAcceptRaidChallenge(pendingChallenge)}
                        onDismiss={() => setDismissedChallengeToken(challengeTokenParam)}
                      />
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                      <div className="space-y-2">
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-400/15 text-amber-300 border border-amber-400/30">
                          {activeEdition.scope === 'MONTH'
                            ? `👑 Monthly Raid Challenge • ${formatMonthKeyLabel(activeEdition.monthKey)}`
                            : `🎯 Date Raid Challenge • ${activeEdition.dateKey}`}
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                          Challenge {activeEdition.bossName}!
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                          Conquer <strong className="text-amber-300">{activeEdition.questions.length}</strong>{' '}
                          curated Current Affairs questions in{' '}
                          <strong>{activeEdition.title}</strong>.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        <div className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-4 space-y-1.5">
                          <div className="text-2xl">💥</div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider">
                            Boss Damage
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Every correct answer deals <strong className="text-rose-300">100 DMG</strong>{' '}
                            (125 DMG on a 3+ streak) to both Personal &amp; Community Boss HP!
                          </p>
                        </div>

                        <div className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-4 space-y-1.5">
                          <div className="text-2xl">⚡</div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider">
                            Perfect Speed Badge
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Hit{' '}
                            <strong className="text-amber-300">
                              {activeEdition.questions.length}/{activeEdition.questions.length} within{' '}
                              {formatDurationMs(perfectLimitMs)}
                            </strong>{' '}
                            to mint a Perfect Boss Slayer Badge!
                          </p>
                        </div>

                        <div className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-4 space-y-1.5">
                          <div className="text-2xl">📄</div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider">
                            1-Page Revision PDF
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            When Community Boss HP hits <strong className="text-emerald-400">0</strong>,
                            the 1-Page Revision PDF unlocks for everyone!
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={handleStartRaid}
                          className="px-7 py-4 rounded-2xl bg-gradient-to-r from-rose-500 via-amber-500 to-amber-400 hover:from-rose-400 hover:to-amber-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-rose-500/20 transition hover:-translate-y-0.5 cursor-pointer flex items-center gap-2"
                        >
                          <span>⚔️</span>
                          <span>
                            {raidAttempt
                              ? `Strike Again (${activeEdition.questions.length} Qs)`
                              : `Start Boss Fight (${activeEdition.questions.length} Qs)`}
                          </span>
                        </button>

                        {activeEdition.newsItems.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('news')}
                            className="px-5 py-4 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-white/[0.1] text-sky-300 font-bold text-xs transition cursor-pointer"
                          >
                            📰 Read News Notes First ({activeEdition.newsItems.length}) →
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Personal Raid Dossier */}
                    <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-5">
                      <div className="space-y-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                          🛡️ Your Raider Standing ({activeEdition.dateKey})
                        </span>

                        {raidAttempt ? (
                          <div className="space-y-3">
                            <div className="p-4 rounded-2xl bg-slate-950 border border-white/[0.08] flex items-center justify-between">
                              <span className="text-xs text-slate-400 font-bold">Best Score</span>
                              <span className="text-xl font-black text-emerald-400">
                                {raidAttempt.bestScore} / {raidAttempt.totalQuestions}
                              </span>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-950 border border-white/[0.08] flex items-center justify-between">
                              <span className="text-xs text-slate-400 font-bold">Fastest Run</span>
                              <span className="text-base font-black text-amber-300 font-mono">
                                {formatDurationMs(raidAttempt.bestTimeMs)}
                              </span>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-950 border border-white/[0.08] flex items-center justify-between">
                              <span className="text-xs text-slate-400 font-bold">
                                Damage Dealt
                              </span>
                              <span className="text-base font-black text-rose-400">
                                {raidAttempt.totalDamageContributed.toLocaleString()} DMG
                              </span>
                            </div>
                            {raidAttempt.perfectUnderLimit && (
                              <div className="p-3 rounded-2xl bg-amber-400/15 border border-amber-400/35 text-amber-300 text-xs font-black text-center">
                                🏅 Perfect Slayer Badge Earned!
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-5 rounded-2xl bg-slate-950/80 border border-dashed border-white/[0.12] text-center space-y-2">
                            <div className="text-3xl">🗡️</div>
                            <p className="text-xs font-bold text-white">No Strike Recorded Yet</p>
                            <p className="text-[11px] text-slate-400">
                              Enter this Boss Fight to deal damage and compete for the Perfect
                              Slayer Badge!
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
                        <span>Lifetime Boss Damage:</span>
                        <strong className="text-white font-mono">
                          {playerStats.totalDamageDealt.toLocaleString()} DMG
                        </strong>
                      </div>
                    </div>
                  </div>
                  </div>
                )}

                {phase === 'battling' && currentQuestion && (
                  <div className="space-y-5 animate-fade-in">
                    {activeRaidChallenge && (
                      <HeadToHeadLiveTargetBar
                        challengerName={activeRaidChallenge.challenger}
                        currentValue={correctSoFar}
                        targetValue={activeRaidChallenge.score}
                        unitLabel="correct"
                        extraTargetNote={`${activeRaidChallenge.damage.toLocaleString()} DMG in ${formatDurationMs(
                          activeRaidChallenge.timeMs
                        )}`}
                      />
                    )}

                    {/* Battle HUD */}
                    <div className="bg-slate-900/90 border border-white/[0.1] rounded-3xl p-4 sm:p-5 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div className="flex items-center gap-3.5 relative">
                        <div
                          key={`battle_boss_${bossShakeKey}`}
                          className={`w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-3xl shrink-0 ${
                            bossShakeKey > 0 ? 'animate-boss-hit' : ''
                          }`}
                        >
                          {personalBossRemainingHp === 0 ? '💥' : activeEdition.bossAvatar}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-black text-rose-300 truncate">
                              Personal Boss Quota HP
                            </span>
                            <span className="font-mono font-black text-white">
                              {personalBossRemainingHp} / {personalQuotaMax}
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-white/[0.08]">
                            <div
                              className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-300"
                              style={{ width: `${personalBossHpPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Floating Damage Popups */}
                        <div className="pointer-events-none absolute -top-3 left-10 z-20 flex flex-col gap-1">
                          {damagePopups.map((p) => (
                            <span
                              key={p.id}
                              className={`animate-damage-float px-2.5 py-0.5 rounded-full text-xs font-black shadow-lg ${
                                p.isMiss
                                  ? 'bg-slate-800 text-slate-300 border border-white/20'
                                  : p.isCrit
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-rose-500 text-white'
                              }`}
                            >
                              {p.isMiss
                                ? '🛡️ BLOCKED (0 DMG)'
                                : p.isCrit
                                ? `⚡ CRIT -${p.amount} HP!`
                                : `🗡️ -${p.amount} HP!`}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-3">
                        <div className="px-3.5 py-2 rounded-2xl bg-slate-950 border border-white/[0.08] text-center">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Strike
                          </span>
                          <span className="text-sm font-black text-white">
                            {currentIndex + 1} / {activeEdition.questions.length}
                          </span>
                        </div>

                        <div className="px-3.5 py-2 rounded-2xl bg-slate-950 border border-white/[0.08] text-center">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Hits
                          </span>
                          <span className="text-sm font-black text-emerald-400">
                            {correctSoFar} Correct
                          </span>
                        </div>

                        <div
                          className={`px-3.5 py-2 rounded-2xl border text-center transition ${
                            comboStreak >= 3
                              ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                              : 'bg-slate-950 border-white/[0.08] text-slate-300'
                          }`}
                        >
                          <span className="text-[10px] font-bold uppercase block">Combo</span>
                          <span className="text-sm font-black">🔥 {comboStreak}x</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3">
                        <div
                          className={`px-4 py-2 rounded-2xl border text-right ${
                            stillOnPerfectTrack
                              ? 'bg-amber-400/15 border-amber-400/40'
                              : 'bg-slate-950 border-white/[0.08]'
                          }`}
                        >
                          <span className="text-[10px] font-black uppercase tracking-wider block text-amber-300">
                            {stillOnPerfectTrack
                              ? `⚡ Perfect Window (${formatDurationMs(speedTimeRemainingMs)} left)`
                              : '⏱️ Raid Stopwatch'}
                          </span>
                          <span className="text-base font-mono font-black text-white">
                            {formatDurationMs(elapsedMs)}{' '}
                            <span className="text-xs text-slate-400">
                              / {formatDurationMs(perfectLimitMs)}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Question Strike Card */}
                    <div className="bg-slate-900/85 border border-white/[0.09] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-xs">
                            Q{currentIndex + 1}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-white/[0.08] text-[11px] font-bold text-sky-300">
                            {currentQuestion.categoryTag}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">A–E</kbd> to
                          attack
                        </span>
                      </div>

                      <h3 className="text-base sm:text-xl font-black text-white leading-relaxed">
                        {currentQuestion.questionText}
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentQuestion.options.map((opt, oIdx) => {
                          const chosen = selectedAnswers[currentIndex];
                          const isThisChosen = chosen === oIdx;
                          const isThisCorrect = oIdx === currentQuestion.correctOptionIndex;

                          let btnCls =
                            'bg-slate-950/90 hover:bg-slate-900 border-white/[0.1] hover:border-amber-400/50 text-slate-100';
                          if (lockedCurrent) {
                            if (isThisCorrect) {
                              btnCls =
                                'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-500/10';
                            } else if (isThisChosen && !isThisCorrect) {
                              btnCls = 'bg-rose-500/20 border-rose-400 text-rose-200';
                            } else {
                              btnCls = 'bg-slate-950/50 border-white/[0.05] text-slate-500';
                            }
                          }

                          return (
                            <button
                              key={oIdx}
                              type="button"
                              disabled={lockedCurrent}
                              onClick={() => void handleSelectOption(oIdx)}
                              className={`text-left p-4 rounded-2xl border font-bold text-xs sm:text-sm transition flex items-start gap-3 cursor-pointer disabled:cursor-default ${btnCls}`}
                            >
                              <span
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                  lockedCurrent && isThisCorrect
                                    ? 'bg-emerald-400 text-slate-950'
                                    : lockedCurrent && isThisChosen
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-slate-800 text-amber-300'
                                }`}
                              >
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span className="leading-snug pt-0.5">{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {lockedCurrent && (
                        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border border-white/[0.1] flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                          <div className="space-y-1">
                            <span
                              className={`text-xs font-black uppercase tracking-wider block ${
                                selectedAnswers[currentIndex] === currentQuestion.correctOptionIndex
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {selectedAnswers[currentIndex] === currentQuestion.correctOptionIndex
                                ? `⚔️ Direct Hit! Boss took ${
                                    comboStreak >= 3
                                      ? BASE_HIT_DAMAGE + STREAK_CRIT_BONUS_DAMAGE
                                      : BASE_HIT_DAMAGE
                                  } Damage!`
                                : '🛡️ Boss Blocked! Logged to Mistake Vault'}
                            </span>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {currentQuestion.explanation}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={handleNextQuestion}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shrink-0 shadow-lg transition cursor-pointer"
                          >
                            {currentIndex + 1 < activeEdition.questions.length
                              ? 'Next Strike →'
                              : 'Finish Boss Raid →'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {phase === 'victory' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/25 border border-amber-400/35 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-400/35">
                              ⚔️ Raid Complete
                            </span>
                            {correctSoFar === activeEdition.questions.length &&
                              finalTimeMs <= perfectLimitMs && (
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-400 text-slate-950 shadow">
                                  🏅 Perfect Slayer Badge Unlocked!
                                </span>
                              )}
                          </div>

                          <h3 className="text-2xl sm:text-3xl font-black text-white">
                            You Dealt{' '}
                            <span className="text-rose-400">
                              {personalDamage.toLocaleString()} Damage
                            </span>{' '}
                            to {activeEdition.bossName}!
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-300">
                            Score:{' '}
                            <strong className="text-emerald-400">
                              {correctSoFar}/{activeEdition.questions.length}
                            </strong>{' '}
                            • Time:{' '}
                            <strong className="text-amber-300 font-mono">
                              {formatDurationMs(finalTimeMs)}
                            </strong>{' '}
                            • Best Streak: <strong className="text-white">{bestCombo}x</strong>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {isBossDefeated ? (
                            <button
                              type="button"
                              onClick={() => downloadOnePageRevisionPdf(activeEdition)}
                              className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition cursor-pointer"
                            >
                              ⬇ Download Unlocked 1-Page PDF
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleStartRaid}
                              className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition cursor-pointer"
                            >
                              ⚔️ Strike Again ({communityState.currentHp.toLocaleString()} HP Left)
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={handleStartRaid}
                            className="px-4 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-white/[0.12] text-slate-200 font-bold text-xs transition cursor-pointer"
                          >
                            🔄 Replay Raid
                          </button>
                        </div>
                      </div>

                      {earnedBadgeThisRun && (
                        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-400/20 via-amber-500/10 to-slate-950 border border-amber-400/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 flex items-center justify-center text-3xl shadow-lg shrink-0">
                              🏅
                            </div>
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 block">
                                🎉 NEW PERFECT-SCORE BADGE MINTED!
                              </span>
                              <h4 className="text-base sm:text-lg font-black text-white">
                                {earnedBadgeThisRun.tierLabel}
                              </h4>
                              <p className="text-xs text-slate-300">
                                {earnedBadgeThisRun.score}/{earnedBadgeThisRun.totalQuestions}{' '}
                                against {earnedBadgeThisRun.bossName} in{' '}
                                <strong>{formatDurationMs(earnedBadgeThisRun.timeTakenMs)}</strong>!
                              </p>
                            </div>
                          </div>

                          <Link
                            href="/profile"
                            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shrink-0 transition"
                          >
                            View on Profile →
                          </Link>
                        </div>
                      )}
                    </div>

                    {duelOutcome && (
                      <HeadToHeadVerdictBanner
                        outcome={duelOutcome}
                        onRematchSameSeed={handleStartRaid}
                      />
                    )}

                    {raidSharePayload && (
                      <HeadToHeadSharePanel
                        payload={raidSharePayload}
                        onChallengerNameChange={(nextName) => {
                          saveChallengerName(nextName);
                          setRaiderName(nextName);
                        }}
                        conqueredChallenge={duelOutcome}
                      />
                    )}

                    {/* Question Solutions & Vault Bookmarking */}
                    <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                        <h4 className="text-base font-black text-white">
                          📋 Raid Question Breakdown &amp; Solutions
                        </h4>
                        <Link
                          href="/notebook"
                          className="text-xs font-bold text-amber-400 hover:underline"
                        >
                          Open Mistake Vault →
                        </Link>
                      </div>

                      <div className="space-y-3">
                        {activeEdition.questions.map((q, idx) => {
                          const userAns = selectedAnswers[idx];
                          const isRight = userAns === q.correctOptionIndex;
                          const vaultId = `ca_raid_${activeEdition.id}_${q.id}`;
                          const isSaved = Boolean(bookmarkedMap[vaultId]);

                          return (
                            <div
                              key={q.id}
                              className="p-4 rounded-2xl bg-slate-950/80 border border-white/[0.07] space-y-2"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                      isRight
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-rose-500/20 text-rose-300'
                                    }`}
                                  >
                                    Q{idx + 1} • {isRight ? '✓ HIT' : '✕ MISSED'}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400">
                                    {q.categoryTag}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleToggleVaultBookmark(q, idx)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                    isSaved
                                      ? 'bg-amber-400/20 border-amber-400/40 text-amber-300'
                                      : 'bg-slate-900 border-white/[0.08] text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {isSaved ? '★ Saved in Vault' : '+ Save to Vault'}
                                </button>
                              </div>

                              <p className="text-xs sm:text-sm font-bold text-white">
                                {q.questionText}
                              </p>

                              <div className="flex flex-wrap gap-3 text-xs">
                                <span className="text-emerald-400 font-bold">
                                  ✓ Correct: {q.options[q.correctOptionIndex]}
                                </span>
                                {!isRight && userAns !== undefined && (
                                  <span className="text-rose-400 font-semibold">
                                    Your Strike: {q.options[userAns]}
                                  </span>
                                )}
                              </div>

                              <p className="text-[11px] text-slate-400 leading-relaxed">
                                {q.explanation}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ================================================================= */}
            {/* TAB 2: ADMIN-CURATED CURRENT AFFAIRS NEWS                         */}
            {/* ================================================================= */}
            {activeTab === 'news' && (
              <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 block">
                      📰 Curated Raid Study Briefing
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                      {activeEdition.title} — Current Affairs Notes
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartRaid}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition shrink-0 cursor-pointer"
                  >
                    ⚔️ Start Boss Fight ({activeEdition.questions.length} Qs) →
                  </button>
                </div>

                {activeEdition.newsItems.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <div className="text-3xl">📰</div>
                    <p className="text-sm font-bold text-white">
                      No separate News notes attached to this Boss Fight yet.
                    </p>
                    <p className="text-xs text-slate-400">
                      Jump straight into the Boss Fight Arena to solve the questions!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeEdition.newsItems.map((news, idx) => (
                      <article
                        key={news.id}
                        className="p-5 rounded-2xl bg-slate-950/85 border border-white/[0.08] space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-500/15 text-sky-300 border border-sky-500/30">
                            #{idx + 1} • {news.category}
                          </span>
                          {news.keyStat && (
                            <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-black bg-amber-400/15 text-amber-300 border border-amber-400/30">
                              {news.keyStat}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm sm:text-base font-black text-white leading-snug">
                          {news.headline}
                        </h4>
                        <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
                          {news.points.map((pt, pIdx) => (
                            <li key={pIdx} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================= */}
            {/* TAB 3: UNLOCKED 1-PAGE REVISION SUMMARY PDF                       */}
            {/* ================================================================= */}
            {activeTab === 'summary' && (
              <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fade-in">
                {!isBossDefeated ? (
                  <div className="py-10 text-center max-w-xl mx-auto space-y-4">
                    <div className="w-20 h-20 rounded-3xl bg-rose-500/15 border border-rose-500/30 text-4xl flex items-center justify-center mx-auto">
                      🔒
                    </div>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/35 inline-block">
                      Guarded by {activeEdition.bossName}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-white">
                      Drain {communityState.currentHp.toLocaleString()} More Community HP to Unlock
                      the 1-Page Revision PDF!
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                      Every visitor&apos;s correct strike drains <strong className="text-white">100–125 HP</strong>{' '}
                      from the Community Boss. Once HP hits <strong className="text-emerald-400">0</strong>,
                      the downloadable 1-Page Revision PDF unlocks for everyone!
                    </p>
                    <button
                      type="button"
                      onClick={handleStartRaid}
                      className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition cursor-pointer"
                    >
                      ⚔️ Attack the Boss Now →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-400/35">
                          🔓 Community Reward Unlocked
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white mt-1.5">
                          1-Page Revision Summary — {activeEdition.title}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => downloadOnePageRevisionPdf(activeEdition)}
                        className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition flex items-center gap-2 shrink-0 cursor-pointer"
                      >
                        <span>⬇</span>
                        <span>Download 1-Page PDF (.pdf)</span>
                      </button>
                    </div>

                    {activeEdition.newsItems.length > 0 && (
                      <div className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-5 space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                          📰 Key Current Affairs Highlights
                        </h4>
                        <ul className="space-y-2 text-xs text-slate-200 leading-relaxed">
                          {activeEdition.newsItems.map((n, i) => (
                            <li key={n.id}>
                              <strong className="text-amber-300">
                                {i + 1}. [{n.category}] {n.headline}:
                              </strong>{' '}
                              {n.points.join(' • ')}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="bg-slate-950/80 border border-white/[0.07] rounded-2xl p-5 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                        ⚡ Rapid Q&amp;A Revision Checklist
                      </h4>
                      <div className="space-y-2 text-xs">
                        {activeEdition.questions.map((q, idx) => (
                          <div
                            key={q.id}
                            className="p-2.5 rounded-xl bg-slate-900/70 border border-white/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <span className="text-slate-200 font-semibold">
                              Q{idx + 1}. {q.questionText}
                            </span>
                            <span className="text-emerald-400 font-black shrink-0">
                              → {q.options[q.correctOptionIndex]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ================================================================= */}
        {/* TAB 4: PERFECT-SCORE RAID BADGES CABINET (ALWAYS ACCESSIBLE)      */}
        {/* ================================================================= */}
        {activeTab === 'badges' && (
          <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                  ⚡ Speed &amp; Accuracy Hall of Fame
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  My Perfect Boss Slayer Badges
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-2xl bg-slate-950 border border-white/[0.08] text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Raids Played
                  </span>
                  <strong className="text-base font-black text-white">
                    {playerStats.raidsPlayed}
                  </strong>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-slate-950 border border-white/[0.08] text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Fastest Perfect
                  </span>
                  <strong className="text-base font-black text-amber-300 font-mono">
                    {playerStats.fastestPerfectMs !== null
                      ? formatDurationMs(playerStats.fastestPerfectMs)
                      : '--:--'}
                  </strong>
                </div>
              </div>
            </div>

            {playerStats.perfectBadges.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="text-4xl">🏅</div>
                <h4 className="text-base font-black text-white">
                  No Perfect Slayer Badges Earned Yet
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Score 100% within the speed timer in any Date or Month Boss Fight to mint your
                  permanent Slayer Badge!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {playerStats.perfectBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="p-5 rounded-2xl bg-gradient-to-br from-amber-400/15 via-slate-950 to-slate-950 border border-amber-400/35 space-y-3 shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">
                        {badge.tier === 'LIGHTNING_GODSLAYER'
                          ? '⚡'
                          : badge.tier === 'GRANDMASTER_SLAYER'
                          ? '🔥'
                          : '🏅'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black font-mono">
                        {badge.score}/{badge.totalQuestions} in{' '}
                        {formatDurationMs(badge.timeTakenMs)}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">{badge.tierLabel}</h4>
                      <p className="text-xs text-amber-200/90 font-semibold mt-0.5">
                        Slain: {badge.bossName}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 truncate">
                        {badge.scope === 'MONTH' ? '🗓️ Month:' : '📅 Date:'} {badge.dateKey} •{' '}
                        {badge.editionTitle}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function CaRaidPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-3xl animate-bounce">⚔️</div>
            <p className="text-xs font-bold text-slate-400">Loading CA Boss Fight Arena…</p>
          </div>
        </div>
      }
    >
      <CaBossRaidContent />
    </Suspense>
  );
}
