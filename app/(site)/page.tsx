import Link from 'next/link';
import Image from 'next/image';
import ProductCard from '@/components/ProductCard';
import { Product, Event } from '@/types';
import { getHero } from '@/lib/heroes';
import { readData } from '@/lib/dataCache';
import { getAllPosts } from '@/lib/posts';
import { getDiscountMap } from '@/lib/promotions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTree, faWind, faInfinity } from '@fortawesome/free-solid-svg-icons';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const allProductsList = await readData<Product>('products');
  const postsData = await getAllPosts();
  const eventsData = await readData<Event>('events');

  const featuredProducts = allProductsList.filter(p => p.featured);
  const featuredIds = new Set(featuredProducts.map(p => p.id));
  const extras = allProductsList
    .filter(p => !featuredIds.has(p.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.max(0, 4 - featuredProducts.length));
  const featured = [...featuredProducts, ...extras].slice(0, 4);
  const discounts = await getDiscountMap(featured.map(p => p.id));
  const latestPosts = [...postsData]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);
  const latestEvent = eventsData
    .filter(e => e.cover)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null;

  const hero = (await getHero('home'))!;
  return (
    <>
      <section className="relative h-screen w-full overflow-hidden">
        <Image
          src={hero.image}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-forest" />
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50" />
        <div className="absolute bottom-14 left-0 right-0 px-6">
          <div className="mx-auto max-w-6xl">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-cream/60">
              {hero.label}
            </p>
            <h1 className="font-display text-5xl font-medium leading-tight text-cream sm:text-7xl">
              {hero.heading}
            </h1>
            <div className="mt-8">
              <Link
                href={hero.buttonHref}
                className="inline-block rounded-sm border border-cream/30 px-8 py-3.5 text-sm font-medium text-cream transition-all hover:border-cream/70 hover:bg-cream/10"
              >
                {hero.buttonText}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured products ─────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-terra">
              Featured
            </p>
            <h2 className="font-display text-3xl font-medium text-charcoal">The essentials</h2>
          </div>
          <Link
            href="/products"
            className="hidden text-sm font-medium text-charcoal/60 underline underline-offset-4 hover:text-charcoal sm:block"
          >
            View all
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
          {featured.map(product => (
            <ProductCard key={product.id} product={product} discountPercent={discounts[product.id] ?? 0} />
          ))}
        </div>

        <div className="mt-10 text-center sm:hidden">
          <Link
            href="/products"
            className="text-sm font-medium text-charcoal/60 underline underline-offset-4 hover:text-charcoal"
          >
            View all products
          </Link>
        </div>
      </section>

      {/* ── Latest event ──────────────────────────────────── */}
      {latestEvent && (
        <section className="relative h-[70vh] w-full overflow-hidden">
          <Image
            src={latestEvent.cover}
            alt={latestEvent.name}
            fill
            sizes="100vw"
            className="object-cover scale-105" style={{ filter: 'blur(3px)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-14">
            <div className="mx-auto max-w-6xl">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-cream/60">
                Latest event
              </p>
              <h2 className="font-display text-4xl font-medium text-cream sm:text-5xl">
                {latestEvent.name}
              </h2>
              {latestEvent.location && (
                <p className="mt-2 text-sm text-cream/60">{latestEvent.location}</p>
              )}
              {latestEvent.description && (
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-cream/75">
                  {latestEvent.description}
                </p>
              )}
              <Link
                href="/events"
                className="mt-6 inline-block rounded-sm border border-cream/30 px-7 py-3 text-sm font-medium text-cream transition-all hover:border-cream/70 hover:bg-cream/10"
              >
                See all events
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Latest stories ────────────────────────────────── */}
      {latestPosts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-widest text-terra">From the journal</p>
              <h2 className="font-display text-3xl font-medium text-charcoal">Latest stories</h2>
            </div>
            <Link href="/writing" className="hidden text-sm font-medium text-charcoal/60 underline underline-offset-4 hover:text-charcoal sm:block">
              All posts
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {latestPosts.map(post => (
              <Link key={post.slug} href={`/writing/${post.slug}`} className="group flex h-full flex-col">
                <div className="flex h-full flex-col overflow-hidden rounded-sm bg-sage/10">
                  <div className="relative aspect-[16/9] overflow-hidden bg-sage/20 shrink-0">
                    {post.image && (
                      <Image
                        src={post.image}
                        alt={post.title}
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col px-4 pb-5 pt-4">
                    <p className="text-[11px] font-medium uppercase tracking-widest text-charcoal/40">
                      {new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <h3 className="mt-1.5 line-clamp-2 font-display text-lg font-medium text-charcoal transition-colors group-hover:text-terra">
                      {post.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-charcoal/60 line-clamp-2">{post.excerpt}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Link href="/writing" className="text-sm font-medium text-charcoal/60 underline underline-offset-4 hover:text-charcoal">
              All posts
            </Link>
          </div>
        </section>
      )}

      {/* ── Story section ─────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-8">

        {/* Overline */}
        <p className="mb-12 text-xs font-medium uppercase tracking-[0.25em] text-charcoal/40">
          Who we are
        </p>

        {/* Unified grid: 2 cols on mobile (thin images pair up), 3 cols on desktop
            (col-span-2/1 reproduces the original 2fr/1fr and 1fr/2fr ratios exactly) */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:grid-rows-3">

          {/* Big image */}
          <div className="relative col-span-2 overflow-hidden rounded-sm bg-sage/20 lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-1" style={{ minHeight: '520px' }}>
            <Image
              src="/images/uploads/misc/1783349362583-hf5jwd.webp"
              alt=""
              fill
              sizes="(min-width: 1024px) 66vw, 100vw"
              className="object-cover"
            />
          </div>

          {/* Text panel */}
          <div className="col-span-2 flex flex-col justify-center rounded-sm bg-forest px-8 py-10 lg:col-span-1 lg:col-start-3 lg:row-start-1">
            <h2 className="font-display text-2xl font-medium leading-snug text-cream">
              Small batch.<br />Made to be worn.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-cream/70">
              We make things in small runs, by hand, in the UK. No excess stock, no cutting corners. Each piece is built around how people actually move — on the trail, at the coast, between the two.
            </p>
            <Link
              href="/about"
              className="mt-6 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-cream/60 transition-colors hover:text-cream"
            >
              Our story
              <span>→</span>
            </Link>
          </div>

          {/* Second image — sits side-by-side with the third image on mobile */}
          <div className="relative overflow-hidden rounded-sm bg-sage/20 lg:col-start-3 lg:row-start-2" style={{ minHeight: '220px' }}>
            <Image
              src="/images/uploads/misc/1783370013292-5grv6i.webp"
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, 50vw"
              className="object-cover"
            />
          </div>

          {/* Third image */}
          <div className="relative overflow-hidden rounded-sm bg-sage/20 lg:col-start-1 lg:row-start-3" style={{ minHeight: '220px' }}>
            <Image
              src="/images/uploads/misc/1783349378858-06jm4g.webp"
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, 50vw"
              className="object-cover"
            />
          </div>

          {/* Pull quote */}
          <div className="col-span-2 flex flex-col justify-center rounded-sm bg-terra/8 px-10 py-10 lg:col-span-2 lg:col-start-2 lg:row-start-3">
            <blockquote className="font-display text-xl font-medium leading-relaxed text-charcoal lg:text-2xl">
              "We'd rather make one thing right than ten things quickly."
            </blockquote>
            <p className="mt-4 text-sm text-charcoal/50">
              Every run starts with a problem we've had ourselves — gear that looks good but falls apart, or works well but feels clinical. We try to thread the needle between the two.
            </p>
          </div>
        </div>

      </section>

      {/* ── Ethos strip ───────────────────────────────────── */}
      <section className="bg-forest px-6 py-24 text-cream">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-3">
            {[
              {
                heading: 'Made properly',
                body: 'We work with quality blanks and apply screen-printing, DTF, and embroidery to make them our own. Small batches, deliberate choices, and details that earn their place.',
                icon: faTree,
              },
              {
                heading: 'Built for movement',
                body: 'Technical fabrics, articulated patterning, and functional details that earn their place.',
                icon: faWind,
              },
              {
                heading: 'Designed to last',
                body: "We'd rather you buy one piece that lasts five years than five that fall apart after one season.",
                icon: faInfinity,
              },
            ].map(({ heading, body, icon }, i) => (
              <div key={heading} className={i !== 0 ? 'border-t border-cream/20 pt-12 sm:border-l sm:border-t-0 sm:pl-12 sm:pt-0' : ''}>
                <div className="mb-4 text-cream/50">
                  <FontAwesomeIcon icon={icon} style={{ width: 24, height: 24 }} />
                </div>
                <h3 className="font-display text-2xl font-medium text-cream">{heading}</h3>
                <p className="mt-3 text-sm leading-relaxed text-cream/60">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
