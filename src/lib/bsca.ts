import { supabase } from './supabase';
import { persistSettingToSupabase } from './monetization';

export type BscaCategory =
  | 'BANKING_FINANCE'
  | 'ECONOMY_BUSINESS'
  | 'NATIONAL'
  | 'INTERNATIONAL'
  | 'APPOINTMENTS'
  | 'AWARDS_HONOURS'
  | 'SPORTS'
  | 'DEFENCE_SCIENCE'
  | 'MOUS_SUMMITS'
  | 'REPORTS_INDICES'
  | 'IMPORTANT_DAYS'
  | 'MISC';

export interface BscaCategoryMeta {
  key: BscaCategory;
  label: string;
  icon: string;
  color: string;
  badgeCls: string;
  borderCls: string;
}

export const BSCA_CATEGORIES: BscaCategoryMeta[] = [
  { key: 'BANKING_FINANCE', label: 'Banking & RBI', icon: '🏦', color: 'amber', badgeCls: 'bg-amber-400/15 text-amber-300 border-amber-400/30', borderCls: 'border-l-amber-400' },
  { key: 'ECONOMY_BUSINESS', label: 'Economy & Business', icon: '📈', color: 'emerald', badgeCls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', borderCls: 'border-l-emerald-400' },
  { key: 'NATIONAL', label: 'National Affairs', icon: '🇮🇳', color: 'blue', badgeCls: 'bg-blue-500/15 text-blue-300 border-blue-500/30', borderCls: 'border-l-blue-400' },
  { key: 'INTERNATIONAL', label: 'International', icon: '🌍', color: 'cyan', badgeCls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', borderCls: 'border-l-cyan-400' },
  { key: 'APPOINTMENTS', label: 'Appointments & Resignations', icon: '🎖️', color: 'purple', badgeCls: 'bg-purple-500/15 text-purple-300 border-purple-500/30', borderCls: 'border-l-purple-400' },
  { key: 'MOUS_SUMMITS', label: 'MoUs & Summits', icon: '🤝', color: 'teal', badgeCls: 'bg-teal-500/15 text-teal-300 border-teal-500/30', borderCls: 'border-l-teal-400' },
  { key: 'REPORTS_INDICES', label: 'Reports & Ranks', icon: '📊', color: 'orange', badgeCls: 'bg-orange-500/15 text-orange-300 border-orange-500/30', borderCls: 'border-l-orange-400' },
  { key: 'AWARDS_HONOURS', label: 'Awards & Honours', icon: '🏆', color: 'yellow', badgeCls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30', borderCls: 'border-l-yellow-400' },
  { key: 'SPORTS', label: 'Sports', icon: '⚽', color: 'rose', badgeCls: 'bg-rose-500/15 text-rose-300 border-rose-500/30', borderCls: 'border-l-rose-400' },
  { key: 'DEFENCE_SCIENCE', label: 'Defence & Science', icon: '🛡️', color: 'indigo', badgeCls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30', borderCls: 'border-l-indigo-400' },
  { key: 'IMPORTANT_DAYS', label: 'Important Days', icon: '📅', color: 'pink', badgeCls: 'bg-pink-500/15 text-pink-300 border-pink-500/30', borderCls: 'border-l-pink-400' },
  { key: 'MISC', label: 'General / Miscellaneous', icon: '📰', color: 'slate', badgeCls: 'bg-slate-500/15 text-slate-300 border-slate-500/30', borderCls: 'border-l-slate-400' },
];

export function getCategoryMeta(cat: BscaCategory | string): BscaCategoryMeta {
  const clean = (cat || '').toUpperCase().trim();
  const found = BSCA_CATEGORIES.find((c) => c.key === clean || c.label.toUpperCase() === clean);
  return (
    found || {
      key: 'MISC',
      label: cat || 'General Current Affairs',
      icon: '📰',
      color: 'slate',
      badgeCls: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
      borderCls: 'border-l-slate-400',
    }
  );
}

export interface BscaStaticGkItem {
  key: string;
  value: string;
}

export interface BscaArticle {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: BscaCategory;
  bullets: string[];
  staticGk: BscaStaticGkItem[];
  keyStats?: string[]; // e.g. ["₹57,613 Cr Outlay", "10,000 Buses", "10-Year PPP"]
  isFeaturedHero?: boolean;
  sourceUrl?: string;
  readTimeMin?: number;
  importance?: 'HIGH' | 'MEDIUM';
  created_at?: string;
}

export interface BscaCapsule {
  id: string;
  title: string;
  month: string; // e.g. "October 2026"
  category: 'MONTHLY_FULL' | 'BANKING_AWARENESS' | 'RBI_CIRCULARS' | 'BUDGET_SCHEMES';
  pdf_url: string;
  file_size?: string;
  pages_count?: number;
  badge?: string;
  highlights?: string[];
  download_count?: number;
  created_at?: string;
}

export interface BscaDayPdf {
  id: string;
  course_id: string;
  monthTitle: string; // e.g. "August", "September", "October"
  day_number: number;
  title: string;
  pdf_url: string;
  pdf_hindi_url?: string; // 🇮🇳 Hindi PDF URL
  release_date: string; // YYYY-MM-DD
  topic_list?: string;
  created_at?: string;
}

export function extractHindiPdfFromTopic(topicList?: string): { cleanTopics: string; hindiPdfUrl?: string } {
  if (!topicList) return { cleanTopics: '' };
  const tagRegex = /(?:\[\[HINDI_PDF:([^\]]+)\]\]|<!--\s*HINDI_PDF:\s*([^\s>]+)\s*-->|\[HINDI_PDF:([^\]]+)\])/i;
  const match = topicList.match(tagRegex);
  const hindiPdfUrl = match ? (match[1] || match[2] || match[3] || '').trim() : undefined;
  const cleanTopics = topicList.replace(tagRegex, '').trim();
  return { cleanTopics, hindiPdfUrl };
}

export function encodeHindiPdfIntoTopic(topics?: string, hindiPdfUrl?: string): string {
  const base = (topics || '').trim();
  if (!hindiPdfUrl || !hindiPdfUrl.trim()) return base;
  return `${base}\n[[HINDI_PDF:${hindiPdfUrl.trim()}]]`.trim();
}

export const MONTH_NAMES = [
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
] as const;

export function getPdfYearAndMonth(pdf: BscaDayPdf): { year: string; monthIndex: number; monthName: string } {
  let year = '';
  let monthIndex = -1;

  // 1. Check release_date YYYY-MM-DD
  if (pdf.release_date) {
    const ymd = pdf.release_date.match(/^(\d{4})-(\d{1,2})/);
    if (ymd) {
      year = ymd[1];
      const m = parseInt(ymd[2], 10);
      if (m >= 1 && m <= 12) {
        monthIndex = m - 1;
      }
    }
  }

  // 2. Check title or release_date in DD-MM-YYYY format
  if (monthIndex === -1 || !year) {
    const dmy = (pdf.release_date || pdf.title || '').match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (dmy) {
      if (!year) year = dmy[3];
      if (monthIndex === -1) {
        const m = parseInt(dmy[2], 10);
        if (m >= 1 && m <= 12) monthIndex = m - 1;
      }
    }
  }

  // 3. Check monthTitle or title for Month Name
  if (monthIndex === -1) {
    const combined = `${pdf.monthTitle || ''} ${pdf.title || ''}`.toUpperCase();
    for (let i = 0; i < MONTH_NAMES.length; i++) {
      if (combined.includes(MONTH_NAMES[i].toUpperCase())) {
        monthIndex = i;
        break;
      }
    }
  }

  // 4. Check for 4-digit year in monthTitle or title
  if (!year) {
    const yMatch = `${pdf.monthTitle || ''} ${pdf.title || ''}`.match(/\b(20\d{2})\b/);
    if (yMatch) {
      year = yMatch[1];
    }
  }

  // Fallbacks if still missing
  if (!year) year = '2026';
  if (monthIndex === -1) monthIndex = 9; // October default

  return {
    year,
    monthIndex,
    monthName: MONTH_NAMES[monthIndex],
  };
}

export interface BscaParsedDocResult {
  date: string;
  quizTitle: string;
  articles: Omit<BscaArticle, 'id'>[];
  questions: {
    question_text: string;
    options: string[];
    correct_option_index: number;
    explanation?: string;
  }[];
}

export const BSCA_ARTICLES_KEY = 'bs_bsca_articles_v1';
export const BSCA_CAPSULES_KEY = 'bs_bsca_capsules_v1';
export const BSCA_READ_HISTORY_KEY = 'bs_bsca_read_history_v1';

// Seed authentic high-yield banking current affairs
export const DEFAULT_BSCA_ARTICLES: BscaArticle[] = [
  {
    id: 'bsca_art_01',
    date: '2026-10-25',
    title: 'RBI tightens Project Finance norms: Mandates 2.5% general contingency buffer during construction',
    category: 'BANKING_FINANCE',
    isFeaturedHero: true,
    keyStats: ['2.5% Construction Buffer', '1.0% Operational Buffer', '20% Amortization Rule'],
    bullets: [
      'The Reserve Bank of India has issued definitive prudential guidelines for financing infrastructure and project loans by commercial banks and NBFCs.',
      'Lenders are required to maintain a general provision of 2.5% of funded outstanding during the construction phase, lowered from the initially proposed 5.0% draft norm.',
      'Post Commercial Operations Date (COD), this buffer can be tapered down to 1.0% once 20% of the loan principal is systematically amortized.',
      'Applicable across all public, private, and non-banking lenders with grandfathering protection for projects funded before October 2026.',
    ],
    staticGk: [
      { key: 'RBI Governor', value: 'Shaktikanta Das (25th Governor)' },
      { key: 'Headquarters', value: 'Mumbai, Maharashtra' },
      { key: 'Statutory Act', value: 'RBI Act, 1934 (Commenced 1 April 1935)' },
      { key: 'Nationalization Date', value: '1 January 1949' },
    ],
    readTimeMin: 2,
    importance: 'HIGH',
    created_at: new Date().toISOString(),
  },
  {
    id: 'bsca_art_02',
    date: '2026-10-25',
    title: 'SEBI launches "Saarthi 3.0" multilingual AI investor portal to combat fraudulent finfluencers',
    category: 'BANKING_FINANCE',
    keyStats: ['15 Languages', 'Saarthi 3.0', 'SEBI Scam Radar'],
    bullets: [
      'Securities and Exchange Board of India (SEBI) chairperson Madhabi Puri Buch inaugurated version 3.0 of the Saarthi mobile portal.',
      'The app incorporates an AI-powered conversational assistant capable of answering questions on mutual funds, REITs, InvITs, and municipal bonds in 15 Indian languages.',
      'SEBI has included a real-time "Scam Radar" directory where retail investors can verify whether an investment advisor or telegram channel is registered under SEBI IA Regulations.',
    ],
    staticGk: [
      { key: 'SEBI Chairperson', value: 'Madhabi Puri Buch (First woman chairperson)' },
      { key: 'Headquarters', value: 'SEBI Bhavan, BKC, Mumbai' },
      { key: 'Statutory Body', value: '12 April 1992 (SEBI Act, 1992)' },
    ],
    readTimeMin: 2,
    importance: 'HIGH',
    created_at: new Date().toISOString(),
  },
  {
    id: 'bsca_art_03',
    date: '2026-10-25',
    title: 'NPCI & Al Etihad Payments link RuPay & Jaywan card networks for zero-markup retail transactions',
    category: 'MOUS_SUMMITS',
    keyStats: ['RuPay & Jaywan', 'Direct INR-AED settlement', 'Zero Foreign Markup'],
    bullets: [
      'NPCI International Payments Limited (NIPL) and UAE’s Al Etihad Payments announced the live operational linkage between India’s RuPay and UAE’s Jaywan domestic card networks.',
      'Indian tourists and business delegates in Dubai and Abu Dhabi can now swipe domestic RuPay cards across all POS machines with zero foreign exchange currency markup.',
      'Settlement will be routed through the bilateral Local Currency Settlement (LCS) mechanism in Indian Rupee (INR) and UAE Dirham (AED).',
    ],
    staticGk: [
      { key: 'NPCI MD & CEO', value: 'Dilip Asbe' },
      { key: 'UAE Capital', value: 'Abu Dhabi' },
      { key: 'UAE Currency', value: 'UAE Dirham (AED)' },
      { key: 'NPCI Established', value: '2008 under Payment & Settlement Systems Act, 2007' },
    ],
    readTimeMin: 2,
    importance: 'HIGH',
    created_at: new Date().toISOString(),
  },
  {
    id: 'bsca_art_04',
    date: '2026-10-25',
    title: 'Cabinet approves ₹57,613 Crore expansion of PM-eBus Sewa with 10,000 electric buses',
    category: 'NATIONAL',
    keyStats: ['₹57,613 Crore Outlay', '10,000 e-Buses', '10-Year PPP Support'],
    bullets: [
      'The Union Cabinet chaired by Prime Minister Narendra Modi sanctioned an expanded financial package of ₹57,613 crore for PM-eBus Sewa.',
      'The scheme will deploy 10,000 green electric buses across cities with populations between 3 lakh and 40 lakh under a Public-Private Partnership (PPP) model.',
      'The Central government will disburse ₹20,000 crore as operational grant assistance over a 10-year period.',
    ],
    staticGk: [
      { key: 'Nodal Ministry', value: 'Ministry of Housing and Urban Affairs (MoHUA)' },
      { key: 'India Climate Goal', value: 'Net Zero Carbon by 2070 / 500 GW Non-Fossil by 2030' },
    ],
    readTimeMin: 2,
    importance: 'MEDIUM',
    created_at: new Date().toISOString(),
  },
  {
    id: 'bsca_art_05',
    date: '2026-10-24',
    title: 'World Bank raises India FY27 GDP growth forecast to 7.0%, citing rural consumption revival',
    category: 'REPORTS_INDICES',
    keyStats: ['7.0% GDP Forecast', 'World Bank Report', 'Fastest Growing Economy'],
    bullets: [
      'The World Bank raised its India GDP growth projection for the current fiscal to 7.0%, upgrading from its earlier estimate of 6.6%.',
      'The flagship "India Development Update" highlighted easing core inflation, monsoon-driven rural demand revival, and robust capital expenditure by public sector undertakings.',
      'India continues to retain its status as the world’s fastest-growing major economy, outpacing China, Indonesia, and ASEAN peers.',
    ],
    staticGk: [
      { key: 'World Bank President', value: 'Ajay Banga' },
      { key: 'Headquarters', value: 'Washington D.C., United States' },
      { key: 'Chief Economist', value: 'Indermit Gill' },
      { key: 'Member Countries', value: '189 Members' },
    ],
    readTimeMin: 2,
    importance: 'HIGH',
    created_at: new Date().toISOString(),
  },
  {
    id: 'bsca_art_06',
    date: '2026-10-24',
    title: 'K. V. Kamath reappointed as Chairman of NaBFID for an extended 3-year term',
    category: 'APPOINTMENTS',
    keyStats: ['K. V. Kamath', 'NaBFID Chairman', '3-Year Extension'],
    bullets: [
      'The Appointments Committee of the Cabinet (ACC) approved the reappointment of veteran banker Kundapur Vaman Kamath as Chairman of NaBFID.',
      'NaBFID is India’s specialized Development Financial Institution (DFI) established under the NaBFID Act 2021 to provide long-term debt to national infrastructure projects.',
      'Kamath previously served as the first President of the New Development Bank (BRICS Bank) and Managing Director & CEO of ICICI Bank.',
    ],
    staticGk: [
      { key: 'NaBFID Headquarters', value: 'Mumbai, Maharashtra' },
      { key: 'Managing Director', value: 'Rajkiran Rai G.' },
      { key: 'Statutory DFI', value: 'Regulated and supervised as AIFI by RBI' },
    ],
    readTimeMin: 1,
    importance: 'HIGH',
    created_at: new Date().toISOString(),
  },
];

export const DEFAULT_BSCA_CAPSULES: BscaCapsule[] = [];

// Map legacy updates_feed ONE_LINER row into a modern BscaArticle
export function mapUpdateFeedToBscaArticle(row: Record<string, unknown>): BscaArticle {
  const content = String(row.content || '').trim();
  const rawDate = row.post_date ? String(row.post_date).slice(0, 10) : String(row.created_at || '').slice(0, 10);
  const title = String(row.title || '').trim();

  // Extract static GK from markdown table syntax like |Key: Value| or |Key: ...|
  const staticGk: BscaStaticGkItem[] = [];
  const lines = content.split('\n').map((l: string) => l.trim()).filter(Boolean);
  const narrativeLines: string[] = [];

  lines.forEach((line: string) => {
    if (line.startsWith('|') && line.includes(':')) {
      const parts = line.split('|').map((s: string) => s.trim()).filter(Boolean);
      parts.forEach((p: string) => {
        if (p.includes(':')) {
          const [k, ...v] = p.split(':');
          const cleanK = k.trim();
          const cleanV = v.join(':').trim();
          if (cleanK && cleanV) {
            staticGk.push({ key: cleanK, value: cleanV });
          }
        }
      });
    } else if (line.startsWith('|') && (line.includes('---') || line.includes('Key'))) {
      // Table header or separator
    } else {
      narrativeLines.push(line);
    }
  });

  const bullets: string[] = [];
  narrativeLines.forEach((nl: string) => {
    if (nl.startsWith('-') || nl.startsWith('•') || nl.startsWith('*')) {
      bullets.push(nl.replace(/^[\-\•\*]+\s*/, '').trim());
    } else {
      bullets.push(nl);
    }
  });

  // Intelligent Category Detection
  const textCombined = (title + ' ' + content).toUpperCase();
  let category: BscaCategory = 'BANKING_FINANCE';

  if (
    textCombined.includes('UPI') ||
    textCombined.includes('RBI') ||
    textCombined.includes('BANK') ||
    textCombined.includes('SEBI') ||
    textCombined.includes('F&O') ||
    textCombined.includes('STOCK') ||
    textCombined.includes('TAX') ||
    textCombined.includes('RUPEE') ||
    textCombined.includes('FINANCE') ||
    textCombined.includes('CLOSING AUCTION') ||
    textCombined.includes('NSE')
  ) {
    category = 'BANKING_FINANCE';
  } else if (
    textCombined.includes('GDP') ||
    textCombined.includes('INFLATION') ||
    textCombined.includes('ECONOMY') ||
    textCombined.includes('GROWTH') ||
    textCombined.includes('FISCAL')
  ) {
    category = 'ECONOMY_BUSINESS';
  } else if (
    textCombined.includes('APPOINT') ||
    textCombined.includes('CHAIRMAN') ||
    textCombined.includes('CHIEF') ||
    textCombined.includes('DGAFMS') ||
    textCombined.includes('AIR MARSHAL') ||
    textCombined.includes('RESIGN')
  ) {
    category = 'APPOINTMENTS';
  } else if (
    textCombined.includes('RANK') ||
    textCombined.includes('INDEX') ||
    textCombined.includes('REPORT') ||
    textCombined.includes('MDPI') ||
    textCombined.includes('COMPETITIVENESS')
  ) {
    category = 'REPORTS_INDICES';
  } else if (
    textCombined.includes('AWARD') ||
    textCombined.includes('HONOUR') ||
    textCombined.includes('PRIZE') ||
    textCombined.includes('MEDAL') ||
    textCombined.includes('TILAK') ||
    textCombined.includes('DOVAL')
  ) {
    category = 'AWARDS_HONOURS';
  } else if (
    textCombined.includes('MOU') ||
    textCombined.includes('SUMMIT') ||
    textCombined.includes('CORRIDOR') ||
    textCombined.includes('SCHEME') ||
    textCombined.includes('PM NARENDRA MODI') ||
    textCombined.includes('NSDC') ||
    textCombined.includes('AVPL') ||
    textCombined.includes('FAVARA')
  ) {
    category = 'MOUS_SUMMITS';
  } else if (
    textCombined.includes('DRONE') ||
    textCombined.includes('SPACE') ||
    textCombined.includes('ISRO') ||
    textCombined.includes('DRDO') ||
    textCombined.includes('IN-SPACE') ||
    textCombined.includes('DEFENCE') ||
    textCombined.includes('SATELLITE')
  ) {
    category = 'DEFENCE_SCIENCE';
  } else if (textCombined.includes('SPORT') || textCombined.includes('CRICKET') || textCombined.includes('OLYMPIC') || textCombined.includes('CHESS')) {
    category = 'SPORTS';
  } else if (
    textCombined.includes('LADAKH') ||
    textCombined.includes('HERITAGE') ||
    textCombined.includes('CENTRE') ||
    textCombined.includes('CABINET') ||
    textCombined.includes('GOVT') ||
    textCombined.includes('STATE')
  ) {
    category = 'NATIONAL';
  } else {
    category = 'MISC';
  }

  // Extract key stats/numbers
  const statMatches = content.match(/(?:₹|Rs\.?\s?)[0-9,]+(?:\s?(?:Lakh|Crore|Cr|Billion|Trillion))?|[0-9]+(?:\.[0-9]+)?%|[0-9]+th\sRank|[0-9]+,\d+/gi) || [];
  const keyStats = Array.from(new Set(statMatches)).slice(0, 3);

  return {
    id: `upd_${row.id}`,
    date: rawDate,
    title,
    category,
    bullets: bullets.length > 0 ? bullets : [content],
    staticGk,
    keyStats: keyStats.length > 0 ? keyStats : undefined,
    readTimeMin: Math.max(1, Math.round(content.split(/\s+/).length / 90)),
    importance: category === 'BANKING_FINANCE' || category === 'ECONOMY_BUSINESS' ? 'HIGH' : 'MEDIUM',
    created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
  };
}

// Dual-Engine Fetch for Articles (Merges dedicated bsca_articles + legacy updates_feed ONE_LINERs)
export async function fetchBscaArticles(): Promise<BscaArticle[]> {
  const articlesMap = new Map<string, BscaArticle>();
  let loadedDedicatedTable = false;

  // 1. Fetch Dedicated bsca_articles from Supabase
  try {
    const { data, error } = await supabase
      .from('bsca_articles')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      loadedDedicatedTable = true;
      data.forEach((a) => {
        articlesMap.set(a.id, a as BscaArticle);
      });
    }
  } catch {}

  // 2. Fallback / Sync from Cloud admin_settings when dedicated table had no rows
  if (!loadedDedicatedTable) {
    try {
      const { data } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', BSCA_ARTICLES_KEY)
        .maybeSingle();

      if (data?.setting_value) {
        const parsed = JSON.parse(data.setting_value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((a: BscaArticle) => articlesMap.set(a.id, a));
        }
      }
    } catch {}
  }

  // 3. LocalStorage fallback if cloud returned nothing yet
  if (articlesMap.size === 0 && typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(BSCA_ARTICLES_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((a: BscaArticle) => articlesMap.set(a.id, a));
        }
      }
    } catch {}
  }

  // 4. Fetch legacy CA ONE_LINERs from updates_feed table (only for dates not replaced by dedicated articles)
  try {
    const { data: updateRows, error: updErr } = await supabase
      .from('updates_feed')
      .select('*')
      .eq('category', 'ONE_LINER')
      .order('post_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!updErr && Array.isArray(updateRows)) {
      updateRows.forEach((row) => {
        const mapped = mapUpdateFeedToBscaArticle(row as Record<string, unknown>);
        if (!articlesMap.has(mapped.id) && !articlesMap.has(String(row.id))) {
          articlesMap.set(mapped.id, mapped);
        }
      });
    }
  } catch {}

  // 5. Seed defaults only if empty or if no admin articles exist for the seed's date
  if (articlesMap.size === 0) {
    DEFAULT_BSCA_ARTICLES.forEach((a) => articlesMap.set(a.id, a));
  } else {
    const existingDates = new Set(Array.from(articlesMap.values()).map((a) => a.date));
    DEFAULT_BSCA_ARTICLES.forEach((seed) => {
      if (!existingDates.has(seed.date) && !articlesMap.has(seed.id)) {
        articlesMap.set(seed.id, seed);
      }
    });
  }

  const result = Array.from(articlesMap.values());

  // Sort descending by date, then created_at
  result.sort((a, b) => {
    const dComp = b.date.localeCompare(a.date);
    if (dComp !== 0) return dComp;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });

  return result;
}

