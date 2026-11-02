import { supabase } from './supabase';
import { persistSettingToSupabase } from './monetization';

/**
 * Topic-wise Practice Question Pool
 * ---------------------------------
 * Dual-Engine Backend:
 * 1. Dedicated Supabase Table (`practice_questions`): High-performance table with RLS.
 * 2. Automatic Cloud Fallback (`admin_settings` key `bs_practice_questions_pool_v1`):
 *    If the table has not been created yet in the Supabase SQL editor, the engine
 *    transparently synchronizes all questions to Supabase `admin_settings` + `localStorage`.
 *    Zero configuration needed – works out of the box!
 */

export const PRACTICE_TABLE = 'practice_questions';
export const PRACTICE_IMAGE_BUCKET = 'course_pdfs';
export const PRACTICE_SESSION_SIZE = 10;
export const PRACTICE_POOL_SETTINGS_KEY = 'bs_practice_questions_pool_v1';

export type PracticeDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface PracticeQuestion {
  id: string;
  topic: string;
  difficulty: PracticeDifficulty;
  question_text: string;
  question_image_url?: string | null;
  options: string[];
  correct_option_index: number;
  solution_text?: string | null;
  solution_image_url?: string | null;
  created_at?: string;
}

export type NewPracticeQuestion = Omit<PracticeQuestion, 'id' | 'created_at'>;

export interface PracticeTopicMeta {
  name: string;
  icon: string;
  group: 'ARITHMETIC' | 'ADVANCED_QUANT' | 'REASONING' | 'OTHER';
}

export const DEFAULT_PRACTICE_TOPICS: PracticeTopicMeta[] = [
  { name: 'Mixed Arithmetic', icon: '🎯', group: 'ARITHMETIC' },
  { name: 'Percentage', icon: '%', group: 'ARITHMETIC' },
  { name: 'Profit & Loss', icon: '💹', group: 'ARITHMETIC' },
  { name: 'Simple Interest', icon: '🏦', group: 'ARITHMETIC' },
  { name: 'Compound Interest', icon: '📈', group: 'ARITHMETIC' },
  { name: 'Ratio & Proportion', icon: '⚖️', group: 'ARITHMETIC' },
  { name: 'Partnership', icon: '🤝', group: 'ARITHMETIC' },
  { name: 'Averages', icon: '📊', group: 'ARITHMETIC' },
  { name: 'Problems on Ages', icon: '🎂', group: 'ARITHMETIC' },
  { name: 'Mixture & Alligation', icon: '🧪', group: 'ARITHMETIC' },
  { name: 'Time & Work', icon: '🛠️', group: 'ARITHMETIC' },
  { name: 'Pipes & Cisterns', icon: '🚰', group: 'ARITHMETIC' },
  { name: 'Time, Speed & Distance', icon: '🚗', group: 'ARITHMETIC' },
  { name: 'Boats & Streams', icon: '🚤', group: 'ARITHMETIC' },
  { name: 'Problems on Trains', icon: '🚆', group: 'ARITHMETIC' },
  { name: 'Mensuration', icon: '📐', group: 'ARITHMETIC' },
  { name: 'Probability', icon: '🎲', group: 'ARITHMETIC' },
  { name: 'Permutation & Combination', icon: '🔢', group: 'ARITHMETIC' },
  { name: 'Simplification', icon: '➗', group: 'ADVANCED_QUANT' },
  { name: 'Approximation', icon: '≈', group: 'ADVANCED_QUANT' },
  { name: 'Number Series', icon: '🔁', group: 'ADVANCED_QUANT' },
  { name: 'Quadratic Equations', icon: '𝑥²', group: 'ADVANCED_QUANT' },
  { name: 'Data Interpretation', icon: '📉', group: 'ADVANCED_QUANT' },
  { name: 'Data Sufficiency', icon: '🧩', group: 'ADVANCED_QUANT' },
];

