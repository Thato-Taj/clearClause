import type { Metadata } from 'next';
import Link from 'next/link';
import { Report } from '@/components/report/Report';
import { EXAMPLE_REPORT } from '@/lib/example';
import { btn } from '@/lib/cn';

export const metadata: Metadata = {
  title: 'Example report',
  description: 'See what a ClearClause report looks like, using a made-up gym membership contract.',
};

export default function ExamplePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="no-print mb-10 flex flex-col gap-4 rounded-xl border border-line bg-paper-2 p-5 sm:flex-row sm:items-center">
        <p className="flex-1 text-ink-2">
          <strong className="text-ink">This is an example.</strong> PulseFit is a made-up gym. This is the report you get for any contract or terms you check.
        </p>
        <Link href="/scan" className={btn('primary', 'md')}>
          Check your own document
        </Link>
      </div>
      <Report result={EXAMPLE_REPORT} demo />
    </div>
  );
}
