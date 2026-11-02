import { supabase } from './supabase';

// ============================================================================
// TYPES & INTERFACES (ADMIN-MANAGED DATE & MONTH BOSS FIGHTS — NO EXTRACTION)
// ============================================================================

export type RaidScope = 'DATE' | 'MONTH';

export interface RaidNewsItem {
  id: string;
  category: string;
  headline: string;
  points: string[];
  keyStat?: string;
}

export interface RaidQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  categoryTag: string;
}

export interface BossFightEdition {
  /** e.g. 'date_2026-11-02' or 'month_2026-11' */
  id: string;
  scope: RaidScope;
  /** 'YYYY-MM-DD' when scope === 'DATE', 'YYYY-MM' when scope === 'MONTH' */
  dateKey: string;
  /** Always 'YYYY-MM' for month bar filtering */
  monthKey: string;
  /** Always 'YYYY' for year bar filtering */
  year: string;
  title: string;
  bossName: string;
  bossSubtitle: string;
  bossAvatar: string;
  communityMaxHp: number;
  /** Speed window in seconds for earning the Perfect-Score Badge (default 180s = 3 mins) */
  perfectTimeLimitSec: number;
  newsItems: RaidNewsItem[];
  questions: RaidQuestion[];
  /** Optional custom 1-page PDF URL uploaded by Admin; if omitted, 1-Page PDF is generated from newsItems + questions */
  customSummaryPdfUrl?: string;
  updatedAt: string;
}

export interface BossFightIndexItem {
  id: string;
  scope: RaidScope;
  dateKey: string;
  monthKey: string;
  year: string;
  title: string;
  bossName: string;
  bossAvatar: string;
  communityMaxHp: number;
  questionCount: number;
  newsCount: number;
  updatedAt: string;
}

export interface CommunityHitLog {
  id: string;
  raiderName: string;
  damage: number;
  isPerfectSlayer?: boolean;
  at: string;
}

export interface CommunityRaidState {
  raidId: string;
  maxHp: number;
  currentHp: number;
  totalDamageDealt: number;
  totalContributors: number;
  contributorIds: string[];
  defeatedAt: string | null;
  recentHits: CommunityHitLog[];
  updatedAt: string;
}

export interface PerfectRaidBadge {
  id: string;
  raidId: string;
  scope: RaidScope;
  dateKey: string;
  bossName: string;
  editionTitle: string;
  score: number;
  totalQuestions: number;
  timeTakenMs: number;
  tier: 'LIGHTNING_GODSLAYER' | 'GRANDMASTER_SLAYER' | 'MYTHIC_SLAYER';
  tierLabel: string;
  earnedAt: string;
}

export interface PlayerRaidDayAttempt {
  raidId: string;
  dateKey: string;
  scope: RaidScope;
  bestScore: number;
  totalQuestions: number;
  bestTimeMs: number;
  totalDamageContributed: number;
  attemptsCount: number;
  perfectUnderLimit: boolean;
  lastPlayedAt: string;
}

export interface PlayerRaidStats {
  raidsPlayed: number;
  bossesDamagedIds: string[];
  totalDamageDealt: number;
  bestScore: number;
  fastestPerfectMs: number | null;
  perfectBadges: PerfectRaidBadge[];
  attemptsByRaidId: Record<string, PlayerRaidDayAttempt>;
}

// ============================================================================
// CONSTANTS & KEYS
// ============================================================================

export const DEFAULT_PERFECT_TIME_LIMIT_SEC = 180; // 3 minutes
export const PERFECT_BADGE_TIME_LIMIT_MS = DEFAULT_PERFECT_TIME_LIMIT_SEC * 1000;
export const BASE_HIT_DAMAGE = 100;
export const STREAK_CRIT_BONUS_DAMAGE = 25;
export const DEFAULT_DAILY_COMMUNITY_BOSS_HP = 3000;
export const DEFAULT_MONTHLY_COMMUNITY_BOSS_HP = 10000;

export const BOSS_FIGHT_INDEX_KEY = 'bs_ca_boss_fights_index_v2';
export const BOSS_FIGHT_EDITION_PREFIX = 'bs_ca_boss_fight_edition_v2_';
export const COMMUNITY_RAID_KEY_PREFIX = 'bs_ca_raid_community_v2_';
export const LOCAL_RAID_STATS_KEY = 'bs_ca_raid_player_stats_v2';

