'use client';

import React from 'react';
import LegalDocumentLayout, {
  type LegalClause,
  type LegalHighlightCard,
} from '@/components/LegalDocumentLayout';

const DISCLAIMER_HIGHLIGHTS: LegalHighlightCard[] = [
  {
    icon: '🏛️',
    title: 'Non-Government Platform',
    description:
      'BankingSolutions is an independent private EdTech platform and is NOT affiliated with IBPS, SBI, RBI, NABARD, or LIC.',
  },
  {
    icon: '🎯',
    title: 'Simulated CBT Practice',
    description:
      'Mock interfaces, All-India percentiles, and cut-off projections are preparatory simulations, not official exam scores.',
  },
  {
    icon: '📢',
    title: 'Verify Official Notices',
    description:
      'Always confirm final exam dates, eligibility criteria, and vacancies directly on official bank/IBPS portals.',
  },
  {
    icon: '📘',
    title: 'Academic Jargon Only',
    description:
      'Banking & RBI financial concepts taught on the platform are strictly for exam syllabus mastery, not investment advice.',
  },
];

const DISCLAIMER_CLAUSES: LegalClause[] = [
  {
    id: 'non-affiliation',
    number: '01',
    title: 'Independent Educational Platform & Non-Affiliation',
    badge: 'Statutory Notice',
    summary:
      'Affirms that BankingSolutions operates independently of all government and public-sector recruiting bodies.',
    paragraphs: [
      'BankingSolutions is an independent, privately operated educational technology platform dedicated to helping competitive exam aspirants prepare for banking, insurance, and financial regulatory examinations in India.',
      'BankingSolutions is NOT affiliated with, associated with, authorized by, endorsed by, or in any way officially connected with the Institute of Banking Personnel Selection (IBPS), State Bank of India (SBI), Reserve Bank of India (RBI), National Bank for Agriculture and Rural Development (NABARD), Securities and Exchange Board of India (SEBI), Life Insurance Corporation of India (LIC), NIACL, or any central or state government ministry, department, or recruitment board.',
    ],
    callout: {
      tone: 'amber',
      title: 'Official Portals Always Prevail',
      body: 'For authoritative recruitment notifications, admit cards, exam center allocations, and official results, candidates must rely exclusively on official portals such as ibps.in, sbi.co.in, and rbi.org.in.',
    },
  },
  {
    id: 'trademark-fair-use',
    number: '02',
    title: 'Nominative Fair Use of Exam Names & Institutional Titles',
    summary:
      'Clarifies why exam titles like SBI PO, IBPS PO, RRB, and RBI Grade B appear across courses and mock tests.',
    paragraphs: [
      'All institutional names, examination titles (including but not limited to SBI PO, SBI Clerk / Junior Associates, IBPS PO, IBPS Clerk, IBPS RRB Officer Scale-I / Office Assistant, RBI Grade B, RBI Assistant, NABARD Grade A), trademarks, and emblems mentioned on BankingSolutions belong to their respective institutional owners.',
      'Such names and designations are used strictly under nominative fair use for descriptive, educational, and syllabus-categorization purposes so aspirants can identify which exam pattern a mock test, BSPS practice sheet, or BSCA current affairs capsule targets.',
    ],
  },
  {
    id: 'content-accuracy',
    number: '03',
    title: 'Accuracy of Mock Questions, Solutions & Current Affairs',
    badge: 'Editorial Standard',
    summary:
      'Addresses editorial diligence, dynamic GA/RBI updates, and typographical or errata handling.',
    paragraphs: [
      'Our subject-matter experts and editorial team exercise high diligence when drafting Quantitative Aptitude sets, Reasoning puzzles, Critical Reasoning arguments, English editorials, Computer Awareness MCQs, BSPS sheets, BSCA compilations, and Daily CA Boss Raid questions.',
      'However, economic indicators, RBI policy rates, union budget figures, appointments, rankings, and current affairs facts evolve rapidly. Accordingly, BankingSolutions makes no express or implied warranty that every question, explanation, or PDF note is completely free from inadvertent typographical errors, subsequent factual revisions, or alternative interpretations.',
    ],
    bullets: [
      {
        label: 'Prompt Errata Resolution',
        detail:
          'Whenever an aspirant flags an ambiguous option, calculation typo, or updated current affairs statistic, our content team reviews and updates the cloud question bank promptly.',
      },
      {
        label: 'Memory-Based Papers',
        detail:
          'Previous-year or memory-based exam sets are reconstructed from genuine student exam-day feedback for pattern familiarity and do not claim to be verbatim reproductions of confidential official papers.',
      },
    ],
  },
  {
    id: 'cbt-simulations',
    number: '04',
    title: 'Real CBT Interface, Percentiles & Cut-Off Projections',
    summary:
      'Explains the scope and limitations of simulated exam environments and predicted cut-offs.',
    paragraphs: [
      'Our Real CBT Mock Test player, sectional timers, palette indicators, All-India Rank / Percentile calculators, and expected cut-off analyses are engineered to closely mirror actual examination conditions.',
      'Actual examination interfaces, normalization formulas (such as equi-percentile normalization across multiple shifts), question difficulty distributions, and official sectional/overall cut-offs are determined solely by the exam-conducting authority and may differ from our preparatory simulations.',
    ],
  },
  {
    id: 'no-selection-guarantee',
    number: '05',
    title: 'No Guarantee of Exam Clearance, Score or Final Selection',
    badge: 'Important',
    summary:
      'Sets transparent expectations regarding individual preparation and recruitment outcomes.',
    paragraphs: [
      'Enrolling in any BankingSolutions course, PRO Pass, PDF schedule, or test series provides structured practice tools and performance diagnostics designed to accelerate your speed and accuracy.',
      'Nevertheless, competitive exam success depends on each candidate’s individual consistency, conceptual command, exam-day execution, and official vacancy competition. BankingSolutions neither promises nor guarantees clearing any Prelims/Mains cut-off, interview shortlisting, or final appointment.',
    ],
  },
  {
    id: 'exam-notifications',
    number: '06',
    title: 'Exam Updates, One-Liners & Notification Summaries',
    summary:
      'Covers recruitment alerts, vacancy breakdowns, and eligibility summaries published on the site.',
    paragraphs: [
      'Articles, Exam One-Liners, marquee notices, and notification summaries published on BankingSolutions are simplified digests created for student convenience.',
      'Recruiting bodies frequently issue corrigenda, date extensions, age-relaxation clauses, or vacancy revisions. Aspirants are strongly advised to read the complete official PDF advertisement published by the recruiting organization before submitting an exam application or paying official application fees.',
    ],
  },
  {
    id: 'financial-awareness-scope',
    number: '07',
    title: 'Banking & Financial Awareness — Not Financial or Legal Advice',
    summary:
      'Distinguishes banking exam concepts (Repo Rate, NPA, Basel III, Capital Markets) from personal financial advisory.',
    paragraphs: [
      'Modules such as Word Matrix (Financial & Banking Jargon), BSCA Current Affairs, and General Awareness quizzes discuss monetary policy instruments, SEBI/RBI regulations, balance-sheet ratios, government schemes, and financial instruments.',
      'All such explanations are strictly academic and intended solely for competitive examination preparation. Nothing on BankingSolutions constitutes investment advice, tax counsel, banking solicitation, or legal opinion.',
    ],
  },
  {
    id: 'external-resources',
    number: '08',
    title: 'External Websites, Embedded Videos & Community Channels',
    summary:
      'Clarifies responsibility boundaries for third-party links and study groups.',
    paragraphs: [
      'BankingSolutions may link to external reference sites, embed YouTube video classes, or enable sharing Head-to-Head challenge links to Telegram and WhatsApp study groups.',
      'We do not control and assume no responsibility for third-party websites, user-generated discussions in unofficial study groups, or external platform availability. Beware of impostor channels claiming to sell BankingSolutions courses outside our official website and verified `@Banking_Solutions` community.',
    ],
  },
  {
    id: 'limitation-of-reliance',
    number: '09',
    title: 'Limitation of Liability for Educational Reliance',
    summary:
      'Protects the platform against claims arising from reliance on study material or technical downtime.',
    paragraphs: [
      'Under no circumstances shall BankingSolutions, its founder, educators, or technical contributors be held liable for any direct, indirect, incidental, or consequential loss, missed application deadline, or exam outcome arising from reliance on information, mock scores, or study schedules hosted on the Platform.',
    ],
  },
  {
    id: 'report-discrepancy',
    number: '10',
    title: 'Reporting Content Errata or Clarification Requests',
    badge: 'Feedback',
    summary:
      'Invites students and institutions to report any factual correction or intellectual property concern.',
    paragraphs: [
      'We deeply value academic precision. If you spot a question key discrepancy, an outdated banking awareness figure, or any content requiring clarification, please share the Mock/Quiz title and Question ID with our editorial team.',
    ],
    callout: {
      tone: 'emerald',
      title: 'Editorial Review & Support Channel',
      body: 'Reach out via Official Telegram (@Banking_Solutions) or our Student Support Desk with screenshots or Question IDs. Verified academic corrections are prioritized and updated across the platform within 24–72 hours.',
    },
  },
];

export default function DisclaimerPage() {
  return (
    <LegalDocumentLayout
      activePage="disclaimer"
      headerSubtitle="Statutory Disclosures, Non-Affiliation & Academic Scope"
      primaryBadge="📋 Statutory Disclaimer"
      complianceBadge="Independent EdTech Disclosure"
      title="Educational & Legal Disclaimer"
      leadDescription={
        <>
          This Disclaimer sets forth important statutory disclosures regarding{' '}
          <strong className="text-white">BankingSolutions&apos;</strong> status as an independent
          educational platform, the preparatory nature of our Real CBT simulations and study
          materials, and the boundaries of academic reliance for competitive banking examinations.
        </>
      }
      highlights={DISCLAIMER_HIGHLIGHTS}
      searchPlaceholder="e.g., IBPS affiliation, cut-off, accuracy, errata..."
      clauses={DISCLAIMER_CLAUSES}
    />
  );
}
