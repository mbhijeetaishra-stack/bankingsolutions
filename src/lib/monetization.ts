import { supabase } from './supabase';

export type CouponTarget =
  | 'ALL'
  | 'PRO_PASS'
  | 'MISTAKE_NOTEBOOK'
  | 'CRITICAL_REASONING'
  | 'COMPUTER'
  | 'EBOOKS'
  | 'TOPIC_PRACTICE'
  | 'CURRENT_AFFAIRS';

export interface PromoCoupon {
  id: string;
  code: string;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: number;
  applicableTo: CouponTarget;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface ProPassPlan {
  id: string;
  title: string;
  durationMonths: number;
  originalPrice: number;
  launchPrice: number;
  badge?: string;
  isPopular?: boolean;
  isActive: boolean;
}

export interface ProPassConfig {
  isVisibleOnWebsite: boolean;
  plans: ProPassPlan[];
}

const COUPONS_STORAGE_KEY = 'bs_promo_coupons_v1';
const PRO_PASS_CONFIG_KEY = 'bs_pro_pass_config_v1';

export const DEFAULT_PRO_PASS_PLANS: ProPassPlan[] = [
  {
    id: 'plan_1m',
    title: '1 Month Starter Pass',
    durationMonths: 1,
    originalPrice: 499,
    launchPrice: 199,
    badge: 'QUICK BOOST',
    isPopular: false,
    isActive: true,
  },
  {
    id: 'plan_3m',
    title: '3 Months Target Pass',
    durationMonths: 3,
    originalPrice: 999,
    launchPrice: 349,
    badge: 'PRELIMS + MAINS',
    isPopular: false,
    isActive: true,
  },
  {
    id: 'plan_6m',
    title: '6 Months Pro Pass',
    durationMonths: 6,
    originalPrice: 1499,
    launchPrice: 499,
    badge: 'MOST POPULAR',
    isPopular: true,
    isActive: true,
  },
  {
    id: 'plan_12m',
    title: '12 Months Ultimate Pass',
    durationMonths: 12,
    originalPrice: 2499,
    launchPrice: 799,
    badge: 'BEST VALUE',
    isPopular: false,
    isActive: true,
  },
];

export const DEFAULT_COUPONS: PromoCoupon[] = [
  {
    id: 'default_bsol',
    code: 'BSOL',
    discountType: 'PERCENT',
    discountValue: 50,
    applicableTo: 'ALL',
    description: 'Official BankingSolutions Educator Launch Offer (50% OFF)',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'default_bank50',
    code: 'BANK50',
    discountType: 'PERCENT',
    discountValue: 50,
    applicableTo: 'ALL',
    description: 'Aspirant Special 50% Scholarship Discount',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'default_rrb2026',
    code: 'RRB2026',
    discountType: 'FLAT',
    discountValue: 150,
    applicableTo: 'ALL',
    description: 'RRB PO & Clerk 2026 Target Batch Flat ₹150 OFF',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export function getProPassConfig(): ProPassConfig {
  if (typeof window === 'undefined') {
    return { isVisibleOnWebsite: false, plans: DEFAULT_PRO_PASS_PLANS };
  }
  try {
    const raw = localStorage.getItem(PRO_PASS_CONFIG_KEY);
    if (!raw) {
      return {
        isVisibleOnWebsite: false,
        plans: DEFAULT_PRO_PASS_PLANS,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      isVisibleOnWebsite:
        typeof parsed.isVisibleOnWebsite === 'boolean'
          ? parsed.isVisibleOnWebsite
          : false,
      plans:
        Array.isArray(parsed.plans) && parsed.plans.length > 0
          ? parsed.plans
          : DEFAULT_PRO_PASS_PLANS,
    };
  } catch (e) {
    return { isVisibleOnWebsite: false, plans: DEFAULT_PRO_PASS_PLANS };
  }
}

export async function persistSettingToSupabase(
  key: string,
  value: string
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('admin_settings')
      .select('id')
      .eq('setting_key', key)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from('admin_settings')
        .update({ setting_value: value, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('admin_settings')
        .insert([{ setting_key: key, setting_value: value }]);
    }
  } catch (e) {
    console.error(`Failed to persist ${key} to Supabase:`, e);
  }
}

export function saveProPassConfig(config: ProPassConfig): ProPassConfig {
  const serialized = JSON.stringify(config);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PRO_PASS_CONFIG_KEY, serialized);
    } catch (e) {
      console.error('Failed to save PRO Pass config:', e);
    }
  }
  persistSettingToSupabase(PRO_PASS_CONFIG_KEY, serialized);
  return config;
}

export function setProPassVisibility(isVisible: boolean): ProPassConfig {
  const current = getProPassConfig();
  return saveProPassConfig({ ...current, isVisibleOnWebsite: isVisible });
}

export function upsertProPassPlan(
  plan: Omit<ProPassPlan, 'id'> & { id?: string }
): ProPassConfig {
  const current = getProPassConfig();
  const planId = plan.id || `plan_${Date.now()}`;
  const existingIdx = current.plans.findIndex((p) => p.id === planId);
  let nextPlans: ProPassPlan[];

  const normalizedPlan: ProPassPlan = {
    ...plan,
    id: planId,
  };

  if (normalizedPlan.isPopular) {
    current.plans = current.plans.map((p) => ({ ...p, isPopular: false }));
  }

  if (existingIdx >= 0) {
    nextPlans = [...current.plans];
    nextPlans[existingIdx] = normalizedPlan;
  } else {
    nextPlans = [...current.plans, normalizedPlan].sort(
      (a, b) => a.durationMonths - b.durationMonths
    );
  }

  return saveProPassConfig({ ...current, plans: nextPlans });
}

export function toggleProPassPlanActive(planId: string): ProPassConfig {
  const current = getProPassConfig();
  const nextPlans = current.plans.map((p) =>
    p.id === planId ? { ...p, isActive: !p.isActive } : p
  );
  return saveProPassConfig({ ...current, plans: nextPlans });
}

export function deleteProPassPlan(planId: string): ProPassConfig {
  const current = getProPassConfig();
  const nextPlans = current.plans.filter((p) => p.id !== planId);
  return saveProPassConfig({ ...current, plans: nextPlans });
}

// --- MISTAKE NOTEBOOK DURATION PLANS ---
const NOTEBOOK_PLANS_KEY = 'bs_notebook_plans_v1';

export const DEFAULT_NOTEBOOK_PLANS: ProPassPlan[] = [
  {
    id: 'nb_1m',
    title: '1 Month Vault Access',
    durationMonths: 1,
    originalPrice: 149,
    launchPrice: 79,
    badge: 'QUICK REVISION',
    isPopular: false,
    isActive: true,
  },
  {
    id: 'nb_3m',
    title: '3 Months Vault Access',
    durationMonths: 3,
    originalPrice: 249,
    launchPrice: 129,
    badge: 'PRELIMS + MAINS',
    isPopular: false,
    isActive: true,
  },
  {
    id: 'nb_6m',
    title: '6 Months Vault Access',
    durationMonths: 6,
    originalPrice: 399,
    launchPrice: 199,
    badge: 'MOST POPULAR',
    isPopular: true,
    isActive: true,
  },
  {
    id: 'nb_12m',
    title: '12 Months Vault Access',
    durationMonths: 12,
    originalPrice: 599,
    launchPrice: 299,
    badge: 'BEST VALUE',
    isPopular: false,
    isActive: true,
  },
];

export function getNotebookPlans(): ProPassPlan[] {
  if (typeof window === 'undefined') return DEFAULT_NOTEBOOK_PLANS;
  try {
    const raw = localStorage.getItem(NOTEBOOK_PLANS_KEY);
    if (!raw) {
      localStorage.setItem(
        NOTEBOOK_PLANS_KEY,
        JSON.stringify(DEFAULT_NOTEBOOK_PLANS)
      );
      return DEFAULT_NOTEBOOK_PLANS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_NOTEBOOK_PLANS;
  } catch (e) {
    return DEFAULT_NOTEBOOK_PLANS;
  }
}

export function saveNotebookPlans(plans: ProPassPlan[]): ProPassPlan[] {
  const serialized = JSON.stringify(plans);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(NOTEBOOK_PLANS_KEY, serialized);
    } catch (e) {
      console.error('Failed to save Notebook plans:', e);
    }
  }
  persistSettingToSupabase(NOTEBOOK_PLANS_KEY, serialized);
  return plans;
}

