'use client';

import React from 'react';
import LegalDocumentLayout, {
  type LegalClause,
  type LegalHighlightCard,
} from '@/components/LegalDocumentLayout';

const REFUND_HIGHLIGHTS: LegalHighlightCard[] = [
  {
    icon: '⚡',
    title: 'Instant Digital Delivery',
    description:
      'PRO Pass, courses, CBT mocks, and BSPS/BSCA PDFs unlock immediately upon payment; unlocked digital sales are final.',
  },
  {
    icon: '🔁',
    title: '100% Double-Debit Refund',
    description:
      'Accidental duplicate payments for the same course or pass are refunded in full within 5–7 business days.',
  },
  {
    icon: '🛠️',
    title: 'Technical Unlock Protection',
    description:
      'If a verified payment fails to unlock access and our team cannot resolve it within 72 hours, a full refund is issued.',
  },
  {
    icon: '🔕',
    title: 'Zero Surprise Auto-Debits',
    description:
      'All passes (1M / 3M / 6M / 12M) are one-time prepaid tenures—we never silently auto-debit your bank or UPI.',
  },
];

const REFUND_CLAUSES: LegalClause[] = [
  {
    id: 'digital-fulfillment',
    number: '01',
    title: 'Nature of Digital Educational Products & Instant Fulfillment',
    badge: 'Core Principle',
    summary:
      'Explains why downloadable PDFs, online test series, and instant course unlocks are treated as non-returnable digital goods.',
    paragraphs: [
      'BankingSolutions provides immediate digital access to proprietary educational products—including BankingSolutions PRO Pass memberships, Real CBT Mock Test Series, BSPS Practice Sheets, BSCA Current Affairs PDFs, Computer Awareness Courses, Critical Reasoning sets, RRB PDF Courses, and downloadable E-Books.',
      'Unlike physical merchandise, digital study materials and downloadable PDFs are delivered instantaneously upon payment confirmation and cannot be "returned" once accessed, viewed, or downloaded. Consequently, in accordance with industry standards and the Consumer Protection (E-Commerce) Rules, 2020 for digital content, all completed purchases are generally final and non-refundable.',
    ],
    bullets: [
      {
        label: 'Free Samples & Previews Before Purchase',
        detail:
          'We provide free daily targets, sample quizzes, calculation & vocabulary arenas, and clear syllabus descriptions so aspirants can evaluate platform quality thoroughly before making any payment.',
      },
    ],
  },
  {
    id: 'cancellation-policy',
    number: '02',
    title: 'Prepaid Validity & Subscription Cancellation Policy',
    badge: 'No Auto-Renewal',
    summary:
      'Confirms one-time prepaid plan validity with zero recurring mandate traps.',
    paragraphs: [
      'All PRO Pass memberships (1-Month, 3-Month, 6-Month, and 12-Month plans) and subject courses on BankingSolutions operate on a transparent, one-time prepaid validity model unless an explicit recurring mandate is ever introduced and consented to separately.',
      'Your bank account, card, or UPI ID will NOT be automatically charged when your pass expires. Because there is no recurring billing cycle to cancel, you may simply choose whether or not to renew upon expiry. Discontinuing use mid-tenure does not entitle a user to a pro-rata refund for unused days.',
    ],
  },
  {
    id: 'eligible-refund-cases',
    number: '03',
    title: 'Eligible Scenarios for Refund Approval',
    badge: 'Student Protection',
    summary:
      'Lists the clear, fair billing and technical situations where a 100% refund is approved.',
    paragraphs: [
      'Notwithstanding the general finality of digital goods, BankingSolutions protects aspirants against genuine banking and technical anomalies. You are eligible for a full refund in the following verified scenarios:',
    ],
    bullets: [
      {
        label: 'Duplicate / Double Payment',
        detail:
          'If due to network latency or UPI/bank retry you are charged twice (two distinct successful debits) for the exact same course, E-Book, or PRO Pass plan on the same account, 100% of the duplicate transaction will be refunded.',
      },
      {
        label: 'Amount Debited Without Order Activation',
        detail:
          'If money is debited from your bank/UPI account during Razorpay checkout, is not automatically reversed by your bank within T+5 business days, and settled into our merchant account without unlocking your course—we will either activate your course immediately (with full validity from activation date) or issue a 100% refund per your preference.',
      },
      {
        label: 'Unresolved Platform-Side Access Defect',
        detail:
          'If a verified technical defect solely attributable to BankingSolutions completely prevents you from accessing a newly purchased course or pass, and our engineering support desk is unable to restore access within 72 hours of your support ticket (provided no PDFs/E-Books from that purchase were already downloaded).',
      },
    ],
  },
  {
    id: 'non-refundable-cases',
    number: '04',
    title: 'Scenarios Not Eligible for Refunds',
    summary:
      'Clarifies common situations where refund, swap, or partial credit requests cannot be accepted.',
    paragraphs: [
      'To maintain fair pricing for all aspirants and protect intellectual property against download-and-refund abuse, refunds will NOT be granted under any of the following circumstances:',
    ],
    bullets: [
      {
        label: 'Change of Mind or Exam Plans',
        detail:
          'Deciding not to appear for banking exams, personal schedule changes, or purchasing a course by mistake after viewing/downloading its contents.',
      },
      {
        label: 'Post-Download PDF & E-Book Unlocks',
        detail:
          'Any course, RRB PDF pack, BSPS/BSCA bundle, or E-Book once any PDF file, chapter note, or mock test inside the package has been opened or downloaded.',
      },
      {
        label: 'Promotional Discounts & Flash Sales',
        detail:
          'Price differences if a launch coupon, festive sale, or revised plan price is introduced after your purchase date.',
      },
      {
        label: 'Device Incompatibility or Local Internet Issues',
        detail:
          'Inability to use the platform due to ISP outages, corporate firewall blocks, or unsupported/outdated user hardware.',
      },
      {
        label: 'Account Suspension for Policy Violations',
        detail:
          'Accounts restricted or terminated due to credential sharing, Telegram/WhatsApp PDF piracy, or abusive conduct forfeit all remaining validity without refund.',
      },
    ],
  },
  {
    id: 'non-transferability',
    number: '05',
    title: 'Non-Transferability & Accidental Plan Selection',
    summary:
      'Explains account-binding rules and how to request an upgrade adjustment within 24 hours.',
    paragraphs: [
      'Purchased courses and PRO Pass plans are permanently bound to the registered email ID used during checkout and cannot be transferred or reassigned to another student’s account.',
      'However, if you accidentally purchased a shorter plan (e.g., 1-Month Pass instead of 6-Month PRO Pass) and contact us within 24 hours of payment before downloading paid PDFs, our support team may, at its discretion, assist you in upgrading by paying only the differential amount.',
    ],
  },
  {
    id: 'request-procedure',
    number: '06',
    title: 'How to Submit a Refund or Failed-Transaction Ticket',
    badge: 'Step-by-Step',
    summary:
      'Specifies the 7-day reporting window and exact transaction details required for fast verification.',
    paragraphs: [
      'Eligible billing or duplicate-debit claims must be submitted within seven (7) calendar days of the transaction date. Please include the following details so our billing desk can reconcile your Razorpay ledger immediately:',
    ],
    bullets: [
      {
        label: '1. Registered Account Email',
        detail: 'The exact email address signed in on BankingSolutions during checkout.',
      },
      {
        label: '2. Payment / UTR Reference ID',
        detail:
          'Your Razorpay Payment ID (e.g., `pay_...`), Order ID, Receipt Number (`BS-...`), or 12-digit UPI UTR number.',
      },
      {
        label: '3. Transaction Proof & Reason',
        detail:
          'A clear screenshot of the bank/UPI debit confirmation along with a brief description of the duplicate debit or technical error.',
      },
    ],
  },
  {
    id: 'settlement-timelines',
    number: '07',
    title: 'Verification & Bank Refund Settlement Timelines',
    badge: '5–7 Business Days',
    summary:
      'Sets clear processing SLAs from ticket approval to bank account credit.',
    paragraphs: [
      'Once we receive your complete billing ticket, our finance and technical team verifies gateway logs within 2 to 3 business days.',
      'Upon approval, the refund is initiated immediately via Razorpay strictly back to the original source of payment (the same UPI ID, Debit/Credit Card, NetBanking account, or Wallet used at checkout—never via cash or third-party bank transfers). Depending on your issuing bank’s settlement cycle, funds typically reflect in your account within 5 to 7 business days.',
    ],
  },
  {
    id: 'coupons-grants',
    number: '08',
    title: 'Promotional Coupons, Bundles & Complimentary Grants',
    summary:
      'Clarifies refund caps on discounted orders and zero-cash-value administrative grants.',
    paragraphs: [
      'Where an eligible refund applies to an order placed using a promotional coupon code (e.g., flat or percentage discount), the maximum refundable amount shall never exceed the actual net INR amount paid by you at checkout. Expired coupons are not re-issued upon refund.',
      'Scholarship passes, giveaway rewards, or administrative email grants unlocked at ₹0 carry no monetary or refundable cash value.',
    ],
  },
  {
    id: 'chargeback-policy',
    number: '09',
    title: 'Unwarranted Chargebacks & Dispute Resolution',
    summary:
      'Encourages direct resolution and outlines anti-fraud protections against post-download chargebacks.',
    paragraphs: [
      'If you notice an unfamiliar or failed debit, please contact BankingSolutions Support first—we resolve genuine gateway discrepancies far faster than bank dispute queues.',
    ],
    callout: {
      tone: 'rose',
      title: 'Fraudulent Chargeback Protection',
      body: 'Filing an unauthorized bank/card chargeback after unlocking courses, downloading BSPS/BSCA/E-Book PDFs, or attempting paid mock tests is treated as friendly fraud. In such cases, BankingSolutions immediately revokes account access and submits timestamped IP, session, receipt, and download audit logs to Razorpay and the acquiring bank.',
    },
  },
  {
    id: 'billing-support',
    number: '10',
    title: 'Billing Helpdesk & Grievance Escalation',
    badge: 'Support SLA',
    summary:
      'Provides official channels for instant payment verification and refund tracking.',
    paragraphs: [
      'Our student billing support team is committed to transparent, stress-free payment resolution so your exam preparation never loses momentum.',
    ],
    callout: {
      tone: 'emerald',
      title: 'Official Billing & Refund Support Desk',
      body: 'For duplicate debits, unactivated payments, or receipt assistance, message our verified support desk via Official Telegram (@Banking_Solutions) with your registered email and Razorpay Payment ID / UPI UTR. Tickets are acknowledged within 24–48 hours and resolved within 5–7 business days.',
    },
  },
];

export default function RefundPage() {
  return (
    <LegalDocumentLayout
      activePage="refund"
      headerSubtitle="Digital Fulfillment, Cancellations & Razorpay Refund SLAs"
      primaryBadge="💳 Billing & Refund Policy"
      complianceBadge="E-Commerce Rules, 2020 Aligned"
      title="Refund & Cancellation Policy"
      leadDescription={
        <>
          This Refund &amp; Cancellation Policy governs all paid enrollments, PRO Pass memberships,
          Real CBT test series, and downloadable PDF / E-Book purchases on{' '}
          <strong className="text-white">BankingSolutions</strong>. We maintain clear, fair rules
          that protect aspirants from duplicate debits or technical failures while safeguarding
          instant-delivery digital study materials.
        </>
      }
      highlights={REFUND_HIGHLIGHTS}
      searchPlaceholder="e.g., duplicate payment, UPI failed, 5-7 days, PRO Pass..."
      clauses={REFUND_CLAUSES}
    />
  );
}
