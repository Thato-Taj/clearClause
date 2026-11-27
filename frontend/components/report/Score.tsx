import { cn } from '@/lib/cn';
import { ACTS, ACT_ORDER, BAND_LABEL } from '@/lib/site';
import type { AnalysisResult, BandId } from '@/lib/types';

/** Colour follows the palette: pale orange → orange → red as non-compliance rises. */
export const bandColour: Record<BandId, { fill: string; text: string }> = {
  clear: { fill: 'bg-ink-3', text: 'text-ink-2' },
  low: { fill: 'bg-pale', text: 'text-pale-ink' },
  moderate: { fill: 'bg-orange', text: 'text-orange-ink' },
  high: { fill: 'bg-red', text: 'text-red-ink' },
  critical: { fill: 'bg-red', text: 'text-red-ink' },
};

/** A ruler-style bar: 0–100 with quarter ticks. */
export function ScoreBar({ score, band, size = 'md' }: { score: number; band: BandId; size?: 'sm' | 'md' }) {
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-full bg-paper-3', size === 'md' ? 'h-3' : 'h-2')}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-label={`Non-compliance score ${score} out of 100`}
    >
      <div className={cn('h-full rounded-full', bandColour[band].fill)} style={{ width: `${Math.max(score, score === 0 ? 0 : 3)}%` }} />
      {[25, 50, 75].map((t) => (
        <span key={t} aria-hidden className="absolute top-0 h-full w-px bg-paper/80" style={{ left: `${t}%` }} />
      ))}
    </div>
  );
}

export function ScorePanel({ result }: { result: AnalysisResult }) {
  const { overall, band, counts } = result.scores;
  return (
    <section aria-labelledby="score-heading" className="rounded-xl border border-line bg-paper p-5 sm:p-6 print-break-avoid">
      <h2 id="score-heading" className="text-[0.8rem] font-bold uppercase tracking-wider text-ink-3">
        Risk score
      </h2>
      <div className="mt-2 flex items-end gap-3">
        <span className={cn('font-serif text-6xl font-bold leading-none tabular-nums', bandColour[band].text)}>{overall}</span>
        <span className="pb-1 text-lg text-ink-3">/ 100</span>
        <span className={cn('mb-1 ml-auto rounded-md px-2.5 py-1 text-[0.9rem] font-bold', band === 'clear' ? 'bg-paper-3 text-ink-2' : `${bandColour[band].text} bg-paper-2`)}>
          {BAND_LABEL[band]}
        </span>
      </div>
      <div className="mt-4">
        <ScoreBar score={overall} band={band} />
      </div>
      <p className="mt-3 text-[0.95rem] text-ink-2">
        <strong className="text-ink">0 means we found no problems.</strong> The higher the number, the less this document follows the law.
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-red-bg px-2 py-3">
          <dt className="text-[0.8rem] font-semibold text-red-ink">Breaks the law</dt>
          <dd className="font-serif text-2xl font-bold text-red-ink tabular-nums">{counts.violation}</dd>
        </div>
        <div className="rounded-lg bg-orange-bg px-2 py-3">
          <dt className="text-[0.8rem] font-semibold text-orange-ink">Unfair or risky</dt>
          <dd className="font-serif text-2xl font-bold text-orange-ink tabular-nums">{counts.concern}</dd>
        </div>
        <div className="rounded-lg bg-pale-bg px-2 py-3">
          <dt className="text-[0.8rem] font-semibold text-pale-ink">Unclear</dt>
          <dd className="font-serif text-2xl font-bold text-pale-ink tabular-nums">{counts.vague}</dd>
        </div>
      </dl>
    </section>
  );
}

export function ActScores({ result }: { result: AnalysisResult }) {
  const applicable = ACT_ORDER.filter((id) => result.scores.perAct[id]?.applicable);
  const notApplicable = ACT_ORDER.filter((id) => !result.scores.perAct[id]?.applicable);
  return (
    <section aria-labelledby="acts-heading" className="rounded-xl border border-line bg-paper p-5 sm:p-6 print-break-avoid">
      <h2 id="acts-heading" className="text-[0.8rem] font-bold uppercase tracking-wider text-ink-3">
        Score for each law
      </h2>
      {applicable.length === 0 ? (
        <p className="mt-3 text-ink-2">None of the laws we check seem to apply to this document.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {applicable.map((id) => {
            const a = result.scores.perAct[id];
            const score = a.score ?? 0;
            const band = a.band ?? 'clear';
            return (
              <li key={id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-bold" title={ACTS[id].name}>
                    {ACTS[id].short}
                  </span>
                  <span className={cn('font-bold tabular-nums', bandColour[band].text)}>{score}</span>
                </div>
                <p className="mb-1.5 text-[0.85rem] leading-snug text-ink-3">{ACTS[id].plain}</p>
                <ScoreBar score={score} band={band} size="sm" />
              </li>
            );
          })}
        </ul>
      )}
      {notApplicable.length > 0 && (
        <p className="mt-5 border-t border-line pt-3 text-[0.85rem] text-ink-3">
          Doesn’t apply to this document: {notApplicable.map((id) => ACTS[id].short).join(', ')}
        </p>
      )}
    </section>
  );
}
