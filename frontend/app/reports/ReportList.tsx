'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FileText, LoaderCircle, MessageCircle, Puzzle, Send } from 'lucide-react';
import { SignInPrompt } from '@/components/SignInPrompt';
import { bandColour } from '@/components/report/Score';
import { listScans, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { btn, cn, formatDate } from '@/lib/cn';
import { BAND_LABEL } from '@/lib/site';
import type { ScanSummary } from '@/lib/types';

const CHANNEL_ICON = { web: FileText, extension: Puzzle, telegram: Send, whatsapp: MessageCircle };
const CHANNEL_LABEL = { web: 'Website', extension: 'Extension', telegram: 'Telegram', whatsapp: 'WhatsApp' };

export function ReportList() {
  const { user, ready } = useAuth();
  const [scans, setScans] = useState<ScanSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    listScans()
      .then((r) => setScans(r.scans))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your reports.'));
  }, [user]);

  if (!ready) return <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-ink-3" aria-label="Loading" />;
  if (!user) return <SignInPrompt title="Your reports" body="Sign in to see every report you’ve made on the website, WhatsApp, Telegram and the extension." />;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-4xl font-bold">My reports</h1>
        <Link href="/scan" className={btn('primary', 'md')}>
          Check a document
        </Link>
      </div>

      {error && <p role="alert" className="mt-6 rounded-lg bg-red-bg p-4 text-red-ink">{error}</p>}

      {!scans && !error && <LoaderCircle className="mx-auto mt-10 h-6 w-6 animate-spin text-ink-3" aria-label="Loading" />}

      {scans?.length === 0 && (
        <div className="ruled mt-8 rounded-xl border border-dashed border-line-strong p-10 text-center">
          <p className="text-lg font-semibold">No reports yet</p>
          <p className="mt-1 text-ink-2">Every document you check while signed in is saved here.</p>
        </div>
      )}

      {scans && scans.length > 0 && (
        <ul className="mt-8 divide-y divide-line rounded-xl border border-line">
          {scans.map((s) => {
            const Icon = CHANNEL_ICON[s.channel] ?? FileText;
            const band = s.band ?? 'clear';
            return (
              <li key={s.id}>
                <Link href={`/reports/${s.id}`} className="flex items-center gap-4 p-4 hover:bg-paper-2 sm:p-5">
                  <div className="w-14 shrink-0 text-center">
                    <p className={cn('font-serif text-3xl font-bold leading-none tabular-nums', bandColour[band].text)}>{s.score ?? '–'}</p>
                    <p className="mt-1 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-3">score</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{s.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9rem] text-ink-3">
                      <span>{s.documentType}</span>
                      <span className={cn('font-semibold', bandColour[band].text)}>{BAND_LABEL[band]}</span>
                      <span className="inline-flex items-center gap-1">
                        <Icon className="h-3.5 w-3.5" aria-hidden /> {CHANNEL_LABEL[s.channel] ?? 'Website'}
                      </span>
                      <span>{formatDate(s.createdAt)}</span>
                    </p>
                  </div>
                  {s.counts && (
                    <div className="hidden shrink-0 gap-1.5 sm:flex" aria-label="Findings">
                      <span className="rounded-md bg-red-bg px-2 py-0.5 text-[0.85rem] font-bold text-red-ink" title="Breaks the law">{s.counts.violation}</span>
                      <span className="rounded-md bg-orange-bg px-2 py-0.5 text-[0.85rem] font-bold text-orange-ink" title="Unfair or risky">{s.counts.concern}</span>
                      <span className="rounded-md bg-pale-bg px-2 py-0.5 text-[0.85rem] font-bold text-pale-ink" title="Unclear">{s.counts.vague}</span>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
