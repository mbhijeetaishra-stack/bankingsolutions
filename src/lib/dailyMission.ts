import { persistSettingToSupabase } from './monetization';
import { supabase } from './supabase';

export type MissionCategory = 'QUANT' | 'REASONING' | 'ENGLISH' | 'GA' | 'MOCK' | 'REVISION' | 'CUSTOM';

export interface DailyMissionTask {
  id: string;
  title: string;
  subtitle: string;
  category: MissionCategory;
  xp: number;
  estimatedMinutes: number;
  actionUrl: string;
  actionLabel: string;
  isCustom?: boolean;
}

export interface StudentDailyProgress {
  currentStreak: number;
  bestStreak: number;
  lastCompletedDate: string | null; // YYYY-MM-DD
  totalXp: number;
  /** Map of YYYY-MM-DD -> array of completed task IDs */
  history: Record<string, string[]>;
  /** Custom tasks added by student */
  customTasks: DailyMissionTask[];
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  targetExam: string;
  xp: number;
  streak: number;
  updatedAt: string;
}

export const DAILY_MISSION_CONFIG_KEY = 'bs_daily_mission_tasks_v1';
export const DAILY_LEADERBOARD_KEY = 'bs_daily_xp_leaderboard_v1';
export const LOCAL_PROGRESS_KEY = 'bs_student_daily_mission_progress_v1';

export const DEFAULT_DAILY_MISSION_TASKS: DailyMissionTask[] = [
  {
    id: 'mission_calc_lab',
    title: '15-Min Speed Math & Approximation Drill',
    subtitle: 'Boost calculation speed on Quadratic, Simplification & Number Series',
    category: 'QUANT',
    xp: 40,
    estimatedMinutes: 15,
    actionUrl: '/calc-lab',
    actionLabel: 'Open Calc Lab',
  },
  {
    id: 'mission_daily_ca',
    title: 'Slay the Daily CA Boss Raid (10 Questions)',
    subtitle: 'Strike today’s Boss from the Daily CA PDF, drain Community HP & unlock the 1-Page Summary',
    category: 'GA',
    xp: 55,
    estimatedMinutes: 5,
    actionUrl: '/ca-raid',
    actionLabel: 'Enter Boss Raid',
  },
  {
    id: 'mission_mock_test',
    title: 'Attempt 1 Full or Sectional CBT Mock Test',
    subtitle: 'Simulate real exam timer discipline & benchmark your percentile',
    category: 'MOCK',
    xp: 100,
    estimatedMinutes: 35,
    actionUrl: '/tests',
    actionLabel: 'Attempt Mock',
  },
  {
    id: 'mission_critical_reasoning',
    title: 'Solve 10 Critical Reasoning / Puzzle Questions',
    subtitle: 'Practice Assumptions, Inferences, Courses of Action & Seating Sets',
    category: 'REASONING',
    xp: 60,
    estimatedMinutes: 20,
    actionUrl: '/critical-reasoning',
    actionLabel: 'Practice CR',
  },
  {
    id: 'mission_english_editorial',
    title: 'Clear 2 Boards in Word Matrix (Vocab & Banking Jargon)',
    subtitle: 'Pair 8 Editorial Vocab & RBI Banking Jargon terms on a 4×4 grid under 45s',
    category: 'ENGLISH',
    xp: 45,
    estimatedMinutes: 10,
    actionUrl: '/word-matrix',
    actionLabel: 'Play Word Matrix',
  },
  {
    id: 'mission_mistake_notebook',
    title: 'Re-Attempt 10 Saved Questions in Mistake Notebook',
    subtitle: 'Turn your previous wrong & skipped mock questions into marks',
    category: 'REVISION',
    xp: 50,
    estimatedMinutes: 15,
    actionUrl: '/notebook',
    actionLabel: 'Revise Mistakes',
  },
];

