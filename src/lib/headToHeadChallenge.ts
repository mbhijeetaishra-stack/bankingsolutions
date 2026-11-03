export type ChallengeCalcModule =
  | 'mixed'
  | 'simplification'
  | 'tables'
  | 'squares'
  | 'cubes'
  | 'percentages'
  | 'add_sub';

export type ChallengeCalcDifficulty = 'easy' | 'medium' | 'hard';

export type ChallengeWordMatrixMode =
  | 'banking_jargon'
  | 'editorial_definitions'
  | 'synonyms'
  | 'antonyms'
  | 'mixed';

export interface CalcLabChallengePayload {
  arena: 'calc_lab';
  challenger: string;
  score: number;
  durationSec: number;
  module: ChallengeCalcModule;
  difficulty: ChallengeCalcDifficulty;
  accuracy: number;
  seed: number;
}

export interface WordMatrixChallengePayload {
  arena: 'word_matrix';
  challenger: string;
  score: number;
  clearTimeMs: number | null;
  matchedPairs: number;
  totalPairs: number;
  mode: ChallengeWordMatrixMode;
  pairIds: string[];
}

export interface CaRaidChallengePayload {
  arena: 'ca_raid';
  challenger: string;
  score: number;
  totalQuestions: number;
  damage: number;
  timeMs: number;
  raidId: string;
  bossName: string;
}

export type HeadToHeadChallengePayload =
  | CalcLabChallengePayload
  | WordMatrixChallengePayload
  | CaRaidChallengePayload;

export interface DuelOutcomeSummary {
  verdict: 'won' | 'tied' | 'lost';
  headline: string;
  detail: string;
  challengerName: string;
  challengerTargetLabel: string;
}

export const CHALLENGER_NAME_STORAGE_KEY = 'bs_h2h_challenger_name_v1';

const CALC_MODULE_LABELS: Record<ChallengeCalcModule, string> = {
  mixed: 'Speed Mix',
  simplification: 'BODMAS Simplification',
  tables: 'Tables Drill',
  squares: 'Power Squares',
  cubes: 'Power Cubes',
  percentages: 'Fraction %',
  add_sub: 'Rapid Add/Sub',
};

const WORD_MODE_LABELS: Record<ChallengeWordMatrixMode, string> = {
  banking_jargon: 'Banking Jargon',
  editorial_definitions: 'Editorial Vocab',
  synonyms: 'Power Synonyms',
  antonyms: 'Contrast Antonyms',
  mixed: 'Grandmaster Mix',
};

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToUtf8(token: string): string {
  const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  if (typeof atob === 'function') {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(padded, 'base64').toString('utf8');
}

function sanitizeName(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim().slice(0, 28);
  return cleaned || 'Banking Aspirant';
}

export function getSavedChallengerName(fallback = 'Banking Aspirant'): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = localStorage.getItem(CHALLENGER_NAME_STORAGE_KEY);
    if (saved && saved.trim()) return sanitizeName(saved);
  } catch {}
  return sanitizeName(fallback);
}

export function saveChallengerName(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = sanitizeName(name);
    localStorage.setItem(CHALLENGER_NAME_STORAGE_KEY, clean);
  } catch {}
}

export function formatCalcDurationLabel(durationSec: number): string {
  if (durationSec === 60) return '60s Blitz';
  if (durationSec < 60) return `${durationSec}s Blitz`;
  if (durationSec === 90) return '90s Blitz';
  if (durationSec === 120) return '2m Speed Duel';
  if (durationSec === 180) return '3m Speed Clash';
  if (durationSec % 60 === 0) return `${Math.round(durationSec / 60)}m Speed Drill`;
  return `${durationSec}s Blitz`;
}

