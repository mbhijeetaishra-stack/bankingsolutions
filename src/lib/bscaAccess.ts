import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { checkAndClaimEmailGrants, persistSettingToSupabase } from './monetization';
import { DurationUnit } from './practiceAccess';

/**
 * Dedicated Standalone Monetization for BSCA Current Affairs Hub (/bsca)
 * ---------------------------------------------------------------------
 * - Allows students to buy ONLY Current Affairs (without buying the full Pro Pass).
 * - Admin controls prices, durations, discounts, and free/paid mode in AdminBscaPricing.
 * - Stored in `admin_settings` under BSCA_ACCESS_KEY.
 * - Purchases recorded in `student_course_purchases` with course_name = BSCA_COURSE_NAME.
 * - Full PRO Pass holders, admin email grants, and admins also automatically get access.
 */

export const BSCA_ACCESS_KEY = 'bs_bsca_access_v1';
export const BSCA_COURSE_NAME = 'BSCA Current Affairs Pass';
const ADMIN_EMAIL = 'abhijeet9022102210@gmail.com';

export interface BscaPlan {
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

export interface BscaAccessConfig {
  /** When false, all current affairs PDFs and quizzes are free for everyone */
  isPaid: boolean;
  plans: BscaPlan[];
}

export const DEFAULT_BSCA_PLANS: BscaPlan[] = [
  {
    id: 'bsca_1m',
    title: '1 Month Current Affairs Pass',
    durationValue: 1,
    durationUnit: 'MONTHS',
    originalPrice: 149,
    price: 69,
    badge: 'STARTER',
    isPopular: false,
    isActive: true,
  },
  {
    id: 'bsca_3m',
    title: '3 Months Current Affairs Pass',
    durationValue: 3,
    durationUnit: 'MONTHS',
    originalPrice: 299,
    price: 149,
    badge: 'MOST POPULAR',
    isPopular: true,
    isActive: true,
  },
  {
    id: 'bsca_12m',
    title: '12 Months Complete GA Pass',
    durationValue: 12,
    durationUnit: 'MONTHS',
    originalPrice: 699,
    price: 299,
    badge: 'BEST VALUE',
    isPopular: false,
    isActive: true,
  },
];

export const DEFAULT_BSCA_ACCESS: BscaAccessConfig = {
  isPaid: true,
  plans: DEFAULT_BSCA_PLANS,
};

function normaliseConfig(raw: unknown): BscaAccessConfig {
  const obj = raw as Partial<BscaAccessConfig> | undefined;
  return {
    isPaid: typeof obj?.isPaid === 'boolean' ? obj.isPaid : true,
    plans: Array.isArray(obj?.plans) && obj.plans.length > 0 ? obj.plans : DEFAULT_BSCA_PLANS,
  };
}

export function getBscaAccessConfig(): BscaAccessConfig {
  if (typeof window === 'undefined') return DEFAULT_BSCA_ACCESS;
  try {
    const raw = localStorage.getItem(BSCA_ACCESS_KEY);
    return raw ? normaliseConfig(JSON.parse(raw)) : DEFAULT_BSCA_ACCESS;
  } catch {
    return DEFAULT_BSCA_ACCESS;
  }
}

/** Reads the latest Current Affairs pricing config from Supabase (falls back to cached copy) */
export async function syncBscaAccessConfig(): Promise<BscaAccessConfig> {
  let config = getBscaAccessConfig();
  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', BSCA_ACCESS_KEY)
      .maybeSingle();

    if (data?.setting_value) {
      config = normaliseConfig(JSON.parse(data.setting_value));
      try {
        localStorage.setItem(BSCA_ACCESS_KEY, JSON.stringify(config));
      } catch {}
    }
  } catch {}
  return config;
}

export async function saveBscaAccessConfig(config: BscaAccessConfig): Promise<BscaAccessConfig> {
  const serialized = JSON.stringify(config);
  try {
    localStorage.setItem(BSCA_ACCESS_KEY, serialized);
  } catch {}
  await persistSettingToSupabase(BSCA_ACCESS_KEY, serialized);
  return config;
}