export const RAID_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const RAID_MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const RAID_NEWS_CATEGORIES = [
  'Banking & RBI',
  'Economy & GDP',
  'National & Schemes',
  'International & MoUs',
  'Appointments & Awards',
  'Defence, Science & Space',
  'Sports, Books & Days',
  'Static GK Booster',
];

export const BOSS_AVATAR_PRESETS = [
  { avatar: '🐉', defaultName: 'Mint-Lord Repo Leviathan', defaultSub: 'Guardian of RBI Circulars & Banking Mandates' },
  { avatar: '👹', defaultName: 'Macro-Fiscal Colossus', defaultSub: 'Titan of GDP Forecasts & Sovereign Outlooks' },
  { avatar: '👾', defaultName: 'Geo-Strategic Sovereign', defaultSub: 'Overlord of Global Summits, MoUs & Space Missions' },
  { avatar: '🛡️', defaultName: 'Chronicle Archon', defaultSub: 'Keeper of Appointments, Indices & National Honours' },
  { avatar: '🔥', defaultName: 'Apex Treasury Dragon', defaultSub: 'Master of Capital Markets, SEBI & Financial Awareness' },
  { avatar: '👑', defaultName: 'Grand Monthly Emperor', defaultSub: 'Supreme Monthly Current Affairs Raid Boss' },
];

export const DEFAULT_PLAYER_RAID_STATS: PlayerRaidStats = {
  raidsPlayed: 0,
  bossesDamagedIds: [],
  totalDamageDealt: 0,
  bestScore: 0,
  fastestPerfectMs: null,
  perfectBadges: [],
  attemptsByRaidId: {},
};

// ============================================================================
// ID & FORMATTING HELPERS
// ============================================================================

export function makeRaidEditionId(scope: RaidScope, dateOrMonthKey: string): string {
  const clean = dateOrMonthKey.trim();
  return scope === 'MONTH' ? `month_${clean.slice(0, 7)}` : `date_${clean.slice(0, 10)}`;
}

export function formatMonthKeyLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const mIdx = Number(m) - 1;
  if (!y || Number.isNaN(mIdx) || mIdx < 0 || mIdx > 11) return monthKey;
  return `${RAID_MONTH_NAMES[mIdx]} ${y}`;
}

export function formatDateChipLabel(dateKey: string): string {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  const mIdx = Number(parts[1]) - 1;
  const day = parts[2];
  if (Number.isNaN(mIdx) || mIdx < 0 || mIdx > 11) return dateKey;
  return `${day} ${RAID_MONTH_SHORT[mIdx]}`;
}

export function getPerfectBadgeTier(
  timeTakenMs: number,
  limitMs = PERFECT_BADGE_TIME_LIMIT_MS
): {
  tier: PerfectRaidBadge['tier'];
  tierLabel: string;
} {
  if (timeTakenMs <= limitMs * 0.5) {
    return {
      tier: 'LIGHTNING_GODSLAYER',
      tierLabel: '⚡ Lightning Godslayer',
    };
  }
  if (timeTakenMs <= limitMs * 0.75) {
    return {
      tier: 'GRANDMASTER_SLAYER',
      tierLabel: '🔥 Grandmaster Boss Slayer',
    };
  }
  return {
    tier: 'MYTHIC_SLAYER',
    tierLabel: '🏅 Mythic Perfect Raider',
  };
}

// ============================================================================
// ADMIN CATALOG & EDITION CRUD (SUPABASE `admin_settings` + LOCAL CACHE)
// ============================================================================

function toIndexItem(edition: BossFightEdition): BossFightIndexItem {
  return {
    id: edition.id,
    scope: edition.scope,
    dateKey: edition.dateKey,
    monthKey: edition.monthKey,
    year: edition.year,
    title: edition.title,
    bossName: edition.bossName,
    bossAvatar: edition.bossAvatar,
    communityMaxHp: edition.communityMaxHp,
    questionCount: edition.questions.length,
    newsCount: edition.newsItems.length,
    updatedAt: edition.updatedAt,
  };
}

export async function fetchBossFightCatalog(): Promise<BossFightIndexItem[]> {
  let remoteList: BossFightIndexItem[] | null = null;
  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', BOSS_FIGHT_INDEX_KEY)
      .maybeSingle();
    if (data?.setting_value) {
      const parsed = JSON.parse(data.setting_value);
      if (Array.isArray(parsed)) {
        remoteList = parsed as BossFightIndexItem[];
      }
    }
  } catch {
    // Fallback to localStorage
  }

  if (remoteList) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(BOSS_FIGHT_INDEX_KEY, JSON.stringify(remoteList));
      } catch {}
    }
    return sortCatalogItems(remoteList);
  }

  if (typeof window !== 'undefined') {
    try {
      const localRaw = localStorage.getItem(BOSS_FIGHT_INDEX_KEY);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (Array.isArray(parsed)) {
          return sortCatalogItems(parsed as BossFightIndexItem[]);
        }
      }
    } catch {}
  }

  return [];
}

