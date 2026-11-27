import { db, FieldValue, Timestamp } from '../firebase.js';
import { saDate } from './util.js';

const DAY_MS = 86_400_000;

// Fallback when Firestore isn't configured (local development and tests — resets on restart).
const memory = new Map();

/**
 * @typedef {{scans: number, periodDays: number}} Allowance  scans -1 = unlimited
 * @typedef {{used: number|null, limit: number, remaining: number, periodDays: number, nextAt: string|null}} Usage
 */

/**
 * Rolling window: a check counts against the allowance for `periodDays` after it was used, then frees up.
 * Unlike calendar fortnights, nobody can get 6 checks in 2 days by straddling a reset.
 * @param {number[]} stamps times (ms) of earlier checks
 * @returns {{recent: number[], usage: Usage}}
 */
function evaluate(stamps, { scans, periodDays }, now) {
  const windowMs = periodDays * DAY_MS;
  const recent = (Array.isArray(stamps) ? stamps : []).filter((t) => t > now - windowMs).sort((a, b) => a - b);
  // The check whose expiry brings `used` back under the limit — or, with room left, the next one to free up.
  const freesUp = scans > 0 && recent.length ? recent[Math.max(0, recent.length - scans)] : null;
  return {
    recent,
    usage: {
      used: recent.length,
      limit: scans,
      remaining: Math.max(0, scans - recent.length),
      periodDays,
      nextAt: freesUp === null ? null : new Date(freesUp + windowMs).toISOString(),
    },
  };
}

/** Decide one check against the stored stamps. `stamps` is null when nothing should be written. */
function attempt(stored, allowance, now) {
  const before = evaluate(stored, allowance, now);
  if (before.usage.remaining === 0) return { stamps: null, result: { allowed: false, ...before.usage, stamp: null } };
  const after = evaluate([...before.recent, now], allowance, now);
  return { stamps: after.recent, result: { allowed: true, ...after.usage, stamp: now } };
}

/**
 * Atomically use one check from the allowance.
 * @param {string} key  e.g. "uid:abc", "anon:<hash>", "telegram:<hash>"
 * @param {Allowance} allowance
 * @returns {Promise<Usage & {allowed: boolean, stamp: number|null}>} pass `stamp` to refund() to give this check back
 */
export async function consume(key, allowance, now = Date.now()) {
  if (allowance.scans === -1) {
    // Never blocks; a daily count is kept for usage statistics only.
    await bumpDaily(key, 1, now);
    return { allowed: true, used: null, limit: -1, remaining: -1, periodDays: allowance.periodDays, nextAt: null, stamp: null };
  }

  if (!db) {
    const { stamps, result } = attempt(memory.get(key), allowance, now);
    if (stamps) memory.set(key, stamps);
    return result;
  }

  const ref = db.collection('usage').doc(key);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const { stamps, result } = attempt(snap.exists ? snap.data().stamps : [], allowance, now);
    if (stamps) {
      // A Firestore TTL policy on `expireAt` deletes the row once its newest check has left the window.
      tx.set(ref, { key, stamps, expireAt: Timestamp.fromMillis(now + allowance.periodDays * DAY_MS + DAY_MS) });
    }
    return result;
  });
}

/** Give a check back when the analysis failed through no fault of the user. */
export async function refund(key, stamp) {
  if (stamp == null) return bumpDaily(key, -1, Date.now());
  if (!db) {
    const stamps = memory.get(key) ?? [];
    const i = stamps.indexOf(stamp);
    if (i !== -1) memory.set(key, stamps.toSpliced(i, 1));
    return;
  }
  await db.collection('usage').doc(key).set({ stamps: FieldValue.arrayRemove(stamp) }, { merge: true });
}

/** Current usage without using a check. */
export async function peek(key, allowance, now = Date.now()) {
  if (allowance.scans === -1) return { used: null, limit: -1, remaining: -1, periodDays: allowance.periodDays, nextAt: null };
  let stamps = memory.get(key);
  if (db) {
    const snap = await db.collection('usage').doc(key).get();
    stamps = snap.exists ? snap.data().stamps : [];
  }
  return evaluate(stamps, allowance, now).usage;
}

/** Daily usage counter for unlimited plans (statistics only). */
async function bumpDaily(key, delta, now) {
  const date = saDate(new Date(now));
  const id = `${key}__${date}`;
  if (!db) {
    memory.set(id, Math.max(0, (memory.get(id) ?? 0) + delta));
    return;
  }
  await db
    .collection('usage')
    .doc(id)
    .set({ key, date, count: FieldValue.increment(delta), expireAt: Timestamp.fromMillis(now + 35 * DAY_MS) }, { merge: true });
}