export function upsertNotebookPlan(
  plan: Omit<ProPassPlan, 'id'> & { id?: string }
): ProPassPlan[] {
  let current = getNotebookPlans();
  const planId = plan.id || `nb_${Date.now()}`;
  const existingIdx = current.findIndex((p) => p.id === planId);

  const normalizedPlan: ProPassPlan = {
    ...plan,
    id: planId,
  };

  if (normalizedPlan.isPopular) {
    current = current.map((p) => ({ ...p, isPopular: false }));
  }

  let nextPlans: ProPassPlan[];
  if (existingIdx >= 0) {
    nextPlans = [...current];
    nextPlans[existingIdx] = normalizedPlan;
  } else {
    nextPlans = [...current, normalizedPlan].sort(
      (a, b) => a.durationMonths - b.durationMonths
    );
  }

  return saveNotebookPlans(nextPlans);
}

export function toggleNotebookPlanActive(planId: string): ProPassPlan[] {
  const nextPlans = getNotebookPlans().map((p) =>
    p.id === planId ? { ...p, isActive: !p.isActive } : p
  );
  return saveNotebookPlans(nextPlans);
}

export function deleteNotebookPlan(planId: string): ProPassPlan[] {
  const nextPlans = getNotebookPlans().filter((p) => p.id !== planId);
  return saveNotebookPlans(nextPlans);
}

