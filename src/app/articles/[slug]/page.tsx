import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  fetchArticleBySlugServerSide,
  fetchAllArticlesServerSide,
} from '@/lib/articles';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://bankingsolutions.in';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticleBySlugServerSide(slug);

  if (!article) {
    return {
      title: 'Banking Exam Notification, Dates & Cut-Offs | BankingSolutions',
      description:
        'Latest SBI PO, IBPS PO, IBPS Clerk, RRB PO & RBI exam notifications, exam dates, syllabus, and expected cut-off marks.',
    };
  }

  const canonicalUrl = `${SITE_URL}/articles/${article.slug}`;
  const keywordsArray = article.keywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  return {
    title: article.metaTitle || `${article.title} | BankingSolutions`,
    description: article.metaDescription || article.summary,
    keywords: keywordsArray,
    authors: [{ name: article.authorName || 'BankingSolutions' }],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: article.metaTitle || article.title,
      description: article.metaDescription || article.summary,
      url: canonicalUrl,
      siteName: 'BankingSolutions',
      type: 'article',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: article.imageUrl
        ? [{ url: article.imageUrl, alt: article.title }]
        : [{ url: '/channel-logo.png', alt: article.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.metaTitle || article.title,
      description: article.metaDescription || article.summary,
    },
  };
}