export async function saveBscaArticles(
  articles: BscaArticle[],
  options?: { replaceDate?: string; deletedIds?: string[] }
): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(BSCA_ARTICLES_KEY, JSON.stringify(articles));
    } catch {}
  }

  try {
    if (options?.replaceDate) {
      await supabase.from('bsca_articles').delete().eq('date', options.replaceDate);
    }
    if (options?.deletedIds && options.deletedIds.length > 0) {
      await supabase.from('bsca_articles').delete().in('id', options.deletedIds);
    }
    if (articles.length > 0) {
      await supabase.from('bsca_articles').upsert(articles);
    }
  } catch {}

  await persistSettingToSupabase(BSCA_ARTICLES_KEY, JSON.stringify(articles));
  return true;
}

// Capsules fetch
export async function fetchBscaCapsules(): Promise<BscaCapsule[]> {
  const isValidCap = (c: Partial<BscaCapsule>) => Boolean(c?.pdf_url && c.pdf_url !== '/courses' && c.pdf_url.trim() !== '');

  try {
    const { data, error } = await supabase
      .from('bsca_capsules')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const valid = data.filter(isValidCap);
      if (valid.length > 0) return valid as BscaCapsule[];
    }
  } catch {}

  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', BSCA_CAPSULES_KEY)
      .maybeSingle();

    if (data?.setting_value) {
      const parsed = JSON.parse(data.setting_value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter(isValidCap);
        if (valid.length > 0) return valid as BscaCapsule[];
      }
    }
  } catch {}

  // LocalStorage check
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(BSCA_CAPSULES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(isValidCap);
          if (valid.length > 0) return valid as BscaCapsule[];
        }
      }
    } catch {}
  }

  return [];
}