export function getPromoCoupons(): PromoCoupon[] {
  if (typeof window === 'undefined') return DEFAULT_COUPONS;
  try {
    const raw = localStorage.getItem(COUPONS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(DEFAULT_COUPONS));
      return DEFAULT_COUPONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_COUPONS;
  } catch (e) {
    return DEFAULT_COUPONS;
  }
}

export function savePromoCoupons(coupons: PromoCoupon[]): void {
  const serialized = JSON.stringify(coupons);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(COUPONS_STORAGE_KEY, serialized);
    } catch (e) {
      console.error('Failed to save coupons:', e);
    }
  }
  persistSettingToSupabase(COUPONS_STORAGE_KEY, serialized);
}

export async function syncMonetizationFromSupabase(
  pushLocalIfMissingInDb = false
): Promise<{
  proPassConfig: ProPassConfig;
  notebookPlans: ProPassPlan[];
  coupons: PromoCoupon[];
}> {
  let proPassConfig = getProPassConfig();
  let notebookPlans = getNotebookPlans();
  let coupons = getPromoCoupons();

  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        PRO_PASS_CONFIG_KEY,
        NOTEBOOK_PLANS_KEY,
        COUPONS_STORAGE_KEY,
      ]);

    if (!error && data) {
      const foundKeys = new Set<string>();

      for (const row of data) {
        foundKeys.add(row.setting_key);
        if (row.setting_key === PRO_PASS_CONFIG_KEY && row.setting_value) {
          try {
            const parsed = JSON.parse(row.setting_value);
            proPassConfig = {
              isVisibleOnWebsite:
                typeof parsed.isVisibleOnWebsite === 'boolean'
                  ? parsed.isVisibleOnWebsite
                  : true,
              plans:
                Array.isArray(parsed.plans) && parsed.plans.length > 0
                  ? parsed.plans
                  : DEFAULT_PRO_PASS_PLANS,
            };
            if (typeof window !== 'undefined') {
              localStorage.setItem(
                PRO_PASS_CONFIG_KEY,
                JSON.stringify(proPassConfig)
              );
            }
          } catch (e) {}
        }

        if (row.setting_key === NOTEBOOK_PLANS_KEY && row.setting_value) {
          try {
            const parsed = JSON.parse(row.setting_value);
            if (Array.isArray(parsed) && parsed.length > 0) {
              notebookPlans = parsed;
              if (typeof window !== 'undefined') {
                localStorage.setItem(
                  NOTEBOOK_PLANS_KEY,
                  JSON.stringify(notebookPlans)
                );
              }
            }
          } catch (e) {}
        }

        if (row.setting_key === COUPONS_STORAGE_KEY && row.setting_value) {
          try {
            const parsed = JSON.parse(row.setting_value);
            if (Array.isArray(parsed) && parsed.length > 0) {
              coupons = parsed;
              if (typeof window !== 'undefined') {
                localStorage.setItem(
                  COUPONS_STORAGE_KEY,
                  JSON.stringify(coupons)
                );
              }
            }
          } catch (e) {}
        }
      }

      // If called from Admin portal and DB didn't have the rows yet, push the Admin's local config to Supabase immediately!
      if (pushLocalIfMissingInDb) {
        if (!foundKeys.has(PRO_PASS_CONFIG_KEY)) {
          await persistSettingToSupabase(
            PRO_PASS_CONFIG_KEY,
            JSON.stringify(proPassConfig)
          );
        }
        if (!foundKeys.has(NOTEBOOK_PLANS_KEY)) {
          await persistSettingToSupabase(
            NOTEBOOK_PLANS_KEY,
            JSON.stringify(notebookPlans)
          );
        }
        if (!foundKeys.has(COUPONS_STORAGE_KEY)) {
          await persistSettingToSupabase(
            COUPONS_STORAGE_KEY,
            JSON.stringify(coupons)
          );
        }
      }
    }
  } catch (e) {}

  return { proPassConfig, notebookPlans, coupons };
}

