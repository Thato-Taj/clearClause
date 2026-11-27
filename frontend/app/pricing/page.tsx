import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { btn, cn } from '@/lib/cn';
import { PLANS, SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Free for everyone. Pro for people who sign a lot. Business for companies that write contracts and terms.',
};

const FAQ = [
  {
    q: 'Is ClearClause a lawyer?',
    a: 'No. ClearClause gives guidance, not legal advice. It helps you spot problems and ask the right questions. For advice on your own situation, speak to an attorney, Legal Aid South Africa or a university law clinic.',
  },
  {
    q: 'Do you keep my documents?',
    a: 'No. We read your document to check it, then throw it away. If you are signed in, we keep the report so you can find it later — and you can delete it at any time.',
  },
  {
    q: 'Which documents work?',
    a: 'Terms and conditions, privacy policies, job offers and employment contracts, leases, loan and credit agreements, gym and cellphone contracts, insurance policies and more — as PDF, Word, a photo, pasted text or a link.',
  },
  {
    q: 'How do I upgrade?',
    a: `Card payments are coming soon. Until then, email ${SITE.contactEmail} and we’ll set you up.`,
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl">Pricing</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">Free for everyone who needs to understand what they’re signing. Paid plans for people and companies who need more.</p>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const featured = plan.id === 'business';
          return (
            <section
              key={plan.id}
              id={plan.id}
              aria-labelledby={`plan-${plan.id}`}
              className={cn('scroll-mt-24 flex flex-col rounded-2xl border p-6 sm:p-7', featured ? 'border-2 border-ink' : 'border-line')}
            >
              <h2 id={`plan-${plan.id}`} className="font-serif text-2xl font-bold">
                {plan.name}
              </h2>
              <p className="mt-1 text-ink-2">{plan.blurb}</p>
              <p className="mt-5">
                <span className="font-serif text-4xl font-bold">{plan.price}</span>
                <span className="text-ink-3">{plan.period}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="mt-1 h-4 w-4 shrink-0" aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {plan.id === 'free' ? (
                <Link href="/scan" className={btn('secondary', 'lg', 'mt-8')}>
                  Start checking
                </Link>
              ) : (
                <a
                  href={`mailto:${SITE.contactEmail}?subject=${encodeURIComponent(`ClearClause ${plan.name} plan`)}`}
                  className={btn(featured ? 'primary' : 'secondary', 'lg', 'mt-8')}
                >
                  {plan.id === 'business' ? 'Talk to us' : 'Get Pro'}
                </a>
              )}
            </section>
          );
        })}
      </div>

      <section className="mx-auto mt-20 max-w-3xl" aria-labelledby="faq">
        <h2 id="faq" className="font-serif text-3xl font-bold">
          Questions
        </h2>
        <dl className="mt-6 divide-y divide-line border-y border-line">
          {FAQ.map((f) => (
            <div key={f.q} className="py-5">
              <dt className="text-lg font-semibold">{f.q}</dt>
              <dd className="mt-1.5 text-ink-2">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