function sortCatalogItems(items: BossFightIndexItem[]): BossFightIndexItem[] {
  return [...items].sort((a, b) => {
    if (a.monthKey !== b.monthKey) return b.monthKey.localeCompare(a.monthKey);
    if (a.scope !== b.scope) return a.scope === 'DATE' ? -1 : 1;
    return b.dateKey.localeCompare(a.dateKey);
  });
}

export async function fetchBossFightEdition(raidId: string): Promise<BossFightEdition | null> {
  if (!raidId) return null;
  const key = `${BOSS_FIGHT_EDITION_PREFIX}${raidId}`;

  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .maybeSingle();
    if (data?.setting_value) {
      const parsed = JSON.parse(data.setting_value) as BossFightEdition;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(key, JSON.stringify(parsed));
        } catch {}
      }
      return parsed;
    }
  } catch {
    // Fallback to localStorage
  }

  if (typeof window !== 'undefined') {
    try {
      const localRaw = localStorage.getItem(key);
      if (localRaw) return JSON.parse(localRaw) as BossFightEdition;
    } catch {}
  }

  return null;
}

export async function saveBossFightEdition(
  edition: BossFightEdition
): Promise<{ success: boolean; error?: string; catalog: BossFightIndexItem[] }> {
  const editionKey = `${BOSS_FIGHT_EDITION_PREFIX}${edition.id}`;
  const updatedEdition: BossFightEdition = {
    ...edition,
    updatedAt: new Date().toISOString(),
  };
  const serializedEdition = JSON.stringify(updatedEdition);

  const existingCatalog = await fetchBossFightCatalog();
  const nextIndexItem = toIndexItem(updatedEdition);
  const filteredCatalog = existingCatalog.filter((it) => it.id !== updatedEdition.id);
  const nextCatalog = sortCatalogItems([nextIndexItem, ...filteredCatalog]);
  const serializedCatalog = JSON.stringify(nextCatalog);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(editionKey, serializedEdition);
      localStorage.setItem(BOSS_FIGHT_INDEX_KEY, serializedCatalog);
    } catch {}
  }

  try {
    const [edRes, idxRes] = await Promise.all([
      supabase
        .from('admin_settings')
        .upsert({ setting_key: editionKey, setting_value: serializedEdition }, { onConflict: 'setting_key' }),
      supabase
        .from('admin_settings')
        .upsert({ setting_key: BOSS_FIGHT_INDEX_KEY, setting_value: serializedCatalog }, { onConflict: 'setting_key' }),
    ]);

    if (edRes.error) {
      return { success: false, error: edRes.error.message, catalog: nextCatalog };
    }
    if (idxRes.error) {
      return { success: false, error: idxRes.error.message, catalog: nextCatalog };
    }
    return { success: true, catalog: nextCatalog };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save Boss Fight edition';
    return { success: false, error: msg, catalog: nextCatalog };
  }
}

export async function deleteBossFightEdition(
  raidId: string
): Promise<{ success: boolean; catalog: BossFightIndexItem[] }> {
  const editionKey = `${BOSS_FIGHT_EDITION_PREFIX}${raidId}`;
  const commKey = `${COMMUNITY_RAID_KEY_PREFIX}${raidId}`;

  const existingCatalog = await fetchBossFightCatalog();
  const nextCatalog = existingCatalog.filter((it) => it.id !== raidId);
  const serializedCatalog = JSON.stringify(nextCatalog);

  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(editionKey);
      localStorage.removeItem(commKey);
      localStorage.setItem(BOSS_FIGHT_INDEX_KEY, serializedCatalog);
    } catch {}
  }

  try {
    await Promise.all([
      supabase.from('admin_settings').delete().eq('setting_key', editionKey),
      supabase.from('admin_settings').delete().eq('setting_key', commKey),
      supabase
        .from('admin_settings')
        .upsert({ setting_key: BOSS_FIGHT_INDEX_KEY, setting_value: serializedCatalog }, { onConflict: 'setting_key' }),
    ]);
    return { success: true, catalog: nextCatalog };
  } catch {
    return { success: false, catalog: nextCatalog };
  }
}