export const SEED_LEADERBOARD: LeaderboardEntry[] = [
  {
    userId: 'seed_1',
    name: 'Aarav Sharma',
    targetExam: 'SBI PO 2026',
    xp: 4820,
    streak: 19,
    updatedAt: new Date().toISOString(),
  },
  {
    userId: 'seed_2',
    name: 'Priya Nair',
    targetExam: 'IBPS PO 2026',
    xp: 4390,
    streak: 16,
    updatedAt: new Date().toISOString(),
  },
  {
    userId: 'seed_3',
    name: 'Rohan Verma',
    targetExam: 'RBI Grade B',
    xp: 3910,
    streak: 14,
    updatedAt: new Date().toISOString(),
  },
  {
    userId: 'seed_4',
    name: 'Sneha Kulkarni',
    targetExam: 'SBI Clerk 2026',
    xp: 3450,
    streak: 12,
    updatedAt: new Date().toISOString(),
  },
  {
    userId: 'seed_5',
    name: 'Vikramaditya Singh',
    targetExam: 'IBPS RRB PO',
    xp: 2980,
    streak: 9,
    updatedAt: new Date().toISOString(),
  },
  {
    userId: 'seed_6',
    name: 'Ananya Chatterjee',
    targetExam: 'SBI PO 2026',
    xp: 2640,
    streak: 8,
    updatedAt: new Date().toISOString(),
  },
];

export function getTodayDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getTodayDateKey(d);
}

export function getLast7DaysKeys(): { dateKey: string; dayLabel: string; isToday: boolean }[] {
  const result: { dateKey: string; dayLabel: string; isToday: boolean }[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push({
      dateKey: getTodayDateKey(d),
      dayLabel: dayNames[d.getDay()],
      isToday: i === 0,
    });
  }
  return result;
}

export function getOfficerRankBadge(xp: number): {
  title: string;
  badgeIcon: string;
  nextRankXp: number;
  colorClass: string;
} {
  if (xp >= 5000) {
    return {
      title: 'RBI Grade-B Master',
      badgeIcon: '👑',
      nextRankXp: 10000,
      colorClass: 'text-amber-300 bg-amber-400/15 border-amber-400/40',
    };
  }
  if (xp >= 2500) {
    return {
      title: 'Scale-II Banking Officer',
      badgeIcon: '🎖️',
      nextRankXp: 5000,
      colorClass: 'text-purple-300 bg-purple-500/15 border-purple-500/40',
    };
  }
  if (xp >= 1000) {
    return {
      title: 'Probationary Officer (PO)',
      badgeIcon: '⭐',
      nextRankXp: 2500,
      colorClass: 'text-blue-300 bg-blue-500/15 border-blue-500/40',
    };
  }
  if (xp >= 300) {
    return {
      title: 'Junior Associate (Clerk)',
      badgeIcon: '🛡️',
      nextRankXp: 1000,
      colorClass: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40',
    };
  }
  return {
    title: 'Banking Aspirant',
    badgeIcon: '🎯',
    nextRankXp: 300,
    colorClass: 'text-slate-300 bg-slate-800 border-slate-700',
  };
}

export function getMissionTasks(): DailyMissionTask[] {
  if (typeof window === 'undefined') return DEFAULT_DAILY_MISSION_TASKS;
  try {
    const raw = localStorage.getItem(DAILY_MISSION_CONFIG_KEY);
    if (!raw) return DEFAULT_DAILY_MISSION_TASKS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_DAILY_MISSION_TASKS;
    return parsed;
  } catch {
    return DEFAULT_DAILY_MISSION_TASKS;
  }
}

export async function saveMissionTasks(tasks: DailyMissionTask[]): Promise<void> {
  const serialized = JSON.stringify(tasks);
  if (typeof window !== 'undefined') {
    localStorage.setItem(DAILY_MISSION_CONFIG_KEY, serialized);
  }
  await persistSettingToSupabase(DAILY_MISSION_CONFIG_KEY, serialized);
}

