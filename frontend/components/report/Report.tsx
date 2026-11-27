'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, Languages, LoaderCircle, Printer, Trash2, TriangleAlert, CircleCheck } from 'lucide-react';
import { ClauseCard, severityStyle } from './ClauseCard';
import { ActScores, ScorePanel } from './Score';
import { translate, ApiError } from '@/lib/api';
import { btn, cn, formatDate } from '@/lib/cn';
import { LANGUAGES, SEVERITY } from '@/lib/site';
import type { AnalysisResult, Severity } from '@/lib/types';

type Filter = 'all' | Severity;

interface Props {
  result: AnalysisResult;
  scanId?: string | null;
  createdAt?: string | null;
  /** Called with the translated result so the parent can keep it. */
  onChange?: (r: AnalysisResult) => void;
  onDelete?: () => void;
  /** Static example: no translation calls. */
  demo?: boolean;
}

export function Report({ result, scanId, createdAt, onChange, onDelete, demo }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const visible = useMemo(
    () => (filter === 'all' ? result.clauses : result.clauses.filter((c) => c.severity === filter)),
    [filter, result.clauses],
  );

  const changeLanguage = async (language: string) => {
    if (language === result.language) return;
    setTranslating(true);
    setError('');
    try {
      const res = await translate(scanId ? { scanId, language } : { result, language });
      onChange?.(res.result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Translation failed. Please try again.');
    } finally {
      setTranslating(false);
    }
  };

  const copySummary = async () => {
    const lines = [
      `ClearClause report: ${result.title}`,
      `Risk score: ${result.scores.overall}/100 (${result.scores.bandLabel})`,
      '',
      result.summary,
      '',
      ...result.clauses.map((c, i) => `${i + 1}. [${SEVERITY[c.severity].label}] ${c.title} (${c.reference}) — ${c.explanation}`),
      '',
      `Our advice: ${result.verdict}`,
      'ClearClause gives guidance, not legal advice.',
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Your browser blocked clipboard access.');
    }
  };

  if (!result.isLegalDocument) {
    return (
      <div className="rounded-xl border border-line bg-paper-2 p-6">
        <h2 className="font-serif text-2xl font-semibold">This doesn’t look like a contract or terms</h2>
        <p className="mt-2 text-ink-2">{result.summary}</p>
        <p className="mt-3 text-ink-2">Try uploading the actual terms and conditions, privacy policy or contract.</p>
      </div>
    );
  }

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: result.clauses.length },
    { id: 'violation', label: SEVERITY.violation.label, count: result.scores.counts.violation },
    { id: 'concern', label: SEVERITY.concern.label, count: result.scores.counts.concern },
    { id: 'vague', label: SEVERITY.vague.label, count: result.scores.counts.vague },
  ];

  return (
    <article className="rise" aria-labelledby="report-title">
      {/* ── Header ───────────────────────────── */}
      <header className="margin-rule pl-5 sm:pl-7">
        <p className="text-[0.85rem] font-bold uppercase tracking-wider text-ink-3">
          {result.documentType}
          {result.mode === 'business' && ' · Compliance mode'}
        </p>
        <h1 id="report-title" className="mt-1 font-serif text-3xl font-bold leading-tight sm:text-[2.6rem]">
          {result.title}
        </h1>
        <p className="mt-2 text-[0.95rem] text-ink-3">
          {createdAt ? `Checked ${formatDate(createdAt)}` : `Checked ${formatDate(result.analysedAt)}`}
          {result.source.url && (
            <>
              {' · '}
              <a className="underline" href={result.source.url} target="_blank" rel="noopener noreferrer nofollow">
                {new URL(result.source.url).hostname}
              </a>
            </>
          )}
        </p>
      </header>

      {/* ── Toolbar ──────────────────────────── */}
      <div className="no-print mt-6 flex flex-wrap items-center gap-2">
        {!demo && (
          <label className={cn(btn('secondary', 'sm'), 'relative pr-2')}>
            {translating ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Languages className="h-4 w-4" aria-hidden />}
            <span className="sr-only">Report language</span>
            <select
              value={result.language}
              onChange={(e) => changeLanguage(e.target.value)}
              disabled={translating}
              className="cursor-pointer bg-transparent pr-1 font-semibold outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" onClick={() => window.print()} className={btn('secondary', 'sm')}>
          <Printer className="h-4 w-4" aria-hidden /> Save as PDF
        </button>
        <button type="button" onClick={copySummary} className={btn('secondary', 'sm')}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy summary'}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} className={btn('danger', 'sm', 'sm:ml-auto')}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete report
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="no-print mt-3 rounded-lg bg-red-bg px-4 py-2 text-[0.95rem] text-red-ink">
          {error}
        </p>
      )}
      {result.source.truncated && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-pale-bg px-4 py-3 text-[0.95rem] text-pale-ink">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          This document was very long, so we only checked the first part. Upload the remaining sections separately to check them too.
        </p>
      )}

      {/* ── Body ─────────────────────────────── */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="order-2 min-w-0 lg:order-1">
          <section aria-labelledby="summary-heading" className="print-break-avoid">
            <h2 id="summary-heading" className="font-serif text-2xl font-semibold">
              In short
            </h2>
            <p className="mt-2 text-[1.1rem] leading-relaxed">{result.summary}</p>
          </section>

          {result.positives.length > 0 && (
            <section aria-labelledby="good-heading" className="mt-6 rounded-xl bg-paper-2 p-5 print-break-avoid">
              <h2 id="good-heading" className="flex items-center gap-2 font-bold">
                <CircleCheck className="h-5 w-5 text-ink-2" aria-hidden /> What this document does well
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-ink-2">
                {result.positives.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="findings-heading" className="mt-10">
            <h2 id="findings-heading" className="font-serif text-2xl font-semibold">
              What we found
            </h2>

            {result.clauses.length === 0 ? (
              <p className="mt-3 rounded-xl border border-line bg-paper-2 p-5 text-ink-2">
                We didn’t find any clauses that break the law, are unfair, or are unclear. That’s a good sign — but still read anything you sign.
              </p>
            ) : (
              <>
                <div role="tablist" aria-label="Filter findings" className="no-print mt-4 flex flex-wrap gap-2">
                  {filters.map((f) => (
                    <button
                      key={f.id}
                      role="tab"
                      type="button"
                      aria-selected={filter === f.id}
                      disabled={f.count === 0 && f.id !== 'all'}
                      onClick={() => setFilter(f.id)}
                      className={cn(
                        'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[0.9rem] font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
                        filter === f.id ? 'border-ink bg-ink text-paper' : 'border-line-strong text-ink-2 hover:bg-paper-2',
                      )}
                    >
                      {f.id !== 'all' && <span aria-hidden className={cn('h-2.5 w-2.5 rounded-full', severityStyle[f.id].dot)} />}
                      {f.label}
                      <span className="tabular-nums opacity-70">{f.count}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 space-y-4">
                  {visible.map((c) => (
                    <ClauseCard key={c.id} clause={c} index={result.clauses.indexOf(c)} />
                  ))}
                </div>
              </>
            )}
          </section>

          <section aria-labelledby="advice-heading" className="mt-10 rounded-xl border-2 border-ink p-5 sm:p-6 print-break-avoid">
            <h2 id="advice-heading" className="font-serif text-2xl font-semibold">
              Our advice
            </h2>
            <p className="mt-2 text-[1.1rem]">{result.verdict}</p>
          </section>

          <p className="mt-6 text-[0.9rem] text-ink-3">
            ClearClause gives guidance, not legal advice. It can miss things or make mistakes. For advice on your situation, speak to an attorney, Legal Aid South Africa (0800 110 110) or a university law clinic.
          </p>
        </div>

        <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-24 lg:self-start">
          <ScorePanel result={result} />
          <ActScores result={result} />
        </aside>
      </div>
    </article>
  );
}