export async function saveBscaCapsules(capsules: BscaCapsule[]): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(BSCA_CAPSULES_KEY, JSON.stringify(capsules));
    } catch {}
  }

  try {
    const { error } = await supabase.from('bsca_capsules').upsert(capsules);
    if (!error) return true;
  } catch {}

  await persistSettingToSupabase(BSCA_CAPSULES_KEY, JSON.stringify(capsules));
  return true;
}

// Fetch all Day-Wise Current Affairs PDFs (AffairsCloud style from course_pdfs where course category = BSCA)
export async function fetchBscaDayPdfs(): Promise<BscaDayPdf[]> {
  try {
    const { data: courses, error: cErr } = await supabase
      .from('pdf_courses')
      .select('id, title')
      .eq('category', 'BSCA');

    if (cErr || !courses || courses.length === 0) return [];

    const courseMap: Record<string, string> = {};
    courses.forEach((c) => {
      courseMap[c.id] = c.title;
    });

    const courseIds = courses.map((c) => c.id);
    const { data: pdfs, error: pErr } = await supabase
      .from('course_pdfs')
      .select('*')
      .in('course_id', courseIds)
      .order('release_date', { ascending: false })
      .order('day_number', { ascending: false });

    if (pErr || !pdfs) return [];

    return pdfs.map((p: Record<string, unknown>) => {
      const topicRaw = typeof p.topic_list === 'string' ? p.topic_list : undefined;
      const { cleanTopics, hindiPdfUrl } = extractHindiPdfFromTopic(topicRaw);
      const courseId = String(p.course_id || '');
      return {
        ...p,
        monthTitle: courseMap[courseId] || 'General',
        topic_list: cleanTopics,
        pdf_hindi_url: (typeof p.pdf_hindi_url === 'string' && p.pdf_hindi_url) || hindiPdfUrl || undefined,
      };
    }) as BscaDayPdf[];
  } catch {
    return [];
  }
}

