import { supabase } from './supabase';
import { checkAndClaimEmailGrants, persistSettingToSupabase } from './monetization';

/**
 * Paid access for Topic-wise Question Practice (/practice)
 * --------------------------------------------------------
 * - Admin decides price + duration of every plan (stored in `admin_settings` under PRACTICE_ACCESS_KEY).
 * - A purchase is stored in `student_course_purchases` with course_name = PRACTICE_COURSE_NAME and an `expires_at`.
 * - PRO Pass holders, admin email grants and admins also get access.
 * - The database itself (RLS on practice_questions) enforces the same rule – see supabase/practice_questions.sql.
 */

export const PRACTICE_ACCESS_KEY = 'bs_practice_access_v1';
export const PRACTICE_COURSE_NAME = 'Topic-wise Question Practice';
const ADMIN_EMAIL = 'abhijeet9022102210@gmail.com';

export type DurationUnit = 'DAYS' | 'MONTHS';

export interface PracticePlan {
  id: string;
  title: string;
  durationValue: number;
  durationUnit: DurationUnit;
  originalPrice: number;
  price: number;
  badge?: string;
  isPopular?: boolean;
  isActive: boolean;
}

export interface PracticeAccessConfig {
  /** When false, practice is free for everyone. */
  isPaid: boolean;
  plans: PracticePlan[];
}

export const DEFAULT_PRACTICE_PLANS: PracticePlan[] = [
  { id: 'pq_1m', title: '1 Month Practice Pass', durationValue: 1, durationUnit: 'MONTHS', originalPrice: 199, price: 99, badge: 'STARTER', isPopular: false, isActive: true },
  { id: 'pq_3m', title: '3 Months Practice Pass', durationValue: 3, durationUnit: 'MONTHS', originalPrice: 399, price: 199, badge: 'MOST POPULAR', isPopular: true, isActive: true },
  { id: 'pq_12m', title: '12 Months Practice Pass', durationValue: 12, durationUnit: 'MONTHS', originalPrice: 999, price: 449, badge: 'BEST VALUE', isPopular: false, isActive: true },
];

export const DEFAULT_PRACTICE_ACCESS: PracticeAccessConfig = { isPaid: true, plans: DEFAULT_PRACTICE_PLANS };

function normaliseConfig(raw: any): PracticeAccessConfig {
  return {
    isPaid: typeof raw?.isPaid === 'boolean' ? raw.isPaid : true,
    plans: Array.isArray(raw?.plans) ? raw.plans : DEFAULT_PRACTICE_PLANS,
  };
}

export function getPracticeAccessConfig(): PracticeAccessConfig {
  if (typeof window === 'undefined') return DEFAULT_PRACTICE_ACCESS;
  try {
    const raw = localStorage.getItem(PRACTICE_ACCESS_KEY);
    return raw ? normaliseConfig(JSON.parse(raw)) : DEFAULT_PRACTICE_ACCESS;
  } catch {
    return DEFAULT_PRACTICE_ACCESS;
  }
}

/** Reads the latest config from Supabase (falls back to the cached copy). */
export async function syncPracticeAccessConfig(): Promise<PracticeAccessConfig> {
  let config = getPracticeAccessConfig();
  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', PRACTICE_ACCESS_KEY)
      .maybeSingle();
    if (data?.setting_value) {
      config = normaliseConfig(JSON.parse(data.setting_value));
      try {
        localStorage.setItem(PRACTICE_ACCESS_KEY, JSON.stringify(config));
      } catch {}
    }
  } catch {}
  return config;
}

export async function savePracticeAccessConfig(config: PracticeAccessConfig): Promise<PracticeAccessConfig> {
  const serialized = JSON.stringify(config);
  try {
    localStorage.setItem(PRACTICE_ACCESS_KEY, serialized);
  } catch {}
  await persistSettingToSupabase(PRACTICE_ACCESS_KEY, serialized);
  return config;
}

export function formatPlanDuration(plan: Pick<PracticePlan, 'durationValue' | 'durationUnit'>): string {
  const v = plan.durationValue;
  if (plan.durationUnit === 'DAYS') return `${v} ${v === 1 ? 'Day' : 'Days'}`;
  return `${v} ${v === 1 ? 'Month' : 'Months'}`;
}