export function formatMsShortClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getChallengeHeadline(payload: HeadToHeadChallengePayload): string {
  if (payload.arena === 'calc_lab') {
    const modeSuffix =
      payload.module === 'mixed'
        ? formatCalcDurationLabel(payload.durationSec)
        : `${formatCalcDurationLabel(payload.durationSec)} (${CALC_MODULE_LABELS[payload.module]})`;
    return `Beat my score of ${payload.score} in ${modeSuffix}`;
  }

  if (payload.arena === 'word_matrix') {
    if (payload.clearTimeMs !== null && payload.matchedPairs >= payload.totalPairs) {
      const secs = (payload.clearTimeMs / 1000).toFixed(1);
      return `Beat my ${secs}s clear (${payload.score} pts) in 45s Word Matrix`;
    }
    return `Beat my score of ${payload.score} (${payload.matchedPairs}/${payload.totalPairs} pairs) in 45s Word Matrix`;
  }

  return `Beat my score of ${payload.score}/${payload.totalQuestions} (${payload.damage.toLocaleString()} DMG in ${formatMsShortClock(payload.timeMs)}) in CA Boss Fight`;
}

export function getChallengeSubtitle(payload: HeadToHeadChallengePayload): string {
  if (payload.arena === 'calc_lab') {
    const diffLabel =
      payload.difficulty === 'easy'
        ? 'Clerk Prelims'
        : payload.difficulty === 'hard'
        ? 'Mains Pro'
        : 'PO Prelims';
    return `${CALC_MODULE_LABELS[payload.module]} • ${diffLabel} • ${payload.accuracy}% Accuracy • Exact Same Seeded Questions`;
  }

  if (payload.arena === 'word_matrix') {
    const modeLabel = WORD_MODE_LABELS[payload.mode] || 'Banking Vocab';
    const timePart =
      payload.clearTimeMs !== null
        ? `Cleared in ${(payload.clearTimeMs / 1000).toFixed(1)}s`
        : `${payload.matchedPairs}/${payload.totalPairs} Pairs Matched`;
    return `${modeLabel} • ${timePart} • Exact Same 8 Vocabulary Pairs`;
  }

  return `${payload.bossName} • ${payload.damage.toLocaleString()} DMG • Time ${formatMsShortClock(payload.timeMs)} • Exact Same 10 GA Questions`;
}

interface CompactWireChallenge {
  v: 1;
  d: Record<string, unknown>;
  k: string;
}

export function encodeChallengeToken(payload: HeadToHeadChallengePayload): string {
  let compact: Record<string, unknown>;
  if (payload.arena === 'calc_lab') {
    compact = {
      a: 'c',
      n: sanitizeName(payload.challenger),
      s: Math.max(0, Math.round(payload.score)),
      t: Math.max(15, Math.round(payload.durationSec)),
      m: payload.module,
      df: payload.difficulty,
      ac: Math.max(0, Math.min(100, Math.round(payload.accuracy))),
      sd: Math.abs(Math.trunc(payload.seed)) || 104729,
    };
  } else if (payload.arena === 'word_matrix') {
    compact = {
      a: 'w',
      n: sanitizeName(payload.challenger),
      s: Math.max(0, Math.round(payload.score)),
      ct: payload.clearTimeMs !== null ? Math.max(100, Math.round(payload.clearTimeMs)) : null,
      mp: Math.max(0, Math.round(payload.matchedPairs)),
      tp: Math.max(1, Math.round(payload.totalPairs)),
      m: payload.mode,
      p: payload.pairIds.slice(0, 8),
    };
  } else {
    compact = {
      a: 'r',
      n: sanitizeName(payload.challenger),
      s: Math.max(0, Math.round(payload.score)),
      tq: Math.max(1, Math.round(payload.totalQuestions)),
      dm: Math.max(0, Math.round(payload.damage)),
      tm: Math.max(0, Math.round(payload.timeMs)),
      id: payload.raidId,
      bn: payload.bossName.slice(0, 60),
    };
  }

  const serializedData = JSON.stringify(compact);
  const wire: CompactWireChallenge = {
    v: 1,
    d: compact,
    k: fnv1aHex(`bs_h2h_v1:${serializedData}`),
  };
  return utf8ToBase64Url(JSON.stringify(wire));
}