export function addPromoCoupon(
  input: Omit<PromoCoupon, 'id' | 'createdAt'>
): PromoCoupon[] {
  const existing = getPromoCoupons().filter(
    (c) => c.code.toUpperCase() !== input.code.trim().toUpperCase()
  );
  const newCoupon: PromoCoupon = {
    ...input,
    code: input.code.trim().toUpperCase(),
    id: `cpn_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [newCoupon, ...existing];
  savePromoCoupons(updated);
  return updated;
}

export function togglePromoCouponActive(id: string): PromoCoupon[] {
  const updated = getPromoCoupons().map((c) =>
    c.id === id ? { ...c, isActive: !c.isActive } : c
  );
  savePromoCoupons(updated);
  return updated;
}

export function deletePromoCoupon(id: string): PromoCoupon[] {
  const updated = getPromoCoupons().filter((c) => c.id !== id);
  savePromoCoupons(updated);
  return updated;
}

export function evaluatePromoCoupon(
  rawCode: string,
  basePrice: number,
  target: CouponTarget,
  explicitBsolPrice?: number
): {
  valid: boolean;
  finalPrice: number;
  discountAmount: number;
  coupon?: PromoCoupon;
  message: string;
} {
  const cleanCode = rawCode.trim().toUpperCase();
  if (!cleanCode) {
    return {
      valid: false,
      finalPrice: basePrice,
      discountAmount: 0,
      message: 'Please enter a coupon code.',
    };
  }

  const all = getPromoCoupons();
  const matched = all.find(
    (c) =>
      c.code.toUpperCase() === cleanCode &&
      c.isActive &&
      (c.applicableTo === 'ALL' || c.applicableTo === target)
  );

  if (!matched) {
    return {
      valid: false,
      finalPrice: basePrice,
      discountAmount: 0,
      message: '❌ Invalid or expired coupon code. Try "BSOL" or "BANK50".',
    };
  }

  // If the admin modified BSOL to e.g. 100% OFF, honor the coupon's actual discount!
  if (
    cleanCode === 'BSOL' &&
    explicitBsolPrice !== undefined &&
    matched.discountType === 'PERCENT' &&
    matched.discountValue === 50
  ) {
    const discountAmount = Math.max(0, basePrice - explicitBsolPrice);
    return {
      valid: true,
      finalPrice: Math.max(0, explicitBsolPrice),
      discountAmount,
      coupon: matched,
      message: `🎉 "${cleanCode}" applied! You saved ₹${discountAmount}.`,
    };
  }

  // No cap! Allow up to 100% discount (₹0 payable)
  let finalPrice = basePrice;
  if (matched.discountType === 'PERCENT') {
    const pct = Math.min(100, Math.max(0, matched.discountValue));
    const disc = Math.round((basePrice * pct) / 100);
    finalPrice = Math.max(0, basePrice - disc);
  } else {
    finalPrice = Math.max(0, basePrice - matched.discountValue);
  }

  const discountAmount = Math.max(0, basePrice - finalPrice);
  return {
    valid: true,
    finalPrice,
    discountAmount,
    coupon: matched,
    message:
      finalPrice === 0
        ? `🎉 100% Discount Code "${matched.code}" applied! Payable: ₹0 (Free Unlock).`
        : `🎉 "${matched.code}" applied! You saved ₹${discountAmount}.`,
  };
}

export function downloadPurchaseReceipt(params: {
  receiptId: string;
  itemName: string;
  itemType: 'Master Course' | 'PRO Pass Bundle' | 'E-Book';
  amountPaid: number;
  paymentId: string;
  purchaseDate: string;
  expiryDate?: string;
  studentName: string;
  studentEmail: string;
}) {
  if (typeof window === 'undefined') return;

  const formattedDate = new Date(params.purchaseDate || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const formattedExpiry = params.expiryDate
    ? new Date(params.expiryDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Lifetime Access';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payment Receipt - ${params.itemName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 40px 20px;
      margin: 0;
    }
    .receipt-box {
      max-width: 680px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 36px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 24px;
      margin-bottom: 24px;
    }
    .brand {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
    }
    .brand span {
      color: #d97706;
    }
    .badge {
      display: inline-block;
      background: #dcfce7;
      color: #15803d;
      font-size: 11px;
      font-weight: 800;
      padding: 5px 12px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: #f8fafc;
      padding: 18px;
      border-radius: 14px;
      margin-bottom: 24px;
      font-size: 13px;
    }
    .meta-label {
      color: #64748b;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .meta-value {
      font-weight: 700;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th {
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 8px;
    }
    td {
      padding: 16px 8px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
      font-weight: 600;
    }
    .total-row td {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
      border-top: 2px solid #0f172a;
      border-bottom: none;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #64748b;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
    }
    .print-btn {
      display: inline-block;
      margin-top: 16px;
      padding: 10px 22px;
      background: #0f172a;
      color: #ffffff;
      border-radius: 10px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      border: none;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .receipt-box { box-shadow: none; border: none; }
      .print-btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="receipt-box">
    <div class="header">
      <div>
        <div class="brand">Banking<span>Solutions</span></div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
          Precision Banking Exam Preparation Platform
        </div>
      </div>
      <div style="text-align: right;">
        <span class="badge">✓ Paid &amp; Verified</span>
        <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
          Receipt #: <strong>BS-${params.receiptId.slice(0, 8).toUpperCase()}</strong>
        </div>
      </div>
    </div>

    <div class="meta-grid">
      <div>
        <div class="meta-label">Billed To Aspirant</div>
        <div class="meta-value">${params.studentName}</div>
        <div style="color: #64748b; font-size: 12px;">${params.studentEmail}</div>
      </div>
      <div>
        <div class="meta-label">Transaction Details</div>
        <div class="meta-value">Date: ${formattedDate}</div>
        <div style="color: #64748b; font-size: 12px;">Payment ID: ${params.paymentId || 'Verified Online'}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Category</th>
          <th>Validity</th>
          <th style="text-align: right;">Amount Paid</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${params.itemName}</td>
          <td>${params.itemType}</td>
          <td>${formattedExpiry}</td>
          <td style="text-align: right;">₹${Number(params.amountPaid || 0).toLocaleString('en-IN')}.00</td>
        </tr>
        <tr class="total-row">
          <td colspan="3">Total Amount Paid (Inclusive of Taxes)</td>
          <td style="text-align: right; color: #15803d;">₹${Number(params.amountPaid || 0).toLocaleString('en-IN')}.00</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <div>Thank you for learning with <strong>BankingSolutions</strong>! Wishing you success in your upcoming Banking Exams.</div>
      <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=780,height=720');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
  }
}

// ============================================================================
// ADMIN FREE COURSE GRANT BY EMAIL ID (WORKS EVEN BEFORE OR AFTER SIGNUP)
// ============================================================================

export interface EmailCourseGrant {
  id: string;
  email: string;
  courseName: string;
  durationMonths: number; // 0 = Lifetime
  expiresAt: string | null;
  note?: string;
  grantedAt: string;
}

export const EMAIL_COURSE_GRANTS_KEY = 'bs_email_course_grants_v1';

export function getEmailCourseGrants(): EmailCourseGrant[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(EMAIL_COURSE_GRANTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function syncEmailCourseGrantsFromSupabase(): Promise<EmailCourseGrant[]> {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', EMAIL_COURSE_GRANTS_KEY)
      .maybeSingle();

    if (!error && data?.setting_value) {
      const parsed =
        typeof data.setting_value === 'string'
          ? JSON.parse(data.setting_value)
          : data.setting_value;
      if (Array.isArray(parsed)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(EMAIL_COURSE_GRANTS_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  } catch {
    // Fallback to localStorage
  }
  return getEmailCourseGrants();
}

export async function grantFreeCourseByEmail(params: {
  emails: string[];
  courseName: string;
  durationMonths: number; // 0 = Lifetime (10 years)
  note?: string;
}): Promise<EmailCourseGrant[]> {
  const current = await syncEmailCourseGrantsFromSupabase();
  const now = new Date();
  let expiresIso: string | null = null;

  if (params.durationMonths > 0) {
    const exp = new Date();
    exp.setMonth(exp.getMonth() + params.durationMonths);
    expiresIso = exp.toISOString();
  } else {
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 10);
    expiresIso = exp.toISOString();
  }

  const normalizedEmails = params.emails
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));

  let updated = [...current];

  for (const email of normalizedEmails) {
    // Remove existing identical email + courseName grant to replace cleanly
    updated = updated.filter(
      (g) =>
        !(
          g.email.toLowerCase() === email &&
          g.courseName.toLowerCase() === params.courseName.toLowerCase()
        )
    );

    const newGrant: EmailCourseGrant = {
      id: `grant_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      email,
      courseName: params.courseName,
      durationMonths: params.durationMonths,
      expiresAt: expiresIso,
      note: params.note?.trim() || 'Admin Free Grant',
      grantedAt: now.toISOString(),
    };

    updated = [newGrant, ...updated];

    // Also try to insert directly into student_course_purchases if profile with email exists
    try {
      const { data: matchedProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle();

      if (matchedProfile?.id) {
        await supabase.from('student_course_purchases').upsert(
          [
            {
              user_id: matchedProfile.id,
              course_name: params.courseName,
              amount_paid: 0,
              payment_id: `ADMIN_FREE_GRANT_${Date.now()}`,
              expires_at: expiresIso,
            },
          ],
          { onConflict: 'user_id,course_name' }
        );
      }
    } catch {
      // Even if profiles table doesn't store email or RLS blocks lookup, the student will auto-claim on login!
    }
  }

  const serialized = JSON.stringify(updated);
  if (typeof window !== 'undefined') {
    localStorage.setItem(EMAIL_COURSE_GRANTS_KEY, serialized);
  }
  await persistSettingToSupabase(EMAIL_COURSE_GRANTS_KEY, serialized);
  return updated;
}