// ============================================================================
// ADMIN HELPER: PARSE ADMIN'S STRUCTURED MCQ TEXT / WORD (.DOCX) PASTE
// ============================================================================

export function parseAdminFormattedQuestions(
  rawText: string,
  defaultCategory = 'Current Affairs'
): RaidQuestion[] {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const blocks = normalized.split(/(?=(?:^|\n)\s*(?:Q\.?\s*\d+[\).:-]?|\d+[\).])\s+)/i);
  const parsed: RaidQuestion[] = [];

  blocks.forEach((block, bIdx) => {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 3) return;

    const firstLine = lines[0].replace(/^(?:Q\.?\s*\d+[\).:-]?|\d+[\).])\s*/i, '').trim();
    if (!firstLine) return;

    const options: string[] = [];
    let questionLines = [firstLine];
    let ansIndex = 0;
    let explanation = '';
    let categoryTag = defaultCategory;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const optMatch = line.match(/^(?:\(([A-Ea-e1-5])\)|([A-Ea-e1-5])[\).:-])\s*(.+)$/);
      if (optMatch) {
        options.push(optMatch[3].trim());
        continue;
      }

      const ansMatch = line.match(/^(?:Ans(?:wer)?|Correct(?:\s*Option)?)\s*[:-]\s*\(?([A-Ea-e1-5])\)?/i);
      if (ansMatch) {
        const tok = ansMatch[1].toUpperCase();
        ansIndex =
          tok >= '1' && tok <= '5'
            ? Number(tok) - 1
            : Math.max(0, tok.charCodeAt(0) - 65);
        continue;
      }

      const expMatch = line.match(/^(?:Exp(?:lanation)?|Solution)\s*[:-]\s*(.+)$/i);
      if (expMatch) {
        explanation = expMatch[1].trim();
        continue;
      }

      const catMatch = line.match(/^(?:Category|Tag)\s*[:-]\s*(.+)$/i);
      if (catMatch) {
        categoryTag = catMatch[1].trim();
        continue;
      }

      if (options.length === 0 && !explanation) {
        questionLines = [...questionLines, line];
      } else if (explanation) {
        explanation += ` ${line}`;
      }
    }

    if (options.length >= 2) {
      parsed.push({
        id: `raid_q_${Date.now()}_${bIdx}`,
        questionText: questionLines.join(' '),
        options,
        correctOptionIndex: Math.min(options.length - 1, Math.max(0, ansIndex)),
        explanation: explanation || 'Refer to the Boss Fight Current Affairs notes.',
        categoryTag,
      });
    }
  });

  return parsed;
}

