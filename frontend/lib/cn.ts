import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** Shared button styles. Primary is ink, not red — red is reserved for "breaks the law". */
export const button = {
  base: 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none',
  size: { sm: 'h-9 px-3 text-[0.9rem]', md: 'h-11 px-5 text-base', lg: 'h-13 px-6 text-[1.05rem]' },
  primary: 'bg-ink text-paper hover:bg-ink-2',
  secondary: 'bg-paper text-ink border border-line-strong hover:bg-paper-2',
  ghost: 'text-ink-2 hover:text-ink hover:bg-paper-2',
  danger: 'bg-paper text-red-ink border border-red/40 hover:bg-red-bg',
};

export const btn = (variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary', size: 'sm' | 'md' | 'lg' = 'md', extra?: string) =>
  cn(button.base, button.size[size], button[variant], extra);

export const formatDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
    : '';