const VALID_CALC_MODULES = new Set<ChallengeCalcModule>([
  'mixed',
  'simplification',
  'tables',
  'squares',
  'cubes',
  'percentages',
  'add_sub',
]);

const VALID_CALC_DIFFS = new Set<ChallengeCalcDifficulty>(['easy', 'medium', 'hard']);

const VALID_WORD_MODES = new Set<ChallengeWordMatrixMode>([
  'banking_jargon',
  'editorial_definitions',
  'synonyms',
  'antonyms',
  'mixed',
]);

export function decodeChallengeToken(
  token: string | null | undefined,
  expectedArena?: HeadToHeadChallengePayload['arena']
): HeadToHeadChallengePayload | null {
  if (!token || typeof token !== 'string' || token.length > 1600) return null;

  try {
    const json = base64UrlToUtf8(token.trim());
    const wire = JSON.parse(json) as Partial<CompactWireChallenge>;
    if (!wire || wire.v !== 1 || !wire.d || typeof wire.d !== 'object' || typeof wire.k !== 'string') {
      return null;
    }

    const expectedKey = fnv1aHex(`bs_h2h_v1:${JSON.stringify(wire.d)}`);
    if (wire.k !== expectedKey) return null;

    const d = wire.d;
    let decoded: HeadToHeadChallengePayload | null = null;

    if (d.a === 'c') {
      const mod = String(d.m || 'mixed') as ChallengeCalcModule;
      const diff = String(d.df || 'medium') as ChallengeCalcDifficulty;
      decoded = {
        arena: 'calc_lab',
        challenger: sanitizeName(String(d.n || 'Challenger')),
        score: Math.max(0, Number(d.s) || 0),
        durationSec: Math.min(3600, Math.max(15, Number(d.t) || 60)),
        module: VALID_CALC_MODULES.has(mod) ? mod : 'mixed',
        difficulty: VALID_CALC_DIFFS.has(diff) ? diff : 'medium',
        accuracy: Math.max(0, Math.min(100, Number(d.ac) || 100)),
        seed: Math.abs(Math.trunc(Number(d.sd) || 104729)),
      };
    } else if (d.a === 'w') {
      const wmMode = String(d.m || 'banking_jargon') as ChallengeWordMatrixMode;
      const rawPairs = Array.isArray(d.p)
        ? d.p.filter((id): id is string => typeof id === 'string').slice(0, 8)
        : [];
      decoded = {
        arena: 'word_matrix',
        challenger: sanitizeName(String(d.n || 'Challenger')),
        score: Math.max(0, Number(d.s) || 0),
        clearTimeMs: typeof d.ct === 'number' && d.ct > 0 ? d.ct : null,
        matchedPairs: Math.max(0, Number(d.mp) || 0),
        totalPairs: Math.max(1, Number(d.tp) || 8),
        mode: VALID_WORD_MODES.has(wmMode) ? wmMode : 'banking_jargon',
        pairIds: rawPairs,
      };
    } else if (d.a === 'r') {
      const raidId = String(d.id || '').trim();
      if (!raidId) return null;
      decoded = {
        arena: 'ca_raid',
        challenger: sanitizeName(String(d.n || 'Challenger')),
        score: Math.max(0, Number(d.s) || 0),
        totalQuestions: Math.max(1, Number(d.tq) || 10),
        damage: Math.max(0, Number(d.dm) || 0),
        timeMs: Math.max(0, Number(d.tm) || 0),
        raidId,
        bossName: String(d.bn || 'Daily CA Boss').slice(0, 60),
      };
    }

    if (!decoded) return null;
    if (expectedArena && decoded.arena !== expectedArena) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function buildChallengeShareLinks(
  payload: HeadToHeadChallengePayload,
  options?: {
    origin?: string;
    conqueredChallenge?: DuelOutcomeSummary | null;
  }
): {
  headline: string;
  challengeUrl: string;
  fullShareText: string;
  telegramShareUrl: string;
  whatsappShareUrl: string;
} {
  const baseOrigin =
    options?.origin ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://bankingsolutions.in');

  const token = encodeChallengeToken(payload);
  let path = '/calc-lab';
  if (payload.arena === 'calc_lab') {
    path = `/calc-lab?c=${encodeURIComponent(token)}`;
  } else if (payload.arena === 'word_matrix') {
    path = `/word-matrix?c=${encodeURIComponent(token)}`;
  } else {
    path = `/ca-raid?raid=${encodeURIComponent(payload.raidId)}&c=${encodeURIComponent(token)}`;
  }

  const challengeUrl = `${baseOrigin}${path}`;
  const headline = getChallengeHeadline(payload);
  const conquered = options?.conqueredChallenge;

  const introLine =
    conquered && conquered.verdict === 'won'
      ? `🏆 I just beat ${conquered.challengerName}'s challenge (${conquered.challengerTargetLabel})!`
      : `⚔️ Head-to-Head Banking Study Challenge from ${sanitizeName(payload.challenger)}!`;

  const arenaTag =
    payload.arena === 'calc_lab'
      ? `⚡ Same seeded mental math questions (${payload.accuracy}% Accuracy)`
      : payload.arena === 'word_matrix'
      ? '🧩 Exact same 4×4 Banking & Editorial Vocabulary board'
      : `🐉 ${payload.bossName} — Same 10-Question GA Raid`;

  const telegramBody = `${introLine}\n🔥 "${headline}"\n${arenaTag}\n👇 Tap to accept the duel:`;
  const fullShareText = `${introLine}\n🔥 "${headline}"\n${arenaTag}\n👉 ${challengeUrl}`;

  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(
    challengeUrl
  )}&text=${encodeURIComponent(telegramBody)}`;

  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullShareText)}`;

  return {
    headline,
    challengeUrl,
    fullShareText,
    telegramShareUrl,
    whatsappShareUrl,
  };
}

export function evaluateCalcLabDuel(
  challenge: CalcLabChallengePayload,
  myScore: number,
  myAccuracy: number
): DuelOutcomeSummary {
  const targetLabel = `${challenge.score} in ${formatCalcDurationLabel(challenge.durationSec)}`;
  if (myScore > challenge.score) {
    return {
      verdict: 'won',
      headline: `Victory! You Beat ${challenge.challenger}'s Score!`,
      detail: `You solved ${myScore} vs ${challenge.challenger}'s ${challenge.score} (+${
        myScore - challenge.score
      } ahead)!`,
      challengerName: challenge.challenger,
      challengerTargetLabel: targetLabel,
    };
  }
  if (myScore === challenge.score) {
    if (myAccuracy > challenge.accuracy) {
      return {
        verdict: 'won',
        headline: `Tiebreaker Win vs ${challenge.challenger}!`,
        detail: `Tied at ${myScore} solved, and your ${myAccuracy}% accuracy edged out ${challenge.accuracy}%!`,
        challengerName: challenge.challenger,
        challengerTargetLabel: targetLabel,
      };
    }
    return {
      verdict: 'tied',
      headline: `Dead Heat Tie with ${challenge.challenger}!`,
      detail: `Both of you hit ${myScore} in ${formatCalcDurationLabel(challenge.durationSec)}! Run it back to break the tie.`,
      challengerName: challenge.challenger,
      challengerTargetLabel: targetLabel,
    };
  }
  return {
    verdict: 'lost',
    headline: `${challenge.challenger} Holds the Crown (${challenge.score} vs ${myScore})`,
    detail: `Only ${challenge.score - myScore} more correct answer${
      challenge.score - myScore === 1 ? '' : 's'
    } needed to beat ${challenge.challenger}!`,
    challengerName: challenge.challenger,
    challengerTargetLabel: targetLabel,
  };
}

export function evaluateWordMatrixDuel(
  challenge: WordMatrixChallengePayload,
  myScore: number,
  myClearTimeMs: number | null,
  myMatchedPairs: number
): DuelOutcomeSummary {
  const targetLabel =
    challenge.clearTimeMs !== null
      ? `${(challenge.clearTimeMs / 1000).toFixed(1)}s (${challenge.score} pts)`
      : `${challenge.score} pts (${challenge.matchedPairs}/${challenge.totalPairs} pairs)`;

  if (myScore > challenge.score) {
    return {
      verdict: 'won',
      headline: `Victory! You Beat ${challenge.challenger}'s Word Matrix!`,
      detail: `Your ${myScore} pts${
        myClearTimeMs !== null ? ` (${(myClearTimeMs / 1000).toFixed(1)}s)` : ''
      } topped ${challenge.challenger}'s ${targetLabel}!`,
      challengerName: challenge.challenger,
      challengerTargetLabel: targetLabel,
    };
  }
  if (
    myScore === challenge.score &&
    myClearTimeMs !== null &&
    challenge.clearTimeMs !== null &&
    myClearTimeMs < challenge.clearTimeMs
  ) {
    return {
      verdict: 'won',
      headline: `Speed Tiebreaker Win vs ${challenge.challenger}!`,
      detail: `Cleared in ${(myClearTimeMs / 1000).toFixed(1)}s vs ${(
        challenge.clearTimeMs / 1000
      ).toFixed(1)}s!`,
      challengerName: challenge.challenger,
      challengerTargetLabel: targetLabel,
    };
  }
  if (myScore === challenge.score && myMatchedPairs === challenge.matchedPairs) {
    return {
      verdict: 'tied',
      headline: `Exact Tie with ${challenge.challenger}!`,
      detail: `Both scored ${myScore} pts on the exact same 8 vocabulary pairs!`,
      challengerName: challenge.challenger,
      challengerTargetLabel: targetLabel,
    };
  }
  return {
    verdict: 'lost',
    headline: `${challenge.challenger} Leads (${challenge.score} vs ${myScore} pts)`,
    detail: `Hit "Retry Same 8 Pairs" to beat ${challenge.challenger}'s ${targetLabel}!`,
    challengerName: challenge.challenger,
    challengerTargetLabel: targetLabel,
  };
}

export function evaluateCaRaidDuel(
  challenge: CaRaidChallengePayload,
  myScore: number,
  myDamage: number,
  myTimeMs: number
): DuelOutcomeSummary {
  const targetLabel = `${challenge.score}/${challenge.totalQuestions} (${challenge.damage.toLocaleString()} DMG in ${formatMsShortClock(
    challenge.timeMs
  )})`;

  if (
    myScore > challenge.score ||
    (myScore === challenge.score && myDamage > challenge.damage) ||
    (myScore === challenge.score && myDamage === challenge.damage && myTimeMs < challenge.timeMs)
  ) {
    return {
      verdict: 'won',
      headline: `Boss Duel Won! You Out-Raided ${challenge.challenger}!`,
      detail: `You scored ${myScore}/${challenge.totalQuestions} (${myDamage.toLocaleString()} DMG in ${formatMsShortClock(
        myTimeMs
      )}) vs ${targetLabel}!`,
      challengerName: challenge.challenger,
      challengerTargetLabel: targetLabel,
    };
  }
  if (myScore === challenge.score && myDamage === challenge.damage && myTimeMs === challenge.timeMs) {
    return {
      verdict: 'tied',
      headline: `Exact Tie with ${challenge.challenger}!`,
      detail: `Identical ${targetLabel} on ${challenge.bossName}!`,
      challengerName: challenge.challenger,
      challengerTargetLabel: targetLabel,
    };
  }
  return {
    verdict: 'lost',
    headline: `${challenge.challenger} Leads This Boss Fight!`,
    detail: `${challenge.challenger} posted ${targetLabel} — strike again to claim the crown!`,
    challengerName: challenge.challenger,
    challengerTargetLabel: targetLabel,
  };
}

