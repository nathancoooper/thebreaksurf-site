import Link from 'next/link';
import Image from 'next/image';
import { getHero } from '@/lib/heroes';

export const metadata = {
  title: 'Environment | The Break Surf',
  description:
    'How we think about our environmental impact — from organic cotton and recycled polyester to monthly community litter picks.',
};

const PILLARS = [
  {
    label: 'Organic cotton',
    heading: 'Cotton grown without compromise',
    body: [
      'Conventional cotton is one of the most chemically intensive crops on earth — responsible for a disproportionate share of the world\'s pesticide and insecticide use. Every piece of cotton we use is GOTS-certified organic, grown without synthetic chemicals and processed in mills that meet the same standard.',
      'Organic cotton costs more to produce. That cost is reflected in our prices, not absorbed into our margins. We think that\'s the honest way to do it.',
    ],
  },
  {
    label: 'Recycled polyester',
    heading: 'Giving plastic a second life',
    body: [
      'For technical mid-layers and performance fabrics, there\'s currently no natural-fibre alternative that performs the same way. When we do use synthetic fibres, we intend to use bluesign-certified recycled polyester made from post-consumer PET bottles.',
      'We\'re still in the testing phase with recycled polyester products — nothing using it is in the range yet. We\'re including it here because we think it\'s important to be transparent about where we\'re headed, not just where we are.',
    ],
  },
  {
    label: 'Community litter picks',
    heading: 'Showing up for the places we love',
    body: [
      'We run a community litter pick on the first Saturday of every month. We take a group out to local trails, nature reserves, and waterways, spend a couple of hours cleaning up, and usually find at least one inexplicable shopping trolley.',
      'These aren\'t a marketing exercise. They\'re just the most direct thing we can do for the places that inspired the brand. Anyone can come — follow our Instagram for details, or drop us a message if you want to get involved.',
    ],
  },
  {
    label: 'How we run this website',
    heading: 'Lightweight infrastructure, no big cloud',
    body: [
      'This website runs on repurposed hardware — a Raspberry Pi sitting in a cupboard, not a data centre. We reuse existing devices rather than spinning up new cloud servers, which keeps our digital footprint small and our hosting costs at zero.',
      'Our emails are handled by Tuta, a privacy-first provider powered by 100% renewable energy. Based in Germany and certified carbon neutral, they\'re one of the few email providers genuinely committed to sustainable infrastructure — not just buying offsets.',
    ],
  },
];

export default async function EnvironmentPage() {
  const hero = (await getHero('environment'))!;
  return (
    <>
      {/* ── Full-screen hero ──────────────────────────────────
          Drop your photo at /public/images/environment-hero.jpg  */}
      <section className="relative h-screen w-full overflow-hidden">
        <Image
          src={hero.image}
          alt="The outdoors we're working to protect"
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

      {/* ── Intro ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <p className="font-display text-2xl font-medium leading-relaxed text-charcoal">
          We&apos;re a small clothing brand making things by hand. We don&apos;t have the scale to
          solve the fashion industry&apos;s environmental problems. But we can be honest about
          ours, and do what we can about them.
        </p>
        <p className="mt-6 text-sm leading-relaxed text-charcoal/60">
          This page is where we explain what we actually do — not what we aspire to do, and not
          marketing language dressed up as environmental policy. If something isn&apos;t good
          enough yet, we&apos;ll say so.
        </p>
      </section>

      {/* ── Pillars ───────────────────────────────────────── */}
      <section className="border-t border-charcoal/10">
        {PILLARS.map(({ label, heading, body }, i) => (
          <div
            key={label}
            className={`border-b border-charcoal/10 ${i % 2 === 1 ? 'bg-moss/5' : ''}`}
          >
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-16 lg:grid-cols-3">
              {/* Label + heading */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-terra">
                  {label}
                </p>
                <h2 className="font-display text-2xl font-medium text-charcoal">{heading}</h2>
              </div>
              {/* Body copy */}
              <div className="space-y-4 lg:col-span-2">
                {body.map((para, j) => (
                  <p key={j} className="text-sm leading-relaxed text-charcoal/70">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ── Litter pick CTA ───────────────────────────────── */}
      <section className="bg-forest px-6 py-20 text-cream">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-medium text-cream">
            Come to the next litter pick
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-cream/70">
            First Saturday of every month. Bring gloves, wear something you don&apos;t mind
            getting muddy, and we&apos;ll sort the rest. All welcome.
          </p>
          <Link
            href="/writing/first-community-litter-pick"
            className="mt-8 inline-block rounded-sm border border-cream/30 px-8 py-3.5 text-sm font-medium text-cream transition-all hover:border-sage/70 hover:bg-sage/25"
          >
            Read about the first one →
          </Link>
        </div>
      </section>
    </>
  );
}
