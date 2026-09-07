'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UploadProvider } from '@/components/admin/UploadManager';
import SettingsModal from '@/components/admin/SettingsModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPenNib,
  faShirt,
  faTag,
  faTags,
  faCalendarDays,
  faStar,
  faImage,
  faBoxOpen,
  faBook,
  faHandHoldingDollar,
  faChartLine,
  faWarehouse,
  faUsers,
  faAddressBook,
  faRightFromBracket,
  faGraduationCap,
  faTruck,
  faBuildingColumns,
  faBoxesStacked,
  faDiagramProject,
  faSwatchbook,
  faLayerGroup,
  faChartPie,
  faIndustry,
  faListUl,
  faUserShield,
  faFileInvoiceDollar,
  faGear,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';

// Exported so the Team management page can build its permission checklist
// from this exact same list, rather than keeping a second copy in sync.
export const NAV: { label: string; href: string; exact?: boolean; icon: IconDefinition; group?: string }[] = [
  { label: 'Products',   href: '/admin/products',   icon: faShirt,            group: 'Content' },
  { label: 'Promotions', href: '/admin/promotions', icon: faTag,              group: 'Content' },
  { label: 'Writing',    href: '/admin/writing',    icon: faPenNib,           group: 'Content' },
  { label: 'Events',     href: '/admin/events',     icon: faCalendarDays,     group: 'Content' },
  { label: 'Orders',     href: '/admin/orders',     icon: faBoxOpen,          group: 'Admin' },
  { label: 'Reviews',    href: '/admin/reviews',    icon: faStar,             group: 'Admin' },
  { label: 'University', href: '/admin/university', icon: faGraduationCap,    group: 'Admin' },
  { label: 'Heroes',     href: '/admin/heroes',     icon: faImage,            group: 'Admin' },
  { label: 'Meetings',   href: '/admin/meetings',   icon: faUsers,            group: 'Team' },
  { label: 'People',     href: '/admin/people',     icon: faAddressBook,      group: 'Team' },
  { label: 'Overview',         href: '/admin/finance-overview', icon: faBuildingColumns,   group: 'Finance' },
  { label: 'Receipts',         href: '/admin/receipts',         icon: faFileInvoiceDollar, group: 'Finance' },
  { label: 'Journal Entries',  href: '/admin/journal-entries',  icon: faBook,              group: 'Finance' },
  { label: 'Directors Loans',  href: '/admin/directors-loans',  icon: faHandHoldingDollar, group: 'Finance' },
  { label: 'Finance Report',   href: '/admin/finance-report',   icon: faChartLine,         group: 'Finance' },
  { label: 'Invoices',         href: '/admin/sales-orders',     icon: faFileInvoiceDollar, group: 'Finance' },
  { label: 'Projects',         href: '/admin/projects',         icon: faDiagramProject,    group: 'Finance' },
  { label: 'Overview',         href: '/admin/manufacturing',    icon: faIndustry,          group: 'Manufacturing' },
  { label: 'Stock',            href: '/admin/stock',            icon: faWarehouse,         group: 'Manufacturing' },
  { label: 'Tag Printer',      href: '/admin/tag-printer',      icon: faTags,              group: 'Manufacturing' },
  { label: 'Purchase Orders',  href: '/admin/purchase-orders',  icon: faTruck,             group: 'Manufacturing' },
  { label: 'BOMs',             href: '/admin/boms',             icon: faListUl,            group: 'Manufacturing' },
  { label: 'Items',            href: '/admin/items',            icon: faBoxesStacked,      group: 'Manufacturing' },
  { label: 'Categories',       href: '/admin/item-categories',  icon: faChartPie,          group: 'Manufacturing' },
  { label: 'Designs',          href: '/admin/designs',          icon: faSwatchbook,        group: 'Manufacturing' },
  { label: 'DTF Nesting',      href: '/admin/nesting',          icon: faLayerGroup,        group: 'Manufacturing' },
];

