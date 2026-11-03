'use client';

import React from 'react';
import LegalDocumentLayout, {
  type LegalClause,
  type LegalHighlightCard,
} from '@/components/LegalDocumentLayout';

const TERMS_HIGHLIGHTS: LegalHighlightCard[] = [
  {
    icon: '👤',
    title: '1 Aspirant = 1 Account',
    description:
      'PRO Pass and course unlocks are strictly personal. Sharing login credentials with groups or peers triggers automated account lockouts.',
  },
  {
    icon: '🛡️',
    title: 'Strict Anti-Piracy',
    description:
      'BSPS sheets, BSCA PDFs, E-Books, and Mock Questions cannot be redistributed on Telegram, WhatsApp, drives, or external channels.',
  },
  {
    icon: '💳',
    title: 'Verified Digital Billing',
    description:
      'Payments are processed securely via Razorpay in INR. Instant digital unlocks are non-transferable and governed by our Refund Policy.',
  },
  {
    icon: '🏛️',
    title: 'Independent EdTech',
    description:
      'BankingSolutions is an independent prep platform and is not affiliated with IBPS, SBI, RBI, NABARD, or any government body.',
  },
];

const TERMS_CLAUSES: LegalClause[] = [
  {
    id: 'definitions',
    number: '01',
    title: 'Definitions & Scope of Agreement',
    badge: 'Foundation',
    summary:
      'Establishes key legal terms used throughout this Agreement across all BankingSolutions web, mobile, and PWA experiences.',
    paragraphs: [
      'These Terms and Conditions ("Terms", "Terms of Use", or "Agreement") constitute a legally binding electronic contract between you ("User", "Aspirant", "Student", or "you") and BankingSolutions ("Platform", "Company", "we", "us", or "our"), governing your access to and use of our website, Progressive Web Application (PWA), test series interfaces, downloadable materials, and associated services.',
      'This document is an electronic record published in accordance with the provisions of the Information Technology Act, 2000 and the rules framed thereunder, and does not require any physical or digital signatures to be enforceable.',
    ],
    bullets: [
      {
        label: 'Platform Services',
        detail:
          'Includes Real CBT Mock Tests, BSPS (BankingSolutions Practice Sheets), BSCA (BankingSolutions Current Affairs), Computer Awareness Courses, RRB PDF Courses, E-Books, Smart Mistake & Vault Notebook, Calculation Lab, Word Matrix, Daily CA Boss Raid, and Daily Targets Hub.',
      },
      {
        label: 'Subscription & Paid Products',
        detail:
          'Refers to time-bound memberships (including BankingSolutions PRO Pass plans), individual subject courses, test series packs, and digital PDF/E-Book purchases unlocked against a fee.',
      },
      {
        label: 'Proprietary Content',
        detail:
          'Encompasses all exam questions, solutions, bilingual explanations, editorial vocabulary sets, current affairs digests, software source code, visual layouts, and trademarks hosted on BankingSolutions.',
      },
    ],
  },
  {
    id: 'eligibility',
    number: '02',
    title: 'Acceptance of Terms & User Eligibility',
    summary:
      'Outlines who may legally register and use BankingSolutions and how continued usage signifies consent.',
    paragraphs: [
      'By accessing, browsing, registering an account, or purchasing any course, pass, or digital material on BankingSolutions, you acknowledge that you have read, understood, and agreed to be bound by these Terms, along with our Privacy Policy, Disclaimer, and Refund & Cancellation Policy.',
      'Use of the Platform is available to individuals competent to contract under the Indian Contract Act, 1872. If you are under 18 years of age (a minor), you may use BankingSolutions only under the supervision and express consent of a parent or legal guardian who agrees to be bound by these Terms on your behalf.',
      'If you do not agree with any provision of these Terms, you must discontinue using the Platform immediately.',
    ],
  },
  {
    id: 'accounts',
    number: '03',
    title: 'Account Registration, Security & Single-User License',
    badge: 'Strict Policy',
    summary:
      'Every BankingSolutions account is strictly personal to a single aspirant and may not be shared, sold, or accessed concurrently.',
    paragraphs: [
      'While select practice tools and previews may be explored in guest mode, full access to mock test analytics, cloud-synced Mistake Notebooks, leaderboards, and paid courses requires registering an authenticated account using accurate and verifiable personal information.',
      'You are solely responsible for safeguarding your login credentials, OAuth sessions, and all activities conducted through your account. You must notify us immediately if you suspect any unauthorized use or security breach of your account.',
    ],
    bullets: [
      {
        label: 'Strictly Single-User Access',
        detail:
          'Your account, PRO Pass, and purchased courses are licensed exclusively to you as an individual aspirant. Credential sharing across study groups, friends, cybercafes, or coaching batches is strictly prohibited.',
      },
      {
        label: 'Automated Anti-Sharing Safeguards',
        detail:
          'Our security systems monitor abnormal concurrent logins, rapid IP/device switching, and automated session sharing. Accounts flagged for credential sharing may be temporarily locked or permanently terminated without refund.',
      },
      {
        label: 'Accurate Profile Identity',
        detail:
          'Impersonating another student, educator, or administrator on leaderboards, reviews, or Head-to-Head challenges is prohibited.',
      },
    ],
  },
  {
    id: 'offerings',
    number: '04',
    title: 'Courses, PRO Pass Memberships & Access Validity',
    summary:
      'Clarifies what is included in paid plans, validity timelines, and syllabus updates.',
    paragraphs: [
      'BankingSolutions offers both complimentary learning hubs and paid digital enrollments—such as 1-Month, 3-Month, 6-Month, and 12-Month PRO Pass plans, standalone subject courses (e.g., Computer Awareness, Critical Reasoning, RRB PDF Course), and digital E-Books.',
      'Access to any paid course or PRO Pass begins immediately upon verified payment confirmation (or administrative grant) and remains active until the stated expiry date displayed on your Purchase Receipt and Student Profile.',
    ],
    bullets: [
      {
        label: 'Non-Transferable Enrollments',
        detail:
          'Purchased passes, courses, and digital unlocks are tied permanently to the purchasing email/account ID and cannot be transferred, gifted, or migrated to another email address.',
      },
      {
        label: 'Dynamic Syllabus Alignment',
        detail:
          'To reflect evolving IBPS, SBI, RBI, and RRB exam patterns, we may add, revise, archive, or replace practice questions, mock sets, or PDF schedules during an active subscription cycle.',
      },
    ],
  },
  {
    id: 'payments',
    number: '05',
    title: 'Pricing, Payments, Taxes & Promotional Coupons',
    badge: 'Billing',
    summary:
      'Governs Indian Rupee (INR) pricing, authorized payment processing via Razorpay, taxes, and promotional discount codes.',
    paragraphs: [
      'All prices listed on BankingSolutions are denominated in Indian Rupees (INR / ₹) unless explicitly stated otherwise and are inclusive of applicable indirect taxes unless itemized at checkout.',
      'Online payments are processed securely through authorized, PCI-DSS compliant third-party payment gateways, including Razorpay (supporting UPI, Debit/Credit Cards, NetBanking, and Wallets). BankingSolutions does not store your raw card numbers, CVV, or UPI PINs on its servers.',
    ],
    bullets: [
      {
        label: 'Price Revisions',
        detail:
          'Launch offers, strike-through discounts, and plan prices are subject to revision at our sole discretion. Any price change will not retroactively affect an already active paid validity period.',
      },
      {
        label: 'Promotional & Coupon Codes',
        detail:
          'Promo codes (such as launch or category-specific coupons) cannot be clubbed together, exchanged for cash, or applied retroactively after a transaction is completed.',
      },
      {
        label: 'Digital Receipts',
        detail:
          'Upon successful payment verification, an official printable receipt containing your Transaction/Payment ID, validity period, and amount paid is made available in your account.',
      },
    ],
  },
  {
    id: 'refunds',
    number: '06',
    title: 'Digital Delivery, Cancellations & Refund Policy',
    summary:
      'Explains immediate digital fulfillment and the narrow circumstances under which billing disputes qualify for review.',
    paragraphs: [
      'Because BankingSolutions delivers instant access to digital intellectual property—including downloadable PDFs (BSPS, BSCA, E-Books), unlocked CBT Mock Tests, and course modules—all sales are generally final and non-refundable once unlocked.',
      'These Terms incorporate our dedicated Refund & Cancellation Policy by reference. Refund requests are entertained strictly in cases of verified duplicate deduction for the same order or an unresolved platform-side technical failure that completely prevented access to the purchased product.',
    ],
    callout: {
      tone: 'amber',
      title: 'Chargeback & Payment Dispute Notice',
      body: 'Initiating an unauthorized bank chargeback after downloading PDFs or attempting paid mock tests constitutes a material breach of these Terms and will result in immediate suspension of your BankingSolutions account pending investigation.',
    },
  },
  {
    id: 'intellectual-property',
    number: '07',
    title: 'Intellectual Property Rights & Anti-Piracy Covenant',
    badge: 'Copyright',
    summary:
      'Protects all mock questions, BSPS/BSCA PDFs, quizzes, and platform code against piracy, Telegram/WhatsApp redistribution, and scraping.',
    paragraphs: [
      'All rights, title, and interest in and to BankingSolutions—including mock test questions, quantitative and reasoning puzzles, critical reasoning sets, computer awareness notes, BSPS practice sheets, BSCA current affairs compilations, Word Matrix banks, Boss Raid editions, UI designs, logos, and underlying software—are the exclusive intellectual property of BankingSolutions and protected under the Indian Copyright Act, 1957 and applicable international laws.',
      'Subject to your compliance with these Terms, we grant you a limited, revocable, non-exclusive, non-transferable, personal license to view, practice, and (where explicitly enabled via an official Download button) save PDF study materials solely for your own personal competitive exam preparation.',
    ],
    bullets: [
      {
        label: 'Zero-Tolerance Anti-Piracy Rule',
        detail:
          'You must NOT upload, forward, mirror, resell, or redistribute any BankingSolutions PDFs, paid E-Books, screenshots of mock test questions, or course content on Telegram channels/groups, WhatsApp groups, Google Drive links, YouTube videos, or third-party websites.',
      },
      {
        label: 'No Scraping or AI Dataset Harvesting',
        detail:
          'Using bots, crawlers, headless browsers, screen-recording tools, or automated scripts to extract questions, solutions, or user data—including for training machine learning models or competing test platforms—is strictly prohibited.',
      },
      {
        label: 'Digital Watermarking',
        detail:
          'Downloaded PDFs and test views may embed user-identifying metadata or watermarks to trace unauthorized leaks and pursue civil and criminal remedies.',
      },
    ],
    callout: {
      tone: 'rose',
      title: 'Enforcement Against Content Piracy',
      body: 'Unauthorized reproduction or distribution of BankingSolutions study materials on Telegram, WhatsApp, or file-sharing networks will result in immediate permanent account termination without refund and legal action under the Copyright Act, 1957 and Information Technology Act, 2000.',
    },
  },
  {
    id: 'acceptable-use',
    number: '08',
    title: 'Acceptable Use, Fair Play & Community Arenas',
    summary:
      'Ensures fair competition across Mock Rankings, Calculation Lab, Word Matrix Top 100, Daily CA Boss Raid, and Head-to-Head Challenges.',
    paragraphs: [
      'BankingSolutions features interactive community and competitive arenas—including Mock Test All-India percentiles, Calculation Lab speed rankings, Word Matrix Top 100 leaderboards, Daily Current Affairs Boss Raids (community HP pools), Head-to-Head Challenge links, and student course reviews.',
      'You agree to participate honestly and respectfully across all interactive features and refrain from any conduct that degrades platform integrity or harasses fellow aspirants.',
    ],
    bullets: [
      {
        label: 'Leaderboard & Score Integrity',
        detail:
          'Manipulating client timers, tampering with network payloads, using automated solver scripts, or exploiting bugs to inflate scores, streaks, or community Boss Raid damage will result in leaderboard disqualification and account ban.',
      },
      {
        label: 'Head-to-Head Challenge Links',
        detail:
          'Official challenge links generated via Calculation Lab, Word Matrix, or CA Boss Raid are meant for healthy peer competition in Telegram/WhatsApp study groups. You must not use offensive, defamatory, or misleading display names when generating challenge links.',
      },
      {
        label: 'Authentic Reviews & Feedback',
        detail:
          'Reviews submitted on BankingSolutions must reflect genuine learning experiences and must not contain spam, abusive language, promotional links, or unlawful content.',
      },
    ],
  },
  {
    id: 'non-affiliation',
    number: '09',
    title: 'Independent EdTech Status & Non-Affiliation',
    summary:
      'Clarifies that BankingSolutions is an independent exam-prep platform and not an official government or recruiting body.',
    paragraphs: [
      'BankingSolutions is an independent private educational technology platform created to help aspirants prepare for banking, insurance, and regulatory body examinations.',
      'We are NOT affiliated with, endorsed by, sponsored by, or officially connected to the Institute of Banking Personnel Selection (IBPS), State Bank of India (SBI), Reserve Bank of India (RBI), NABARD, LIC, NIACL, or any central or state government authority.',
      'All references to exam names (such as SBI PO, SBI Clerk, IBPS PO, IBPS RRB, RBI Grade B/Assistant) are used strictly for descriptive and syllabus-identification purposes. Candidates must always verify official exam dates, eligibility criteria, and recruitment notifications directly from the respective recruiting body’s official website.',
    ],
  },
  {
    id: 'third-party',
    number: '10',
    title: 'Third-Party Services, Gateways & External Links',
    summary:
      'Covers external tools integrated into the platform such as Razorpay, Supabase, YouTube embeds, and social sharing.',
    paragraphs: [
      'Our Platform integrates select trusted third-party infrastructure and links—such as Razorpay for payment processing, Supabase for authentication and cloud storage, YouTube for embedded video explanations, and Telegram/WhatsApp share intents for study communities.',
      'Your interaction with any third-party service is governed by that provider’s own terms and privacy policies. BankingSolutions is not responsible for the availability, security practices, or content of external websites or messaging platforms outside our direct control.',
    ],
  },
  {
    id: 'availability',
    number: '11',
    title: 'Platform Availability, Maintenance & Modifications',
    summary:
      'Addresses uptime targets, scheduled upgrades, offline PWA storage, and feature evolution.',
    paragraphs: [
      'While we strive to maintain 24×7 availability—especially during peak Prelims and Mains exam seasons—access to BankingSolutions may occasionally be interrupted for scheduled maintenance, server upgrades, database migrations, or events beyond our reasonable control (including ISP outages, cloud provider incidents, or force majeure events).',
      'Local browser storage (`localStorage` / PWA cache) used for guest streaks, theme preferences, or unsynced practice states may clear if you wipe your browser data or switch devices without signing in. Signed-in accounts enjoy cloud synchronization for supported features.',
      'We reserve the right to enhance, modify, restructure, or discontinue specific free tools or beta features at any time to improve the overall aspirant experience.',
    ],
  },
  {
    id: 'termination',
    number: '12',
    title: 'Account Suspension & Termination',
    summary:
      'Specifies when BankingSolutions or the user may suspend or terminate platform access.',
    paragraphs: [
      'You may stop using BankingSolutions at any time. If you wish to request deletion of your registered account, you may contact our support team from your registered email address.',
      'BankingSolutions reserves the right, at its sole discretion and without prior notice or liability, to restrict, suspend, or permanently terminate your account and revoke access to paid courses/passes without refund if we reasonably determine that you have:',
    ],
    bullets: [
      {
        label: 'Breached Intellectual Property',
        detail:
          'Shared, leaked, scraped, or commercially distributed proprietary PDFs, mock tests, or course videos.',
      },
      {
        label: 'Shared Account Credentials',
        detail:
          'Permitted multiple individuals to use a single paid account or PRO Pass.',
      },
      {
        label: 'Engaged in Fraud or Abuse',
        detail:
          'Committed payment fraud, abusive chargebacks, leaderboard manipulation, or cyberattacks against our infrastructure.',
      },
    ],
  },
  {
    id: 'warranties',
    number: '13',
    title: 'Disclaimer of Warranties & No Guarantee of Selection',
    summary:
      'Clarifies "as-is" service delivery and that exam clearance depends on individual effort and official recruitment outcomes.',
    paragraphs: [
      'All content, mock tests, current affairs notes, memory-based papers, and analytics on BankingSolutions are provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied, including implied warranties of merchantability, fitness for a particular purpose, or error-free operation.',
      'While our educators and content team meticulously curate questions, answer keys, and current affairs facts, occasional typographical errors or syllabus shifts by exam-conducting bodies may occur. You may report any question discrepancy for prompt editorial review.',
    ],
    callout: {
      tone: 'blue',
      title: 'Educational Aid — No Guarantee of Rank or Recruitment',
      body: 'BankingSolutions provides structured practice and analytics to sharpen your speed and accuracy, but we make no guarantee or assurance of clearing any cut-off, achieving a specific percentile, or securing final selection in any banking or government examination.',
    },
  },
  {
    id: 'liability',
    number: '14',
    title: 'Limitation of Liability & Indemnification',
    summary:
      'Defines statutory caps on financial liability and user indemnification obligations.',
    paragraphs: [
      'To the fullest extent permitted by applicable Indian law, BankingSolutions, its founder, educators, contributors, and technology partners shall not be liable for any indirect, incidental, special, consequential, or punitive damages—including loss of data, exam opportunity, or anticipated results—arising out of or relating to your use of or inability to use the Platform.',
      'In no event shall BankingSolutions’ total aggregate liability to you for all claims arising out of or relating to these Terms or any paid service exceed the total amount actually paid by you to BankingSolutions for the specific course or pass giving rise to the claim during the six (6) months immediately preceding the event.',
      'You agree to indemnify, defend, and hold harmless BankingSolutions and its team from and against any third-party claims, losses, liabilities, damages, and legal expenses arising from your violation of these Terms, infringement of intellectual property rights, or misuse of the Platform.',
    ],
  },
  {
    id: 'governing-law',
    number: '15',
    title: 'Governing Law, Dispute Resolution & Grievance Redressal',
    badge: 'Legal & Support',
    summary:
      'Sets Indian legal jurisdiction, updates to these Terms, and official grievance contact channels.',
    paragraphs: [
      'These Terms and any dispute or claim arising out of or in connection with them shall be governed by and construed in accordance with the laws of India, without regard to conflict-of-law principles.',
      'Before initiating any formal legal proceeding, both parties agree to attempt good-faith amicable resolution for at least thirty (30) days by submitting a written notice describing the issue and account details to our Grievance & Support Desk. Subject to the foregoing, courts of competent jurisdiction in India shall have exclusive jurisdiction.',
      'We may revise these Terms periodically to reflect new platform features, payment regulations, or legal requirements. When we post changes, we will update the "Last Updated" date at the top of this page. Continued use of BankingSolutions after updated Terms take effect constitutes your acceptance of the revised Agreement.',
    ],
    callout: {
      tone: 'emerald',
      title: 'Grievance Redressal & Student Support Desk (IT Rules Compliance)',
      body: 'For billing queries, technical access issues, copyright notices, or formal grievances under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, please reach out with your registered email and Transaction ID via Official Telegram (@Banking_Solutions) or our Student Support Desk. All grievances are acknowledged within 48 hours and resolved within 15 business days.',
    },
  },
];

export default function TermsPage() {
  return (
    <LegalDocumentLayout
      activePage="terms"
      headerSubtitle="Terms of Use & Student License Agreement"
      primaryBadge="⚖️ Binding User Agreement"
      complianceBadge="IT Act, 2000 Compliant"
      title="Terms & Conditions"
      leadDescription={
        <>
          Please read these Terms &amp; Conditions carefully before accessing or purchasing courses,
          test series, PRO Pass memberships, or downloadable study resources on{' '}
          <strong className="text-white">BankingSolutions</strong>. These Terms establish your legal
          rights, license boundaries, and responsibilities as an aspirant on our platform.
        </>
      }
      highlights={TERMS_HIGHLIGHTS}
      searchPlaceholder="e.g., PRO Pass, refund, PDF piracy, Razorpay..."
      clauses={TERMS_CLAUSES}
    />
  );
}
