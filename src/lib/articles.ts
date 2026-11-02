import { persistSettingToSupabase } from './monetization';
import { supabase } from './supabase';

export type ArticleCategory =
  | 'NOTIFICATION'
  | 'EXAM_DATE'
  | 'EXPECTED_CUTOFF'
  | 'SYLLABUS_PATTERN'
  | 'RESULT'
  | 'EXAM_ANALYSIS'
  | 'SALARY_JOB_PROFILE';

export interface ArticleHighlight {
  label: string;
  value: string;
}

export interface ArticleFaq {
  question: string;
  answer: string;
}

export interface SeoExamArticle {
  id: string;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  category: ArticleCategory;
  examTag: string;
  summary: string;
  quickHighlights: ArticleHighlight[];
  markdownContent: string;
  faqs: ArticleFaq[];
  officialLink?: string;
  imageUrl?: string;
  authorName: string;
  publishedAt: string;
  updatedAt: string;
  isPublished: boolean;
}

export const SEO_ARTICLES_KEY = 'bs_seo_exam_articles_v1';

export function slugifyArticleTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `exam-article-${Date.now()}`
  );
}

export const generateArticleSlug = slugifyArticleTitle;

export const DEFAULT_SEO_ARTICLES: SeoExamArticle[] = [
  {
    id: 'seo_sbi_po_2026',
    slug: 'sbi-po-2026-notification-exam-date-expected-cutoff-syllabus',
    title: 'SBI PO 2026 Notification, Exam Date, Vacancy, Syllabus & Expected Cut-Off',
    metaTitle:
      'SBI PO 2026 Notification, Exam Date, Expected Cut-Off & Syllabus | BankingSolutions',
    metaDescription:
      'Complete guide to SBI PO 2026 Notification: check Prelims & Mains exam dates, category-wise vacancies, revised exam pattern, previous year cut-off trends, and preparation strategy.',
    keywords:
      'SBI PO 2026 notification, SBI PO 2026 exam date, SBI PO expected cutoff 2026, SBI PO syllabus 2026, SBI PO vacancy 2026, SBI PO prelims cutoff',
    category: 'NOTIFICATION',
    examTag: 'SBI PO 2026',
    summary:
      'Everything banking aspirants need to know about the upcoming State Bank of India Probationary Officer (SBI PO) 2026 recruitment: important dates, selection process, sectional timing, and safe attempts.',
    quickHighlights: [
      { label: 'Conducting Body', value: 'State Bank of India (SBI)' },
      { label: 'Post Name', value: 'Probationary Officer (PO)' },
      { label: 'Selection Process', value: 'Prelims + Mains + Psychometric Test & Interview' },
      { label: 'Prelims Exam Mode', value: 'Online CBT (100 Marks, 60 Minutes)' },
      { label: 'Negative Marking', value: '1/4th (0.25 Marks per wrong answer)' },
      { label: 'Official Website', value: 'sbi.co.in/web/careers' },
    ],
    markdownContent: `## 📢 SBI PO 2026 Recruitment Overview

The **State Bank of India Probationary Officer (SBI PO)** exam is the most prestigious recruitment examination in the Indian banking sector. Candidates aiming for SBI PO 2026 should begin their integrated Prelims + Mains preparation early, with special emphasis on **Data Interpretation, Puzzle Seating Arrangements, Critical Reasoning, and General/Banking Awareness**.

---

## 📋 SBI PO Prelims Exam Pattern 2026

Note that in SBI PO Prelims, there is **no sectional cut-off**—only an overall cut-off is applied to shortlist candidates (approx. 10x the number of vacancies) for the Mains examination.

| Section Name | No. of Questions | Maximum Marks | Sectional Duration |
| :--- | :---: | :---: | :---: |
| **English Language** | 30 | 30 | 20 Minutes |
| **Quantitative Aptitude** | 35 | 35 | 20 Minutes |
| **Reasoning Ability** | 35 | 35 | 20 Minutes |
| **Total** | **100 Questions** | **100 Marks** | **60 Minutes** |

---

## 🎯 SBI PO Expected & Previous Year Prelims Cut-Off Trends (Out of 100)

Based on recent difficulty levels and vacancy trends, here is the category-wise cut-off benchmark:

| Category | Previous Trend (Out of 100) | 2026 Safe Target Score |
| :--- | :---: | :---: |
| **General (UR)** | 59.25 – 63.00 | **65+ Marks** |
| **EWS** | 59.25 – 61.50 | **63+ Marks** |
| **OBC** | 58.50 – 61.25 | **62+ Marks** |
| **SC** | 53.00 – 55.50 | **57+ Marks** |
| **ST** | 47.50 – 50.00 | **52+ Marks** |

---

## 🚀 How to Prepare for SBI PO 2026 on BankingSolutions

1. **Daily 30-Day Guided Targets**: Follow our structured Beginner & Repeater track checklists on the **Daily Targets** portal.
2. **Real CBT Interface Mock Tests**: Practice full-length and sectional tests with Time-Trap Detection.
3. **Critical Reasoning & Current Affairs (BSCA)**: Master the game-changing Mains sections using our bilingual study modules.`,
    faqs: [
      {
        question: 'Is there any sectional cut-off in SBI PO Prelims 2026?',
        answer:
          'No, SBI PO Prelims does not have sectional cut-offs. Candidates only need to clear the overall category-wise cut-off to qualify for SBI PO Mains.',
      },
      {
        question: 'What is the age limit for SBI PO 2026?',
        answer:
          'The candidate must be between 21 and 30 years of age for the General category, with age relaxation applicable for OBC (3 years) and SC/ST (5 years) candidates.',
      },
      {
        question: 'How many attempts are allowed for SBI PO?',
        answer:
          'General/EWS candidates have 4 attempts, General(PwBD)/OBC candidates have 7 attempts, while SC/ST candidates have no restriction on the number of attempts (within the age limit).',
      },
    ],
    officialLink: 'https://sbi.co.in/web/careers',
    authorName: 'Abhijeet Sir (BankingSolutions)',
    publishedAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    isPublished: true,
  },
  {
    id: 'seo_ibps_rrb_2026',
    slug: 'ibps-rrb-po-clerk-2026-notification-exam-date-expected-cutoff',
    title: 'IBPS RRB PO & Clerk 2026 Notification, Exam Dates, Pattern & Expected Cut-Off',
    metaTitle:
      'IBPS RRB PO & Clerk 2026 Notification, Exam Date & Cut-Off | BankingSolutions',
    metaDescription:
      'Check IBPS RRB 2026 Notification details for Officer Scale-I (PO) and Office Assistant (Clerk): composite 45-minute Prelims strategy, Computer Awareness weightage, and state-wise cut-offs.',
    keywords:
      'IBPS RRB 2026 notification, RRB PO 2026 exam date, RRB Clerk expected cutoff, IBPS RRB syllabus 2026, Regional Rural Bank recruitment 2026',
    category: 'EXPECTED_CUTOFF',
    examTag: 'IBPS RRB 2026',
    summary:
      'Complete breakdown of IBPS RRB CRP XV (2026) for Officer Scale-I and Office Assistant: Prelims 80-Marks 45-Minute composite timer strategy, Mains Computer Knowledge weightage, and safe attempts.',
    quickHighlights: [
      { label: 'Exam Name', value: 'IBPS RRB CRP (Officer Scale-I & Office Assistant)' },
      { label: 'Prelims Pattern', value: '80 Questions (40 Reasoning + 40 Quant) in 45 Mins' },
      { label: 'Language Medium', value: 'English, Hindi + Regional Languages' },
      { label: 'Mains Special Section', value: 'Computer Knowledge (40 Qs = 20 Marks)' },
      { label: 'Interview Phase', value: 'Applicable for RRB PO (No Interview for RRB Clerk)' },
      { label: 'Official Website', value: 'ibps.in' },
    ],
    markdownContent: `## 🌾 IBPS RRB PO & Clerk 2026 Exam Overview

The **IBPS Regional Rural Banks (RRB)** recruitment is one of the best opportunities for banking aspirants because the **Prelims exam consists only of Reasoning and Quantitative Aptitude (80 Marks in 45 Minutes)** without an English section in Prelims, and candidates can choose between **English or Hindi** in the Mains exam!

---

## ⏱️ IBPS RRB Prelims Pattern (PO & Clerk)

| Section Name | No. of Questions | Maximum Marks | Duration |
| :--- | :---: | :---: | :---: |
| **Reasoning Ability** | 40 | 40 | 25 Minutes (PO) |
| **Quantitative Aptitude / Numerical Ability** | 40 | 40 | 20 Minutes (PO) |
| **Total** | **80 Questions** | **80 Marks** | **45 Minutes** |

---

## 💻 Why Computer Awareness & Hindi/English Are Decisive in RRB Mains

In IBPS RRB Mains:
- **Computer Knowledge** carries **40 Questions (20 Marks)**—using our **Complete Computer Awareness Course** can help you score 17+ out of 20 Marks in under 10 minutes.
- Candidates can opt for either **English Language** or **Hindi Language (40 Questions, 40 Marks)**.`,
    faqs: [
      {
        question: 'Is there an English section in IBPS RRB PO and Clerk Prelims?',
        answer:
          'No, IBPS RRB Prelims only tests Reasoning Ability (40 questions) and Quantitative Aptitude (40 questions) for a total of 80 marks in 45 minutes.',
      },
      {
        question: 'Can I choose Hindi instead of English in IBPS RRB Mains?',
        answer:
          'Yes! In IBPS RRB PO and Clerk Mains, candidates have the choice to attempt either Section 4A (English Language) or Section 4B (Hindi Language).',
      },
    ],
    officialLink: 'https://www.ibps.in',
    authorName: 'Abhijeet Sir (BankingSolutions)',
    publishedAt: '2026-02-05T00:00:00.000Z',
    updatedAt: '2026-02-05T00:00:00.000Z',
    isPublished: true,
  },
];