export function getStudentDailyProgress(): StudentDailyProgress {
  const defaultProgress: StudentDailyProgress = {
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
    totalXp: 120, // Welcome bonus XP
    history: {},
    customTasks: [],
  };

  if (typeof window === 'undefined') return defaultProgress;
  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
    if (!raw) return defaultProgress;
    const parsed = JSON.parse(raw) as StudentDailyProgress;

    // Validate if streak expired (missed both today and yesterday)
    const today = getTodayDateKey();
    const yesterday = getYesterdayDateKey();
    let currentStreak = parsed.currentStreak || 0;
    if (
      parsed.lastCompletedDate &&
      parsed.lastCompletedDate !== today &&
      parsed.lastCompletedDate !== yesterday
    ) {
      currentStreak = 0;
    }

    return {
      currentStreak,
      bestStreak: Math.max(parsed.bestStreak || 0, currentStreak),
      lastCompletedDate: parsed.lastCompletedDate || null,
      totalXp: typeof parsed.totalXp === 'number' ? parsed.totalXp : 120,
      history: parsed.history || {},
      customTasks: Array.isArray(parsed.customTasks) ? parsed.customTasks : [],
    };
  } catch {
    return defaultProgress;
  }
}

export function saveStudentDailyProgress(progress: StudentDailyProgress): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(progress));
}

export function getLeaderboardEntries(): LeaderboardEntry[] {
  if (typeof window === 'undefined') return SEED_LEADERBOARD;
  try {
    const raw = localStorage.getItem(DAILY_LEADERBOARD_KEY);
    if (!raw) return SEED_LEADERBOARD;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return SEED_LEADERBOARD;
    return parsed;
  } catch {
    return SEED_LEADERBOARD;
  }
}

export async function syncDailyMissionFromSupabase(): Promise<{
  tasks: DailyMissionTask[];
  leaderboard: LeaderboardEntry[];
}> {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [DAILY_MISSION_CONFIG_KEY, DAILY_LEADERBOARD_KEY]);

    if (!error && data && data.length > 0) {
      for (const row of data) {
        if (!row.setting_value) continue;
        const parsed =
          typeof row.setting_value === 'string'
            ? JSON.parse(row.setting_value)
            : row.setting_value;
        if (row.setting_key === DAILY_MISSION_CONFIG_KEY && Array.isArray(parsed)) {
          if (typeof window !== 'undefined') {
            localStorage.setItem(DAILY_MISSION_CONFIG_KEY, JSON.stringify(parsed));
          }
        }
        if (row.setting_key === DAILY_LEADERBOARD_KEY && Array.isArray(parsed)) {
          if (typeof window !== 'undefined') {
            localStorage.setItem(DAILY_LEADERBOARD_KEY, JSON.stringify(parsed));
          }
        }
      }
    }
  } catch {
    // Fallback to localStorage
  }

  return {
    tasks: getMissionTasks(),
    leaderboard: getLeaderboardEntries(),
  };
}

export async function updateStudentOnLeaderboard(entry: {
  userId: string;
  name: string;
  targetExam: string;
  xp: number;
  streak: number;
}): Promise<LeaderboardEntry[]> {
  const current = getLeaderboardEntries();
  const idx = current.findIndex((item) => item.userId === entry.userId);
  const record: LeaderboardEntry = {
    ...entry,
    updatedAt: new Date().toISOString(),
  };

  let updated: LeaderboardEntry[];
  if (idx >= 0) {
    updated = current.map((item, i) => (i === idx ? record : item));
  } else {
    updated = [...current, record];
  }

  updated.sort((a, b) => b.xp - a.xp || b.streak - a.streak);
  const topList = updated.slice(0, 30);

  const serialized = JSON.stringify(topList);
  if (typeof window !== 'undefined') {
    localStorage.setItem(DAILY_LEADERBOARD_KEY, serialized);
  }
  await persistSettingToSupabase(DAILY_LEADERBOARD_KEY, serialized);
  return topList;
}

