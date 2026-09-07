import Link from 'next/link';

export const metadata = {
  title: 'Shipping | The Break Surf',
  description: 'Shipping information for The Break Surf orders.',
};

const SECTIONS = [
  {
    heading: 'Where we ship',
    body: [
      'We currently ship to addresses in the United Kingdom. If you\'re based outside the UK and want to order, get in touch at nathan@thebreaksurf.co.uk and we\'ll see what we can do.',
    ],
  },
  {
    heading: 'Processing time',
    body: [
      'Because we make in small batches, most items ship within 3–5 working days of your order being placed. If an item is made to order or there\'s a longer lead time, we\'ll tell you clearly on the product page.',
      'You\'ll receive a confirmation email when your order ships, with tracking information where available.',
    ],
  },
  {
    heading: 'Delivery options',
    body: [
      'Standard UK delivery: 2–3 working days after dispatch. Free on orders over £50.',
      'Exact costs are shown at checkout before you pay.',
    ],
  },
  {
    heading: 'Tracked shipping',
    body: [
      'All orders are sent with tracking. You\'ll get a tracking number by email once your order has been dispatched. If your tracking hasn\'t updated after 5 working days, contact us and we\'ll look into it.',
    ],
  },
  {
    heading: 'Delays',
    body: [
      'We can\'t guarantee delivery dates, especially during busy periods like Christmas. If your order is time-sensitive, please get in touch before ordering and we\'ll let you know if we can meet your deadline.',
      'Once an order is with the carrier, delays are outside our control — but we\'ll always do what we can to help.',
    ],
  },
  {
    heading: 'Missing or damaged deliveries',
    body: [
      'If your order arrives damaged or doesn\'t arrive at all, email us at nathan@thebreaksurf.co.uk with your order number. We\'ll investigate and replace or refund as appropriate.',
    ],
  },
];

export default function ShippingPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-charcoal/40">Policy</p>
      <h1 className="font-display text-4xl font-medium text-charcoal">Shipping</h1>
      <p className="mt-4 text-sm text-charcoal/50">Last updated June 2026</p>

      <div className="mt-14 space-y-12">
        {SECTIONS.map(({ heading, body }) => (
          <div key={heading}>
            <h2 className="font-display text-xl font-medium text-charcoal">{heading}</h2>
            <div className="mt-4 space-y-3">
              {body.map((para, i) => (
                <p key={i} className="text-sm leading-relaxed text-charcoal/70">{para}</p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 border-t border-charcoal/10 pt-10">
        <p className="text-sm text-charcoal/60">
          Questions about your order? Email{' '}
          <a href="mailto:nathan@thebreaksurf.co.uk" className="underline underline-offset-4 hover:text-charcoal">
            nathan@thebreaksurf.co.uk
          </a>{' '}
          or see our{' '}
          <Link href="/returns" className="underline underline-offset-4 hover:text-charcoal">
            returns policy
          </Link>.
        </p>
      </div>
    </div>
  );
}
