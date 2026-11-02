import { ProPassPlan, persistSettingToSupabase } from './monetization';
import { supabase } from './supabase';

export type CourseCategory =
  | 'QUANT'
  | 'REASONING'
  | 'ENGLISH'
  | 'GA_BANKING'
  | 'COMPUTER'
  | 'DESCRIPTIVE'
  | 'COMBO';

export interface DynamicCourseChapter {
  id: string;
  chapterNumber: number;
  title: string;
  subtitle?: string;
  markdownContent: string;
  hinglishContent?: string;
  videoUrl?: string;
  pdfUrl?: string;
  isFreePreview: boolean;
}

export interface DynamicCourse {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: CourseCategory;
  icon: string;
  badge: string;
  isFree: boolean;
  includedInProPass: boolean;
  isPublished: boolean;
  plans: ProPassPlan[];
  chapters: DynamicCourseChapter[];
  createdAt: string;
}

const DYNAMIC_COURSES_KEY = 'bs_dynamic_courses_v1';

export const DEFAULT_COURSE_PLANS: ProPassPlan[] = [
  {
    id: 'cplan_1m',
    title: '1 Month Access',
    durationMonths: 1,
    originalPrice: 299,
    launchPrice: 149,
    badge: '1 MONTH',
    isPopular: false,
    isActive: true,
  },
  {
    id: 'cplan_3m',
    title: '3 Months Access',
    durationMonths: 3,
    originalPrice: 499,
    launchPrice: 249,
    badge: '3 MONTHS',
    isPopular: false,
    isActive: true,
  },
  {
    id: 'cplan_6m',
    title: '6 Months Access',
    durationMonths: 6,
    originalPrice: 799,
    launchPrice: 349,
    badge: 'MOST POPULAR',
    isPopular: true,
    isActive: true,
  },
  {
    id: 'cplan_12m',
    title: '12 Months Access',
    durationMonths: 12,
    originalPrice: 1199,
    launchPrice: 499,
    badge: 'BEST VALUE',
    isPopular: false,
    isActive: true,
  },
];

