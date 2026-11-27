'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { Report } from '@/components/report/Report';
import { SignInPrompt } from '@/components/SignInPrompt';
import { deleteScan, getScan, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { SavedScan } from '@/lib/types';

export function SavedReport({ id }: { id: string }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [scan, setScan] = useState<SavedScan | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    getScan(id)
      .then((r) => setScan(r.scan))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load this report.'));
  }, [id, user]);

  const remove = async () => {
    if (!window.confirm('Delete this report? This cannot be undone.')) return;
    try {
      await deleteScan(id);
      router.push('/reports');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete this report.');
    }
  };

  if (!ready) return <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-ink-3" aria-label="Loading" />;
  if (!user) return <SignInPrompt title="Sign in to see this report" body="Reports are private. Sign in with the account that made it." />;

  return (
    <>
      <Link href="/reports" className="no-print mb-6 inline-flex items-center gap-1.5 text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> My reports
      </Link>
      {error && <p role="alert" className="rounded-lg bg-red-bg p-4 text-red-ink">{error}</p>}
      {!scan && !error && <LoaderCircle className="mx-auto mt-10 h-6 w-6 animate-spin text-ink-3" aria-label="Loading" />}
      {scan && (
        <Report
          result={scan}
          scanId={scan.id}
          createdAt={scan.createdAt}
          onChange={(r) => setScan({ ...scan, ...r })}
          onDelete={remove}
        />
      )}
    </>
  );
}
