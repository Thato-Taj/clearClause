import Link from 'next/link';
import { ArrowRight, Building2, Globe, MessageCircle, Puzzle, Send } from 'lucide-react';
import { btn, cn } from '@/lib/cn';
import { ACTS, ACT_ORDER, SITE } from '@/lib/site';

function AnnotatedPage() {
  const lines = [
    { n: '3.1', text: 'This agreement runs for a fixed period of 36 months and may not be cancelled by the member.', sev: 'violation', note: 'Breaks the law', law: 'CPA s 14' },
    { n: '5.2', text: 'A reasonable administration fee may be charged from time to time.', sev: 'vague', note: 'Unclear wording', law: 'CPA s 22' },
    { n: '8.1', text: 'We may amend the fees and these terms at any time at our sole discretion.', sev: 'concern', note: 'Unfair or risky', law: 'CPA s 48' },
    { n: '11.3', text: 'You consent to us sharing your personal information with our marketing partners.', sev: 'violation', note: 'Breaks the law', law: 'POPIA s 69' },
  ] as const;
  const chip = { violation: 'bg-red-bg text-red-ink', concern: 'bg-orange-bg text-orange-ink', vague: 'bg-pale-bg text-pale-ink' };

  return (
    <div aria-hidden className="relative rotate-[0.6deg] rounded-sm border border-line bg-paper shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)]">
      <div className="ruled margin-rule ml-0 py-6 pr-5 pl-10 sm:pl-12">
        <p className="font-serif text-lg font-bold leading-8">Membership Agreement</p>
        {lines.map((l) => (
          <div key={l.n} className="mt-2">
            <p className="text-[0.95rem] leading-8 text-ink-2">
              <span className="mr-2 font-mono text-[0.8rem] text-ink-3">{l.n}</span>
              <span className={cn('mark', `mark-${l.sev}`)}>{l.text}</span>
            </p>
            <p className="mb-1 flex items-center gap-2 text-[0.8rem] leading-6">
              <span className={cn('rounded px-1.5 font-bold', chip[l.sev])}>{l.note}</span>
              <span className="font-mono text-ink-3">{l.law}</span>
            </p>
          </div>
        ))}
      </div>
      <div className="absolute -right-3 -top-4 rotate-[-4deg] rounded-md border-2 border-red bg-paper px-3 py-1 text-center shadow-sm sm:-right-6">
        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-red-ink">Risk score</p>
        <p className="font-serif text-3xl font-bold leading-none text-red-ink">94</p>
      </div>
    </div>
  );
}

const CHANNELS = [
  { Icon: Globe, title: 'Website', body: 'Upload a PDF, Word file or photo, paste text, or drop in a link.', href: '/scan', cta: 'Check a document' },
  {
    Icon: MessageCircle,
    title: 'WhatsApp',
    body: 'Send the contract to our WhatsApp number and get the report in the chat.',
    href: SITE.whatsappNumber ? `https://wa.me/${SITE.whatsappNumber}?text=HELP` : '/account',
    cta: SITE.whatsappNumber ? 'Open WhatsApp' : 'Coming soon',
  },
  { Icon: Send, title: 'Telegram', body: 'Same checks, in Telegram. Great for long PDFs.', href: `https://t.me/${SITE.telegramBot}`, cta: 'Open Telegram' },
  {
    Icon: Puzzle,
    title: 'Browser extension',
    body: 'Check the terms page you’re on in one click, with problem clauses highlighted on the page.',
    href: SITE.extensionUrl || '/account#extension',
    cta: 'Get the extension',
  },
];

