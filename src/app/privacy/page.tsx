'use client';

import React from 'react';
import LegalDocumentLayout, {
  type LegalClause,
  type LegalHighlightCard,
} from '@/components/LegalDocumentLayout';

const PRIVACY_HIGHLIGHTS: LegalHighlightCard[] = [
  {
    icon: '🛡️',
    title: 'Zero Raw Card Storage',
    description:
      'UPI PINs, CVVs, and card numbers never touch our servers — all payments run strictly through PCI-DSS certified Razorpay.',
  },
  {
    icon: '🔐',
    title: 'Row-Level Cloud Security',
    description:
      'Your account profile, course unlocks, and mock analytics are isolated in Supabase using TLS encryption and Row-Level Security.',
  },
  {
    icon: '🚫',
    title: 'Never Sold to Brokers',
    description:
      'We never sell, rent, or trade your email address, phone number, or test history to coaching telecallers or third-party ad brokers.',
  },
  {
    icon: '⚙️',
    title: 'Full Aspirant Control',
    description:
      'Update your profile identity, clear local PWA cache, download receipts, or request permanent account deletion anytime.',
  },
];

const PRIVACY_CLAUSES: LegalClause[] = [
  {
    id: 'scope-compliance',
    number: '01',
    title: 'Scope, Data Fiduciary Identity & Statutory Compliance',
    badge: 'Foundation',
    summary:
      'Explains how BankingSolutions handles personal data in accordance with Indian data protection laws.',
    paragraphs: [
      'This Privacy Policy describes how BankingSolutions ("Platform", "we", "us", or "our") collects, processes, stores, and protects personal data when you visit our website, install our Progressive Web Application (PWA), attempt mock tests, participate in competitive study arenas, or purchase courses and PRO Pass memberships.',
      'This Policy is published in compliance with the Information Technology Act, 2000, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the principles of India’s Digital Personal Data Protection (DPDP) Act, 2023.',
    ],
  },
  {
    id: 'data-collected',
    number: '02',
    title: 'Categories of Information We Collect',
    badge: 'Transparency',
    summary:
      'Details the exact account, academic, transaction, and security telemetry data collected during platform usage.',
    paragraphs: [
      'We practice strict data minimization—collecting only the information genuinely necessary to authenticate your account, personalize your banking exam preparation, deliver paid unlocks, and prevent credential piracy.',
    ],
    bullets: [
      {
        label: 'Account & Identity Information',
        detail:
          'Your name, display handle, email address, optional target exam preference (e.g., SBI PO, IBPS PO, RRB, RBI), and authentication identifiers when you sign up via email/password or OAuth.',
      },
      {
        label: 'Academic & Practice Telemetry',
        detail:
          'Mock test attempts, section-wise scores, accuracy metrics, time-per-question logs, bookmarked/wrong questions in your Smart Mistake & Vault Notebook, Daily Targets streaks, Calculation Lab records, Word Matrix scores, and Daily CA Boss Raid badges.',
      },
      {
        label: 'Billing & Entitlement Records',
        detail:
          'Course/Pass name, purchase timestamp, plan validity/expiry date, applied promo coupon code, net INR amount paid, and gateway reference IDs (such as Razorpay Order ID and Payment ID) for receipt generation.',
      },
      {
        label: 'Technical & Anti-Sharing Logs',
        detail:
          'Browser user-agent, approximate IP/region metadata, session timestamps, and crash/performance diagnostics used to maintain 24×7 stability and detect unauthorized multi-user credential sharing.',
      },
    ],
  },
  {
    id: 'cookies-local-storage',
    number: '03',
    title: 'Cookies, Local Browser Storage & PWA Offline Cache',
    summary:
      'Clarifies how browser storage keeps your theme, active test state, and streaks responsive without invasive ad trackers.',
    paragraphs: [
      'BankingSolutions uses essential authentication cookies, browser `localStorage`, and Progressive Web App (PWA) service-worker caches to deliver fast, uninterrupted exam simulations—even across brief network fluctuations.',
      'We do NOT deploy third-party behavioral advertising pixels or cross-site tracking cookies.',
    ],
    bullets: [
      {
        label: 'Essential Session Tokens',
        detail:
          'Maintain your authenticated Supabase login session securely across page reloads.',
      },
      {
        label: 'Preference & Study Continuity Keys',
        detail:
          'Store your Dark/Light theme choice (`bs_theme`), guest practice streaks, Mistake Vault bookmarks, and in-progress quiz checkpoints locally on your device.',
      },
      {
        label: 'Clearing Local Data',
        detail:
          'You may clear browser storage or uninstall the PWA at any time via your browser settings; signed-in users retain cloud-synced purchases and mock records.',
      },
    ],
  },
  {
    id: 'purpose-of-use',
    number: '04',
    title: 'How & Why We Use Your Information',
    summary:
      'Maps every category of collected data to a legitimate educational, operational, or security purpose.',
    paragraphs: [
      'We process your personal information strictly for lawful purposes connected with delivering and improving BankingSolutions:',
    ],
    bullets: [
      {
        label: 'Core Learning & Analytics Delivery',
        detail:
          'Computing All-India percentiles, sectional cut-off comparisons, weak-topic diagnostics, and spaced-revision queues in your Mistake Notebook.',
      },
      {
        label: 'Course & PRO Pass Fulfillment',
        detail:
          'Verifying Razorpay transactions, activating email-based course grants, generating printable tax/payment receipts, and managing plan expiry.',
      },
      {
        label: 'Platform Integrity & Anti-Piracy',
        detail:
          'Preventing automated question scraping, PDF leaks, leaderboard manipulation, and unauthorized sharing of paid accounts.',
      },
      {
        label: 'Essential Service Communications',
        detail:
          'Sending password resets, purchase confirmations, critical exam/course updates, and responses to support or grievance tickets.',
      },
    ],
  },
  {
    id: 'leaderboards-community',
    number: '05',
    title: 'Leaderboards, Community Arenas & Shareable Challenge Links',
    badge: 'Community Visibility',
    summary:
      'Explains what fellow aspirants can see when you compete on leaderboards, raids, or Head-to-Head duels.',
    paragraphs: [
      'Certain competitive features are designed for peer benchmarking across India’s banking aspirant community. Only minimal, non-sensitive academic display fields are shown publicly:',
    ],
    bullets: [
      {
        label: 'Arena Leaderboards & Boss Raids',
        detail:
          'When you rank on Mock Test Leaderboards, Calculation Lab Top 50, Word Matrix Top 100, or contribute damage to a Daily CA Boss Raid, your chosen Display Name, Target Exam badge, and score/clear time are visible—never your email address or billing data.',
      },
      {
        label: 'Head-to-Head (1v1) Challenge Links',
        detail:
          'When you voluntarily generate a challenge link for Telegram or WhatsApp, only your chosen challenger nickname, score, and deterministic board/question seed are encoded into the shareable URL.',
      },
      {
        label: 'Student Reviews',
        detail:
          'If you submit a public platform rating or review, your display name and review text are published on the website.',
      },
    ],
  },
  {
    id: 'payment-security',
    number: '06',
    title: 'Payment Processing & Financial Data Security',
    badge: 'PCI-DSS',
    summary:
      'Confirms that sensitive financial credentials are handled exclusively by authorized payment gateways.',
    paragraphs: [
      'All online fee payments on BankingSolutions are processed via Razorpay Software Private Limited (or equivalent RBI-authorized payment aggregators) operating under PCI-DSS Level 1 security standards and 256-bit SSL/TLS encryption.',
      'BankingSolutions never collects, views, or stores your Debit/Credit card numbers, CVV codes, NetBanking passwords, or UPI PINs. We receive only cryptographic payment confirmation webhooks/signatures, transaction reference IDs, and payment status required to unlock your course.',
    ],
  },
  {
    id: 'third-party-sharing',
    number: '07',
    title: 'Trusted Sub-Processors & Data Disclosure Rules',
    summary:
      'Lists our infrastructure partners and confirms our strict ban on commercial data brokering.',
    paragraphs: [
      'We do NOT sell, rent, or monetize student personal data with coaching institutes, telemarketing agencies, or data brokers under any circumstances. Limited technical processing occurs solely through vetted infrastructure providers bound by confidentiality and security obligations:',
    ],
    bullets: [
      {
        label: 'Supabase Cloud Infrastructure',
        detail:
          'Provides encrypted PostgreSQL database hosting, Row-Level Security (RLS), and secure authentication services.',
      },
      {
        label: 'Vercel Hosting & Edge Analytics',
        detail:
          'Delivers global HTTPS content delivery and privacy-friendly, anonymized page performance telemetry.',
      },
      {
        label: 'Razorpay Payment Gateway',
        detail:
          'Processes checkout sessions, UPI/Card authorizations, and statutory refund reversals.',
      },
      {
        label: 'Lawful & Statutory Requests',
        detail:
          'We may disclose necessary records if strictly required by a court order, governmental agency, or law enforcement authority under applicable Indian law, or to enforce our intellectual property rights against piracy.',
      },
    ],
  },
  {
    id: 'security-architecture',
    number: '08',
    title: 'Cloud Security Practices & Safeguards',
    summary:
      'Outlines technical and organizational controls protecting student records.',
    paragraphs: [
      'We implement industry-standard administrative and technical safeguards—including HTTPS/TLS encryption in transit, hashed authentication credentials, PostgreSQL Row-Level Security policies restricting cross-account queries, and role-restricted administrative portals.',
      'While no internet transmission is 100% immune to sophisticated cyber threats, we continuously audit access logs and promptly remediate vulnerabilities. You play a vital role by keeping your password confidential and signing out on shared computers.',
    ],
  },
  {
    id: 'data-retention',
    number: '09',
    title: 'Data Retention & Archival Timelines',
    summary:
      'Explains how long academic progress and statutory billing receipts are retained.',
    paragraphs: [
      'Because banking aspirants frequently prepare across multi-stage recruitment cycles (Prelims, Mains, and Interviews spanning 6 to 24 months), we retain your account profile, Mistake Vault items, and mock analytics for as long as your account remains active.',
      'Upon a verified account deletion request, personal profile data and private study logs are permanently erased or anonymized within 30 days, except for transaction invoices and payment audit logs that must be retained to comply with Indian tax, accounting, and anti-fraud statutes.',
    ],
  },
  {
    id: 'user-rights',
    number: '10',
    title: 'Your Rights as an Aspirant (Data Principal Rights)',
    badge: 'DPDP Rights',
    summary:
      'Empowers you to access, correct, export, or erase your personal data.',
    paragraphs: [
      'Consistent with the Digital Personal Data Protection Act, 2023, you hold the following rights over your personal data on BankingSolutions:',
    ],
    bullets: [
      {
        label: 'Right to Access & Review',
        detail:
          'Inspect your profile details, active course unlocks, payment receipts, and test history directly from your Student Profile.',
      },
      {
        label: 'Right to Correction & Updating',
        detail:
          'Update inaccurate or outdated profile names, target exams, or display handles.',
      },
      {
        label: 'Right to Erasure & Consent Withdrawal',
        detail:
          'Request permanent deletion of your account and personal data by contacting our Grievance & Privacy Desk from your registered email ID (note that deleting an account forfeits remaining access to active courses tied to that account).',
      },
    ],
  },
  {
    id: 'minors-privacy',
    number: '11',
    title: 'Children’s & Minor Aspirants’ Privacy',
    summary:
      'Protects learners under 18 preparing early for competitive exams.',
    paragraphs: [
      'BankingSolutions is designed primarily for university students and graduates eligible for banking recruitment examinations (typically aged 18 and above). Learners under 18 years of age may create an account only with verifiable parental or legal guardian consent. If a parent or guardian believes a minor has submitted personal data without consent, please contact us for prompt removal.',
    ],
  },
  {
    id: 'privacy-grievance',
    number: '12',
    title: 'Policy Updates & Data Protection Grievance Desk',
    badge: 'Contact & SLA',
    summary:
      'Provides official contact channels and resolution timelines for privacy inquiries.',
    paragraphs: [
      'We may update this Privacy Policy periodically to reflect new platform capabilities or regulatory amendments. Any material changes will be reflected in the "Last Updated" date at the top of this page.',
    ],
    callout: {
      tone: 'emerald',
      title: 'Privacy & Data Protection Officer / Grievance Desk',
      body: 'For data access requests, profile corrections, account deletion, or privacy grievances under the IT Act, 2000 & DPDP Act, 2023, contact us with your registered email address via Official Telegram (@Banking_Solutions) or our Student Support Desk. Every request is acknowledged within 48 hours and resolved within 15 business days.',
    },
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout
      activePage="privacy"
      headerSubtitle="Data Protection, Security & Student Privacy Notice"
      primaryBadge="🔒 Data Protection Policy"
      complianceBadge="DPDP Act, 2023 & IT Act Aligned"
      title="Privacy Policy"
      leadDescription={
        <>
          At <strong className="text-white">BankingSolutions</strong>, safeguarding your personal
          identity, mock test analytics, and payment security is foundational to everything we
          build. This Privacy Policy explains transparently what data we collect, how it powers your
          exam preparation, and the strict security controls protecting your account.
        </>
      }
      highlights={PRIVACY_HIGHLIGHTS}
      searchPlaceholder="e.g., Supabase, Razorpay, cookies, delete account..."
      clauses={PRIVACY_CLAUSES}
    />
  );
}