// Not part of NAV itself — always owner-only, never a toggleable permission.
const TEAM_ITEM = { label: 'Team', href: '/admin/team', icon: faUserShield, group: 'Team' };

export const GROUPS = ['Content', 'Admin', 'Team', 'Manufacturing'] as const;
export const PERMISSION_GROUPS = ['Content', 'Admin', 'Team', 'Finance', 'Manufacturing'] as const;

const AUTH_PATHS = ['/admin/login', '/admin/setup'];
const UTILITY_PATHS = ['/admin/storage', '/admin/settings', '/admin/backup'];

interface Me { role: 'owner' | 'member'; permissions: string[] }

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [navigationLocked, setNavigationLocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (AUTH_PATHS.includes(pathname)) return;
    fetch('/api/admin/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(setMe)
      .catch(() => setMe(null));
  }, [pathname]);

  useEffect(() => {
    const update = (event: Event) => {
      setNavigationLocked(Boolean((event as CustomEvent<{ locked?: boolean }>).detail?.locked));
    };
    window.addEventListener('tbs:navigation-lock', update);
    return () => window.removeEventListener('tbs:navigation-lock', update);
  }, []);

  // Non-owners only ever see the pages they've been granted — hides them
  // from the sidebar AND bounces away a direct link to something they
  // shouldn't see. This is nav/page-level only, not per-API-route
  // enforcement — a deliberate, smaller scope for a small trusted team.
  useEffect(() => {
    if (!me || me.role === 'owner' || AUTH_PATHS.includes(pathname)) return;
    const allowed = pathname === '/admin'
      || UTILITY_PATHS.some(path => pathname.startsWith(path))
      || me.permissions.some(p => pathname.startsWith(p));
    if (!allowed) {
      const firstAllowed = NAV.find(item => me.permissions.includes(item.href));
      router.replace(firstAllowed?.href ?? '/admin');
    }
  }, [me, pathname, router]);

  if (AUTH_PATHS.includes(pathname)) return <>{children}</>;

  const visibleNav = !me || me.role === 'owner' ? NAV : NAV.filter(item => me.permissions.includes(item.href));
  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  return (
    <UploadProvider>
    <div className="tbs-dark-surface flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className={`relative flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white transition-opacity ${navigationLocked ? 'pointer-events-none select-none opacity-35 grayscale' : ''}`}>
        <Link href="/admin" className="block shrink-0 px-6 py-5 hover:bg-gray-50 transition-colors">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            The Break Surf
          </p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900">Admin</p>
        </Link>

        <nav className="scrollbar-none fade-edges flex-1 overflow-y-auto px-3 py-1">
          {GROUPS.map(group => {
            const items = visibleNav.filter(item => item.group === group);
            const showTeam = group === 'Team' && me?.role === 'owner';
            if (items.length === 0 && !showTeam) return null;
            return (
              <div key={group} className="mb-4">
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  {group}
                </p>
                {items.map(item => {
                  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <FontAwesomeIcon icon={item.icon} className="w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
                {showTeam && (
                  <Link
                    href={TEAM_ITEM.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      pathname.startsWith(TEAM_ITEM.href)
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <FontAwesomeIcon icon={TEAM_ITEM.icon} className="w-4 shrink-0" />
                    {TEAM_ITEM.label}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-gray-100 px-3 py-2">
          <button
            onClick={() => setShowSettings(true)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <FontAwesomeIcon icon={faGear} className="w-4 shrink-0" />
            Settings
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="w-4 shrink-0" />
            Sign out
          </button>
        </div>
        {navigationLocked && <div className="absolute inset-0 cursor-not-allowed" aria-hidden="true" />}
      </aside>

      {/* Content — overflow-auto so most pages scroll; canvas pages use h-screen internally */}
      <main className="flex-1 overflow-auto min-h-0">{children}</main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
    </UploadProvider>
  );
}
