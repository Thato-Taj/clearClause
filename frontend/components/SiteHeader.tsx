'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { LogOut, Moon, Sun, Monitor } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '@/lib/auth';
import { btn, cn } from '@/lib/cn';

const NAV = [
  { href: '/scan', label: 'Check a document' },
  { href: '/example', label: 'Example report' },
  { href: '/pricing', label: 'Pricing' },
];

const noopSubscribe = () => () => {};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // false during server render / hydration, true afterwards — avoids a theme-icon mismatch.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  const Icon = !mounted ? Monitor : theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const label = !mounted ? 'Theme' : `Theme: ${theme}. Switch to ${next}`;
  return (
    <button type="button" onClick={() => setTheme(next)} className={btn('ghost', 'sm', 'w-9 px-0')} aria-label={label} title={label}>
      <Icon className="h-[1.1rem] w-[1.1rem]" />
    </button>
  );
}

export function SiteHeader() {
  const { user, ready, signIn, signOut } = useAuth();
  const pathname = usePathname();
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setError('');
    try {
      await signIn();
    } catch {
      setError('Sign-in failed. Please try again.');
    }
  };

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="ClearClause home" className="shrink-0">
          <Logo />
        </Link>

        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-2 text-[0.95rem] font-medium text-ink-2 hover:text-ink hover:bg-paper-2',
                pathname === item.href && 'text-ink underline decoration-red decoration-2 underline-offset-[6px]',
              )}
            >
              {item.label}
            </Link>
          ))}
          {user && (
            <Link
              href="/reports"
              className={cn(
                'rounded-md px-3 py-2 text-[0.95rem] font-medium text-ink-2 hover:text-ink hover:bg-paper-2',
                pathname.startsWith('/reports') && 'text-ink underline decoration-red decoration-2 underline-offset-[6px]',
              )}
            >
              My reports
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          {!ready ? (
            <span className="h-9 w-24" />
          ) : user ? (
            <>
              <Link href="/account" className={btn('ghost', 'sm', 'max-w-[11rem]')} title="Account">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper-3 text-[0.8rem] font-bold">
                  {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
                </span>
                <span className="hidden truncate sm:inline">{user.displayName?.split(' ')[0] || 'Account'}</span>
              </Link>
              <button type="button" onClick={() => signOut()} className={btn('ghost', 'sm', 'w-9 px-0')} aria-label="Sign out" title="Sign out">
                <LogOut className="h-[1.1rem] w-[1.1rem]" />
              </button>
            </>
          ) : (
            <button type="button" onClick={handleSignIn} className={btn('secondary', 'sm')}>
              Sign in
            </button>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 md:hidden">
        {[...NAV, ...(user ? [{ href: '/reports', label: 'My reports' }] : [])].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-1.5 text-[0.9rem] font-medium text-ink-2',
              pathname === item.href && 'bg-paper-3 text-ink',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {error && (
        <p role="alert" className="border-t border-red/30 bg-red-bg px-4 py-2 text-center text-[0.9rem] text-red-ink">
          {error}
        </p>
      )}
    </header>
  );
}
