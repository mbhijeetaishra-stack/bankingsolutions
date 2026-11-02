import type { MetadataRoute } from 'next';
import { fetchAllArticlesServerSide } from '@/lib/articles';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://bankingsolutions.in';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await fetchAllArticlesServerSide();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/articles`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/tests`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/courses`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/updates`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/critical-reasoning`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/computer-awareness`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/rrb-pdf-course`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/targets`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/calc-lab`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.75,
    },
    {
      url: `${SITE_URL}/word-matrix`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/ca-raid`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.85,
    },
  ];

  const articleRoutes: MetadataRoute.Sitemap = articles.map((art) => ({
    url: `${SITE_URL}/articles/${art.slug}`,
    lastModified: new Date(art.updatedAt || art.publishedAt),
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  return [...staticRoutes, ...articleRoutes];
}

