import Link from 'next/link';
import MaintenanceToggle from '@/components/MaintenanceToggle';
import StockCheckToggle from '@/components/StockCheckToggle';
import StoreAnalytics from '@/components/admin/StoreAnalytics';
import { getAllPosts } from '@/lib/posts';
import { readData } from '@/lib/dataCache';

export const dynamic = 'force-dynamic';

async function getStats() {
  const [products, events, posts] = await Promise.all([
    readData<{ id: string }>('products'),
    readData<{ date: string; name: string }>('events'),
    getAllPosts(),
  ]);

  const now = new Date();
  const upcoming = events
    .filter(e => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    productCount: products.length,
    postCount: posts.length,
    upcomingCount: upcoming.length,
    nextEvent: upcoming[0] ?? null,
  };
}

export default async function AdminDashboard() {
  const stats = await getStats();

  const nextEventDate = stats.nextEvent
    ? new Date(stats.nextEvent.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mb-8 text-sm text-gray-400">Overview of your content</p>

      <div className="grid grid-cols-3 gap-4">

        {/* Products */}
        <Link href="/admin/products" className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Products</p>
          <p className="mt-3 text-5xl font-light text-gray-900">{stats.productCount}</p>
          <p className="mt-4 text-xs text-gray-400 group-hover:text-gray-600 transition-colors">Manage →</p>
        </Link>

        {/* Posts */}
        <Link href="/admin/writing" className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Articles</p>
          <p className="mt-3 text-5xl font-light text-gray-900">{stats.postCount}</p>
          <p className="mt-4 text-xs text-gray-400 group-hover:text-gray-600 transition-colors">Manage →</p>
        </Link>

        {/* Events */}
        <Link href="/admin/events" className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Upcoming events</p>
          <p className="mt-3 text-5xl font-light text-gray-900">{stats.upcomingCount}</p>
          {nextEventDate && (
            <p className="mt-2 text-xs text-gray-400">
              Next: {stats.nextEvent!.name} · {nextEventDate}
            </p>
          )}
          <p className="mt-3 text-xs text-gray-400 group-hover:text-gray-600 transition-colors">Manage →</p>
        </Link>

        {/* Store analytics */}
        <div className="col-span-3">
          <StoreAnalytics />
        </div>

        {/* Maintenance + stock-check toggles */}
        <div className="col-span-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MaintenanceToggle />
          <StockCheckToggle />
        </div>

      </div>
    </div>
  );
}