/** Built-in high-quality practice question pool (covers key banking prelims + mains standards) */
export const DEFAULT_PRACTICE_QUESTIONS: PracticeQuestion[] = [
  // --- PERCENTAGE ---
  {
    id: 'pq_pct_01',
    topic: 'Percentage',
    difficulty: 'EASY',
    question_text: "A's salary is 25% more than B's salary. By what percentage is B's salary less than A's salary?",
    options: ['16.67%', '20%', '25%', '33.33%', '15%'],
    correct_option_index: 1,
    solution_text: 'Let B = ₹100. Then A = ₹125.\nDifference = 125 - 100 = 25.\nPercentage B is less = (25 / 125) × 100 = 20%.\n\nShortcut formula: [R / (100 + R)] × 100 = [25 / 125] × 100 = 20%.',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pq_pct_02',
    topic: 'Percentage',
    difficulty: 'MEDIUM',
    question_text: 'If the price of sugar increases by 20%, by what percent must a household reduce its consumption so that the total expenditure remains unchanged?',
    options: ['15%', '16.67%', '20%', '18.25%', '25%'],
    correct_option_index: 1,
    solution_text: 'Reduction in consumption = [R / (100 + R)] × 100%\n= [20 / (100 + 20)] × 100 = (20 / 120) × 100 = 1/6 × 100 = 16.67% (or 16 2/3%).',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pq_pct_03',
    topic: 'Percentage',
    difficulty: 'HARD',
    question_text: 'In an examination, a candidate scores 35% marks and fails by 40 marks, while another candidate scores 60% marks and gets 35 marks more than the minimum passing marks. What are the maximum marks of the examination?',
    options: ['250', '280', '300', '320', '350'],
    correct_option_index: 2,
    solution_text: 'Difference in percentage = 60% - 35% = 25%.\nDifference in marks = 40 (fail) + 35 (excess) = 75 marks.\nTherefore, 25% of Maximum Marks = 75\nMaximum Marks = (75 / 25) × 100 = 300 marks.',
    created_at: '2026-01-01T00:00:00.000Z',
  },

  // --- PROFIT & LOSS ---
  {
    id: 'pq_pl_01',
    topic: 'Profit & Loss',
    difficulty: 'EASY',
    question_text: 'A shopkeeper sells an article for ₹840 at a profit of 20%. What was the cost price of the article?',
    options: ['₹680', '₹700', '₹720', '₹750', '₹710'],
    correct_option_index: 1,
    solution_text: 'SP = CP × (100 + Profit%) / 100\n840 = CP × 1.20\nCP = 840 / 1.2 = ₹700.',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pq_pl_02',
    topic: 'Profit & Loss',
    difficulty: 'MEDIUM',
    question_text: 'By selling 33 meters of cloth, a merchant gains the cost price of 11 meters. Find the gain percentage.',
    options: ['25%', '30%', '33.33%', '40%', '50%'],
    correct_option_index: 2,
    solution_text: 'Gain = CP of 11 meters.\nTotal articles sold = 33 meters.\nGain % = (Gain in items / Number of items at CP) × 100\n= (11 / 33) × 100 = 1/3 × 100 = 33.33%.',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pq_pl_03',
    topic: 'Profit & Loss',
    difficulty: 'HARD',
    question_text: 'A dishonest dealer professes to sell his goods at cost price, but uses a false weight of 900 grams for a 1 kg weight. Find his actual profit percentage.',
    options: ['10%', '11.11%', '12.5%', '9.09%', '15%'],
    correct_option_index: 1,
    solution_text: 'Error = 1000g - 900g = 100g.\nTrue value = 1000g, False value = 900g.\nGain % = [Error / (True Value - Error)] × 100\n= [100 / 900] × 100 = 11.11% (11 1/9%).',
    created_at: '2026-01-01T00:00:00.000Z',
  },

  // --- SIMPLE INTEREST ---
  {
    id: 'pq_si_01',
    topic: 'Simple Interest',
    difficulty: 'EASY',
    question_text: 'A sum of money doubles itself in 8 years at simple interest. What is the rate of interest per annum?',
    options: ['10%', '12%', '12.5%', '15%', '16%'],
    correct_option_index: 2,
    solution_text: 'If Principal = P, Amount = 2P, then SI = P.\nSI = (P × R × T) / 100\nP = (P × R × 8) / 100\nR = 100 / 8 = 12.5% per annum.',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pq_si_02',
    topic: 'Simple Interest',
    difficulty: 'MEDIUM',
    question_text: 'A sum of money doubles itself in 7 years at simple interest. In how many years will it become 5 times itself at the same rate?',
    options: ['21 years', '28 years', '35 years', '25 years', '30 years'],
    correct_option_index: 1,
    solution_text: 'To double (n = 2): Interest is 1P in 7 years.\nTo become 5 times (n = 5): Interest required is (5 - 1)P = 4P.\nTime = 4 × 7 = 28 years.',
    created_at: '2026-01-01T00:00:00.000Z',
  },

  // --- COMPOUND INTEREST ---
  {
    id: 'pq_ci_01',
    topic: 'Compound Interest',
    difficulty: 'MEDIUM',
    question_text: 'The difference between simple interest and compound interest on a certain sum for 2 years at 10% per annum is ₹65. What is the sum?',
    options: ['₹5,500', '₹6,000', '₹6,500', '₹7,000', '₹6,250'],
    correct_option_index: 2,
    solution_text: 'For 2 years:\nDifference (CI - SI) = P × (R / 100)²\n65 = P × (10 / 100)²\n65 = P × (1 / 100)\nP = 65 × 100 = ₹6,500.',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pq_ci_02',
    topic: 'Compound Interest',
    difficulty: 'HARD',
    question_text: 'A sum of money invested at compound interest doubles itself in 4 years. In how many years will it become 8 times itself at the same rate?',
    options: ['8 years', '12 years', '16 years', '10 years', '14 years'],
    correct_option_index: 1,
    solution_text: 'In CI: If a sum becomes 2 times in 4 years,\nit will become 2³ = 8 times in (3 × 4) = 12 years.\n\nShortcut: 2^k times takes (k × T) years. Here 8 = 2³, so 3 × 4 = 12 years.',
    created_at: '2026-01-01T00:00:00.000Z',
  },

  // --- TIME & WORK ---
  {
    id: 'pq_tw_01',
    topic: 'Time & Work',
    difficulty: 'EASY',
    question_text: 'A can do a piece of work in 12 days and B can do it in 24 days. Working together, in how many days can they complete the work?',
    options: ['6 days', '8 days', '9 days', '10 days', '7.5 days'],
    correct_option_index: 1,
    solution_text: 'Total Work = LCM(12, 24) = 24 units.\nEfficiency of A = 24 / 12 = 2 units/day.\nEfficiency of B = 24 / 24 = 1 unit/day.\nCombined efficiency = 2 + 1 = 3 units/day.\nDays required = 24 / 3 = 8 days.',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pq_tw_02',
    topic: 'Time & Work',
    difficulty: 'MEDIUM',
    question_text: 'A can do a work in 15 days and B in 20 days. They work together for 4 days, then A leaves. In how many days will B finish the remaining work?',
    options: ['9 days', '10 days', '10.67 days', '11 days', '12 days'],
    correct_option_index: 2,
    solution_text: 'Total Work = LCM(15, 20) = 60 units.\nA = 4 units/day, B = 3 units/day. Total = 7 units/day.\nWork in 4 days = 4 × 7 = 28 units.\nRemaining Work = 60 - 28 = 32 units.\nTime taken by B alone = 32 / 3 = 10.67 days (10 2/3 days).',
    created_at: '2026-01-01T00:00:00.000Z',
  },

  // --- RATIO & PROPORTION ---
  {
    id: 'pq_rp_01',
    topic: 'Ratio & Proportion',
    difficulty: 'EASY',
    question_text: 'The ratio of two numbers is 3 : 5. If 8 is added to each number, the ratio becomes 2 : 3. What is the sum of the original numbers?',
    options: ['48', '56', '64', '72', '80'],
    correct_option_index: 2,
    solution_text: 'Let numbers be 3x and 5x.\n(3x + 8) / (5x + 8) = 2 / 3\n3(3x + 8) = 2(5x + 8)\n9x + 24 = 10x + 16\nx = 8.\nSum of numbers = 3x + 5x = 8x = 8 × 8 = 64.',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pq_rp_02',
    topic: 'Ratio & Proportion',
    difficulty: 'MEDIUM',
    question_text: 'A, B, and C divide ₹1,050 among themselves in such a way that A receives 2/5 of what B and C together receive. How much does A receive?',
    options: ['₹250', '₹300', '₹350', '₹400', '₹450'],
    correct_option_index: 1,
    solution_text: 'A = 2/5 of (B + C) → A / (B + C) = 2 / 5.\nSo A : (B + C) = 2 : 5.\nTotal parts = 2 + 5 = 7 parts = ₹1,050.\n1 part = 1,050 / 7 = ₹150.\nA receives = 2 parts = 2 × 150 = ₹300.',
    created_at: '2026-01-01T00:00:00.000Z',
  },

  // --- TIME, SPEED & DISTANCE ---
  {
    id: 'pq_tsd_01',
    topic: 'Time, Speed & Distance',
    difficulty: 'EASY',
    question_text: 'A train 240 meters long is running at a speed of 72 km/h. How much time will it take to pass a pole?',
    options: ['10 seconds', '12 seconds', '15 seconds', '18 seconds', '20 seconds'],
    correct_option_index: 1,
    solution_text: 'Speed in m/s = 72 × (5 / 18) = 20 m/s.\nDistance to cross pole = Train length = 240 m.\nTime = Distance / Speed = 240 / 20 = 12 seconds.',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pq_tsd_02',
    topic: 'Time, Speed & Distance',
    difficulty: 'MEDIUM',
    question_text: 'A person travels from town A to town B at 40 km/h and returns from B to A at 60 km/h. Find his average speed for the whole journey.',
    options: ['48 km/h', '50 km/h', '52 km/h', '45 km/h', '54 km/h'],
    correct_option_index: 0,
    solution_text: 'When distance is constant, Average Speed = (2 × x × y) / (x + y)\n= (2 × 40 × 60) / (40 + 60)\n= 4800 / 100 = 48 km/h.',
    created_at: '2026-01-01T00:00:00.000Z',
  },

  // --- MIXTURE & ALLIGATION ---
  {
    id: 'pq_ma_01',
    topic: 'Mixture & Alligation',
    difficulty: 'MEDIUM',
    question_text: 'In what ratio must rice at ₹45/kg be mixed with rice at ₹60/kg so that the mixture is worth ₹54/kg?',
    options: ['2 : 3', '3 : 2', '1 : 2', '2 : 5', '4 : 5'],
    correct_option_index: 0,
    solution_text: 'By Rule of Alligation:\nCheaper (45)          Dearer (60)\n             Mean (54)\n(60 - 54) = 6         (54 - 45) = 9\nRatio = 6 : 9 = 2 : 3.',
    created_at: '2026-01-01T00:00:00.000Z',
  },

  // --- PROBLEMS ON AGES ---
  {
    id: 'pq_age_01',
    topic: 'Problems on Ages',
    difficulty: 'EASY',
    question_text: 'The present ratio of ages of Father and Son is 7 : 3. Four years ago, the sum of their ages was 52 years. What is the present age of the son?',
    options: ['15 years', '18 years', '21 years', '24 years', '20 years'],
    correct_option_index: 1,
    solution_text: 'Sum 4 years ago = 52 years.\nPresent sum = 52 + 4 + 4 = 60 years.\nRatio = 7 : 3 (Total = 10 parts).\n1 part = 60 / 10 = 6 years.\nSon present age = 3 parts = 3 × 6 = 18 years.',
    created_at: '2026-01-01T00:00:00.000Z',
  },

  // --- PARTNERSHIP ---
  {
    id: 'pq_part_01',
    topic: 'Partnership',
    difficulty: 'MEDIUM',
    question_text: 'A and B invest in a business in the ratio 3 : 2. If 5% of the total profit goes to charity and A receives ₹855 as his profit share, find the total profit.',
    options: ['₹1,400', '₹1,500', '₹1,600', '₹1,550', '₹1,450'],
    correct_option_index: 1,
    solution_text: "Let total profit = ₹100x.\nRemaining profit after 5% charity = 95x.\nA's share = 95x × (3 / 5) = 57x.\nGiven 57x = 855 → x = 855 / 57 = 15.\nTotal profit = 100x = 100 × 15 = ₹1,500.",
    created_at: '2026-01-01T00:00:00.000Z',
  },

  // --- MIXED ARITHMETIC ---
  {
    id: 'pq_mix_01',
    topic: 'Mixed Arithmetic',
    difficulty: 'MEDIUM',
    question_text: 'The ratio of efficiency of A and B is 3 : 2. A and B together can complete a piece of work in 12 days. If A works at 50% of his normal efficiency and B works at twice his normal efficiency, in how many days will they finish the work?',
    options: ['8 days', '10.9 days', '11.5 days', '12 days', '10.5 days'],
    correct_option_index: 1,
    solution_text: 'Let efficiency of A = 3 units/day, B = 2 units/day.\nCombined efficiency = 3 + 2 = 5 units/day.\nTotal Work = 5 × 12 = 60 units.\n\nNew efficiency:\nA = 50% of 3 = 1.5 units/day.\nB = 2 × 2 = 4 units/day.\nTotal new efficiency = 1.5 + 4 = 5.5 units/day.\nDays required = 60 / 5.5 = 120 / 11 = 10.91 days (10 10/11 days).',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pq_mix_02',
    topic: 'Mixed Arithmetic',
    difficulty: 'HARD',
    question_text: 'A merchant bought 80 kg of sugar at ₹30/kg. He sold 40% of the quantity at a profit of 10% and the remaining quantity at a profit of 20%. Find his overall profit percentage.',
    options: ['14%', '15%', '16%', '16.5%', '18%'],
    correct_option_index: 2,
    solution_text: 'Quantity ratio = 40% : 60% = 2 : 3.\nWeighted Average Profit % = (2 × 10% + 3 × 20%) / (2 + 3)\n= (20 + 60) / 5 = 80 / 5 = 16%.\n\nOverall profit percentage is 16%.',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pq_mix_03',
    topic: 'Mixed Arithmetic',
    difficulty: 'MEDIUM',
    question_text: 'A person invested ₹12,000 in two schemes: Scheme A at 10% p.a. Simple Interest and Scheme B at 20% p.a. Compound Interest (annually). If the investment in Scheme A was ₹7,000 for 2 years and Scheme B was for 2 years, find the total interest earned from both schemes.',
    options: ['₹3,400', '₹3,500', '₹3,600', '₹3,700', '₹3,800'],
    correct_option_index: 2,
    solution_text: 'Scheme A (SI):\nP = ₹7,000, R = 10%, T = 2 years.\nSI = (7000 × 10 × 2) / 100 = ₹1,400.\n\nScheme B (CI):\nRemaining amount = 12000 - 7000 = ₹5,000.\nR = 20%, T = 2 years.\nNet CI rate for 2 years at 20% = 20 + 20 + (20×20)/100 = 44%.\nCI = 44% of 5000 = ₹2,200.\n\nTotal interest earned = 1400 + 2200 = ₹3,600.',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

export function getTopicIcon(topic: string): string {
  const hit = DEFAULT_PRACTICE_TOPICS.find((t) => t.name.toLowerCase() === topic.toLowerCase());
  return hit?.icon || '📝';
}

export function normaliseTopic(raw: string): string {
  const clean = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  const hit = DEFAULT_PRACTICE_TOPICS.find((t) => t.name.toLowerCase() === clean.toLowerCase());
  return hit ? hit.name : clean;
}

export function normaliseDifficulty(raw: any): PracticeDifficulty {
  const v = String(raw || '').trim().toUpperCase();
  if (v.startsWith('E')) return 'EASY';
  if (v.startsWith('H')) return 'HARD';
  return 'MEDIUM';
}

export function parseCorrectOption(raw: any, optionCount = 5): number {
  const v = String(raw ?? '').trim().toUpperCase().replace(/^OPTION\s*/, '').replace(/[().\s]/g, '');
  if (!v) return -1;
  if (/^[A-E]$/.test(v)) {
    const idx = v.charCodeAt(0) - 65;
    return idx < optionCount ? idx : -1;
  }
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= optionCount) return n - 1;
  return -1;
}

export function parseOptions(raw: any): string[] {
  if (Array.isArray(raw)) return raw.map((o) => String(o));
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((o) => String(o)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function validatePracticeQuestion(q: Partial<NewPracticeQuestion>): string | null {
  if (!q.topic || !q.topic.trim()) return 'Topic is missing';
  if ((!q.question_text || !q.question_text.trim()) && !q.question_image_url) return 'Question text/image is missing';
  const opts = (q.options || []).filter((o) => String(o).trim() !== '');
  if (opts.length < 2) return 'At least 2 options are required';
  if (q.correct_option_index === undefined || q.correct_option_index < 0 || q.correct_option_index >= opts.length) {
    return 'Correct answer is missing or invalid';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Image storage helpers
// ---------------------------------------------------------------------------

export async function uploadPracticeImage(file: Blob, kind: 'question' | 'solution', fileName = 'image.png'): Promise<string> {
  const ext = (fileName.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `practice/${kind}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(PRACTICE_IMAGE_BUCKET).upload(path, file, {
    contentType: (file as File).type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    upsert: false,
  });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return supabase.storage.from(PRACTICE_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/data:(.*?);/)?.[1] || 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mime }), ext: mime.split('/')[1] || 'png' };
}

// ---------------------------------------------------------------------------
// Dual-Engine Fallback: `admin_settings` pool storage
// ---------------------------------------------------------------------------

let detectedMissingTable = false;

function isTableMissingError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : err.message || '';
  return /relation .* does not exist|could not find the .*table|schema cache/i.test(msg);
}

export function getLocalPracticePool(): PracticeQuestion[] {
  if (typeof window === 'undefined') return DEFAULT_PRACTICE_QUESTIONS;
  try {
    const raw = localStorage.getItem(PRACTICE_POOL_SETTINGS_KEY);
    if (!raw) {
      localStorage.setItem(PRACTICE_POOL_SETTINGS_KEY, JSON.stringify(DEFAULT_PRACTICE_QUESTIONS));
      return DEFAULT_PRACTICE_QUESTIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PRACTICE_QUESTIONS;
  } catch {
    return DEFAULT_PRACTICE_QUESTIONS;
  }
}

export async function syncPracticePoolFromCloud(): Promise<PracticeQuestion[]> {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', PRACTICE_POOL_SETTINGS_KEY)
      .maybeSingle();

    if (!error && data?.setting_value) {
      const parsed = JSON.parse(data.setting_value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(PRACTICE_POOL_SETTINGS_KEY, JSON.stringify(parsed));
          } catch {}
        }
        return parsed;
      }
    }
  } catch (e) {}

  const local = getLocalPracticePool();
  // Initialize to Supabase if not present yet
  await persistSettingToSupabase(PRACTICE_POOL_SETTINGS_KEY, JSON.stringify(local));
  return local;
}

export async function savePracticePoolToCloud(pool: PracticeQuestion[]): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PRACTICE_POOL_SETTINGS_KEY, JSON.stringify(pool));
    } catch {}
  }
  await persistSettingToSupabase(PRACTICE_POOL_SETTINGS_KEY, JSON.stringify(pool));
}

// ---------------------------------------------------------------------------
// Database API with automatic transparent fallback
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mapRow(r: any): PracticeQuestion {
  return {
    id: r.id,
    topic: r.topic,
    difficulty: normaliseDifficulty(r.difficulty),
    question_text: r.question_text || '',
    question_image_url: r.question_image_url || null,
    options: parseOptions(r.options),
    correct_option_index: Number(r.correct_option_index ?? 0),
    solution_text: r.solution_text || null,
    solution_image_url: r.solution_image_url || null,
    created_at: r.created_at,
  };
}

export async function insertPracticeQuestions(rows: NewPracticeQuestion[]): Promise<{ inserted: number; error?: string }> {
  if (rows.length === 0) return { inserted: 0 };

  // Try Table backend if not marked missing
  if (!detectedMissingTable) {
    try {
      const { error } = await supabase.from(PRACTICE_TABLE).insert(rows.slice(0, 200));
      if (!error) {
        let inserted = Math.min(rows.length, 200);
        for (let i = 200; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          await supabase.from(PRACTICE_TABLE).insert(chunk);
          inserted += chunk.length;
        }
        return { inserted };
      }
      if (isTableMissingError(error)) {
        detectedMissingTable = true;
      } else {
        return { inserted: 0, error: error.message };
      }
    } catch (e: any) {
      if (isTableMissingError(e)) detectedMissingTable = true;
    }
  }

  // Fallback Engine: Save directly to Cloud `admin_settings`
  const pool = await syncPracticePoolFromCloud();
  const newItems: PracticeQuestion[] = rows.map((r, i) => ({
    ...r,
    id: `pq_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
    created_at: new Date().toISOString(),
  }));
  const updated = [...newItems, ...pool];
  await savePracticePoolToCloud(updated);
  return { inserted: rows.length };
}

export async function updatePracticeQuestion(id: string, patch: Partial<NewPracticeQuestion>): Promise<string | null> {
  if (!detectedMissingTable) {
    try {
      const { error } = await supabase.from(PRACTICE_TABLE).update(patch).eq('id', id);
      if (!error) return null;
      if (isTableMissingError(error)) detectedMissingTable = true;
      else return error.message;
    } catch (e: any) {
      if (isTableMissingError(e)) detectedMissingTable = true;
    }
  }

  const pool = await syncPracticePoolFromCloud();
  const updated = pool.map((q) => (q.id === id ? { ...q, ...patch } : q));
  await savePracticePoolToCloud(updated);
  return null;
}

export async function deletePracticeQuestions(ids: string[]): Promise<string | null> {
  const idSet = new Set(ids);
  if (!detectedMissingTable) {
    try {
      const { error } = await supabase.from(PRACTICE_TABLE).delete().in('id', ids);
      if (!error) return null;
      if (isTableMissingError(error)) detectedMissingTable = true;
      else return error.message;
    } catch (e: any) {
      if (isTableMissingError(e)) detectedMissingTable = true;
    }
  }

  const pool = await syncPracticePoolFromCloud();
  const updated = pool.filter((q) => !idSet.has(q.id));
  await savePracticePoolToCloud(updated);
  return null;
}

export async function fetchPracticeQuestionsByTopic(topic: string): Promise<{ data: PracticeQuestion[]; error?: string }> {
  const isMixed = topic.trim().toLowerCase() === 'mixed arithmetic';
  if (!detectedMissingTable) {
    try {
      let query = supabase.from(PRACTICE_TABLE).select('*').order('created_at', { ascending: false });
      if (isMixed) {
        const arithNames = DEFAULT_PRACTICE_TOPICS.filter((t) => t.group === 'ARITHMETIC').map((t) => t.name);
        query = query.in('topic', arithNames);
      } else {
        query = query.eq('topic', topic);
      }
      const { data, error } = await query;

      if (!error && data) {
        return { data: data.map(mapRow) };
      }
      if (isTableMissingError(error)) {
        detectedMissingTable = true;
      }
    } catch (e: any) {
      if (isTableMissingError(e)) detectedMissingTable = true;
    }
  }

  // Fallback to Cloud settings pool
  const pool = await syncPracticePoolFromCloud();
  const cleanTopic = topic.trim().toLowerCase();
  if (isMixed) {
    const arithmeticSet = new Set(
      DEFAULT_PRACTICE_TOPICS.filter((t) => t.group === 'ARITHMETIC').map((t) => t.name.toLowerCase())
    );
    arithmeticSet.add('mixed arithmetic');
    const filtered = pool.filter((q) => arithmeticSet.has(q.topic.trim().toLowerCase()));
    return { data: filtered };
  }
  const filtered = pool.filter((q) => q.topic.trim().toLowerCase() === cleanTopic);
  return { data: filtered };
}

/** Returns { topic: count } for every topic present in the pool. */
export async function fetchTopicCounts(): Promise<{ counts: Record<string, number>; error?: string }> {
  const counts: Record<string, number> = {};

  if (!detectedMissingTable) {
    try {
      // 1. Try RPC if available
      const { data: rpcData, error: rpcError } = await supabase.rpc('practice_topic_counts');
      if (!rpcError && Array.isArray(rpcData)) {
        rpcData.forEach((r: any) => {
          counts[r.topic] = Number(r.total) || 0;
        });
      } else {
        // 2. Try table select
        const { data, error } = await supabase
          .from(PRACTICE_TABLE)
          .select('topic')
          .limit(5000);

        if (!error && data) {
          data.forEach((r: any) => {
            counts[r.topic] = (counts[r.topic] || 0) + 1;
          });
        } else if (isTableMissingError(error) || isTableMissingError(rpcError)) {
          detectedMissingTable = true;
        }
      }
    } catch (e: any) {
      if (isTableMissingError(e)) detectedMissingTable = true;
    }
  }

  if (detectedMissingTable || Object.keys(counts).length === 0) {
    // Fallback: Compute counts from Cloud settings pool
    const pool = await syncPracticePoolFromCloud();
    pool.forEach((q) => {
      const t = normaliseTopic(q.topic);
      counts[t] = (counts[t] || 0) + 1;
    });
  }

  // Aggregate Mixed Arithmetic total from all Arithmetic group topics
  const arithmeticTopicSet = new Set(
    DEFAULT_PRACTICE_TOPICS.filter((t) => t.group === 'ARITHMETIC' && t.name !== 'Mixed Arithmetic').map((t) =>
      t.name.toLowerCase()
    )
  );
  let totalArithmeticQs = 0;
  Object.entries(counts).forEach(([t, count]) => {
    if (arithmeticTopicSet.has(t.toLowerCase()) || t.toLowerCase() === 'mixed arithmetic') {
      totalArithmeticQs += count;
    }
  });
  counts['Mixed Arithmetic'] = Math.max(counts['Mixed Arithmetic'] || 0, totalArithmeticQs);

  return { counts };
}

/** Picks `size` random questions from a topic (optionally filtered by difficulty). */
export async function fetchRandomPracticeSet(
  topic: string,
  size = PRACTICE_SESSION_SIZE,
  difficulty: PracticeDifficulty | 'ALL' = 'ALL'
): Promise<{ data: PracticeQuestion[]; error?: string }> {
  const isMixedArithmetic = topic.trim().toLowerCase() === 'mixed arithmetic';

  if (!detectedMissingTable) {
    try {
      let idQuery = supabase.from(PRACTICE_TABLE).select('id');
      if (isMixedArithmetic) {
        const arithList = DEFAULT_PRACTICE_TOPICS.filter((t) => t.group === 'ARITHMETIC').map((t) => t.name);
        idQuery = idQuery.in('topic', arithList);
      } else {
        idQuery = idQuery.eq('topic', topic);
      }

      if (difficulty !== 'ALL') idQuery = idQuery.eq('difficulty', difficulty);
      const { data: idRows, error: idErr } = await idQuery.limit(5000);

      if (!idErr && idRows && idRows.length > 0) {
        const pickedIds = shuffle(idRows.map((r: any) => r.id as string)).slice(0, size);
        const { data, error } = await supabase.from(PRACTICE_TABLE).select('*').in('id', pickedIds);
        if (!error && data) {
          const byId = new Map(data.map((r: any) => [r.id, mapRow(r)]));
          return { data: pickedIds.map((id) => byId.get(id)).filter(Boolean) as PracticeQuestion[] };
        }
      }

      if (isTableMissingError(idErr)) {
        detectedMissingTable = true;
      }
    } catch (e: any) {
      if (isTableMissingError(e)) detectedMissingTable = true;
    }
  }

  // Fallback: Pick from Cloud settings pool
  const pool = await syncPracticePoolFromCloud();
  const cleanTopic = topic.trim().toLowerCase();
  let candidateQuestions: PracticeQuestion[] = [];

  if (isMixedArithmetic) {
    const arithmeticSet = new Set(
      DEFAULT_PRACTICE_TOPICS.filter((t) => t.group === 'ARITHMETIC').map((t) => t.name.toLowerCase())
    );
    arithmeticSet.add('mixed arithmetic');
    candidateQuestions = pool.filter((q) => arithmeticSet.has(q.topic.trim().toLowerCase()));
  } else {
    candidateQuestions = pool.filter((q) => q.topic.trim().toLowerCase() === cleanTopic);
  }

  if (difficulty !== 'ALL') {
    const diffCandidates = candidateQuestions.filter((q) => q.difficulty === difficulty);
    if (diffCandidates.length >= Math.min(size, 4)) {
      candidateQuestions = diffCandidates;
    }
  }

  if (candidateQuestions.length === 0) {
    candidateQuestions = isMixedArithmetic
      ? pool
      : pool.filter((q) => q.topic.trim().toLowerCase() === cleanTopic);
  }

  if (isMixedArithmetic && candidateQuestions.length > size) {
    // Stratified sampling across chapters for optimal diverse coverage
    const byTopic: Record<string, PracticeQuestion[]> = {};
    candidateQuestions.forEach((q) => {
      const k = q.topic.trim();
      if (!byTopic[k]) byTopic[k] = [];
      byTopic[k].push(q);
    });
    Object.keys(byTopic).forEach((k) => {
      byTopic[k] = shuffle(byTopic[k]);
    });

    const picked: PracticeQuestion[] = [];
    const tKeys = shuffle(Object.keys(byTopic));
    let loopCount = 0;
    while (picked.length < size && loopCount < 30) {
      let added = false;
      for (const k of tKeys) {
        if (picked.length >= size) break;
        const q = byTopic[k].pop();
        if (q) {
          picked.push(q);
          added = true;
        }
      }
      if (!added) break;
      loopCount++;
    }
    return { data: shuffle(picked) };
  }

  const picked = shuffle(candidateQuestions).slice(0, size);
  return { data: picked };
}

// ---------------------------------------------------------------------------
// Student history (local, per device)
// ---------------------------------------------------------------------------

export interface PracticeHistoryEntry {
  topic: string;
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
  timeTakenSec: number;
  at: string;
}

const HISTORY_KEY = 'bs_practice_history_v1';

export function getPracticeHistory(): PracticeHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function savePracticeHistory(entry: PracticeHistoryEntry) {
  if (typeof window === 'undefined') return;
  const list = [entry, ...getPracticeHistory()].slice(0, 100);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {}
}

// ---------------------------------------------------------------------------
// Word (.docx) parsing
// ---------------------------------------------------------------------------

export interface ParsedDocQuestion {
  topic: string;
  difficulty: PracticeDifficulty;
  question_text: string;
  options: string[];
  correct_option_index: number;
  solution_text: string;
  questionImageData?: string;
  solutionImageData?: string;
  error?: string | null;
}

export function parseDocQuestionLines(lines: string[], images: string[], defaultTopic: string): ParsedDocQuestion[] {
  const result: ParsedDocQuestion[] = [];
  let currentTopic = normaliseTopic(defaultTopic);
  let cur: ParsedDocQuestion | null = null;
  let section: 'question' | 'options' | 'solution' = 'question';

  const imgRe = /^\[\[IMG:(\d+)\]\]$/;
  const qStartRe = /^(?:Q(?:ues(?:tion)?)?\.?\s*\d+|\d+)\s*[.):-]\s*(.*)$/i;
  const optRe = /^\(?([A-Ea-e])[).:]\s*(.+)$/;
  const inlineOptsRe = /\(?([A-Ea-e])[).]\s*/g;

  const finish = () => {
    if (!cur) return;
    cur.options = cur.options.map((o) => o.trim()).filter(Boolean);
    cur.question_text = cur.question_text.trim();
    cur.solution_text = cur.solution_text.trim();
    cur.topic = cur.topic || currentTopic;
    cur.error = validatePracticeQuestion({
      topic: cur.topic,
      question_text: cur.question_text,
      question_image_url: cur.questionImageData,
      options: cur.options,
      correct_option_index: cur.correct_option_index,
    });
    result.push(cur);
    cur = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\u00a0/g, ' ').trim();
    if (!line) continue;

    const topicMatch = line.match(/^(?:topic|chapter)\s*[:\-]\s*(.+)$/i);
    if (topicMatch) {
      const t = normaliseTopic(topicMatch[1]);
      if (cur && section === 'question' && !cur.question_text) cur.topic = t;
      else currentTopic = t;
      continue;
    }

    const qMatch = line.match(qStartRe);
    const isExplicitQ = /^Q/i.test(line);
    const canStartNew = !cur || (section === 'solution' ? isExplicitQ : section !== 'question' || cur.options.length > 0);
    if (qMatch && canStartNew) {
      finish();
      cur = {
        topic: currentTopic,
        difficulty: 'MEDIUM',
        question_text: qMatch[1] || '',
        options: [],
        correct_option_index: -1,
        solution_text: '',
      };
      section = 'question';
      continue;
    }

    if (!cur) continue;

    const img = line.match(imgRe);
    if (img) {
      const data = images[Number(img[1])];
      if (data) {
        if (section === 'solution') cur.solutionImageData = cur.solutionImageData || data;
        else cur.questionImageData = cur.questionImageData || data;
      }
      continue;
    }

    const ansMatch = line.match(/^(?:ans(?:wer)?|correct(?:\s*answer)?|key)\s*[:\-.]\s*(.+)$/i);
    if (ansMatch) {
      cur.correct_option_index = parseCorrectOption(ansMatch[1].split(/\s/)[0], 5);
      section = 'options';
      continue;
    }

    const diffMatch = line.match(/^(?:difficulty|level)\s*[:\-]\s*(.+)$/i);
    if (diffMatch) {
      cur.difficulty = normaliseDifficulty(diffMatch[1]);
      continue;
    }

    const solMatch = line.match(/^(?:sol(?:ution)?|explanation|exp)\s*[:\-.]\s*(.*)$/i);
    if (solMatch) {
      section = 'solution';
      cur.solution_text += solMatch[1] ? `${solMatch[1]}\n` : '';
      continue;
    }

    if (section === 'solution') {
      cur.solution_text += `${line}\n`;
      continue;
    }

    const inlineCount = (line.match(inlineOptsRe) || []).length;
    if (/^\(?[A-Ea-e][).]/.test(line) && inlineCount >= 2) {
      const parts = line.split(/\s*\(?[A-Ea-e][).]\s*/).filter((p) => p.trim() !== '');
      cur.options.push(...parts);
      section = 'options';
      continue;
    }

    const optMatch = line.match(optRe);
    if (optMatch) {
      cur.options.push(optMatch[2]);
      section = 'options';
      continue;
    }

    if (section === 'question') {
      cur.question_text += (cur.question_text ? '\n' : '') + line;
    } else if (section === 'options' && cur.options.length > 0 && cur.correct_option_index === -1) {
      cur.options[cur.options.length - 1] += ` ${line}`;
    }
  }
  finish();
  return result;
}
