import { Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ACTS, SEVERITY } from '@/lib/site';
import type { ActId, Clause, Severity } from '@/lib/types';

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
  const laws = groupByAct(clause.acts);
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

      {laws.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h4 className="text-[0.85rem] font-bold uppercase tracking-wide text-ink-3">
            {laws.length === 1 ? 'The law' : 'The laws'}
          </h4>
          <ul className="mt-2 space-y-3">
            {laws.map(({ act, sections }) => {
              const law = ACTS[act];
              return (
                <li key={act} className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
                  <span className="shrink-0 self-start rounded-md border border-line bg-paper-2 px-2 py-0.5 font-mono text-[0.8rem] text-ink-2">
                    {law?.short ?? act}
                    {sections.length > 0 && ` ${sections.join(', ')}`}
                  </span>
                  <p className="text-[0.95rem] leading-snug">
                    <span className="font-semibold">{law?.name ?? act}</span>
                    {law?.plain && <span className="text-ink-2"> — {law.plain}</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </article>
  );
}

/** One entry per Act, in the order the AI cited them, with its sections merged: "CPA s 48, s 51". */
function groupByAct(acts: Clause['acts']): { act: ActId; sections: string[] }[] {
  const byAct = new Map<ActId, string[]>();
  for (const { act, section } of acts) {
    const sections = byAct.get(act) ?? [];
    if (section && !sections.includes(section)) sections.push(section);
    byAct.set(act, sections);
  }
  return [...byAct].map(([act, sections]) => ({ act, sections }));
}
