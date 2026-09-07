import type { MetadataRoute } from 'next';
import { readData } from '@/lib/dataCache';
import { getAllPosts } from '@/lib/posts';
import type { Product } from '@/types';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://thebreaksurf.co.uk';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/environment`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/events`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/writing`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/returns`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/shipping`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const products = (await readData<Product>('products')).map(p => ({
    url: `${SITE_URL}/products/${p.id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const posts = (await getAllPosts()).map(p => ({
    url: `${SITE_URL}/writing/${p.slug}`,
    lastModified: p.date,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...products, ...posts];
}