export function parseAdminFormattedNews(
  rawText: string,
  defaultCategory = 'Banking & RBI'
): RaidNewsItem[] {
  const blocks = rawText
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const items: RaidNewsItem[] = [];
  blocks.forEach((block, idx) => {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    let category = defaultCategory;
    let startIdx = 0;

    if (lines[0].startsWith('[') && lines[0].endsWith(']')) {
      category = lines[0].slice(1, -1).trim() || defaultCategory;
      startIdx = 1;
    }

    const headline = (lines[startIdx] || '').replace(/^[#*\d.)\s-]+/, '').trim();
    if (!headline) return;

    const points = lines
      .slice(startIdx + 1)
      .map((l) => l.replace(/^[•\-*▪▸\s]+/, '').trim())
      .filter(Boolean);

    items.push({
      id: `raid_news_${Date.now()}_${idx}`,
      category,
      headline,
      points: points.length > 0 ? points : [headline],
    });
  });

  return items;
}

// ============================================================================
// COMMUNITY BOSS PROGRESS BAR SYNC (PER RAID EDITION ID)
// ============================================================================

export function createInitialCommunityState(
  raidId: string,
  maxHp = DEFAULT_DAILY_COMMUNITY_BOSS_HP
): CommunityRaidState {
  return {
    raidId,
    maxHp,
    currentHp: maxHp,
    totalDamageDealt: 0,
    totalContributors: 0,
    contributorIds: [],
    defeatedAt: null,
    recentHits: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeCommunityState(
  raw: Partial<CommunityRaidState> | null | undefined,
  raidId: string,
  expectedMaxHp: number
): CommunityRaidState {
  const maxHp = Math.max(200, Number(expectedMaxHp || raw?.maxHp || DEFAULT_DAILY_COMMUNITY_BOSS_HP));
  const totalDamageDealt = Math.max(0, Number(raw?.totalDamageDealt || 0));
  const currentHp = Math.max(0, Math.min(maxHp, maxHp - totalDamageDealt));
  const contributorIds = Array.isArray(raw?.contributorIds)
    ? Array.from(new Set(raw.contributorIds.filter((x): x is string => typeof x === 'string')))
    : [];
  const totalContributors = Math.max(
    contributorIds.length,
    Number(raw?.totalContributors || 0)
  );
  return {
    raidId,
    maxHp,
    currentHp,
    totalDamageDealt,
    totalContributors,
    contributorIds,
    defeatedAt: currentHp === 0 ? raw?.defeatedAt || new Date().toISOString() : null,
    recentHits: Array.isArray(raw?.recentHits) ? raw.recentHits.slice(0, 12) : [],
    updatedAt: raw?.updatedAt || new Date().toISOString(),
  };
}

export async function syncCommunityRaidState(
  raidId: string,
  expectedMaxHp = DEFAULT_DAILY_COMMUNITY_BOSS_HP
): Promise<CommunityRaidState> {
  const key = `${COMMUNITY_RAID_KEY_PREFIX}${raidId}`;
  let localParsed: Partial<CommunityRaidState> | null = null;

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(key);
      if (raw) localParsed = JSON.parse(raw) as Partial<CommunityRaidState>;
    } catch {}
  }

  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .maybeSingle();

    if (data?.setting_value) {
      const remoteParsed = JSON.parse(data.setting_value) as Partial<CommunityRaidState>;
      const mergedDamage = Math.max(
        Number(remoteParsed.totalDamageDealt || 0),
        Number(localParsed?.totalDamageDealt || 0)
      );
      const mergedIds = Array.from(
        new Set([
          ...(remoteParsed.contributorIds || []),
          ...(localParsed?.contributorIds || []),
        ])
      );
      const state = normalizeCommunityState(
        {
          ...remoteParsed,
          maxHp: expectedMaxHp,
          totalDamageDealt: mergedDamage,
          contributorIds: mergedIds,
        },
        raidId,
        expectedMaxHp
      );
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(key, JSON.stringify(state));
        } catch {}
      }
      return state;
    }
  } catch {
    // Fallback to local
  }

  return normalizeCommunityState(localParsed, raidId, expectedMaxHp);
}

export async function resetCommunityBossHp(
  raidId: string,
  maxHp: number
): Promise<CommunityRaidState> {
  const key = `${COMMUNITY_RAID_KEY_PREFIX}${raidId}`;
  const fresh = createInitialCommunityState(raidId, maxHp);
  const serialized = JSON.stringify(fresh);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, serialized);
    } catch {}
  }
  try {
    await supabase
      .from('admin_settings')
      .upsert({ setting_key: key, setting_value: serialized }, { onConflict: 'setting_key' });
  } catch {}
  return fresh;
}

export async function recordCommunityBossDamage(params: {
  raidId: string;
  expectedMaxHp: number;
  damage: number;
  visitorId: string;
  raiderName: string;
  isPerfectSlayer?: boolean;
}): Promise<CommunityRaidState> {
  const { raidId, expectedMaxHp, damage, visitorId, raiderName, isPerfectSlayer } = params;
  const key = `${COMMUNITY_RAID_KEY_PREFIX}${raidId}`;
  const latest = await syncCommunityRaidState(raidId, expectedMaxHp);

  if (damage <= 0) return latest;

  const newTotalDamage = latest.totalDamageDealt + damage;
  const newCurrentHp = Math.max(0, latest.maxHp - newTotalDamage);
  const nextContributorIds = latest.contributorIds.includes(visitorId)
    ? latest.contributorIds
    : [...latest.contributorIds, visitorId];

  const hitEntry: CommunityHitLog = {
    id: `${Date.now()}_${visitorId.slice(0, 6)}`,
    raiderName: raiderName.trim() || 'Aspirant Raider',
    damage,
    isPerfectSlayer,
    at: new Date().toISOString(),
  };

  const updated: CommunityRaidState = {
    raidId,
    maxHp: latest.maxHp,
    currentHp: newCurrentHp,
    totalDamageDealt: newTotalDamage,
    totalContributors: Math.max(latest.totalContributors, nextContributorIds.length),
    contributorIds: nextContributorIds.slice(-1000),
    defeatedAt: newCurrentHp === 0 ? latest.defeatedAt || new Date().toISOString() : null,
    recentHits: [hitEntry, ...latest.recentHits].slice(0, 12),
    updatedAt: new Date().toISOString(),
  };

  const serialized = JSON.stringify(updated);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, serialized);
    } catch {}
  }

  try {
    await supabase
      .from('admin_settings')
      .upsert({ setting_key: key, setting_value: serialized }, { onConflict: 'setting_key' });
  } catch {
    // Offline safe
  }

  return updated;
}

