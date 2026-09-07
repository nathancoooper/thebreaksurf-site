import Link from 'next/link';

export const metadata = {
  title: 'Returns & Exchanges | The Break Surf',
  description: 'Our returns and exchanges policy.',
};

const SECTIONS = [
  {
    heading: 'Returns',
    body: [
      'We want you to be happy with what you buy from us. If something isn\'t right, we\'ll sort it.',
      'You have 30 days from the date of delivery to return an item for a full refund. Items must be unworn, unwashed, and in their original condition with tags attached. We can\'t accept returns on items that have been worn or washed.',
      'To start a return, email us at nathan@thebreaksurf.co.uk with your order number and the reason for the return. We\'ll reply within 2 working days with instructions.',
      'Return postage is at your cost unless the item is faulty or we\'ve made an error. We recommend using a tracked service — we can\'t be responsible for items lost in transit on the way back to us.',
      'Refunds are processed within 5 working days of receiving your return and will be issued to the original payment method.',
    ],
  },
  {
    heading: 'Exchanges',
    body: [
      'If you need a different size or colour, we\'re happy to exchange where stock allows. Email us before sending anything back so we can check availability.',
      'If the item you want isn\'t in stock, we\'ll issue a refund instead.',
      'We cover the postage cost on the replacement item sent to you. Return postage is at your cost.',
    ],
  },
  {
    heading: 'Faulty or incorrect items',
    body: [
      'If you receive something that\'s faulty, damaged, or not what you ordered, we\'ll cover all costs and make it right as quickly as we can. Email us at nathan@thebreaksurf.co.uk with your order number and a photo of the issue.',
      'We take quality seriously. If something has gone wrong, we want to know.',
    ],
  },
  {
    heading: 'Sale items',
    body: [
      'Sale items can be returned for an exchange or store credit but not a cash refund, unless the item is faulty.',
    ],
  },
  {
    heading: 'Your statutory rights',
    body: [
      'Nothing in this policy affects your statutory rights under the Consumer Contracts Regulations 2013 or the Consumer Rights Act 2015. You have the right to cancel an order within 14 days of receiving it without giving a reason.',
    ],
  },
];

export default function ReturnsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-charcoal/40">Policy</p>
      <h1 className="font-display text-4xl font-medium text-charcoal">Returns &amp; Exchanges</h1>
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
          Questions? Email us at{' '}
          <a href="mailto:nathan@thebreaksurf.co.uk" className="underline underline-offset-4 hover:text-charcoal">
            nathan@thebreaksurf.co.uk
          </a>{' '}
          or visit our{' '}
          <Link href="/about#contact" className="underline underline-offset-4 hover:text-charcoal">
            contact page
          </Link>.
        </p>
      </div>
    </div>
  );
}
