import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | The Break Surf',
  description: 'How The Break Surf collects, uses, and protects your personal data.',
};

const SECTIONS = [
  {
    heading: 'Who we are',
    body: [
      'The Break Surf is a small independent clothing brand based in the UK. When we say "we", "us", or "our" in this policy, we mean The Break Surf.',
      'We are registered with the Information Commissioner\'s Office (ICO) as a data controller (registration number ZC032665).',
      'If you have any questions about how we handle your data, email us at nathan@thebreaksurf.co.uk.',
    ],
  },
  {
    heading: 'What data we collect and why',
    body: [
      'When you place an order, we collect your name, email address, delivery address, and payment details. Payment information is processed securely by Stripe — we never see or store your full card details.',
      'When you leave a review, we collect your name and the content of your review.',
      'When you contact us directly by email, we store that correspondence.',
      'We don\'t run analytics, use tracking pixels, or collect any data beyond what\'s listed above.',
    ],
  },
  {
    heading: 'How we use your data',
    body: [
      'Order data is used to fulfil and deliver your order, communicate about it, and handle returns or issues.',
      'Your email address may be used to send you order confirmations and shipping updates. We won\'t add you to a marketing list without your explicit consent.',
      'Reviews are published on the relevant product page once approved.',
    ],
  },
  {
    heading: 'Who we share your data with',
    body: [
      'Stripe — to process payments. Stripe is PCI DSS compliant and handles your card details securely. Their privacy policy is at stripe.com/privacy.',
      'Royal Mail or other carriers — your name and delivery address are passed to the carrier to fulfil your order.',
      'We don\'t sell your data. We don\'t share it with advertisers. We don\'t use third-party analytics services.',
    ],
  },
  {
    heading: 'Cookies and local storage',
    body: [
      'We use your browser\'s local storage to remember your shopping cart between visits. This is stored only on your device and is not sent to us.',
      'Stripe may set cookies during the checkout process on their own domain (stripe.com). We don\'t control these.',
      'We don\'t use advertising cookies, tracking cookies, or analytics cookies.',
    ],
  },
  {
    heading: 'Google Fonts',
    body: [
      'This site loads fonts from Google Fonts, which means your browser makes a request to Google\'s servers when you visit. This sends your IP address to Google. We\'re working on self-hosting these fonts to remove this dependency.',
    ],
  },
  {
    heading: 'How long we keep your data',
    body: [
      'Order data is kept for 7 years for accounting and legal compliance purposes.',
      'Review data is kept for as long as the product is listed.',
      'Email correspondence is kept for up to 2 years.',
    ],
  },
  {
    heading: 'Your rights',
    body: [
      'Under UK GDPR, you have the right to access the personal data we hold about you, correct inaccurate data, request deletion of your data (where we\'re not legally required to keep it), and object to how we\'re using it.',
      'To exercise any of these rights, email nathan@thebreaksurf.co.uk. We\'ll respond within 30 days.',
      'If you\'re unhappy with how we\'ve handled your data, you can complain to the Information Commissioner\'s Office at ico.org.uk.',
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'If we make significant changes to this policy, we\'ll update the date at the top of this page. We won\'t notify you by email unless the change materially affects how we use your data.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-charcoal/40">Legal</p>
      <h1 className="font-display text-4xl font-medium text-charcoal">Privacy Policy</h1>
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
          Questions about your data? Email{' '}
          <a href="mailto:nathan@thebreaksurf.co.uk" className="underline underline-offset-4 hover:text-charcoal">
            nathan@thebreaksurf.co.uk
          </a>.
        </p>
      </div>
    </div>
  );
}
