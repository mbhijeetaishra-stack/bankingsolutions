'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DailyMissionTask,
  LeaderboardEntry,
  MissionCategory,
  StudentDailyProgress,
  getLast7DaysKeys,
  getLeaderboardEntries,
  getMissionTasks,
  getOfficerRankBadge,
  getStudentDailyProgress,
  getTodayDateKey,
  getYesterdayDateKey,
  saveStudentDailyProgress,
  syncDailyMissionFromSupabase,
  updateStudentOnLeaderboard,
} from '@/lib/dailyMission';

interface DailyMissionWidgetProps {
  currentUser?: {
    id?: string;
    email?: string;
    user_metadata?: { full_name?: string };
  } | null;
  studentNameOverride?: string;
  targetExamOverride?: string;
  variant?: 'homepage' | 'dashboard';
}

const CATEGORY_STYLES: Record<
  MissionCategory,
  { badge: string; icon: string; label: string }
> = {
  QUANT: {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    icon: '⚡',
    label: 'Speed Math',
  },
  GA: {
    badge: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
    icon: '📰',
    label: 'Current Affairs',
  },
  MOCK: {
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    icon: '🚀',
    label: 'CBT Mock Test',
  },
  REASONING: {
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    icon: '🧠',
    label: 'Reasoning',
  },
  ENGLISH: {
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    icon: '📖',
    label: 'English',
  },
  REVISION: {
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    icon: '🔖',
    label: 'Revision',
  },
  CUSTOM: {
    badge: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    icon: '🎯',
    label: 'My Target',
  },
};

