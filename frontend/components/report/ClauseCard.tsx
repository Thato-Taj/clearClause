import { Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ACTS, SEVERITY } from '@/lib/site';
import type { Clause, Severity } from '@/lib/types';

export const severityStyle: Record<Severity, { border: string; chip: string; dot: string }> = {
  violation: { border: 'border-l-red', chip: 'bg-red-bg text-red-ink', dot: 'bg-red' },
  concern: { border: 'border-l-orange', chip: 'bg-orange-bg text-orange-ink', dot: 'bg-orange' },
  vague: { border: 'border-l-pale', chip: 'bg-pale-bg text-pale-ink', dot: 'bg-pale' },
};

export function SeverityChip({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[0.85rem] font-bold', severityStyle[severity].chip, className)}>
      <span aria-hidden className={cn('h-2 w-2 rounded-full', severityStyle[severity].dot)} />
      {SEVERITY[severity].label}
    </span>
  );
}

export function ClauseCard({ clause, index }: { clause: Clause; index: number }) {
  const s = severityStyle[clause.severity];
  return (
    <article
      id={`finding-${clause.id}`}
      className={cn('rounded-xl border border-line border-l-[6px] bg-paper p-5 sm:p-6 print-break-avoid', s.border)}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <SeverityChip severity={clause.severity} />
        <span className="text-[0.9rem] text-ink-3">{clause.reference}</span>
      </div>

      <h3 className="mt-3 font-serif text-[1.35rem] font-semibold leading-snug">
        <span className="sr-only">Finding {index + 1}: </span>
        {clause.title}
      </h3>

      {clause.quote && (
        <figure className="mt-4">
          <blockquote className="border-l-2 border-line-strong pl-4 text-[1rem] leading-relaxed text-ink-2">
            <span className={cn('mark', `mark-${clause.severity}`)}>“{clause.quote}”</span>
          </blockquote>
          {clause.quoteVerified === false && (
            <figcaption className="mt-2 flex items-start gap-1.5 pl-4 text-[0.85rem] text-ink-3">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              We couldn’t match this wording exactly in your document — check the original clause.
            </figcaption>
          )}
        </figure>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <h4 className="text-[0.85rem] font-bold uppercase tracking-wide text-ink-3">What this means</h4>
          <p className="mt-1">{clause.explanation}</p>
        </div>
        <div>
          <h4 className="text-[0.85rem] font-bold uppercase tracking-wide text-ink-3">What you can do</h4>
          <p className="mt-1">{clause.action}</p>
        </div>
      </div>

      {clause.acts.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Laws involved">
          {clause.acts.map((a) => (
            <li
              key={`${a.act}-${a.section}`}
              className="rounded-md border border-line bg-paper-2 px-2 py-0.5 font-mono text-[0.8rem] text-ink-2"
              title={ACTS[a.act]?.name}
            >
              {ACTS[a.act]?.short ?? a.act}
              {a.section ? ` ${a.section}` : ''}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
