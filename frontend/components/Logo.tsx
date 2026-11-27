import { cn } from '@/lib/cn';

/** A section sign (§) on a page with a red margin rule — the mark of a checked document. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('h-8 w-8', className)}>
      <rect x="1" y="1" width="30" height="30" rx="7" className="fill-ink" />
      <rect x="8" y="1" width="2" height="30" className="fill-[var(--red)]" />
      <text
        x="19.5"
        y="22.5"
        textAnchor="middle"
        className="fill-paper"
        style={{ font: '700 19px var(--font-display), Georgia, serif' }}
      >
        §
      </text>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="font-serif text-[1.3rem] font-bold tracking-tight leading-none">
        Clear<span className="text-red">Clause</span>
      </span>
    </span>
  );
}