/** New expiry = (current active expiry or now) + plan duration */
export function computeBscaPlanExpiry(plan: BscaPlan, currentExpiry?: string | null): Date {
  const now = new Date();
  const base = currentExpiry && new Date(currentExpiry) > now ? new Date(currentExpiry) : now;
  const d = new Date(base);
  if (plan.durationUnit === 'DAYS') d.setDate(d.getDate() + plan.durationValue);
  else d.setMonth(d.getMonth() + plan.durationValue);
  return d;
}

interface StudentPurchaseRow {
  course_name: string;
  expires_at: string | null;
}

export interface BscaAccessState {
  user: User | null;
  hasAccess: boolean;
  isPaid: boolean;
  expiresAt: string | null;
  source: 'FREE_MODE' | 'ADMIN' | 'BSCA_PASS' | 'PRO_PASS' | 'GRANT' | 'NONE';
}

const matchesBscaPass = (name: string) => {
  const n = (name || '').toLowerCase();
  return (
    n.includes('bsca') ||
    n.includes('current affairs') ||
    n.includes('general awareness') ||
    n.includes('daily ca')
  );
};

const matchesProPass = (name: string) => (name || '').toLowerCase().includes('pro pass');

/**
 * Checks whether user has access to Current Affairs PDFs, Quizzes & Capsules.
 * Access is granted if:
 * 1. Admin set isPaid = false (Free Mode)
 * 2. User is Admin
 * 3. User purchased standalone "BSCA Current Affairs Pass"
 * 4. User purchased full "PRO Pass" (which includes everything)
 * 5. User received an email grant for either
 */
export async function checkBscaAccess(): Promise<BscaAccessState> {
  const config = await syncBscaAccessConfig();
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

  // Admin "grant by email"
  let grantSource: BscaAccessState | null = null;
  try {
    const grants = await checkAndClaimEmailGrants(user);
    const g = grants.find((x) => matchesBscaPass(x.courseName) || matchesProPass(x.courseName));
    if (g) grantSource = { user, hasAccess: true, isPaid: true, expiresAt: g.expiresAt || null, source: 'GRANT' };
  } catch {}

  // Purchases in student_course_purchases
  const { data: purchases } = await supabase
    .from('student_course_purchases')
    .select('course_name, expires_at')
    .eq('user_id', user.id);

  const now = new Date();
  const valid = ((purchases || []) as StudentPurchaseRow[]).filter(
    (p) =>
      (matchesBscaPass(p.course_name) || matchesProPass(p.course_name)) &&
      (!p.expires_at || new Date(p.expires_at) > now)
  );

  if (valid.length > 0) {
    const lifetime = valid.find((p) => !p.expires_at);
    const best =
      lifetime ||
      valid.sort((a, b) => +new Date(b.expires_at || 0) - +new Date(a.expires_at || 0))[0];
    const isPro = matchesProPass(best.course_name);
    return {
      user,
      hasAccess: true,
      isPaid: true,
      expiresAt: best.expires_at || null,
      source: isPro ? 'PRO_PASS' : 'BSCA_PASS',
    };
  }

  return grantSource || { user, hasAccess: false, isPaid: true, expiresAt: null, source: 'NONE' };
}

export async function getCurrentBscaExpiry(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('student_course_purchases')
    .select('expires_at')
    .eq('user_id', userId)
    .eq('course_name', BSCA_COURSE_NAME)
    .maybeSingle();
  return data?.expires_at || null;
}

export async function recordBscaPurchase(params: {
  userId: string;
  plan: BscaPlan;
  amountPaid: number;
  paymentId: string;
}): Promise<{ expiresAt: string; error?: string }> {
  const current = await getCurrentBscaExpiry(params.userId);
  const expiresAt = computeBscaPlanExpiry(params.plan, current).toISOString();
  const { error } = await supabase.from('student_course_purchases').upsert(
    [
      {
        user_id: params.userId,
        course_name: BSCA_COURSE_NAME,
        amount_paid: params.amountPaid,
        payment_id: params.paymentId,
        expires_at: expiresAt,
      },
    ],
    { onConflict: 'user_id,course_name' }
  );
  return { expiresAt, error: error?.message };
}