export default function Home() {
  return (
    <>
      {/* ── Hero ───────────────────────────────── */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[0.85rem] font-semibold text-ink-2">
              <span className="h-2 w-2 rounded-full bg-red" aria-hidden /> Built for South African law
            </p>
            <h1 className="mt-5 font-serif text-[2.6rem] font-bold leading-[1.08] tracking-tight sm:text-6xl">
              Know what you’re agreeing to.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2 sm:text-xl">
              ClearClause reads contracts, terms and conditions and privacy policies. It shows you which parts{' '}
              <span className="mark mark-violation">break the law</span>, which are{' '}
              <span className="mark mark-concern">unfair or risky</span>, and which are{' '}
              <span className="mark mark-vague">too vague to trust</span> — in plain language and in your own language.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/scan" className={btn('primary', 'lg')}>
                Check a document <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <Link href="/example" className={btn('secondary', 'lg')}>
                See an example report
              </Link>
            </div>
            <p className="mt-4 text-[0.95rem] text-ink-3">3 free checks every 14 days. No sign-up needed.</p>
          </div>
          <div className="mx-auto w-full max-w-lg py-4">
            <AnnotatedPage />
          </div>
        </div>
      </section>

      {/* ── Three colours ─────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-serif text-3xl font-bold sm:text-4xl">Three colours. One glance.</h2>
        <p className="mt-3 max-w-2xl text-lg text-ink-2">Every problem we find is marked like a teacher marks an essay — so you can see what matters first.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { sev: 'violation', title: 'Breaks the law', body: 'The clause seems to go against a specific section of a South African law, like POPIA or the Consumer Protection Act. It may not even be enforceable.', example: 'We may share your details with marketing partners.' },
            { sev: 'concern', title: 'Unfair or risky', body: 'Probably legal, but one-sided or likely to cost you later — like prices that can change whenever the company wants.', example: 'We may change these terms at any time.' },
            { sev: 'vague', title: 'Unclear wording', body: 'So vague that you can’t tell what you’re agreeing to. The law says consumer contracts must be in plain language.', example: 'A reasonable fee may apply from time to time.' },
          ].map((c) => (
            <div
              key={c.sev}
              className={cn(
                'rounded-xl border border-line border-t-[6px] bg-paper p-6',
                c.sev === 'violation' ? 'border-t-red' : c.sev === 'concern' ? 'border-t-orange' : 'border-t-pale',
              )}
            >
              <h3 className="font-serif text-xl font-bold">{c.title}</h3>
              <p className="mt-2 text-ink-2">{c.body}</p>
              <p className="mt-4 text-[0.95rem]">
                <span className={cn('mark', `mark-${c.sev}`)}>“{c.example}”</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Scoring ───────────────────────────── */}
      <section id="scoring" className="scroll-mt-20 border-y border-line bg-paper-2">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="font-serif text-3xl font-bold sm:text-4xl">A score you can check yourself</h2>
            <p className="mt-3 text-lg text-ink-2">
              Every document gets a risk score from 0 to 100, plus a score for each law. <strong className="text-ink">0 means we found no problems.</strong>{' '}
              The higher the number, the less the document follows the law.
            </p>
            <p className="mt-4 text-ink-2">
              The AI only finds and sorts the problems. The score is worked out with a fixed, public rule — so the same problems always give the same score:
            </p>
            <ul className="mt-4 space-y-2">
              <li className="flex gap-3"><span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-red" aria-hidden /><span><strong>Breaks the law</strong> closes half of the gap to 100. One illegal clause means a score of 50. Two means 75.</span></li>
              <li className="flex gap-3"><span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-orange" aria-hidden /><span><strong>Unfair or risky</strong> closes a fifth of the gap.</span></li>
              <li className="flex gap-3"><span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-pale" aria-hidden /><span><strong>Unclear wording</strong> closes 5% of the gap.</span></li>
            </ul>
            <p className="mt-4 text-[0.95rem] text-ink-3">More problems always mean a higher score, but it never reaches 100 — so a contract with 3 problems and one with 15 never look the same.</p>
          </div>
          <div className="rounded-xl border border-line bg-paper p-6">
            <h3 className="text-[0.8rem] font-bold uppercase tracking-wider text-ink-3">What the numbers mean</h3>
            <dl className="mt-4 divide-y divide-line">
              {[
                ['0', 'No issues found', 'text-ink-2'],
                ['1 – 24', 'Low risk', 'text-pale-ink'],
                ['25 – 49', 'Moderate risk', 'text-orange-ink'],
                ['50 – 74', 'High risk', 'text-red-ink'],
                ['75 – 99', 'Critical risk', 'text-red-ink'],
              ].map(([range, label, colour]) => (
                <div key={range} className="flex items-baseline justify-between py-3">
                  <dt className="font-mono tabular-nums text-ink-2">{range}</dt>
                  <dd className={cn('font-bold', colour)}>{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── Laws ──────────────────────────────── */}
      <section id="laws" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-serif text-3xl font-bold sm:text-4xl">The laws we check</h2>
        <p className="mt-3 max-w-2xl text-lg text-ink-2">We only score a document against the laws that apply to it — a gym contract isn’t judged on employment law.</p>
        <ul className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {ACT_ORDER.map((id) => (
            <li key={id} className="margin-rule pl-4">
              <p className="font-bold">{ACTS[id].short}</p>
              <p className="text-[0.9rem] text-ink-3">{ACTS[id].name}</p>
              <p className="mt-1 text-ink-2">{ACTS[id].plain}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Channels ──────────────────────────── */}
      <section id="channels" className="scroll-mt-20 border-y border-line bg-paper-2">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-serif text-3xl font-bold sm:text-4xl">Use it where you already are</h2>
          <p className="mt-3 max-w-2xl text-lg text-ink-2">The same checks and the same report on every channel. Link your account once and your plan and saved reports follow you.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHANNELS.map(({ Icon, title, body, href, cta }) => (
              <div key={title} className="flex flex-col rounded-xl border border-line bg-paper p-6">
                <Icon className="h-6 w-6 text-ink-2" aria-hidden />
                <h3 className="mt-3 font-serif text-xl font-bold">{title}</h3>
                <p className="mt-2 flex-1 text-ink-2">{body}</p>
                <Link href={href} className="mt-4 inline-flex items-center gap-1 font-semibold underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                  {cta} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Business ──────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 rounded-2xl border-2 border-ink p-6 sm:p-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <Building2 className="h-7 w-7" aria-hidden />
            <h2 className="mt-3 font-serif text-3xl font-bold">For businesses: fix it before your customers find it</h2>
            <p className="mt-3 text-lg text-ink-2">
              POPIA fines go up to R10 million. Compliance mode checks your own terms, privacy policy and contracts, and suggests safer wording for every problem — before the Information Regulator or the National Consumer Commission does.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/pricing#business" className={btn('primary', 'lg')}>
              See the Business plan
            </Link>
            <a href={`mailto:${SITE.contactEmail}?subject=ClearClause%20for%20business`} className={btn('secondary', 'lg')}>
              Talk to us
            </a>
          </div>
        </div>
      </section>

      {/* ── Privacy promise ───────────────────── */}
      <section className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="font-serif text-2xl font-bold">We practise what we check</h2>
        <p className="mt-3 text-lg text-ink-2">
          Your document is read once and thrown away. We keep only the report, only if you’re signed in, and you can delete everything with one click. Saved reports are stored in Johannesburg.
        </p>
        <Link href="/privacy" className="mt-3 inline-block font-semibold underline underline-offset-4">
          Read our privacy notice
        </Link>
      </section>
    </>
  );
}