// ============================================================================
// PLAYER RAID STATS & PERFECT-SCORE SPEED BADGES (`useSyncExternalStore`)
// ============================================================================

let cachedStatsRaw: string | null = null;
let cachedStatsSnapshot: PlayerRaidStats = DEFAULT_PLAYER_RAID_STATS;
const statsListeners = new Set<() => void>();

export function subscribePlayerRaidStats(listener: () => void): () => void {
  statsListeners.add(listener);
  if (typeof window !== 'undefined') {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_RAID_STATS_KEY) listener();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      statsListeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }
  return () => {
    statsListeners.delete(listener);
  };
}

function notifyRaidStatsListeners() {
  statsListeners.forEach((fn) => fn());
}

export function loadPlayerRaidStats(): PlayerRaidStats {
  if (typeof window === 'undefined') return DEFAULT_PLAYER_RAID_STATS;
  try {
    const raw = localStorage.getItem(LOCAL_RAID_STATS_KEY);
    if (raw === cachedStatsRaw) return cachedStatsSnapshot;
    cachedStatsRaw = raw;
    if (!raw) {
      cachedStatsSnapshot = DEFAULT_PLAYER_RAID_STATS;
      return cachedStatsSnapshot;
    }
    const parsed = JSON.parse(raw) as Partial<PlayerRaidStats>;
    cachedStatsSnapshot = {
      raidsPlayed: Number(parsed.raidsPlayed || 0),
      bossesDamagedIds: Array.isArray(parsed.bossesDamagedIds) ? parsed.bossesDamagedIds : [],
      totalDamageDealt: Number(parsed.totalDamageDealt || 0),
      bestScore: Number(parsed.bestScore || 0),
      fastestPerfectMs:
        typeof parsed.fastestPerfectMs === 'number' ? parsed.fastestPerfectMs : null,
      perfectBadges: Array.isArray(parsed.perfectBadges) ? parsed.perfectBadges : [],
      attemptsByRaidId:
        parsed.attemptsByRaidId && typeof parsed.attemptsByRaidId === 'object'
          ? parsed.attemptsByRaidId
          : {},
    };
    return cachedStatsSnapshot;
  } catch {
    return DEFAULT_PLAYER_RAID_STATS;
  }
}

export function getServerPlayerRaidStatsSnapshot(): PlayerRaidStats {
  return DEFAULT_PLAYER_RAID_STATS;
}