export function getLocalSeoArticles(): SeoExamArticle[] {
  if (typeof window === 'undefined') return DEFAULT_SEO_ARTICLES;
  try {
    const raw = localStorage.getItem(SEO_ARTICLES_KEY);
    if (!raw) {
      localStorage.setItem(SEO_ARTICLES_KEY, JSON.stringify(DEFAULT_SEO_ARTICLES));
      return DEFAULT_SEO_ARTICLES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SEO_ARTICLES;
  } catch (e) {
    return DEFAULT_SEO_ARTICLES;
  }
}

export async function syncSeoArticlesFromSupabase(): Promise<SeoExamArticle[]> {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', SEO_ARTICLES_KEY)
      .maybeSingle();

    if (!error && data?.setting_value) {
      const parsed = JSON.parse(data.setting_value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(SEO_ARTICLES_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  } catch (e) {}
  return getLocalSeoArticles();
}

export async function saveSeoArticles(
  articles: SeoExamArticle[]
): Promise<SeoExamArticle[]> {
  const serialized = JSON.stringify(articles);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SEO_ARTICLES_KEY, serialized);
    } catch (e) {}
  }
  await persistSettingToSupabase(SEO_ARTICLES_KEY, serialized);
  return articles;
}

export async function upsertSeoArticle(
  input: Omit<SeoExamArticle, 'id' | 'slug' | 'publishedAt' | 'updatedAt'> & {
    id?: string;
    slug?: string;
    publishedAt?: string;
  }
): Promise<SeoExamArticle[]> {
  const current = await syncSeoArticlesFromSupabase();
  const id = input.id || `seo_${Date.now()}`;
  const slug = input.slug?.trim()
    ? slugifyArticleTitle(input.slug)
    : slugifyArticleTitle(input.title);
  const existingIdx = current.findIndex((a) => a.id === id);
  const now = new Date().toISOString();

  const normalized: SeoExamArticle = {
    ...input,
    id,
    slug,
    publishedAt:
      input.publishedAt ||
      (existingIdx >= 0 ? current[existingIdx].publishedAt : now),
    updatedAt: now,
  };

  let next: SeoExamArticle[];
  if (existingIdx >= 0) {
    next = [...current];
    next[existingIdx] = normalized;
  } else {
    next = [normalized, ...current];
  }

  return saveSeoArticles(next);
}

