'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { btn } from '@/lib/cn';

export function SignInPrompt({ title, body }: { title: string; body: string }) {
  const { signIn } = useAuth();
  const [error, setError] = useState('');
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-paper p-8 text-center">
      <h1 className="font-serif text-3xl font-bold">{title}</h1>
      <p className="mt-3 text-ink-2">{body}</p>
      <button
        type="button"
        onClick={() => signIn().catch(() => setError('Sign-in failed. Please try again.'))}
        className={btn('primary', 'lg', 'mt-6')}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
          <path fill="currentColor" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.95l3.66-2.84Z" />
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
        </svg>
        Continue with Google
      </button>
      {error && (
        <p role="alert" className="mt-3 text-red-ink">
          {error}
        </p>
      )}
    </div>
  );
}