export async function revokeEmailCourseGrant(grantId: string): Promise<EmailCourseGrant[]> {
  const current = await syncEmailCourseGrantsFromSupabase();
  const target = current.find((g) => g.id === grantId);
  const updated = current.filter((g) => g.id !== grantId);

  const serialized = JSON.stringify(updated);
  if (typeof window !== 'undefined') {
    localStorage.setItem(EMAIL_COURSE_GRANTS_KEY, serialized);
  }
  await persistSettingToSupabase(EMAIL_COURSE_GRANTS_KEY, serialized);

  if (target) {
    try {
      const { data: matchedProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', target.email)
        .maybeSingle();
      if (matchedProfile?.id) {
        await supabase
          .from('student_course_purchases')
          .delete()
          .eq('user_id', matchedProfile.id)
          .eq('course_name', target.courseName);
      }
    } catch {}
  }

  return updated;
}

/**
 * Checks if a user's email has an active Admin Email Grant for a course (or PRO Pass),
 * and also auto-claims/syncs those grants into `student_course_purchases` for `user.id`.
 */
export async function checkAndClaimEmailGrants(user: {
  id: string;
  email?: string | null;
}): Promise<EmailCourseGrant[]> {
  if (!user?.email) return [];
  const cleanEmail = user.email.trim().toLowerCase();
  const allGrants = await syncEmailCourseGrantsFromSupabase();

  const myActiveGrants = allGrants.filter((g) => {
    if (g.email.toLowerCase() !== cleanEmail) return false;
    if (!g.expiresAt) return true;
    return new Date(g.expiresAt) > new Date();
  });

  if (myActiveGrants.length > 0 && user.id) {
    try {
      const rows = myActiveGrants.map((g) => ({
        user_id: user.id,
        course_name: g.courseName,
        amount_paid: 0,
        payment_id: `ADMIN_GRANT_${g.id}`,
        expires_at: g.expiresAt,
      }));
      await supabase
        .from('student_course_purchases')
        .upsert(rows, { onConflict: 'user_id,course_name' });
    } catch {
      // Ignore if upsert fails; caller still receives myActiveGrants
    }
  }

  return myActiveGrants;
}