export default async function DedicatedSeoArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [article, allArticles] = await Promise.all([
    fetchArticleBySlugServerSide(slug),
    fetchAllArticlesServerSide(),
  ]);

  if (!article) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="text-4xl">📰</div>
        <h1 className="text-2xl font-black text-white">Exam Article Not Found</h1>
        <p className="text-xs text-slate-400 max-w-md">
          The exam guide or notification you are looking for may have been moved or updated.
        </p>
        <Link
          href="/articles"
          className="px-5 py-2.5 bg-amber-400 text-slate-950 font-black text-xs rounded-xl"
        >
          ← Browse All Exam Notifications &amp; Cut-Offs
        </Link>
      </div>
    );
  }

  const canonicalUrl = `${SITE_URL}/articles/${article.slug}`;
  const relatedArticles = allArticles
    .filter((a) => a.slug !== article.slug)
    .slice(0, 4);

  const wordCount = (article.markdownContent || '').split(/\s+/).length;
  const readingTimeMins = Math.max(2, Math.ceil(wordCount / 180));

  // 1. NewsArticle Schema.org JSON-LD
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.metaDescription || article.summary,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    author: {
      '@type': 'Person',
      name: article.authorName || 'Abhijeet Sir (BankingSolutions)',
    },
    publisher: {
      '@type': 'Organization',
      name: 'BankingSolutions',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/channel-logo.png`,
      },
    },
    image: article.imageUrl ? [article.imageUrl] : [`${SITE_URL}/channel-logo.png`],
  };

  // 2. BreadcrumbList Schema.org JSON-LD
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Exam Notifications & Cut-Offs',
        item: `${SITE_URL}/articles`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.title,
        item: canonicalUrl,
      },
    ],
  };

  // 3. FAQPage Schema.org JSON-LD (for Google Rich Snippets)
  const faqJsonLd =
    article.faqs && article.faqs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: article.faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: f.answer,
            },
          })),
        }
      : null;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      {/* Structured Data for Search Engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      {/* Ambient Top Glow */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[380px] bg-gradient-to-r from-amber-500/10 via-blue-600/10 to-emerald-500/10 blur-[140px] rounded-full z-0" />

      {/* Top Sticky Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-white/[0.08] px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-base shadow-lg">
              BS
            </div>
            <div>
              <span className="text-base sm:text-lg font-black text-white tracking-tight block leading-none">
                BankingSolutions
              </span>
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest block mt-1">
                Official Exam Guides &amp; Cut-Off Analysis
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            <Link
              href="/tests"
              className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow transition"
            >
              🚀 Attempt Mock Tests
            </Link>
            <Link
              href="/articles"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-200 font-bold text-xs rounded-xl transition"
            >
              ← All Exam Articles
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content + Sidebar */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT: SEMANTIC SEO ARTICLE */}
        <article className="lg:col-span-8 bg-slate-900/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-10 space-y-8 shadow-2xl">
          {/* Breadcrumb Navigation */}
          <nav
            aria-label="Breadcrumb"
            className="text-xs text-slate-400 flex flex-wrap items-center gap-2"
          >
            <Link href="/" className="hover:text-amber-400 transition">
              Home
            </Link>
            <span>›</span>
            <Link href="/articles" className="hover:text-amber-400 transition">
              Exam Notifications &amp; Cut-Offs
            </Link>
            <span>›</span>
            <span className="text-amber-300 font-semibold truncate max-w-xs">
              {article.examTag}
            </span>
          </nav>

          {/* Article Header & H1 */}
          <header className="space-y-4 border-b border-white/[0.08] pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                {article.examTag}
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold text-[10px] uppercase tracking-wider">
                {article.category.replace('_', ' ')}
              </span>
              <span className="text-xs text-slate-400 ml-auto">
                ⏱️ {readingTimeMins} min read
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
              {article.title}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {article.summary}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-400">
              <div>
                By <strong className="text-white">{article.authorName}</strong>
              </div>
              <time dateTime={article.updatedAt}>
                Last Updated:{' '}
                <strong className="text-emerald-400">
                  {new Date(article.updatedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>
              </time>
            </div>
          </header>

          {/* Optional Banner Image */}
          {article.imageUrl && (
            <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-slate-950">
              <img
                src={article.imageUrl}
                alt={article.title}
                className="w-full max-h-96 object-contain mx-auto"
              />
            </div>
          )}

          {/* Key Exam Highlights Summary Table */}
          {article.quickHighlights && article.quickHighlights.length > 0 && (
            <section
              aria-label="Exam Overview Highlights"
              className="bg-slate-950/90 border border-amber-400/30 rounded-2xl overflow-hidden shadow-lg"
            >
              <div className="bg-gradient-to-r from-amber-400/20 to-slate-900 px-5 py-3 border-b border-white/[0.08] flex items-center justify-between">
                <h2 className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wider">
                  📌 {article.examTag} — Quick Highlights &amp; Overview
                </h2>
              </div>
              <div className="divide-y divide-white/[0.06] text-xs sm:text-sm">
                {article.quickHighlights.map((hl, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-5 py-3 hover:bg-slate-900/50"
                  >
                    <span className="font-bold text-slate-400">{hl.label}</span>
                    <span className="sm:col-span-2 font-black text-white">
                      {hl.value}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Main Markdown Article Content */}
          <section className="prose prose-invert prose-amber max-w-none text-sm sm:text-base leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {article.markdownContent}
            </ReactMarkdown>
          </section>

          {/* Official Notification / Apply Online CTA */}
          {article.officialLink && (
            <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
                  Official Resource Link
                </span>
                <h3 className="text-sm font-black text-white">
                  Download Official Notification / Apply Online for {article.examTag}
                </h3>
              </div>
              <a
                href={article.officialLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shrink-0"
              >
                🔗 Open Official Link ↗
              </a>
            </div>
          )}

          {/* Frequently Asked Questions (Google FAQ Schema Section) */}
          {article.faqs && article.faqs.length > 0 && (
            <section className="space-y-4 pt-4 border-t border-white/[0.08]">
              <h2 className="text-xl font-black text-white">
                ❓ Frequently Asked Questions ({article.examTag})
              </h2>
              <div className="space-y-3">
                {article.faqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-5 space-y-2"
                  >
                    <h3 className="text-sm font-black text-amber-300">
                      Q{idx + 1}. {faq.question}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </article>

        {/* RIGHT SIDEBAR: STUDY RESOURCES & RELATED EXAM GUIDES */}
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
          {/* Mock Test & Preparation CTA Card */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-400/35 rounded-3xl p-6 space-y-4 shadow-xl">
            <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400 text-slate-950 px-2.5 py-1 rounded-full inline-block">
              🎯 Prepare for {article.examTag}
            </span>
            <h3 className="text-lg font-black text-white">
              Crack {article.examTag} with Real CBT Mock Tests
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Practice latest pattern Prelims &amp; Mains mocks, Daily Current Affairs Quizzes, and 30-Day Guided Study Targets.
            </p>
            <div className="space-y-2.5 pt-1">
              <Link
                href="/tests"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs text-center block shadow-lg"
              >
                🚀 Attempt Free &amp; Full Mock Tests →
              </Link>
              <Link
                href="/courses"
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/[0.08] text-slate-200 font-bold text-xs text-center block transition"
              >
                🎓 Explore Free &amp; Paid Courses →
              </Link>
              <Link
                href="/targets"
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/[0.08] text-emerald-300 font-bold text-xs text-center block transition"
              >
                📅 Follow 30-Day Daily Target Plan →
              </Link>
            </div>
          </div>

          {/* Related Exam Articles */}
          {relatedArticles.length > 0 && (
            <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-white/[0.08] pb-2.5">
                📰 More Banking Exam Guides
              </h3>
              <div className="space-y-3">
                {relatedArticles.map((rel) => (
                  <Link
                    key={rel.id}
                    href={`/articles/${rel.slug}`}
                    className="block p-3.5 rounded-2xl bg-slate-950/80 hover:bg-slate-800 border border-white/[0.06] transition space-y-1"
                  >
                    <span className="text-[10px] font-black text-amber-400 uppercase">
                      {rel.examTag}
                    </span>
                    <h4 className="text-xs font-bold text-white line-clamp-2">
                      {rel.title}
                    </h4>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