export const DEFAULT_DYNAMIC_COURSES: DynamicCourse[] = [
  {
    id: 'course_banking_awareness_free',
    slug: 'banking-financial-awareness-foundation',
    title: 'Banking & Financial Awareness Foundation (2026)',
    subtitle: 'Free Complete Static Banking + RBI Monetary Policy Notes',
    description:
      'Master RBI Monetary Policy, Basel III Norms, NPAs, Priority Sector Lending (PSL), Digital Rupee & Capital Markets with crisp exam-oriented notes and PDF capsules.',
    category: 'GA_BANKING',
    icon: '🏦',
    badge: '100% FREE COURSE',
    isFree: true,
    includedInProPass: true,
    isPublished: true,
    plans: DEFAULT_COURSE_PLANS,
    createdAt: '2026-01-15T00:00:00.000Z',
    chapters: [
      {
        id: 'ch_ba_1',
        chapterNumber: 1,
        title: 'RBI Monetary Policy & Key Policy Rates',
        subtitle: 'Repo, SDF, MSF, CRR, SLR & MPC Structure',
        isFreePreview: true,
        markdownContent: `## 🏦 Reserve Bank of India (RBI) & Monetary Policy Committee (MPC)

### 1. Monetary Policy Committee (Section 45ZB of RBI Act, 1934)
- **Total Members**: **6 Members** (3 from RBI + 3 nominated by the Central Government).
- **Chairperson**: Governor of RBI (*Ex-Officio*).
- **Quorum**: Minimum **4 members** required for a meeting.
- **Inflation Target**: **4% CPI** with a tolerance band of **±2%** (2% to 6%).

---

### 2. Policy Rates Quick Revision Table
| Instrument | Key Concept | Impact of Increase |
| :--- | :--- | :--- |
| **Repo Rate** | Short-term lending rate by RBI to commercial banks against government securities | Absorbs liquidity (curbs inflation) |
| **Standing Deposit Facility (SDF)** | Collateral-free liquidity absorption window (Floor of LAF corridor) | Banks park excess funds with RBI |
| **Marginal Standing Facility (MSF)** | Emergency overnight borrowing window where banks can dip into SLR up to 2% | Penal rate (Ceiling of LAF corridor) |
| **Cash Reserve Ratio (CRR)** | % of NDTL kept as cash with RBI (No interest paid by RBI) | Direct liquidity drain |
| **Statutory Liquidity Ratio (SLR)** | % of NDTL kept in liquid assets (Cash, Gold, Approved G-Secs) with bank itself | Max ceiling: 40% of NDTL |

### 💡 High-Yield Exam Trap
- **SDF** was introduced in **April 2022** by amending **Section 17** of the RBI Act, 1934, and does **not** require RBI to provide collateral securities.`,
        hinglishContent: `## 🏦 RBI Monetary Policy & MPC (Hinglish Summary)

### 1. Monetary Policy Committee (MPC) Kya Hai?
- **Section 45ZB (RBI Act, 1934)** ke under MPC banayi gayi hai.
- Ismein **total 6 members** hote hain (3 RBI se + 3 Govt of India nominate karti hai).
- **Target Inflation**: **4% (±2%)** yaani 2% se 6% ke beech Consumer Price Index (CPI) rakhna hota hai.

---

### 2. Important Rates Shortcut:
- **Repo Rate**: Jis rate par RBI banks ko short-term loan deta hai (Government securities rakh kar).
- **SDF (Standing Deposit Facility)**: Bina kisi collateral ke RBI jab banks se extra paisa absorb karta hai. Yeh LAF corridor ka **Floor** hota hai.
- **MSF (Marginal Standing Facility)**: Jab banks ko overnight emergency paisa chahiye hota hai (SLR quota use karke). Yeh LAF corridor ka **Ceiling** hota hai.`,
      },
      {
        id: 'ch_ba_2',
        chapterNumber: 2,
        title: 'Priority Sector Lending (PSL) & Revised Targets',
        subtitle: 'Targets for Domestic Banks, RRBs & Small Finance Banks',
        isFreePreview: true,
        markdownContent: `## 🎯 Priority Sector Lending (PSL) Guidelines

### 1. Overall PSL Targets (% of ANBC or CEOBE, whichever is higher)
- **Domestic Commercial Banks & Foreign Banks (20+ branches)**: **40%**
- **Regional Rural Banks (RRBs)**: **75%**
- **Small Finance Banks (SFBs)**: **75%**
- **Primary Urban Co-operative Banks (UCBs)**: Phased target up to **75%**

---

### 2. Sub-Targets Under PSL
1. **Agriculture**: **18%** of ANBC (Out of which **10%** is mandated for *Small & Marginal Farmers - SMFs*).
2. **Micro Enterprises**: **7.5%** of ANBC.
3. **Advances to Weaker Sections**: **12%** of ANBC (For RRBs, Weaker Sections target is **15%**).`,
        hinglishContent: `## 🎯 Priority Sector Lending (PSL) — Exam Pointers

- **Commercial Banks** ke liye PSL target **40% of ANBC** hota hai.
- **RRBs (Regional Rural Banks)** aur **Small Finance Banks (SFBs)** ke liye PSL target **75% of ANBC** hota hai!
- **Agriculture** sub-target: **18%** (jismein **10%** Small & Marginal Farmers ke liye reserve hota hai, jinke paas 2 hectare tak land hoti hai).`,
      },
    ],
  },
];

export function slugifyCourseTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `course-${Date.now()}`
  );
}

