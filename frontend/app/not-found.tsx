import Link from 'next/link';
import { btn } from '@/lib/cn';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-mono text-ink-3">404</p>
      <h1 className="mt-2 font-serif text-4xl font-bold">
        This page is <span className="mark mark-vague">unclear</span>.
      </h1>
      <p className="mt-3 text-lg text-ink-2">We couldn’t find what you were looking for.</p>
      <Link href="/" className={btn('primary', 'lg', 'mt-8')}>
        Go home
      </Link>
    </div>
  );
}
