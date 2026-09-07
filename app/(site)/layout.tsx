import { CartProvider } from '@/contexts/CartContext';
import Navbar from '@/components/Navbar';
import MainWrapper from '@/components/MainWrapper';
import ScrollToTop from '@/components/ScrollToTop';
import HitTracker from '@/components/HitTracker';
import NavHistoryTracker from '@/components/NavHistoryTracker';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import Footer from '@/components/Footer';
import { readData } from '@/lib/dataCache';

export const dynamic = 'force-dynamic';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const productsData = await readData<{ category?: string }>('products');
  const categories = [...new Set(productsData.map(p => p.category).filter(Boolean))] as string[];

  return (
    <CartProvider>
      <MaintenanceBanner />
      <HitTracker />
      <ScrollToTop />
      <NavHistoryTracker />
      <Navbar categories={categories} />
      <MainWrapper>{children}</MainWrapper>
      <Footer />
    </CartProvider>
  );
}