export async function fetchBscaCourses(): Promise<{ id: string; title: string }[]> {
  try {
    const { data, error } = await supabase
      .from('pdf_courses')
      .select('id, title')
      .eq('category', 'BSCA')
      .order('created_at', { ascending: false });
    if (!error && data) return data;
  } catch {}
  return [];
}

export async function createBscaDayPdf(item: {
  course_id: string;
  day_number: number;
  title: string;
  pdf_url: string;
  pdf_hindi_url?: string;
  release_date: string;
  topic_list?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const combinedTopics = encodeHindiPdfIntoTopic(item.topic_list, item.pdf_hindi_url);
    const dbPayload: Record<string, unknown> = {
      course_id: item.course_id,
      day_number: item.day_number,
      title: item.title,
      pdf_url: item.pdf_url,
      release_date: item.release_date,
      topic_list: combinedTopics || null,
    };
    const { error } = await supabase.from('course_pdfs').insert([dbPayload]);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to insert Day PDF' };
  }
}

export async function updateBscaDayPdf(
  id: string,
  updates: {
    title?: string;
    pdf_url?: string;
    pdf_hindi_url?: string;
    release_date?: string;
    topic_list?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const combinedTopics = encodeHindiPdfIntoTopic(updates.topic_list, updates.pdf_hindi_url);
    const payload: Record<string, unknown> = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.pdf_url !== undefined) payload.pdf_url = updates.pdf_url;
    if (updates.release_date !== undefined) payload.release_date = updates.release_date;
    payload.topic_list = combinedTopics || null;

    const { error } = await supabase.from('course_pdfs').update(payload).eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update Day PDF' };
  }
}

