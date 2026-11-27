'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ClipboardPaste, FileUp, Link2, LoaderCircle, X } from 'lucide-react';
import { Report } from './report/Report';
import { analyze, getMe, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { btn, cn } from '@/lib/cn';
import { LANGUAGES } from '@/lib/site';
import { allowanceText, nextCheckText } from '@/lib/quota';
import type { AnalysisResult, Me, Quota } from '@/lib/types';

type Tab = 'file' | 'text' | 'link';
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.docx,.txt,.md,.html,.htm,image/png,image/jpeg,image/webp,image/heic,image/heif';

const CHECKING = [
  'Reading every clause…',
  'Checking how your personal information is used (POPIA)…',
  'Looking for unfair terms (Consumer Protection Act)…',
  'Checking fees, cancellation and liability…',
  'Writing your report in plain language…',
];

const TABS: { id: Tab; label: string; Icon: typeof FileUp }[] = [
  { id: 'file', label: 'Upload a file', Icon: FileUp },
  { id: 'text', label: 'Paste text', Icon: ClipboardPaste },
  { id: 'link', label: 'Use a link', Icon: Link2 },
];

export function Scanner() {
  const { user, ready, signIn } = useAuth();
  const [tab, setTab] = useState<Tab>('file');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState('English');
  const [mode, setMode] = useState<'consumer' | 'business'>('consumer');
  const [dragging, setDragging] = useState(false);

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Load plan + current usage (re-run when the signed-in user changes).
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getMe()
      .then((m) => {
        if (cancelled) return;
        setMe(m);
        setQuota(m.usage);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, user]);

  // Status text + timer while the analysis runs.
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setElapsed(s);
      setStep(Math.min(CHECKING.length - 1, Math.floor(s / 6)));
    }, 1000);
    return () => clearInterval(t);
  }, [busy]);

  const pickFile = useCallback((f: File | null | undefined) => {
    setError(null);
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError({ message: 'That file is larger than 10 MB. Try a smaller file or paste the text instead.' });
      return;
    }
    setFile(f);
  }, []);

  const canSubmit =
    !busy && ((tab === 'file' && !!file) || (tab === 'text' && text.trim().length >= 80) || (tab === 'link' && /^https?:\/\/\S+\.\S+/.test(url.trim())));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setStep(0);
    setElapsed(0);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await analyze({
        file: tab === 'file' ? file : null,
        text: tab === 'text' ? text : undefined,
        url: tab === 'link' ? url.trim() : undefined,
        language,
        mode,
      });
      setResult(res.result);
      setScanId(res.scanId);
      setQuota(res.quota);
      requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ message: err.message, code: err.code });
        if (err.quota) setQuota(err.quota);
      } else setError({ message: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setResult(null);
    setScanId(null);
    setFile(null);
    setText('');
    setUrl('');
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isBusinessPlan = me?.plan.id === 'business';
  const left = quota && quota.limit !== -1 ? quota.remaining : null;

  return (
    <div>
      {!result && (
        <form onSubmit={submit} className="rounded-2xl border border-line bg-paper shadow-[0_1px_0_var(--line)]" aria-busy={busy}>
          {/* Input type */}
          <div role="tablist" aria-label="How do you want to add the document?" className="flex border-b border-line">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                onClick={() => setTab(id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 px-3 py-4 text-[0.95rem] font-semibold transition-colors cursor-pointer',
                  tab === id ? 'text-ink shadow-[inset_0_-3px_0_var(--ink)]' : 'text-ink-3 hover:text-ink',
                )}
              >
                <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(' ').pop()}</span>
              </button>
            ))}
          </div>

          <div className="p-5 sm:p-7">
            {tab === 'file' && (
              <div id="panel-file" role="tabpanel">
                {file ? (
                  <div className="flex items-center gap-3 rounded-xl border border-line bg-paper-2 p-4">
                    <FileUp className="h-6 w-6 shrink-0 text-ink-2" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{file.name}</p>
                      <p className="text-[0.85rem] text-ink-3">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button type="button" onClick={() => setFile(null)} className={btn('ghost', 'sm', 'w-9 px-0')} aria-label="Remove file">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      pickFile(e.dataTransfer.files?.[0]);
                    }}
                    className={cn(
                      'ruled flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
                      dragging ? 'border-ink bg-paper-2' : 'border-line-strong hover:border-ink-3',
                    )}
                  >
                    <FileUp className="h-8 w-8 text-ink-2" aria-hidden />
                    <span className="mt-3 text-lg font-semibold">Choose a file or drag it here</span>
                    <span className="mt-1 text-[0.95rem] text-ink-3">PDF, Word (.docx), text, or a photo of the contract · up to 10 MB</span>
                    <input ref={fileInput} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
                  </label>
                )}
              </div>
            )}

            {tab === 'text' && (
              <div id="panel-text" role="tabpanel">
                <label htmlFor="paste" className="sr-only">
                  Contract or terms text
                </label>
                <textarea
                  id="paste"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={10}
                  placeholder="Paste the full terms and conditions, privacy policy or contract here…"
                  className="w-full resize-y rounded-xl border border-line-strong bg-paper p-4 text-base leading-relaxed placeholder:text-ink-3 focus:border-ink focus:outline-none"
                />
                <p className="mt-1.5 text-[0.85rem] text-ink-3">
                  {text.trim().length < 80 ? 'Paste at least a few paragraphs.' : `${text.trim().length.toLocaleString('en-ZA')} characters`}
                </p>
              </div>
            )}

            {tab === 'link' && (
              <div id="panel-link" role="tabpanel">
                <label htmlFor="url" className="mb-2 block font-semibold">
                  Link to the terms page
                </label>
                <input
                  id="url"
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.co.za/terms"
                  className="h-12 w-full rounded-xl border border-line-strong bg-paper px-4 text-base placeholder:text-ink-3 focus:border-ink focus:outline-none"
                />
                <p className="mt-1.5 text-[0.85rem] text-ink-3">
                  Works for most public pages and PDF links. If a page needs you to log in, copy and paste the text instead.
                </p>
              </div>
            )}

            {/* Options */}
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="language" className="mb-2 block font-semibold">
                  Explain it to me in
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="h-12 w-full cursor-pointer rounded-xl border border-line-strong bg-paper px-3 text-base focus:border-ink focus:outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
              <fieldset>
                <legend className="mb-2 block font-semibold">I am…</legend>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={cn(
                      'flex h-12 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-[0.95rem] font-semibold',
                      mode === 'consumer' ? 'border-ink bg-ink text-paper' : 'border-line-strong text-ink-2 hover:bg-paper-2',
                    )}
                  >
                    <input type="radio" name="mode" value="consumer" className="sr-only" checked={mode === 'consumer'} onChange={() => setMode('consumer')} />
                    Signing it
                  </label>
                  <label
                    title={isBusinessPlan ? undefined : 'Business plan feature'}
                    className={cn(
                      'flex h-12 items-center justify-center rounded-xl border px-2 text-center text-[0.95rem] font-semibold',
                      !isBusinessPlan && 'cursor-not-allowed opacity-50',
                      isBusinessPlan && 'cursor-pointer',
                      mode === 'business' ? 'border-ink bg-ink text-paper' : 'border-line-strong text-ink-2',
                    )}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value="business"
                      className="sr-only"
                      disabled={!isBusinessPlan}
                      checked={mode === 'business'}
                      onChange={() => setMode('business')}
                    />
                    The business
                  </label>
                </div>
                <p className="mt-1.5 text-[0.85rem] text-ink-3">
                  {isBusinessPlan ? (
                    mode === 'business' ? 'You’ll get fixes and safer wording for each problem.' : 'Choose “The business” to get fixes for your own documents.'
                  ) : (
                    <>
                      Checking your own company’s documents? <Link href="/pricing#business" className="underline">Business plan</Link>
                    </>
                  )}
                </p>
              </fieldset>
            </div>

            {error && (
              <div role="alert" className="mt-6 rounded-xl border border-red/30 bg-red-bg p-4 text-red-ink">
                <p className="font-semibold">{error.message}</p>
                {(error.code === 'quota_exceeded' || error.code === 'auth_required') && (
                  <p className="mt-2 flex flex-wrap gap-3 text-[0.95rem]">
                    {!user && (
                      <button type="button" onClick={() => signIn().catch(() => {})} className="font-semibold underline cursor-pointer">
                        Sign in
                      </button>
                    )}
                    <Link href="/pricing" className="font-semibold underline">
                      See plans
                    </Link>
                  </p>
                )}
              </div>
            )}

            <div className="mt-7 flex flex-col-reverse items-stretch gap-4 sm:flex-row sm:items-center">
              <p className="text-[0.95rem] text-ink-3 sm:flex-1">
                {left !== null && (
                  <>
                    <strong className="text-ink">{left}</strong> of {quota!.limit} checks left — you get {allowanceText(quota!.limit, quota!.periodDays)}.{' '}
                    {left === 0 && quota!.nextAt && <>Next check: {nextCheckText(quota!.nextAt)}.{' '}</>}
                  </>
                )}
                {!user && ready && me?.accountsEnabled !== false && (
                  <>
                    <button type="button" onClick={() => signIn().catch(() => {})} className="underline cursor-pointer">
                      Sign in
                    </button>{' '}
                    to save your reports.
                  </>
                )}
              </p>
              <button type="submit" disabled={!canSubmit} className={btn('primary', 'lg', 'sm:min-w-[15rem]')}>
                {busy ? (
                  <>
                    <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> Checking…
                  </>
                ) : (
                  <>
                    Check this document <ArrowRight className="h-5 w-5" aria-hidden />
                  </>
                )}
              </button>
            </div>

            {busy && (
              <div className="mt-6 rounded-xl bg-paper-2 p-4" aria-live="polite">
                <p className="font-semibold">{CHECKING[step]}</p>
                <p className="mt-1 text-[0.9rem] text-ink-3">
                  {elapsed}s · This usually takes 20 to 60 seconds. Keep this page open.
                </p>
              </div>
            )}

            <p className="mt-6 border-t border-line pt-4 text-[0.85rem] text-ink-3">
              We read your document to check it, then throw the document away. We only keep the report — and only if you’re signed in.{' '}
              <Link href="/privacy" className="underline">
                Privacy
              </Link>
            </p>
          </div>
        </form>
      )}

      {result && (
        <div ref={reportRef} className="scroll-mt-24">
          <div className="no-print mb-8 flex flex-wrap items-center gap-3">
            <button type="button" onClick={reset} className={btn('secondary', 'md')}>
              Check another document
            </button>
            {scanId ? (
              <Link href={`/reports/${scanId}`} className="text-[0.95rem] text-ink-2 underline">
                Saved to My reports
              </Link>
            ) : (
              !user && (
                <span className="text-[0.95rem] text-ink-3">
                  This report isn’t saved.{' '}
                  <button type="button" onClick={() => signIn().catch(() => {})} className="underline cursor-pointer">
                    Sign in
                  </button>{' '}
                  to keep future reports.
                </span>
              )
            )}
          </div>
          <Report result={result} scanId={scanId} onChange={setResult} />
        </div>
      )}
    </div>
  );
}
