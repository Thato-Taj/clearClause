import Link from 'next/link';
import { Logo } from './Logo';
import { SITE } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="no-print mt-24 border-t border-line bg-paper-2">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[0.95rem] text-ink-2">
            Plain-language checks of contracts and terms against South African law. Made in Mzansi.
          </p>
        </div>
        <div>
          <h2 className="text-[0.8rem] font-bold uppercase tracking-wider text-ink-3">Product</h2>
          <ul className="mt-3 space-y-2 text-[0.95rem]">
            <li><Link className="hover:underline" href="/scan">Check a document</Link></li>
            <li><Link className="hover:underline" href="/example">Example report</Link></li>
            <li><Link className="hover:underline" href="/#channels">WhatsApp, Telegram & extension</Link></li>
            <li><Link className="hover:underline" href="/pricing">Pricing</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-[0.8rem] font-bold uppercase tracking-wider text-ink-3">How it works</h2>
          <ul className="mt-3 space-y-2 text-[0.95rem]">
            <li><Link className="hover:underline" href="/#scoring">How we score</Link></li>
            <li><Link className="hover:underline" href="/#laws">Laws we check</Link></li>
            <li><Link className="hover:underline" href="/privacy">Privacy</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-[0.8rem] font-bold uppercase tracking-wider text-ink-3">Contact</h2>
          <ul className="mt-3 space-y-2 text-[0.95rem]">
            <li><a className="hover:underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></li>
            <li><Link className="hover:underline" href="/pricing#business">For businesses</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-[0.85rem] text-ink-3 sm:px-6">
          ClearClause gives guidance, not legal advice. For advice on your situation, speak to an attorney, the Legal Aid South Africa helpline (0800 110 110) or your nearest university law clinic.
        </p>
      </div>
    </footer>
  );
}
