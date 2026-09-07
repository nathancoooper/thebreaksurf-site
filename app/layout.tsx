import type { Metadata } from 'next';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://thebreaksurf.co.uk';
const SITE_DESCRIPTION = 'Outdoor clothing for the creative community. Made for the trail, worn by those who make things.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'The Break Surf',
  description: SITE_DESCRIPTION,
  openGraph: {
    title: 'The Break Surf',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: 'The Break Surf',
    images: [{ url: '/images/hero.jpg', width: 1200, height: 630 }],
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Break Surf',
    description: SITE_DESCRIPTION,
    images: ['/images/hero.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=localStorage.getItem('tbs-theme-preference');p=p==='light'||p==='dark'?p:'system';var r=p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':p==='system'?'light':p;document.documentElement.dataset.tbsTheme=p;document.documentElement.dataset.tbsThemeResolved=r}catch(e){}})()` }} />
        <link rel="me" href="https://mastodon.social/@thebreaksurf" />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