export function getDynamicCourses(): DynamicCourse[] {
  if (typeof window === 'undefined') return DEFAULT_DYNAMIC_COURSES;
  try {
    const raw = localStorage.getItem(DYNAMIC_COURSES_KEY);
    if (!raw) {
      localStorage.setItem(
        DYNAMIC_COURSES_KEY,
        JSON.stringify(DEFAULT_DYNAMIC_COURSES)
      );
      return DEFAULT_DYNAMIC_COURSES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_DYNAMIC_COURSES;
  } catch (e) {
    return DEFAULT_DYNAMIC_COURSES;
  }
}

export async function syncDynamicCoursesFromSupabase(): Promise<DynamicCourse[]> {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', DYNAMIC_COURSES_KEY)
      .maybeSingle();

    if (!error && data?.setting_value) {
      const parsed = JSON.parse(data.setting_value);
      if (Array.isArray(parsed)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(DYNAMIC_COURSES_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  } catch (e) {
    // Fallback to localStorage if admin_settings row doesn't exist yet
  }
  return getDynamicCourses();
}

export async function saveDynamicCourses(
  courses: DynamicCourse[]
): Promise<DynamicCourse[]> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(DYNAMIC_COURSES_KEY, JSON.stringify(courses));
    } catch (e) {
      console.error('Failed to save dynamic courses to localStorage:', e);
    }
  }

  // Sync to Supabase admin_settings so all students see new courses
  await persistSettingToSupabase(DYNAMIC_COURSES_KEY, JSON.stringify(courses));

  return courses;
}

export async function upsertDynamicCourse(
  courseInput: Omit<DynamicCourse, 'id' | 'slug' | 'createdAt'> & {
    id?: string;
    slug?: string;
    createdAt?: string;
  }
): Promise<DynamicCourse[]> {
  const current = getDynamicCourses();
  const id = courseInput.id || `course_${Date.now()}`;
  const slug =
    courseInput.slug?.trim() || slugifyCourseTitle(courseInput.title);
  const existingIdx = current.findIndex((c) => c.id === id);

  const normalized: DynamicCourse = {
    ...courseInput,
    id,
    slug,
    createdAt:
      courseInput.createdAt ||
      (existingIdx >= 0 ? current[existingIdx].createdAt : new Date().toISOString()),
  };

  let next: DynamicCourse[];
  if (existingIdx >= 0) {
    next = [...current];
    next[existingIdx] = normalized;
  } else {
    next = [normalized, ...current];
  }

  return saveDynamicCourses(next);
}

export async function deleteDynamicCourse(id: string): Promise<DynamicCourse[]> {
  const next = getDynamicCourses().filter((c) => c.id !== id);
  return saveDynamicCourses(next);
}

export async function toggleDynamicCoursePublished(
  id: string
): Promise<DynamicCourse[]> {
  const next = getDynamicCourses().map((c) =>
    c.id === id ? { ...c, isPublished: !c.isPublished } : c
  );
  return saveDynamicCourses(next);
}

export async function upsertCourseChapter(
  courseId: string,
  chapterInput: Omit<DynamicCourseChapter, 'id'> & { id?: string }
): Promise<DynamicCourse[]> {
  const current = getDynamicCourses();
  const next = current.map((course) => {
    if (course.id !== courseId) return course;

    const chId = chapterInput.id || `ch_${Date.now()}`;
    const existingIdx = course.chapters.findIndex((ch) => ch.id === chId);
    const normalizedCh: DynamicCourseChapter = {
      ...chapterInput,
      id: chId,
    };

    let updatedChapters: DynamicCourseChapter[];
    if (existingIdx >= 0) {
      updatedChapters = [...course.chapters];
      updatedChapters[existingIdx] = normalizedCh;
    } else {
      updatedChapters = [...course.chapters, normalizedCh].sort(
        (a, b) => a.chapterNumber - b.chapterNumber
      );
    }

    return {
      ...course,
      chapters: updatedChapters,
    };
  });

  return saveDynamicCourses(next);
}

export async function deleteCourseChapter(
  courseId: string,
  chapterId: string
): Promise<DynamicCourse[]> {
  const current = getDynamicCourses();
  const next = current.map((course) => {
    if (course.id !== courseId) return course;
    return {
      ...course,
      chapters: course.chapters.filter((ch) => ch.id !== chapterId),
    };
  });
  return saveDynamicCourses(next);
}
