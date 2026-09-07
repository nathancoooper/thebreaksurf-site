import FooterLink from './FooterLink';
import FooterLogo from './FooterLogo';
import FooterStats from './FooterStats';
import HeartCursor, { HeartColorZone } from './HeartCursor';

const EXPLORE = [
  { label: 'Shop', href: '/products' },
  { label: 'Events', href: '/events' },
  { label: 'Journal', href: '/writing' },
  { label: 'Environment', href: '/environment' },
];

const INFO = [
  { label: 'About', href: '/about' },
  { label: 'Shipping', href: '/shipping' },
  { label: 'Returns', href: '/returns' },
  { label: 'Privacy', href: '/privacy' },
];

const CONNECT = [
  { label: 'Instagram', href: 'https://www.instagram.com/thebreaksurf', external: true },
  { label: 'TikTok', href: 'https://www.tiktok.com/@thebreaksurf', external: true },
  { label: 'Email', href: 'mailto:nathan@thebreaksurf.co.uk' },
];

export default function Footer() {
  return (
    <footer className="border-t border-charcoal/10 bg-cream">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-[220px] shrink-0">
            <FooterLogo />
            <p className="mt-4 text-xs leading-relaxed text-charcoal/50">
              Outdoor clothing for the creative community. Made for the trail, worn by those who make things.
            </p>
            <div className="mt-3">
              <FooterLink href="mailto:nathan@thebreaksurf.co.uk">nathan@thebreaksurf.co.uk</FooterLink>
            </div>
          </div>

          <div className="flex gap-8 sm:gap-16">
            <div>
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-charcoal/40">Explore</p>
              <ul className="space-y-2.5">
                {EXPLORE.map(l => (
                  <li key={l.href}>
                    <FooterLink href={l.href}>{l.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-charcoal/40">Info</p>
              <ul className="space-y-2.5">
                {INFO.map(l => (
                  <li key={l.href}>
                    <FooterLink href={l.href}>{l.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-charcoal/40">Connect</p>
              <ul className="space-y-2.5">
                {CONNECT.map(l => (
                  <li key={l.href}>
                    <FooterLink href={l.href} external={l.external}>{l.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-charcoal/10">
        <HeartCursor>
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <FooterStats />
            <p className="text-xs text-charcoal/40">
              <HeartColorZone>
                © {new Date().getFullYear()} The Break Surf
              </HeartColorZone>
            </p>
          </div>
        </HeartCursor>
      </div>
    </footer>
  );
}