export async function deleteBscaDayPdf(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('course_pdfs').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// Reading history tracking
export function getBscaReadArticles(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const val = localStorage.getItem(BSCA_READ_HISTORY_KEY);
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

export function toggleMarkArticleRead(articleId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = new Set(getBscaReadArticles());
    const wasRead = current.has(articleId);
    if (wasRead) current.delete(articleId);
    else current.add(articleId);
    localStorage.setItem(BSCA_READ_HISTORY_KEY, JSON.stringify(Array.from(current)));
    return !wasRead;
  } catch {
    return false;
  }
}

export const SAMPLE_BSCA_ARTICLES_FORMAT = `BSCA Daily Current Affairs Articles
Date: 2026-11-02

BANKING & FINANCE

RBI Introduces Unified Lending Interface (ULI) for Frictionless Credit Delivery
Key Stats: ₹50,000 Cr Credit Target | 100% Digital KYC | MSME & Agri Focus
- The Reserve Bank of India (RBI) announced the nationwide rollout of the Unified Lending Interface (ULI) to enable frictionless credit delivery, especially for agricultural and MSME borrowers.
- ULI operates on a plug-and-play architecture with standardized APIs connecting lenders to digital land records, GSTN data, and milk cooperative databases.
- Just as UPI transformed retail payments, ULI is designed to compress credit appraisal turnaround times from weeks to minutes.
Static GK:
RBI Headquarters: Mumbai, Maharashtra
RBI Established: 1 April 1935 (RBI Act, 1934)

ECONOMY & BUSINESS

Cabinet Approves PM-eBus Sewa Payment Security Mechanism with ₹3,435 Cr Outlay
Key Stats: ₹3,435.33 Cr Outlay | 38,000+ e-Buses | FY25 to FY29
- The Union Cabinet approved the PM-eBus Sewa-Payment Security Mechanism (PSM) scheme with a financial outlay of ₹3,435.33 crore to accelerate electric bus adoption by Public Transport Authorities (PTAs).
- Under the scheme, Convergence Energy Services Limited (CESL) will ensure timely monthly payments to OEMs/operators through a dedicated RBI escrow facility in case of PTA defaults.
Static GK:
Implementing Agency: Convergence Energy Services Limited (CESL)
Nodal Ministry: Ministry of Heavy Industries

APPOINTMENTS & RESIGNATIONS

Justice Sanjiv Khanna Appointed 51st Chief Justice of India
Key Stats: 51st CJI | Article 124(2) | Supreme Court of India
- The President of India appointed Justice Sanjiv Khanna as the 51st Chief Justice of India under clause (2) of Article 124 of the Constitution of India.
- He also serves as the Executive Chairman of the National Legal Services Authority (NALSA).
Static GK:
Supreme Court Established: 28 January 1950
Constitutional Provision: Article 124`;

/**
 * Extracts raw plain text from an uploaded Word (.docx / .doc), Text (.txt), or Markdown (.md) file.
 */
export async function extractTextFromUploadedDoc(file: File): Promise<string> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.txt') || lower.endsWith('.md')) {
    return await file.text();
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Check if OOXML ZIP (.docx or .doc saved in modern Word format — magic bytes PK\x03\x04)
  const isZipOoxml =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;

  if (lower.endsWith('.docx') || isZipOoxml) {
    const mammoth = await import('mammoth');
    const lib = (mammoth.default || mammoth) as {
      extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    };
    const { value } = await lib.extractRawText({ arrayBuffer });
    return value;
  }

  if (lower.endsWith('.doc')) {
    const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const trimmed = utf8Text.trimStart();

    // 1. HTML / Word XML saved with .doc extension (e.g. Google Docs / Word Web Page .doc)
    if (
      /^<(?:!DOCTYPE|html|\?xml|w:wordDocument)/i.test(trimmed) ||
      /MIME-Version:/i.test(trimmed.slice(0, 200))
    ) {
      return utf8Text
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, '\n')
        .replace(/<li\b[^>]*>/gi, '- ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n\n')
        .trim();
    }

    // 2. RTF saved with .doc extension
    if (trimmed.startsWith('{\\rtf')) {
      return utf8Text
        .replace(/\\(?:par|pard|line)\b\s*/g, '\n')
        .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
        .replace(/[{}]/g, '')
        .replace(/\n\s*\n+/g, '\n\n')
        .trim();
    }

    // 3. Legacy OLE2 Binary Word 97-2003 (.doc) — magic bytes D0 CF 11 E0
    const isOle2 =
      bytes.length >= 4 &&
      bytes[0] === 0xd0 &&
      bytes[1] === 0xcf &&
      bytes[2] === 0x11 &&
      bytes[3] === 0xe0;

    if (isOle2) {
      // Extract both UTF-16LE and ASCII text runs from WordDocument stream
      const segments: string[] = [];

      // Scan UTF-16LE readable blocks
      let u16Buf = '';
      for (let i = 512; i + 1 < bytes.length; i += 2) {
        const code = bytes[i] | (bytes[i + 1] << 8);
        if (code === 0x000d || code === 0x000a) {
          u16Buf += '\n';
        } else if (
          (code >= 0x0020 && code <= 0x007e) ||
          code === 0x20b9 || // ₹
          code === 0x2022 || // •
          code === 0x2013 || // –
          code === 0x2014 || // —
          (code >= 0x0900 && code <= 0x097f) // Devanagari
        ) {
          u16Buf += String.fromCharCode(code);
        } else {
          if (u16Buf.trim().length >= 24) {
            segments.push(u16Buf.trim());
          }
          u16Buf = '';
        }
      }
      if (u16Buf.trim().length >= 24) segments.push(u16Buf.trim());

      // Scan single-byte CP1252/ASCII readable blocks
      let asciiBuf = '';
      for (let i = 512; i < bytes.length; i++) {
        const b = bytes[i];
        if (b === 0x0d || b === 0x0a) {
          asciiBuf += '\n';
        } else if (b === 0x09 || (b >= 0x20 && b <= 0x7e)) {
          asciiBuf += String.fromCharCode(b);
        } else {
          if (asciiBuf.trim().length >= 30 && /[a-zA-Z]{3,}/.test(asciiBuf)) {
            segments.push(asciiBuf.trim());
          }
          asciiBuf = '';
        }
      }
      if (asciiBuf.trim().length >= 30 && /[a-zA-Z]{3,}/.test(asciiBuf)) {
        segments.push(asciiBuf.trim());
      }

      const noiseBlock = /^(?:Root Entry|WordDocument|CompObj|SummaryInformation|DocumentSummaryInformation|Normal\.dot|Microsoft Office Word|Times New Roman|Calibri|Arial)/i;
      const cleaned = segments
        .map((s) =>
          s
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 1 && !noiseBlock.test(l) && !/^HYPERLINK\b/i.test(l))
            .join('\n')
        )
        .filter((s) => s.length >= 24);

      if (cleaned.length > 0) {
        return cleaned.join('\n\n');
      }

      throw new Error(
        'This legacy binary .doc file could not be read cleanly. Please save it as Word (.docx) or Plain Text (.txt) in MS Word / Google Docs and re-upload.'
      );
    }

    // Plain text saved with .doc extension
    if (utf8Text.trim().length > 0) {
      return utf8Text;
    }
  }

  throw new Error('Unsupported file format. Please upload a Word (.docx / .doc), Text (.txt), or Markdown (.md) file.');
}