export async function deleteSeoArticle(id: string): Promise<SeoExamArticle[]> {
  const current = await syncSeoArticlesFromSupabase();
  const next = current.filter((a) => a.id !== id);
  return saveSeoArticles(next);
}

export async function toggleSeoArticlePublished(
  id: string
): Promise<SeoExamArticle[]> {
  const current = await syncSeoArticlesFromSupabase();
  const next = current.map((a) =>
    a.id === id ? { ...a, isPublished: !a.isPublished } : a
  );
  return saveSeoArticles(next);
}

// ============================================================================
// SERVER-SAFE FETCHERS (Uses native HTTP fetch for Next.js SSR, generateMetadata & Sitemap)
// ============================================================================
export async function fetchAllArticlesServerSide(): Promise<SeoExamArticle[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let seoArticles: SeoExamArticle[] = [...DEFAULT_SEO_ARTICLES];

  if (!supabaseUrl || !supabaseKey) {
    return seoArticles;
  }

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  };

  // 1. Fetch Admin-configured SEO Exam Articles from admin_settings
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/admin_settings?setting_key=eq.${SEO_ARTICLES_KEY}&select=setting_value`,
      { headers, cache: 'no-store' }
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows[0]?.setting_value) {
        const parsed = JSON.parse(rows[0].setting_value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          seoArticles = parsed;
        }
      }
    }
  } catch (e) {}

  // 2. Also convert any Notification / Cut-Off / Result / Analysis posts from updates_feed into SEO articles!
  try {
    const feedRes = await fetch(
      `${supabaseUrl}/rest/v1/updates_feed?select=*&order=created_at.desc&limit=50`,
      { headers, cache: 'no-store' }
    );
    if (feedRes.ok) {
      const feedRows = await feedRes.json();
      if (Array.isArray(feedRows)) {
        const existingSlugs = new Set(seoArticles.map((a) => a.slug));
        for (const post of feedRows) {
          if (!post.title) continue;
          const postSlug = `${slugifyArticleTitle(post.title)}-${String(post.id).slice(0, 6)}`;
          if (existingSlugs.has(postSlug)) continue;

          const plainSummary = String(post.content || '')
            .replace(/[#*|•\-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 160);

          seoArticles.push({
            id: `feed_${post.id}`,
            slug: postSlug,
            title: post.title,
            metaTitle: `${post.title} (${post.exam_tag || 'Banking Exam Update'}) | BankingSolutions`,
            metaDescription:
              plainSummary ||
              `Latest ${post.exam_tag || 'Banking Exam'} update, notification, and cut-off details on BankingSolutions.`,
            keywords: `${post.exam_tag || 'Banking Exam'}, ${post.title}, IBPS, SBI, BankingSolutions`,
            category:
              post.category === 'EXPECTED_CUTOFF'
                ? 'EXPECTED_CUTOFF'
                : post.category === 'RESULT'
                ? 'RESULT'
                : post.category === 'EXAM_ANALYSIS'
                ? 'EXAM_ANALYSIS'
                : 'NOTIFICATION',
            examTag: post.exam_tag || 'Banking Exam',
            summary: plainSummary,
            quickHighlights: [
              { label: 'Exam / Category', value: post.exam_tag || 'Banking Exam' },
              { label: 'Update Type', value: post.category || 'Official Update' },
              {
                label: 'Published Date',
                value: post.post_date || new Date(post.created_at).toLocaleDateString('en-IN'),
              },
            ],
            markdownContent: post.content || '',
            faqs: [],
            officialLink: post.external_link || undefined,
            imageUrl: post.image_url || undefined,
            authorName: 'BankingSolutions Editorial Team',
            publishedAt: post.created_at || new Date().toISOString(),
            updatedAt: post.created_at || new Date().toISOString(),
            isPublished: true,
          });
        }
      }
    }
  } catch (e) {}

  return seoArticles.filter((a) => a.isPublished);
}

export async function fetchArticleBySlugServerSide(
  slug: string
): Promise<SeoExamArticle | null> {
  const all = await fetchAllArticlesServerSide();
  return all.find((a) => a.slug === slug || a.id === slug) || null;
}