export default function DailyMissionWidget({
  currentUser,
  studentNameOverride,
  targetExamOverride,
  variant = 'homepage',
}: DailyMissionWidgetProps) {
  const [tasks, setTasks] = useState<DailyMissionTask[]>([]);
  const [progress, setProgress] = useState<StudentDailyProgress>({
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
    totalXp: 120,
    history: {},
    customTasks: [],
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeView, setActiveView] = useState<'checklist' | 'leaderboard'>('checklist');
  const [xpToast, setXpToast] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customMinutes, setCustomMinutes] = useState(20);

  const todayKey = getTodayDateKey();
  const weekDays = getLast7DaysKeys();

  useEffect(() => {
    setTasks(getMissionTasks());
    setProgress(getStudentDailyProgress());
    setLeaderboard(getLeaderboardEntries());

    syncDailyMissionFromSupabase().then(({ tasks: syncedTasks, leaderboard: syncedBoard }) => {
      setTasks(syncedTasks);
      setLeaderboard(syncedBoard);
    });
  }, []);

  const allTodayTasks: DailyMissionTask[] = [...tasks, ...(progress.customTasks || [])];
  const completedTodayIds = progress.history[todayKey] || [];
  const completedCount = allTodayTasks.filter((t) => completedTodayIds.includes(t.id)).length;
  const totalCount = allTodayTasks.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const todayEarnedXp = allTodayTasks
    .filter((t) => completedTodayIds.includes(t.id))
    .reduce((sum, t) => sum + t.xp, 0);
  const todayMaxXp = allTodayTasks.reduce((sum, t) => sum + t.xp, 0);

  const rankInfo = getOfficerRankBadge(progress.totalXp);

  const displayName =
    studentNameOverride ||
    currentUser?.user_metadata?.full_name ||
    currentUser?.email?.split('@')[0] ||
    'You (Aspirant)';
  const displayExam =
    targetExamOverride ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('bs_student_target_exam') || 'SBI PO & IBPS PO 2026'
      : 'SBI PO & IBPS PO 2026');
  const studentId = currentUser?.id || 'local_aspirant';

  const handleToggleTask = async (task: DailyMissionTask) => {
    const currentDayList = progress.history[todayKey] || [];
    const isAlreadyDone = currentDayList.includes(task.id);

    let nextDayList: string[];
    let nextTotalXp = progress.totalXp;
    let nextStreak = progress.currentStreak;
    let nextLastDate = progress.lastCompletedDate;

    if (isAlreadyDone) {
      nextDayList = currentDayList.filter((id) => id !== task.id);
      nextTotalXp = Math.max(0, progress.totalXp - task.xp);
    } else {
      nextDayList = [...currentDayList, task.id];
      nextTotalXp = progress.totalXp + task.xp;

      // Update streak if first task completed today
      if (progress.lastCompletedDate !== todayKey) {
        const yesterdayKey = getYesterdayDateKey();
        if (progress.lastCompletedDate === yesterdayKey) {
          nextStreak = progress.currentStreak + 1;
        } else {
          nextStreak = Math.max(1, progress.currentStreak + 1);
        }
        nextLastDate = todayKey;
      }

      // Bonus +50 XP when all tasks for today are completed!
      if (nextDayList.length === allTodayTasks.length && allTodayTasks.length > 0) {
        nextTotalXp += 50;
        setXpToast(`🎉 All Daily Missions Complete! +${task.xp + 50} XP (Includes +50 Bonus XP)`);
      } else {
        setXpToast(`⚡ +${task.xp} XP Earned! Keep going!`);
      }
      setTimeout(() => setXpToast(null), 3200);
    }

    const nextProgress: StudentDailyProgress = {
      ...progress,
      currentStreak: nextStreak,
      bestStreak: Math.max(progress.bestStreak, nextStreak),
      lastCompletedDate: nextLastDate,
      totalXp: nextTotalXp,
      history: {
        ...progress.history,
        [todayKey]: nextDayList,
      },
    };

    setProgress(nextProgress);
    saveStudentDailyProgress(nextProgress);

    const updatedBoard = await updateStudentOnLeaderboard({
      userId: studentId,
      name: displayName,
      targetExam: displayExam,
      xp: nextTotalXp,
      streak: nextStreak,
    });
    setLeaderboard(updatedBoard);
  };

  const handleAddCustomTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;

    const newCustom: DailyMissionTask = {
      id: `custom_${Date.now()}`,
      title: customTitle.trim(),
      subtitle: 'Personal daily study target added by you',
      category: 'CUSTOM',
      xp: 35,
      estimatedMinutes: Number(customMinutes) || 20,
      actionUrl: '/tests',
      actionLabel: 'Practice',
      isCustom: true,
    };

    const nextProgress: StudentDailyProgress = {
      ...progress,
      customTasks: [...(progress.customTasks || []), newCustom],
    };
    setProgress(nextProgress);
    saveStudentDailyProgress(nextProgress);
    setCustomTitle('');
    setShowCustomForm(false);
  };

  const handleDeleteCustomTask = (taskId: string) => {
    const nextProgress: StudentDailyProgress = {
      ...progress,
      customTasks: (progress.customTasks || []).filter((t) => t.id !== taskId),
    };
    setProgress(nextProgress);
    saveStudentDailyProgress(nextProgress);
  };

  // Merge current user into leaderboard display so they always see their live rank
  const mergedLeaderboard: LeaderboardEntry[] = (() => {
    const copy = [...leaderboard];
    const existingIdx = copy.findIndex((item) => item.userId === studentId);
    const selfEntry: LeaderboardEntry = {
      userId: studentId,
      name: displayName,
      targetExam: displayExam,
      xp: progress.totalXp,
      streak: progress.currentStreak,
      updatedAt: new Date().toISOString(),
    };
    if (existingIdx >= 0) {
      copy[existingIdx] = selfEntry;
    } else {
      copy.push(selfEntry);
    }
    copy.sort((a, b) => b.xp - a.xp || b.streak - a.streak);
    return copy.slice(0, 10);
  })();

  const myRankPosition =
    mergedLeaderboard.findIndex((item) => item.userId === studentId) + 1;

  return (
    <div className="relative bg-gradient-to-b from-slate-900/95 via-slate-950 to-slate-950 border border-amber-400/25 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Floating XP Toast */}
      {xpToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-400 text-slate-950 font-black text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-2xl shadow-amber-400/30 border border-amber-300 animate-bounce">
          {xpToast}
        </div>
      )}

      {/* Top Header Row */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-6 border-b border-white/[0.08]">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[11px] font-black uppercase tracking-wider">
            <span>🔥 Daily Study Mission</span>
            <span>•</span>
            <span>
              {new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
            Today&apos;s Officer Target Checklist
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Complete your daily study targets to build an unbroken{' '}
            <span className="text-amber-300 font-bold">🔥 Daily Streak</span>, earn{' '}
            <span className="text-emerald-300 font-bold">⚡ Officer XP</span>, and climb the All-India Leaderboard.
          </p>
        </div>

        {/* Streak + Total XP + Rank Summary Pills */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Streak Counter Card */}
          <div className="bg-slate-900/90 border border-orange-500/35 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-inner">
            <span className="text-2xl">🔥</span>
            <div>
              <div className="text-lg font-black text-orange-400 leading-none">
                {progress.currentStreak} {progress.currentStreak === 1 ? 'Day' : 'Days'}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                Daily Streak (Best: {progress.bestStreak}d)
              </div>
            </div>
          </div>

          {/* Total XP & Officer Rank Card */}
          <div className="bg-slate-900/90 border border-amber-400/35 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-inner">
            <span className="text-2xl">{rankInfo.badgeIcon}</span>
            <div>
              <div className="text-lg font-black text-amber-300 leading-none">
                {progress.totalXp.toLocaleString()} XP
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                {rankInfo.title} {myRankPosition > 0 ? `• Rank #${myRankPosition}` : ''}
              </div>
            </div>
          </div>

          {/* View Switcher Tabs */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-2xl flex items-center">
            <button
              onClick={() => setActiveView('checklist')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                activeView === 'checklist'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>✅</span>
              <span>Checklist ({completedCount}/{totalCount})</span>
            </button>
            <button
              onClick={() => setActiveView('leaderboard')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                activeView === 'leaderboard'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🏆</span>
              <span>XP Leaderboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* 7-Day Consistency Strip + Today's Progress Bar */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 py-5 border-b border-white/[0.06] items-center">
        {/* Progress Bar */}
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300">
              Today&apos;s Mission Progress:{' '}
              <span className="text-amber-300 font-black">
                {completedCount} of {totalCount} Completed ({completionPct}%)
              </span>
            </span>
            <span className="font-black text-emerald-400">
              +{todayEarnedXp} / {todayMaxXp} XP Today
            </span>
          </div>
          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>

        {/* 7-Day Consistency Strip */}
        <div className="lg:col-span-5 flex items-center justify-between sm:justify-end gap-2">
          <span className="text-[11px] font-bold text-slate-400 mr-1 hidden sm:inline">
            Last 7 Days:
          </span>
          <div className="flex items-center gap-1.5">
            {weekDays.map((day) => {
              const doneCount = (progress.history[day.dateKey] || []).length;
              const isDone = doneCount > 0;
              return (
                <div
                  key={day.dateKey}
                  title={`${day.dayLabel} (${day.dateKey}): ${doneCount} tasks completed`}
                  className={`w-9 h-11 rounded-xl border flex flex-col items-center justify-center text-[10px] font-bold transition ${
                    isDone
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : day.isToday
                      ? 'bg-amber-400/10 border-amber-400/50 text-amber-300'
                      : 'bg-slate-900/80 border-slate-800 text-slate-500'
                  }`}
                >
                  <span>{day.dayLabel}</span>
                  <span className="text-xs mt-0.5">{isDone ? '🔥' : day.isToday ? '⏳' : '·'}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BODY: CHECKLIST OR XP LEADERBOARD */}
      {activeView === 'checklist' ? (
        <div className="relative z-10 pt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {allTodayTasks.map((task) => {
              const isCompleted = completedTodayIds.includes(task.id);
              const style = CATEGORY_STYLES[task.category] || CATEGORY_STYLES.CUSTOM;

              return (
                <div
                  key={task.id}
                  className={`group rounded-2xl border p-4 transition-all flex items-start justify-between gap-3.5 ${
                    isCompleted
                      ? 'bg-emerald-950/20 border-emerald-500/35 shadow-inner'
                      : 'bg-slate-900/80 hover:bg-slate-900 border-white/[0.08] hover:border-amber-400/40'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Checkbox Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task)}
                      aria-label={`Mark ${task.title} as complete`}
                      className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition ${
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-black shadow-md shadow-emerald-500/25'
                          : 'border-slate-600 hover:border-amber-400 bg-slate-950 text-transparent'
                      }`}
                    >
                      ✓
                    </button>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${style.badge}`}
                        >
                          {style.icon} {style.label}
                        </span>
                        <span className="text-[10px] font-black text-amber-300 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded-md">
                          +{task.xp} XP
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          ⏱ {task.estimatedMinutes}m
                        </span>
                      </div>

                      <h3
                        onClick={() => handleToggleTask(task)}
                        className={`text-xs sm:text-sm font-bold cursor-pointer transition ${
                          isCompleted ? 'line-through text-slate-400' : 'text-white group-hover:text-amber-200'
                        }`}
                      >
                        {task.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{task.subtitle}</p>
                    </div>
                  </div>

                  {/* Right Action CTA */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Link
                      href={task.actionUrl}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition whitespace-nowrap ${
                        isCompleted
                          ? 'bg-slate-800 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-400/15 hover:bg-amber-400 text-amber-300 hover:text-slate-950 border border-amber-400/35'
                      }`}
                    >
                      {isCompleted ? 'Done ✓' : `${task.actionLabel} →`}
                    </Link>
                    {task.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomTask(task.id)}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Bar: Add Custom Task + Dashboard Link */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {!showCustomForm ? (
              <button
                type="button"
                onClick={() => setShowCustomForm(true)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 hover:text-amber-300 transition flex items-center gap-2"
              >
                <span>➕</span>
                <span>Add My Personal Study Target (+35 XP)</span>
              </button>
            ) : (
              <form
                onSubmit={handleAddCustomTask}
                className="flex flex-wrap items-center gap-2 bg-slate-900/90 border border-slate-700 p-2.5 rounded-2xl w-full sm:w-auto"
              >
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g., Solve 5 Mains Puzzle Sets"
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 min-w-[210px]"
                />
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(Number(e.target.value))}
                  className="w-16 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                  title="Estimated minutes"
                />
                <span className="text-[11px] text-slate-400">min</span>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition"
                >
                  Save Target
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </form>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveView('leaderboard')}
                className="text-xs font-black text-amber-300 hover:text-amber-200 transition flex items-center gap-1.5"
              >
                <span>🏆 View Live XP Leaderboard</span>
                <span>→</span>
              </button>
              {variant === 'homepage' && (
                <Link
                  href="/profile"
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-xs font-bold text-slate-200 transition"
                >
                  📊 Full Analytics in Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* LEADERBOARD VIEW */
        <div className="relative z-10 pt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>🏆 All-India Daily Mission XP &amp; Streak Leaderboard</span>
              </h3>
              <p className="text-xs text-slate-400">
                Complete your daily targets every day to protect your 🔥 streak and overtake top banking aspirants.
              </p>
            </div>
            <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold ${rankInfo.colorClass}`}>
              Your Tier: {rankInfo.badgeIcon} {rankInfo.title} (Next Tier at {rankInfo.nextRankXp} XP)
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mergedLeaderboard.map((entry, idx) => {
              const rank = idx + 1;
              const isSelf = entry.userId === studentId;
              const medal =
                rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

              return (
                <div
                  key={entry.userId + idx}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition ${
                    isSelf
                      ? 'bg-amber-400/15 border-amber-400/50 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        rank <= 3
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 text-base'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {medal}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-black text-white truncate">
                          {entry.name}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        Target: {entry.targetExam}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs sm:text-sm font-black text-amber-300">
                        ⚡ {entry.xp.toLocaleString()} XP
                      </div>
                      <div className="text-[11px] font-bold text-orange-400">
                        🔥 {entry.streak}d Streak
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

