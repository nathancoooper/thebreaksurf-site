'use client';

import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Logo from './Logo';

// Pages that open with a full-screen hero — navbar starts transparent here
const HERO_PATHS = ['/', '/environment', '/about', '/university'];

export default function Navbar({ categories = [] }: { categories?: string[] }) {
  const { itemCount } = useCart();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Navbar lives in the root layout, so it never unmounts between client-side
  // navigations — without `pathname` here, scrolling past 60px on one page
  // left `scrolled` stuck true forever, showing the opaque header at the top
  // of the next hero page too since nothing re-checked the new page's actual
  // scroll position.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);


  const isHeroPage = HERO_PATHS.includes(pathname);
  const isTransparent = isHeroPage && !scrolled;

  const iconColor = isTransparent ? 'text-cream' : 'text-charcoal';
  const textColor = isTransparent
    ? 'text-cream/90 hover:text-cream'
    : 'text-charcoal/80 hover:text-charcoal';

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isTransparent
            ? 'bg-transparent'
            : `border-b border-charcoal/10 bg-cream/95 backdrop-blur-sm ${isHeroPage && scrolled ? 'shadow-sm' : ''}`
        }`}
      >
        <div className="relative flex w-full items-center px-6 py-5">

          {/* Left: burger */}
          <div className="flex-1">
            <button
              type="button"
              onPointerDown={() => setMenuOpen(true)}
              aria-label="Open menu"
              className={`flex flex-col justify-center gap-[5px] p-3 transition-opacity duration-300 hover:opacity-60 ${iconColor} ${menuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
              <span className="block h-[2px] w-5 bg-current" />
              <span className="block h-[2px] w-5 bg-current" />
              <span className="block h-[2px] w-5 bg-current" />
            </button>
          </div>

          {/* Centre: logo */}
          <div className="absolute left-1/2 -translate-x-1/2">
            {pathname === '/university' ? (
              <div className="flex items-center gap-3">
                <Link href="/" aria-label="The Break Surf">
                  <Logo
                    className={`h-8 w-auto transition-colors duration-300 ${isTransparent ? 'text-cream' : 'text-charcoal/80'}`}
                  />
                </Link>
                <span className={`text-sm transition-colors duration-300 ${isTransparent ? 'text-cream/60' : 'text-charcoal/40'}`}>x</span>
                <div
                  role="img"
                  aria-label="Arts University Bournemouth"
                  className={`h-5 w-[6.5rem] transition-colors duration-300 ${isTransparent ? 'bg-cream' : 'bg-charcoal/80'}`}
                  style={{
                    WebkitMaskImage: 'url(/images/aub-logo-white.svg)',
                    maskImage: 'url(/images/aub-logo-white.svg)',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                  }}
                />
              </div>
            ) : (
              <Link href="/" aria-label="The Break Surf">
                <Logo
                  className={`h-10 w-auto transition-all duration-300 hover:scale-110 hover:rotate-6 ${isTransparent ? 'text-cream' : 'text-charcoal/80'}`}
                />
              </Link>
            )}
          </div>

          {/* Right: cart */}
          <div className="flex flex-1 justify-end">
            <Link
              href="/cart"
              className={`relative flex items-center gap-1.5 text-sm font-medium transition-colors ${textColor}`}
              aria-label={`Bag — ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {itemCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-terra text-[10px] font-bold text-cream">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Sidebar overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[60]"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        >
          <div className="absolute inset-0 bg-black/20" />
        </div>
      )}


      {/* Sidebar panel */}
      <aside
        className={`fixed left-0 top-0 z-[70] h-full w-full overflow-hidden bg-terra/60 backdrop-blur-[4px] transition-transform duration-300 ease-in-out lg:w-[26rem] ${
          menuOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
        }`}
        onClick={() => setMenuOpen(false)}
      >
        {/* Noise texture overlay — no filter so it stays clean */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
            opacity: 0.18,
            mixBlendMode: 'overlay',
          }}
        />

        {/* Inner content */}
        <div className="flex h-full w-full flex-col" onClick={e => e.stopPropagation()}>

          {/* Category tabs */}
          <div className="flex gap-3 overflow-x-auto px-6 pt-10 pb-6 scrollbar-none">
            {['All', ...categories].map(cat => (
              <Link
                key={cat}
                href={cat === 'All' ? '/products' : `/products?category=${cat}`}
                className="shrink-0 rounded-full border border-cream/40 px-4 py-1.5 text-xs font-medium text-cream/80 transition-colors hover:border-cream hover:text-cream"
              >
                {cat}
              </Link>
            ))}
          </div>

          {/* Main nav */}
          <nav className="flex flex-col px-6">
            {[
              { href: '/products', label: 'The Collection' },
              { href: '/writing', label: 'Writing & Posts' },
              { href: '/events', label: 'Upcoming Events' },
              { href: '/environment', label: 'Environment' },
              { href: '/about', label: 'About Us' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between border-b border-cream/20 py-4 text-base font-medium text-cream transition-colors hover:text-cream/70"
              >
                {label}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ))}
          </nav>

          {/* Footer links */}
          <div className="mt-auto flex flex-col gap-3 border-t border-cream/20 px-6 py-8">
            {[
              { href: '/returns', label: 'Returns & Exchanges' },
              { href: '/shipping', label: 'Shipping Policy' },
              { href: '/privacy', label: 'Privacy Policy' },
              { href: '/about#contact', label: 'Contact Us' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-xs text-cream/50 transition-colors hover:text-cream/80"
              >
                {label}
              </Link>
            ))}
          </div>

        </div>
      </aside>

      {/* Border line — high z-index sibling, unaffected by CA filter or backdrop blur */}
      <div
        className={`pointer-events-none fixed top-0 z-[9999] hidden h-full w-px transition-transform duration-300 ease-in-out lg:block ${
          menuOpen ? 'translate-x-0' : '-translate-x-[28rem]'
        }`}
        style={{ left: '26rem', background: 'rgba(242,237,227,0.5)' }}
      />
    </>
  );
}