/** New expiry = (current active expiry or now) + plan duration, so renewing early never loses days. */
export function computePlanExpiry(plan: PracticePlan, currentExpiry?: string | null): Date {
  const now = new Date();
  const base = currentExpiry && new Date(currentExpiry) > now ? new Date(currentExpiry) : now;
  const d = new Date(base);
  if (plan.durationUnit === 'DAYS') d.setDate(d.getDate() + plan.durationValue);
  else d.setMonth(d.getMonth() + plan.durationValue);
  return d;
}

export interface PracticeAccessState {
  user: any | null;
  hasAccess: boolean;
  isPaid: boolean;
  /** ISO date, or null for lifetime / free mode */
  expiresAt: string | null;
  source: 'FREE_MODE' | 'ADMIN' | 'PURCHASE' | 'PRO_PASS' | 'GRANT' | 'NONE';
}

const matchesPractice = (name: string) => {
  const n = (name || '').toLowerCase();
  return n.includes('topic-wise question practice') || n.includes('topic practice');
};
const matchesProPass = (name: string) => (name || '').toLowerCase().includes('pro pass');

export async function checkPracticeAccess(): Promise<PracticeAccessState> {
  const config = await syncPracticeAccessConfig();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user || null;

  if (!config.isPaid) return { user, hasAccess: true, isPaid: false, expiresAt: null, source: 'FREE_MODE' };
  if (!user) return { user: null, hasAccess: false, isPaid: true, expiresAt: null, source: 'NONE' };

  // Admins
  if (user.email?.toLowerCase() === ADMIN_EMAIL || user.app_metadata?.role === 'admin') {
    return { user, hasAccess: true, isPaid: true, expiresAt: null, source: 'ADMIN' };
  }
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (profile?.is_admin === true) return { user, hasAccess: true, isPaid: true, expiresAt: null, source: 'ADMIN' };

  // Admin "grant by email" (also copies the grant into student_course_purchases so the DB lets them read questions)
  let grantSource: PracticeAccessState | null = null;
  try {
    const grants = await checkAndClaimEmailGrants(user);
    const g = grants.find((x) => matchesPractice(x.courseName) || matchesProPass(x.courseName));
    if (g) grantSource = { user, hasAccess: true, isPaid: true, expiresAt: g.expiresAt || null, source: 'GRANT' };
  } catch {}

  // Purchases (own practice pass, or PRO Pass)
  const { data: purchases } = await supabase
    .from('student_course_purchases')
    .select('course_name, expires_at')
    .eq('user_id', user.id);

  const now = new Date();
  const valid = (purchases || []).filter(
    (p: any) => (matchesPractice(p.course_name) || matchesProPass(p.course_name)) && (!p.expires_at || new Date(p.expires_at) > now)
  );
  if (valid.length > 0) {
    // Report the furthest expiry (null = lifetime wins)
    const lifetime = valid.find((p: any) => !p.expires_at);
    const best = lifetime || valid.sort((a: any, b: any) => +new Date(b.expires_at) - +new Date(a.expires_at))[0];
    return {
      user,
      hasAccess: true,
      isPaid: true,
      expiresAt: best.expires_at || null,
      source: matchesPractice(best.course_name) ? 'PURCHASE' : 'PRO_PASS',
    };
  }

  return grantSource || { user, hasAccess: false, isPaid: true, expiresAt: null, source: 'NONE' };
}

/** Returns the student's current practice-pass expiry (to extend on renewal). */
export async function getCurrentPracticeExpiry(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('student_course_purchases')
    .select('expires_at')
    .eq('user_id', userId)
    .eq('course_name', PRACTICE_COURSE_NAME)
    .maybeSingle();
  return data?.expires_at || null;
}

export async function recordPracticePurchase(params: {
  userId: string;
  plan: PracticePlan;
  amountPaid: number;
  paymentId: string;
}): Promise<{ expiresAt: string; error?: string }> {
  const current = await getCurrentPracticeExpiry(params.userId);
  const expiresAt = computePlanExpiry(params.plan, current).toISOString();
  const { error } = await supabase.from('student_course_purchases').upsert(
    [
      {
        user_id: params.userId,
        course_name: PRACTICE_COURSE_NAME,
        amount_paid: params.amountPaid,
        payment_id: params.paymentId,
        expires_at: expiresAt,
      },
    ],
    { onConflict: 'user_id,course_name' }
  );
  return { expiresAt, error: error?.message };
}