function parseNormalizedDateString(raw: string): string | null {
  const s = raw.trim();
  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY (standard Indian date format)
  const dmyMatch = s.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/);
  if (dmyMatch) {
    const first = Number(dmyMatch[1]);
    const second = Number(dmyMatch[2]);
    const y = dmyMatch[3];
    // Assume DD-MM-YYYY unless second > 12
    const day = second > 12 ? second : first;
    const month = second > 12 ? first : second;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // e.g. "02 November 2026" or "Nov 2, 2026"
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

function mapCategoryKeyword(text: string): BscaCategory | null {
  const u = text.toUpperCase().trim();
  if (!u) return null;
  if (/\b(?:BANKING|FINANCE|FINANCIAL|RBI\s+CIRCULAR|BANKING\s*&\s*RBI)\b/.test(u)) return 'BANKING_FINANCE';
  if (/\b(?:ECONOMY|ECONOMIC|BUSINESS|GDP)\b/.test(u)) return 'ECONOMY_BUSINESS';
  if (/\b(?:APPOINTMENTS?|RESIGNATIONS?)\b/.test(u)) return 'APPOINTMENTS';
  if (/\b(?:INTERNATIONAL|GLOBAL\s+AFFAIRS|WORLD\s+NEWS)\b/.test(u)) return 'INTERNATIONAL';
  if (/\b(?:NATIONAL|INDIA\s+NEWS|STATE\s+NEWS)\b/.test(u)) return 'NATIONAL';
  if (/\b(?:MOUS?|SUMMITS?|CONFERENCES?|AGREEMENTS?|SCHEMES?)\b/.test(u)) return 'MOUS_SUMMITS';
  if (/\b(?:REPORTS?|INDICES|INDEX|RANKS?|RANKINGS?)\b/.test(u)) return 'REPORTS_INDICES';
  if (/\b(?:SPORTS?)\b/.test(u)) return 'SPORTS';
  if (/\b(?:AWARDS?|HONOURS?|HONORS?|PRIZES?)\b/.test(u)) return 'AWARDS_HONOURS';
  if (/\b(?:DEFENCE|DEFENSE|SCIENCE|TECHNOLOGY|SPACE)\b/.test(u)) return 'DEFENCE_SCIENCE';
  if (/\b(?:IMPORTANT\s+DAYS?|DAYS?\s*&\s*THEMES?)\b/.test(u)) return 'IMPORTANT_DAYS';
  if (/\b(?:MISC|MISCELLANEOUS|GENERAL\s+AFFAIRS|OBITUAR(?:Y|IES)|BOOKS?\s*&\s*AUTHORS?)\b/.test(u)) return 'MISC';
  return null;
}

/**
 * Detects whether a line is a standalone section Category header or explicit `Category: ...` metadata tag
 * (without accidentally matching full article headlines like "RBI keeps Repo Rate unchanged at 6.50%").
 */
function detectArticleCategoryLine(line: string): { category: BscaCategory; isInlineTag: boolean } | null {
  // 1. Explicit "Category: Banking & Finance" tag
  const explicitMatch = line.match(/^(?:Category|Section)\s*[:\-]\s*(.+)$/i);
  if (explicitMatch) {
    const cat = mapCategoryKeyword(explicitMatch[1]);
    if (cat) return { category: cat, isInlineTag: true };
  }

  // Never treat bullet lines as category headers
  if (/^[\-\•\*\u2022\u25cf\u25b6→➢]\s*/.test(line)) return null;

  // Strip decorative wrappers like "## [BANKING & FINANCE]" or "=== NATIONAL AFFAIRS ==="
  const stripped = line
    .replace(/^[#=\-\*\[\(\s🏦📈🇮🇳🌍🎖️🤝📊🏆⚽🛡️📅📰]+/, '')
    .replace(/[#=\-\*\]\)\s:]+$/, '')
    .trim();

  if (!stripped || stripped.length > 48) return null;

  const exactSectionRegex =
    /^(?:BANKING(?:\s*(?:&|AND|\/)\s*(?:FINANCE|FINANCIAL\s+AWARENESS|RBI|ECONOMY))?(?:\s+NEWS|\s+AFFAIRS)?|FINANCIAL\s+AWARENESS|ECONOMY(?:\s*(?:&|AND|\/)\s*BUSINESS)?(?:\s+NEWS|\s+AFFAIRS)?|BUSINESS(?:\s*(?:&|AND)\s*ECONOMY)?|NATIONAL(?:\s+(?:NEWS|AFFAIRS))?|STATE(?:\s+(?:NEWS|AFFAIRS))?|INTERNATIONAL(?:\s+(?:NEWS|AFFAIRS))?|GLOBAL\s+AFFAIRS|APPOINTMENTS?(?:\s*(?:&|AND|\/)\s*RESIGNATIONS?)?|MOUS?(?:\s*(?:&|AND|\/)\s*(?:SUMMITS?|AGREEMENTS?|CONFERENCES?))?|SUMMITS?(?:\s*(?:&|AND|\/)\s*CONFERENCES?)?|AGREEMENTS?(?:\s*(?:&|AND)\s*MOUS?)?|SCHEMES?(?:\s*(?:&|AND)\s*COMMITTEES?)?|REPORTS?(?:\s*(?:&|AND|\/)\s*(?:INDICES|INDEX|RANKS?|RANKINGS?))?|RANKS?(?:\s*(?:&|AND)\s*(?:REPORTS?|INDICES))?|SPORTS?(?:\s+NEWS)?|AWARDS?(?:\s*(?:&|AND|\/)\s*(?:HONOURS?|HONORS?))?|DEFENCE(?:\s*(?:&|AND|\/)\s*(?:SCIENCE|TECHNOLOGY))?|SCIENCE(?:\s*(?:&|AND|\/)\s*(?:TECHNOLOGY|DEFENCE|SPACE))?|IMPORTANT\s+DAYS?(?:\s*(?:&|AND)\s*THEMES?)?|MISC(?:ELLANEOUS)?|OBITUAR(?:Y|IES)|BOOKS?(?:\s*(?:&|AND)\s*AUTHORS?)?)$/i;

  if (exactSectionRegex.test(stripped)) {
    const cat = mapCategoryKeyword(stripped);
    if (cat) return { category: cat, isInlineTag: false };
  }

  return null;
}

function splitKeyStatsLine(raw: string): string[] {
  const cleaned = raw.trim();
  if (!cleaned) return [];
  if (cleaned.includes('|') || cleaned.includes(';')) {
    return cleaned
      .split(/[|;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  // Split commas that are NOT thousands separators inside numbers (e.g. ₹57,613 Cr stays intact)
  return cleaned
    .split(/,(?!\d{2,3}\b)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ===========================================================================
// WORD (.docx / .doc) / TEXT PARSER FOR PROFESSIONAL BSCA & DAILY QUIZ
// ===========================================================================
export function parseBscaDocText(
  content: string,
  defaultDate?: string,
  mode: 'auto' | 'quiz_only' | 'articles_only' | 'combined' = 'auto'
): BscaParsedDocResult {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let date = defaultDate || new Date().toISOString().slice(0, 10);
  let quizTitle = `BSCA Daily GA Quiz – ${date}`;

  // Check if date header exists in first 25 lines
  const dateRegex =
    /(?:Date|Dated|Edition)\s*[:\-]?\s*([0-9]{1,2}[-\/\.][0-9]{1,2}[-\/\.][0-9]{2,4}|[0-9]{4}[-\/\.][0-9]{1,2}[-\/\.][0-9]{1,2}|[0-9]{1,2}\s+[A-Za-z]+\s*,?\s*[0-9]{4}|[A-Za-z]+\s+[0-9]{1,2}\s*,?\s*[0-9]{4})/i;
  for (let i = 0; i < Math.min(25, lines.length); i++) {
    const m = lines[i].match(dateRegex);
    if (m && m[1]) {
      const normalized = parseNormalizedDateString(m[1]);
      if (normalized) {
        date = normalized;
        quizTitle = `BSCA Daily GA Quiz – ${date}`;
      }
      break;
    }
  }

  // Check for Quiz Title header in top lines
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const l = lines[i];
    if (
      /(?:Quiz|Current\s+Affairs|GA\s+Daily|Banking\s+Awareness|General\s+Awareness)/i.test(l) &&
      !l.startsWith('Q1') &&
      !l.startsWith('Q.1') &&
      !l.startsWith('1.') &&
      !/^(?:Date|Dated|Edition)\s*[:\-]/i.test(l) &&
      l.length < 140
    ) {
      quizTitle = l.replace(/^[#\*\-\s]+/, '').replace(/[#\*]+$/, '').trim();
      break;
    }
  }

  const articles: Omit<BscaArticle, 'id'>[] = [];
  const questions: {
    question_text: string;
    options: string[];
    correct_option_index: number;
    explanation?: string;
  }[] = [];

  // Determine lines distribution
  let articleLines: string[] = [];
  let quizLines: string[] = [];

  const qStartMarkerRegex = /^(?:Q(?:uestion)?\s*[\.\:\)]?\s*[1-9]|\(?\d+\)[\.\)]|\b[1-9]\.|\b[1-9]\))\s+/i;
  const hasCategoryMarker = lines.some((l) => detectArticleCategoryLine(l) !== null);
  const hasQuestionMarker = lines.some((l) => qStartMarkerRegex.test(l));
  const explicitQuizDividerRegex =
    /^(?:DAILY(?:\s+CURRENT\s+AFFAIRS|\s+GA)?\s+QUIZ|CURRENT\s+AFFAIRS\s+QUIZ|---+\s*QUIZ\s*---+)/i;

  if (mode === 'articles_only') {
    // Dedicated Articles Upload Mode: never cut off on numbered headlines/bullets; only stop at an explicit Quiz section banner if present
    let dividerIdx = -1;
    for (let i = 1; i < lines.length; i++) {
      if (explicitQuizDividerRegex.test(lines[i])) {
        dividerIdx = i;
        break;
      }
    }
    articleLines = dividerIdx === -1 ? lines : lines.slice(0, dividerIdx);
    quizLines = [];
  } else if (mode === 'quiz_only' || (!hasCategoryMarker && hasQuestionMarker)) {
    // Pure Quiz Document
    articleLines = [];
    quizLines = lines;
  } else {
    // Combined or Auto with Articles
    let quizStartIndex = -1;
    const quizHeaderRegex =
      /^(?:DAILY(?:\s+CURRENT\s+AFFAIRS|\s+GA)?\s+QUIZ|CURRENT\s+AFFAIRS\s+QUIZ|---+\s*QUIZ\s*---+|Q1[\.\s\:\)]|Q\.1[\.\s\:\)]|QUESTION\s*1[\.\s\:\)])/i;
    for (let i = 0; i < lines.length; i++) {
      if (quizHeaderRegex.test(lines[i])) {
        quizStartIndex = i;
        break;
      }
    }

    if (quizStartIndex === -1 && hasQuestionMarker) {
      for (let i = 0; i < lines.length; i++) {
        if (qStartMarkerRegex.test(lines[i])) {
          quizStartIndex = i;
          break;
        }
      }
    }

    articleLines = quizStartIndex === -1 ? lines : lines.slice(0, quizStartIndex);
    quizLines = quizStartIndex === -1 ? [] : lines.slice(quizStartIndex);
  }

  // 1. Parse Articles (if any)
  if (articleLines.length > 0) {
    let currentCategory: BscaCategory = 'BANKING_FINANCE';
    let currentTitle = '';
    let currentBullets: string[] = [];
    let currentStaticGk: BscaStaticGkItem[] = [];
    let currentKeyStats: string[] = [];
    let currentImportance: 'HIGH' | 'MEDIUM' | null = null;
    let currentFeatured = false;
    let inStaticGk = false;

    function flushArticle() {
      if (currentTitle.trim()) {
        const cleanTitle = currentTitle.trim();
        const finalBullets = currentBullets.length > 0 ? currentBullets : [cleanTitle];
        let finalStats = currentKeyStats;
        if (finalStats.length === 0) {
          const statMatches =
            finalBullets
              .join(' ')
              .match(/(?:₹|Rs\.?\s?|\$)[0-9,]+(?:\.[0-9]+)?(?:\s?(?:Lakh|Crore|Cr|Billion|Million|Trillion))?|[0-9]+(?:\.[0-9]+)?%|[0-9]+(?:st|nd|rd|th)\s+Rank/gi) || [];
          finalStats = Array.from(new Set(statMatches.map((s) => s.trim()))).slice(0, 4);
        }

        articles.push({
          date,
          title: cleanTitle,
          category: currentCategory,
          bullets: finalBullets,
          staticGk: currentStaticGk,
          keyStats: finalStats.length > 0 ? finalStats : undefined,
          isFeaturedHero: currentFeatured || undefined,
          readTimeMin: Math.max(1, Math.round((finalBullets.join(' ').split(/\s+/).length + 20) / 100)),
          importance:
            currentImportance ||
            (currentCategory === 'BANKING_FINANCE' || currentCategory === 'ECONOMY_BUSINESS' ? 'HIGH' : 'MEDIUM'),
        });
      }
      currentTitle = '';
      currentBullets = [];
      currentStaticGk = [];
      currentKeyStats = [];
      currentImportance = null;
      currentFeatured = false;
      inStaticGk = false;
    }

    for (let i = 0; i < articleLines.length; i++) {
      const line = articleLines[i];

      // Skip isolated Date line, document title banner on line 0/1, or horizontal separator
      if (
        /^(?:Date|Dated|Edition)\s*[:\-]?\s*[0-9A-Za-z]/i.test(line) ||
        /^[-=_\*]{3,}$/.test(line) ||
        (i <= 2 &&
          !currentTitle &&
          /^(?:BSCA\s+)?(?:Daily\s+)?Current\s+Affairs(?:\s+(?:Articles?|Digest|Notes|Edition|Update))?$/i.test(
            line.replace(/^[#\*\s]+/, '').replace(/[#\*\s]+$/, '')
          ))
      ) {
        continue;
      }

      // Detect Category Header or "Category: ..." tag
      const detectedCat = detectArticleCategoryLine(line);
      if (detectedCat) {
        if (detectedCat.isInlineTag) {
          // If Category: ... appears before bullets, apply to current article; if current article already has bullets, flush first
          if (currentTitle && currentBullets.length > 0) {
            flushArticle();
          }
          currentCategory = detectedCat.category;
        } else {
          flushArticle();
          currentCategory = detectedCat.category;
        }
        continue;
      }

      // Detect Key Stats line (e.g. "Key Stats: ₹50,000 Cr | 100% Digital")
      const statsMatch = line.match(/^(?:Key\s+Stats?|Key\s+Figures?|Stats?)\s*[:\-]\s*(.+)$/i);
      if (statsMatch) {
        inStaticGk = false;
        currentKeyStats.push(...splitKeyStatsLine(statsMatch[1]));
        continue;
      }

      // Detect Importance / Featured tags
      const impMatch = line.match(/^Importance\s*[:\-]\s*(HIGH|MEDIUM)/i);
      if (impMatch) {
        currentImportance = impMatch[1].toUpperCase() === 'HIGH' ? 'HIGH' : 'MEDIUM';
        continue;
      }
      if (/^Featured(?:\s+Hero)?\s*[:\-]\s*(?:Yes|True|1)/i.test(line)) {
        currentFeatured = true;
        continue;
      }

      // Detect Explicit Headline tag (e.g. "Headline: ...", "Title: ...", "Article 1: ...", "News 1: ...")
      const explicitHeadline = line.match(/^(?:Headline|Title|(?:Article|News)\s*\d*)\s*[:\-\.]\s*(.+)$/i);
      if (explicitHeadline && explicitHeadline[1].trim()) {
        flushArticle();
        currentTitle = explicitHeadline[1].replace(/^[#\*\s]+/, '').replace(/[#\*]+$/, '').trim();
        continue;
      }

      // Detect Static GK section
      if (/^(?:Static\s+GK|Static\s+Takeaways?|Static\s+Points?|Static\s+Facts?)\s*[:\-]?/i.test(line)) {
        inStaticGk = true;
        const stripped = line.replace(/^(?:Static\s+GK|Static\s+Takeaways?|Static\s+Points?|Static\s+Facts?)\s*[:\-]?\s*/i, '').trim();
        if (stripped) {
          stripped.split('|').forEach((chunk) => {
            if (chunk.includes(':')) {
              const [k, ...rest] = chunk.split(':');
              if (k.trim() && rest.join(':').trim()) {
                currentStaticGk.push({ key: k.trim(), value: rest.join(':').trim() });
              }
            }
          });
        }
        continue;
      }

      if (inStaticGk) {
        const cleanGkCandidate = line.replace(/^[\-\•\*\u2022\u25cf\u25b6\d\.\)]+\s*/, '').trim();
        if (cleanGkCandidate.includes(':') && cleanGkCandidate.indexOf(':') < 45) {
          const [k, ...rest] = cleanGkCandidate.split(':');
          const keyText = k.trim();
          const valText = rest.join(':').trim();
          if (keyText && valText) {
            currentStaticGk.push({ key: keyText, value: valText });
            continue;
          }
        }
        inStaticGk = false;
      }

      // Numbered line: e.g. "1. RBI launches..." — if we have no title, OR if previous article already collected unnumbered bullets/staticGk, treat as new numbered article headline!
      const numberedMatch = line.match(/^(\d+)[\.\)]\s+(.+)$/);
      if (numberedMatch) {
        const textBody = numberedMatch[2].trim();
        if (!currentTitle) {
          currentTitle = textBody;
          continue;
        }
        if ((currentBullets.length > 0 || currentStaticGk.length > 0) && textBody.length < 180 && !textBody.endsWith(';')) {
          flushArticle();
          currentTitle = textBody;
          continue;
        }
        currentBullets.push(textBody);
        continue;
      }

      // Bullet point line (-, •, *, ▪, →, ➢)
      if (/^[\-\•\*\u2022\u25cf\u25b6▪→➢]\s*/.test(line)) {
        const cleanBullet = line.replace(/^[\-\•\*\u2022\u25cf\u25b6▪→➢]+\s*/, '').trim();
        if (!currentTitle) {
          currentTitle = cleanBullet;
        } else {
          currentBullets.push(cleanBullet);
        }
        continue;
      }

      // Markdown heading (e.g. ### Headline)
      if (/^#{1,4}\s+/.test(line)) {
        flushArticle();
        currentTitle = line.replace(/^#{1,4}\s+/, '').replace(/[#\*]+$/, '').trim();
        continue;
      }

      // Potential standalone headline vs paragraph bullet
      if (line.length < 170 && !line.endsWith('.') && !line.endsWith(';')) {
        flushArticle();
        currentTitle = line.replace(/^[#\*\s]+/, '').replace(/[#\*]+$/, '').trim();
      } else {
        if (!currentTitle) {
          currentTitle = line;
        } else {
          currentBullets.push(line);
        }
      }
    }
    flushArticle();
  }

  // 2. Parse Quiz Questions
  if (quizLines.length > 0) {
    let curQText = '';
    let curOpts: string[] = [];
    let curAns = 0;
    let curExp = '';
    let readingExp = false;

    function flushQuestion() {
      if (curQText.trim() && curOpts.length >= 2) {
        questions.push({
          question_text: curQText.trim(),
          options: curOpts,
          correct_option_index: Math.min(Math.max(0, curAns), curOpts.length - 1),
          explanation: curExp.trim(),
        });
      }
      curQText = '';
      curOpts = [];
      curAns = 0;
      curExp = '';
      readingExp = false;
    }

    const qStartRegex = /^(?:Q(?:uestion)?\s*[\.\:\)]?\s*(\d+)[\.\:\)]|\(?(\d+)\)[\.\)]|\b(\d+)[\.\)])\s*(.*)$/i;
    const optRegex = /^(?:[\(\[]?([A-Ea-e1-5])[\)\]\.\:]\s*)(.*)$/;
    const ansRegex = /^(?:Correct\s+(?:Option|Answer)|Answer|Ans)\s*[:\-\.]?\s*(?:Option\s*)?[\(\[]?([A-Ea-e1-5])/i;
    const expRegex = /^(?:Explanation|Exp|Sol|Solution|Rationale)\s*[:\-\.]?\s*(.*)$/i;

    for (let i = 0; i < quizLines.length; i++) {
      const l = quizLines[i];

      // Ignore decorative separator lines
      if (/^[-=_\*]{3,}$/.test(l) || /^Instructions\s*:/i.test(l)) {
        continue;
      }

      // Ignore top quiz title if encountered at start
      if (i < 3 && /(?:Quiz|Current\s+Affairs|GA\s+Daily)/i.test(l) && !qStartRegex.test(l)) {
        continue;
      }

      const qm = l.match(qStartRegex);
      if (qm) {
        flushQuestion();
        curQText = (qm[4] || '').trim();
        continue;
      }

      const am = l.match(ansRegex);
      if (am) {
        const raw = am[1].toUpperCase();
        if (/[A-E]/.test(raw)) {
          curAns = raw.charCodeAt(0) - 'A'.charCodeAt(0);
        } else if (/[1-5]/.test(raw)) {
          curAns = Number(raw) - 1;
        }
        continue;
      }

      const em = l.match(expRegex);
      if (em) {
        readingExp = true;
        curExp = em[1] ? em[1].trim() : '';
        continue;
      }

      const om = l.match(optRegex);
      if (om && !readingExp) {
        curOpts.push(om[2].trim());
        continue;
      }

      if (readingExp) {
        curExp += (curExp ? ' ' : '') + l;
      } else if (curOpts.length === 0) {
        curQText = (curQText ? curQText + ' ' : '') + l;
      } else if (curOpts.length > 0) {
        curOpts[curOpts.length - 1] += ' ' + l;
      }
    }
    flushQuestion();
  }

  return {
    date,
    quizTitle,
    articles,
    questions,
  };
}

