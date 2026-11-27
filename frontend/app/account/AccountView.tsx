'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, KeyRound, LoaderCircle, MessageCircle, Puzzle, Send, Trash2 } from 'lucide-react';
import { SignInPrompt } from '@/components/SignInPrompt';
import { createKey, createLinkCode, deleteMe, getMe, listKeys, revokeKey, unlinkChannel, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { btn, cn, formatDate } from '@/lib/cn';
import { SITE } from '@/lib/site';
import { allowanceText, nextCheckText } from '@/lib/quota';
import type { ApiKey, Me } from '@/lib/types';

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line py-8">
      <h2 className="font-serif text-2xl font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={btn('secondary', 'sm')}
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {done ? 'Copied' : label}
    </button>
  );
}

export function AccountView() {
  const { user, ready, signOut } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [code, setCode] = useState<{ code: string; expiresInMinutes: number } | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');

  const load = useCallback(async () => {
    try {
      const [m, k] = await Promise.all([getMe(), listKeys()]);
      setMe(m);
      setKeys(k.keys);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load your account.');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([getMe(), listKeys()])
      .then(([m, k]) => {
        if (cancelled) return;
        setMe(m);
        setKeys(k.keys);
      })
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not load your account.'));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (!ready) return <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-ink-3" aria-label="Loading" />;
  if (!user) return <SignInPrompt title="Your account" body="Sign in to save reports, connect WhatsApp and Telegram, and use the browser extension." />;

  const links = me?.user?.links ?? {};
  const usage = me?.usage;

  return (
    <>
      <h1 className="font-serif text-4xl font-bold">Account</h1>
      <p className="mt-2 text-ink-2">
        Signed in as <strong className="text-ink">{user.email}</strong>
      </p>

      {error && (
        <p role="alert" className="mt-6 rounded-lg bg-red-bg p-4 text-red-ink">
          {error}
        </p>
      )}

      {/* ── Plan ─────────────────────────── */}
      <Section title="Your plan">
        {!me ? (
          <LoaderCircle className="h-5 w-5 animate-spin text-ink-3" aria-label="Loading" />
        ) : (
          <div className="flex flex-wrap items-center gap-6 rounded-xl border border-line p-5">
            <div className="flex-1">
              <p className="text-2xl font-bold">{me.plan.label}</p>
              <p className="text-ink-2">
                {me.plan.scans === -1
                  ? 'Unlimited checks'
                  : `${usage?.remaining ?? 0} of ${me.plan.scans} checks left · you get ${allowanceText(me.plan.scans, me.plan.periodDays)}`}
                {me.plan.scans !== -1 && usage?.remaining === 0 && usage.nextAt && ` · next check ${nextCheckText(usage.nextAt)}`}
              </p>
            </div>
            {me.plan.id !== 'business' && (
              <Link href="/pricing" className={btn('primary', 'md')}>
                Upgrade
              </Link>
            )}
          </div>
        )}
      </Section>

      {/* ── Chat apps ────────────────────── */}
      <Section id="chat" title="WhatsApp and Telegram">
        <p className="text-ink-2">Connect a chat app so your plan applies there and every report is saved here.</p>
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {(
            [
              { id: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, available: Boolean(SITE.whatsappNumber) },
              { id: 'telegram', label: 'Telegram', Icon: Send, available: true },
            ] as const
          ).map(({ id, label, Icon, available }) => (
            <li key={id} className="flex flex-wrap items-center gap-3 p-4">
              <Icon className="h-5 w-5 text-ink-2" aria-hidden />
              <span className="flex-1 font-semibold">{label}</span>
              {links[id] ? (
                <>
                  <span className="text-[0.9rem] text-ink-3">Connected {formatDate(links[id]!.linkedAt)}</span>
                  <button
                    type="button"
                    className={btn('ghost', 'sm')}
                    disabled={busy === `unlink-${id}`}
                    onClick={() => run(`unlink-${id}`, async () => { await unlinkChannel(id); await load(); })}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <span className="text-[0.9rem] text-ink-3">{available ? 'Not connected' : 'Coming soon'}</span>
              )}
            </li>
          ))}
        </ul>

        {code ? (
          <div className="mt-4 rounded-xl bg-paper-2 p-5">
            <p className="font-semibold">Your code (valid for {code.expiresInMinutes} minutes)</p>
            <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em]">{code.code}</p>
            <p className="mt-3 text-ink-2">
              Send <strong className="font-mono text-ink">LINK {code.code}</strong> to the ClearClause bot, or tap:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className={btn('secondary', 'sm')} href={`https://t.me/${SITE.telegramBot}?start=link_${code.code}`} target="_blank" rel="noopener noreferrer">
                <Send className="h-4 w-4" aria-hidden /> Open in Telegram
              </a>
              {SITE.whatsappNumber && (
                <a className={btn('secondary', 'sm')} href={`https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(`LINK ${code.code}`)}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" aria-hidden /> Open in WhatsApp
                </a>
              )}
              <button type="button" className={btn('ghost', 'sm')} onClick={() => load()}>
                I’ve sent it — refresh
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={btn('secondary', 'md', 'mt-4')}
            disabled={busy === 'code'}
            onClick={() => run('code', async () => setCode(await createLinkCode()))}
          >
            {busy === 'code' && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            Get a connection code
          </button>
        )}
      </Section>

      {/* ── Extension & API keys ─────────── */}
      <Section id="extension" title="Browser extension and API">
        <p className="text-ink-2">
          <Puzzle className="mr-1 inline h-4 w-4 align-[-2px]" aria-hidden />
          To use your plan in the browser extension, create an access key and paste it into the extension’s settings.
          {me?.plan.id === 'business' && ' Business plans can also use keys to call the ClearClause API from their own systems.'}
        </p>

        {newKey && (
          <div className="mt-4 rounded-xl border-2 border-ink p-5">
            <p className="font-semibold">Copy your key now — you won’t see it again.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md bg-paper-2 px-3 py-2 font-mono text-[0.9rem]">{newKey}</code>
              <CopyButton value={newKey} />
            </div>
            {me?.plan.id === 'business' && (
              <pre className="mt-4 overflow-x-auto rounded-md bg-paper-3 p-3 font-mono text-[0.8rem] leading-relaxed">
{`curl -X POST ${SITE.apiUrl}/api/analyze \\
  -H "X-API-Key: ${newKey}" \\
  -F "file=@terms.pdf" -F "mode=business"`}
              </pre>
            )}
          </div>
        )}

        {keys.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 p-4">
                <KeyRound className="h-4 w-4 text-ink-3" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{k.label}</p>
                  <p className="text-[0.85rem] text-ink-3">
                    <span className="font-mono">{k.prefix}…</span> · created {formatDate(k.createdAt)}
                    {k.lastUsedAt ? ` · last used ${formatDate(k.lastUsedAt)}` : ' · never used'}
                  </p>
                </div>
                <button
                  type="button"
                  className={btn('ghost', 'sm')}
                  disabled={busy === `revoke-${k.id}`}
                  onClick={() => run(`revoke-${k.id}`, async () => { await revokeKey(k.id); setKeys(keys.filter((x) => x.id !== k.id)); })}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className={btn('secondary', 'md', 'mt-4')}
          disabled={busy === 'key'}
          onClick={() =>
            run('key', async () => {
              const k = await createKey(keys.length ? `Key ${keys.length + 1}` : 'Browser extension');
              setNewKey(k.key);
              setKeys([{ id: k.id, label: k.label, prefix: k.prefix, createdAt: new Date().toISOString(), lastUsedAt: null }, ...keys]);
            })
          }
        >
          {busy === 'key' && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
          Create an access key
        </button>
      </Section>

      {/* ── Delete ───────────────────────── */}
      <Section title="Delete your data">
        <p className="text-ink-2">
          This permanently deletes your saved reports, access keys, chat connections and account details. You can’t undo it.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="confirm-delete" className="sr-only">
            Type DELETE to confirm
          </label>
          <input
            id="confirm-delete"
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="h-11 rounded-lg border border-line-strong bg-paper px-3 focus:border-ink focus:outline-none"
          />
          <button
            type="button"
            disabled={confirmDelete !== 'DELETE' || busy === 'delete'}
            className={cn(btn('danger', 'md'))}
            onClick={() =>
              run('delete', async () => {
                await deleteMe();
                await signOut();
                router.replace('/');
              })
            }
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Delete everything
          </button>
        </div>
      </Section>
    </>
  );
}
