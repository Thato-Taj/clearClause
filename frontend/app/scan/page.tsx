import type { Metadata } from 'next';
import { Scanner } from '@/components/Scanner';

export const metadata: Metadata = {
  title: 'Check a document',
  description: 'Upload a contract, terms and conditions or privacy policy and see what breaks South African law.',
};

export default function ScanPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl">Check a document</h1>
        <p className="mt-3 text-lg text-ink-2">
          Contracts, terms and conditions, privacy policies, leases, job offers, loan agreements — we’ll show you what to worry about.
        </p>
      </div>
      <div className="mx-auto mt-8 max-w-3xl [&:has(article)]:max-w-none">
        <Scanner />
      </div>
    </div>
  );
}
