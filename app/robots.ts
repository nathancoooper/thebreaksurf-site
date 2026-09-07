import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://thebreaksurf.co.uk';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/cart', '/success', '/cancel', '/construction'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
