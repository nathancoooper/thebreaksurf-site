import Link from 'next/link';
import Image from 'next/image';
import { getHero } from '@/lib/heroes';

export const metadata = {
  title: 'About | The Break Surf',
  description:
    'The Break Surf is a small independent clothing brand made by hand in the UK. This is our story.',
};

const VALUES = [
  {
    label: 'Small by choice',
    heading: 'We make in batches, not bulk',
    body: [
      'We work with quality blanks and use screen-printing, DTF, and embroidery to make them our own. We keep our runs small because small means we can pay attention — to the print, to the placement, to whether the thing we made is actually worth making.',
      "We're not trying to scale this into something else. The size is part of the point.",
    ],
  },
  {
    label: 'Collaborative',
    heading: 'Made with people we admire',
    body: [
      "We don't design in isolation. The Staple Tee came from a conversation with local artist Amy Ryalls. The New Heights Hoodie came from working with Japanese illustrator Youki. We think the best things come from people who care about different things figuring out how to make something together.",
      'If you make things and want to talk, get in touch.',
    ],
  },
  {
    label: 'Honest',
    heading: 'We say what things cost and why',
    body: [
      "Our prices reflect what it actually costs to make something properly — organic cotton, quality blanks, small-batch decoration. We don't inflate margins or manufacture scarcity. What you pay is what it takes.",
      "We're also honest about what we don't do yet. We're a young brand. There are things we want to improve. We'll say so rather than pretend otherwise.",
    ],
  },
];

export default async function AboutPage() {
  const hero = (await getHero('about'))!;
  return (
    <>
      {/* Hero */}
      <section className="relative h-screen w-full overflow-hidden">
        <Image
          src={hero.image}
          alt="The Break Surf"
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

      {/* Intro */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <p className="font-display text-2xl font-medium leading-relaxed text-charcoal">
          The Break Surf started the way most good things do — a group of friends, a shared obsession
          with the outdoors, and a feeling that the clothing out there didn&apos;t quite reflect the
          life they were living.
        </p>
        <p className="mt-6 text-sm leading-relaxed text-charcoal/60">
          We&apos;re a small independent brand based in the UK. We make clothing in small
          batches, using quality blanks and organic materials. We collaborate with independent artists. We run community
          litter picks. We&apos;re students who started something and are figuring it out as we go —
          honestly, carefully, and with a lot of enthusiasm for the places that inspired us to start.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/products"
            className="rounded-sm border border-terra/40 px-6 py-3 text-sm font-medium text-charcoal transition-all hover:border-terra/60 hover:bg-terra/10 hover:text-terra"
          >
            Shop the collection
          </Link>
          <Link
            href="/environment"
            className="rounded-sm border border-forest/30 px-6 py-3 text-sm font-medium text-charcoal transition-all hover:border-forest/50 hover:bg-forest/10 hover:text-forest"
          >
            Our environmental commitment
          </Link>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-charcoal/10">
        {VALUES.map(({ label, heading, body }, i) => (
          <div
            key={label}
            className={`border-b border-charcoal/10 ${i % 2 === 1 ? 'bg-moss/5' : ''}`}
          >
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-16 lg:grid-cols-3">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-terra">
                  {label}
                </p>
                <h2 className="font-display text-2xl font-medium text-charcoal">{heading}</h2>
              </div>
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

      {/* Contact */}
      <section id="contact" className="bg-forest px-6 py-24 text-cream">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">

            {/* Left — heading + copy */}
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-cream/50">
                Get in touch
              </p>
              <h2 className="font-display text-4xl font-medium leading-tight text-cream">
                We&apos;d love to<br />hear from you.
              </h2>
              <p className="mt-5 text-sm leading-relaxed text-cream/70">
                Whether it&apos;s a question about an order, a collaboration idea, or you just want
                to come to a litter pick — drop us a message. We&apos;re a small team and we read
                everything ourselves.
              </p>
            </div>

            {/* Right — contact options */}
            <div className="flex flex-col justify-center gap-6">
              <a
                href="mailto:nathan@thebreaksurf.co.uk"
                className="group flex items-center gap-5 border-b border-cream/20 pb-6 transition-colors hover:border-cream/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream/20 transition-colors group-hover:border-cream/50">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-cream/70">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-cream/50">Email</p>
                  <p className="mt-0.5 text-sm font-medium text-cream group-hover:underline group-hover:underline-offset-4">
                    nathan@thebreaksurf.co.uk
                  </p>
                </div>
              </a>

              <a
                href="https://instagram.com/thebreaksurf"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-5 border-b border-cream/20 pb-6 transition-colors hover:border-cream/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream/20 transition-colors group-hover:border-cream/50">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-cream/70">
                    <rect x="2" y="2" width="20" height="20" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-cream/50">Instagram</p>
                  <p className="mt-0.5 text-sm font-medium text-cream group-hover:underline group-hover:underline-offset-4">
                    @thebreaksurf
                  </p>
                </div>
              </a>

              <div className="flex items-center gap-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream/20">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-cream/70">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-cream/50">Based in</p>
                  <p className="mt-0.5 text-sm font-medium text-cream">South Coast, Bournemouth</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </>
  );
}
