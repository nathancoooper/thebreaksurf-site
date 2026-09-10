import Image from 'next/image';
import { getHero } from '@/lib/heroes';
import { readData } from '@/lib/dataCache';
import type { Product } from '@/types';
import UniversityDropoffForm from '@/components/UniversityDropoffForm';
import UniversityShopSection from '@/components/UniversityShopSection';

export const metadata = {
  title: 'The Break x AUB',
  description: 'Drop your garment off at university reception and we\'ll embroider the university logo on for you.',
};

const STEPS = [
  {
    heading: '1. Drop off',
    body: 'Bring your garment to reception any time during the week and fill in the form below with your details.',
  },
  {
    heading: '2. We collect',
    body: 'At the end of the week, we collect every garment dropped off and take them back to our workshop.',
  },
  {
    heading: '3. We embroider',
    body: 'We embroider the university logo on in the placement and thread colour you chose.',
  },
  {
    heading: '4. You collect',
    body: 'Once it\'s done, your garment is returned to reception ready for you to pick up.',
  },
];

export default async function UniversityPage() {
  const hero = (await getHero('university'))!;
  const allProducts = await readData<Product>('products');
  const uniProducts = allProducts.filter(p => p.category === 'University');
  return (
    <>
      {/* Hero */}
      <section className="relative h-screen w-full overflow-hidden">
        <Image
          src={hero.image}
          alt="University embroidery collaboration"
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
            <h1 className="text-5xl font-bold leading-tight tracking-tight text-cream sm:text-7xl">
              {hero.heading}
            </h1>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={hero.buttonHref}
                className="inline-block rounded-sm border border-cream/30 px-8 py-3.5 text-sm font-medium text-cream transition-all hover:border-cream/70 hover:bg-cream/10"
              >
                {hero.buttonText}
              </a>
              <a
                href="#uni-shop"
                className="inline-block rounded-sm bg-cream px-8 py-3.5 text-sm font-medium text-charcoal transition-all hover:bg-cream/90"
              >
                Shop pre-made
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-charcoal/40">Collaboration</p>
        <p className="text-2xl font-bold tracking-tight leading-relaxed text-charcoal">
          We&rsquo;ve teamed up with the university to embroider your own garments with the university logo.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-charcoal/60">
          Drop your garment off at reception, tell us where you&rsquo;d like the logo and in what colour,
          and we&rsquo;ll take care of the rest.
        </p>
      </section>

      {/* How it works */}
      <section className="border-y border-charcoal/10 bg-moss/5">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ heading, body }) => (
            <div key={heading}>
              <h2 className="text-lg font-bold tracking-tight text-charcoal">{heading}</h2>
              <p className="mt-2 text-sm leading-relaxed text-charcoal/70">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Form + receipt */}
      <section id="dropoff-form" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-charcoal">Tell us about your garment</h2>
          <p className="mt-2 text-sm text-charcoal/60">
            Fill this in when you drop your garment off at reception — one form per garment, please.
          </p>
        </div>
        <UniversityDropoffForm />
      </section>

      {/* Shop */}
      <UniversityShopSection products={uniProducts} />

      {/* Societies & sports */}
      <section className="border-y border-charcoal/10 bg-moss/5">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-charcoal/40">Societies &amp; Sports</p>
          <h2 className="text-3xl font-bold tracking-tight text-charcoal">
            Made for AUB. By AUB Students.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-charcoal/60">
            Last year, we supplied over 100 shirts, hoodies, and totes to societies across the university.
            Every piece was <strong>printed by hand in our flat by students</strong>. What started as a
            small side project has grown into clothing for societies, sports teams, and student groups across AUB.
          </p>
          <a
            href="mailto:nathan@thebreaksurf.co.uk"
            className="mt-8 inline-block rounded-sm border border-charcoal/20 px-8 py-3.5 text-sm font-medium text-charcoal transition-all hover:border-charcoal/50 hover:bg-charcoal/5"
          >
            Get in touch
          </a>
        </div>
      </section>

      {/* Contact */}
      <section className="border-t border-charcoal/10 px-6 py-16 text-center">
        <p className="text-sm text-charcoal/60">
          Questions about the collaboration? Email{' '}
          <a href="mailto:nathan@thebreaksurf.co.uk" className="underline underline-offset-4 hover:text-charcoal">
            nathan@thebreaksurf.co.uk
          </a>.
        </p>
      </section>
    </>
  );
}