export function recordPlayerRaidCompletion(params: {
  raidId: string;
  scope: RaidScope;
  dateKey: string;
  bossName: string;
  editionTitle: string;
  score: number;
  totalQuestions: number;
  damageDealt: number;
  timeTakenMs: number;
  perfectLimitMs?: number;
}): {
  stats: PlayerRaidStats;
  newlyEarnedBadge: PerfectRaidBadge | null;
  isPerfectUnderLimit: boolean;
} {
  const prev = loadPlayerRaidStats();
  const limitMs = params.perfectLimitMs || PERFECT_BADGE_TIME_LIMIT_MS;
  const isPerfectUnderLimit =
    params.totalQuestions > 0 &&
    params.score === params.totalQuestions &&
    params.timeTakenMs <= limitMs;

  let newlyEarnedBadge: PerfectRaidBadge | null = null;
  const nextBadges = [...prev.perfectBadges];

  if (isPerfectUnderLimit) {
    const { tier, tierLabel } = getPerfectBadgeTier(params.timeTakenMs, limitMs);
    const existingIdx = nextBadges.findIndex((b) => b.raidId === params.raidId);
    const candidateBadge: PerfectRaidBadge = {
      id: `raid_perfect_${params.raidId}`,
      raidId: params.raidId,
      scope: params.scope,
      dateKey: params.dateKey,
      bossName: params.bossName,
      editionTitle: params.editionTitle,
      score: params.score,
      totalQuestions: params.totalQuestions,
      timeTakenMs: params.timeTakenMs,
      tier,
      tierLabel,
      earnedAt: new Date().toISOString(),
    };
    if (existingIdx === -1) {
      nextBadges.unshift(candidateBadge);
      newlyEarnedBadge = candidateBadge;
    } else if (params.timeTakenMs < nextBadges[existingIdx].timeTakenMs) {
      nextBadges[existingIdx] = candidateBadge;
      newlyEarnedBadge = candidateBadge;
    }
  }

  const prevAtt = prev.attemptsByRaidId[params.raidId];
  const nextAttempt: PlayerRaidDayAttempt = {
    raidId: params.raidId,
    dateKey: params.dateKey,
    scope: params.scope,
    bestScore: Math.max(prevAtt?.bestScore || 0, params.score),
    totalQuestions: params.totalQuestions,
    bestTimeMs: prevAtt
      ? params.score >= prevAtt.bestScore
        ? Math.min(prevAtt.bestTimeMs, params.timeTakenMs)
        : prevAtt.bestTimeMs
      : params.timeTakenMs,
    totalDamageContributed: (prevAtt?.totalDamageContributed || 0) + params.damageDealt,
    attemptsCount: (prevAtt?.attemptsCount || 0) + 1,
    perfectUnderLimit: Boolean(prevAtt?.perfectUnderLimit || isPerfectUnderLimit),
    lastPlayedAt: new Date().toISOString(),
  };

  const nextIds = prev.bossesDamagedIds.includes(params.raidId)
    ? prev.bossesDamagedIds
    : [params.raidId, ...prev.bossesDamagedIds];

  const nextFastestPerfect = isPerfectUnderLimit
    ? prev.fastestPerfectMs !== null
      ? Math.min(prev.fastestPerfectMs, params.timeTakenMs)
      : params.timeTakenMs
    : prev.fastestPerfectMs;

  const updated: PlayerRaidStats = {
    raidsPlayed: prev.raidsPlayed + 1,
    bossesDamagedIds: nextIds,
    totalDamageDealt: prev.totalDamageDealt + params.damageDealt,
    bestScore: Math.max(prev.bestScore, params.score),
    fastestPerfectMs: nextFastestPerfect,
    perfectBadges: nextBadges,
    attemptsByRaidId: {
      ...prev.attemptsByRaidId,
      [params.raidId]: nextAttempt,
    },
  };

  if (typeof window !== 'undefined') {
    try {
      const serialized = JSON.stringify(updated);
      localStorage.setItem(LOCAL_RAID_STATS_KEY, serialized);
      cachedStatsRaw = serialized;
      cachedStatsSnapshot = updated;
      notifyRaidStatsListeners();
    } catch {}
  }

  return {
    stats: updated,
    newlyEarnedBadge,
    isPerfectUnderLimit,
  };
}

export function getOrCreateVisitorRaiderId(): string {
  if (typeof window === 'undefined') return 'anon_server';
  const key = 'bs_ca_raid_visitor_id_v1';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = `raider_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, created);
    return created;
  } catch {
    return `raider_${Date.now().toString(36)}`;
  }
}

// ============================================================================
// PURE-JS 1-PAGE A4 REVISION PDF GENERATOR (BUILT STRICTLY FROM ADMIN NEWS & QS)
// ============================================================================

function sanitizePdfAscii(text: string): string {
  return text
    .replace(/₹/g, 'Rs. ')
    .replace(/[•▪▸►]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfString(str: string): string {
  return sanitizePdfAscii(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapTextToLines(text: string, maxCharsPerLine: number): string[] {
  const clean = sanitizePdfAscii(text);
  if (!clean) return [];
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w.length > maxCharsPerLine ? w.slice(0, maxCharsPerLine) : w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function generateOnePageRevisionPdfBytes(edition: BossFightEdition): Uint8Array {
  const ops: string[] = [];

  // Canvas + Header
  ops.push('0.98 0.99 1.00 rg 0 0 595.28 841.89 re f');
  ops.push('0.04 0.08 0.18 rg 0 756 595.28 86 re f');
  ops.push('0.96 0.65 0.14 rg 0 752 595.28 4 re f');

  const scopeBadge = edition.scope === 'MONTH' ? 'MONTHLY BOSS RAID' : 'DAILY BOSS RAID';
  ops.push(
    `BT /F2 9 Tf 0.98 0.75 0.22 rg 36 818 Td (BANKINGSOLUTIONS  |  ${scopeBadge} UNLOCKED 1-PAGE REVISION SHEET) Tj ET`
  );
  ops.push(
    `BT /F2 14.5 Tf 1 1 1 rg 36 796 Td (${escapePdfString(edition.title.slice(0, 75))}) Tj ET`
  );
  ops.push(
    `BT /F1 8.5 Tf 0.80 0.86 0.94 rg 36 772 Td (${escapePdfString(
      `Edition: ${edition.dateKey}   |   Boss Defeated: ${edition.bossName}   |   Curated Exam Revision Summary`
    )}) Tj ET`
  );

  let y = 730;

  const drawSectionHeader = (title: string, r: number, g: number, b: number) => {
    if (y < 85) return;
    ops.push(`${r.toFixed(2)} ${g.toFixed(2)} ${b.toFixed(2)} rg 36 ${y - 4} 523 18 re f`);
    ops.push(`BT /F2 9.5 Tf 1 1 1 rg 44 ${y + 1} Td (${escapePdfString(title)}) Tj ET`);
    y -= 20;
  };

  // SECTION 1: ADMIN-ADDED CURRENT AFFAIRS NEWS
  if (edition.newsItems.length > 0) {
    drawSectionHeader('1. CURATED CURRENT AFFAIRS HIGHLIGHTS & KEY FACTS', 0.09, 0.25, 0.52);

    for (let i = 0; i < edition.newsItems.length && y > 320; i++) {
      const item = edition.newsItems[i];
      const statSuffix = item.keyStat ? ` [${item.keyStat}]` : '';
      const headLines = wrapTextToLines(
        `${i + 1}. [${item.category}] ${item.headline}${statSuffix}`,
        92
      ).slice(0, 2);

      for (const hl of headLines) {
        ops.push(`BT /F2 8.6 Tf 0.06 0.11 0.22 rg 40 ${y} Td (${escapePdfString(hl)}) Tj ET`);
        y -= 11.5;
      }

      for (const pt of item.points.slice(0, 2)) {
        if (y <= 310) break;
        const pLine = wrapTextToLines(`- ${pt}`, 94)[0] || '';
        ops.push(`BT /F1 8.2 Tf 0.18 0.22 0.30 rg 48 ${y} Td (${escapePdfString(pLine)}) Tj ET`);
        y -= 11;
      }
      y -= 3;
    }
    y -= 4;
  }

  // SECTION 2: ADMIN-ADDED BOSS RAID RAPID Q&A CHECKLIST
  if (edition.questions.length > 0 && y > 95) {
    drawSectionHeader('2. BOSS RAID RAPID Q&A REVISION CHECKLIST', 0.48, 0.22, 0.06);

    for (let i = 0; i < edition.questions.length && y > 54; i++) {
      const q = edition.questions[i];
      const ans = q.options[q.correctOptionIndex] || '';
      const compactQ = sanitizePdfAscii(q.questionText).slice(0, 66);
      const compactA = sanitizePdfAscii(ans).slice(0, 34);
      const row = `Q${i + 1}. ${compactQ}${q.questionText.length > 66 ? '...' : ''}  ->  Ans: ${compactA}`;
      ops.push(`BT /F1 8.1 Tf 0.12 0.15 0.22 rg 40 ${y} Td (${escapePdfString(row)}) Tj ET`);
      y -= 11.5;
    }
  }

  // Footer
  ops.push('0.82 0.85 0.90 RG 0.8 w 36 34 m 559 34 l S');
  ops.push(
    'BT /F1 7.5 Tf 0.38 0.43 0.52 rg 36 22 Td (Generated by BankingSolutions CA Boss Raid  |  bankingsolutions.in  |  Revise Smart, Conquer Mains) Tj ET'
  );

  const contentStream = ops.join('\n');
  const encoder = new TextEncoder();
  const streamBytesLen = encoder.encode(contentStream).byteLength;

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
    `6 0 obj\n<< /Length ${streamBytesLen} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
  ];

  let pdfText = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(encoder.encode(pdfText).byteLength);
    pdfText += obj;
  }

  const xrefOffset = encoder.encode(pdfText).byteLength;
  pdfText += `xref\n0 ${objects.length + 1}\n`;
  pdfText += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdfText += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfText += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return encoder.encode(pdfText);
}

export function downloadOnePageRevisionPdf(edition: BossFightEdition): void {
  if (typeof window === 'undefined') return;
  if (edition.customSummaryPdfUrl && edition.customSummaryPdfUrl.trim()) {
    window.open(edition.customSummaryPdfUrl.trim(), '_blank', 'noopener,noreferrer');
    return;
  }
  const pdfBytes = generateOnePageRevisionPdfBytes(edition);
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  const blob = new Blob([copy], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BSCA_Boss_Raid_1Page_${edition.dateKey}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
