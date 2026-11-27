import { db, FieldValue, Timestamp } from '../firebase.js';
import { saDate } from './util.js';

// Fallback when Firestore isn't configured (local development only — resets on restart).
const memory = new Map();

const docId = (key, date) => `${key}__${date}`;

/**
 * Atomically use one scan from today's allowance.
 * @param {string} key   e.g. "uid:abc", "anon:<hash>", "telegram:<hash>"
 * @param {number} limit daily scans, -1 = unlimited
 */
export async function consume(key, limit) {
  const date = saDate();
  if (limit === -1) {
    // Still count usage for analytics, but never block.
    await bump(key, date, 1);
    return { allowed: true, used: null, limit: -1, remaining: -1 };
  }

  if (!db) {
    const id = docId(key, date);
    const used = memory.get(id) ?? 0;
    if (used >= limit) return { allowed: false, used, limit, remaining: 0 };
    memory.set(id, used + 1);
    return { allowed: true, used: used + 1, limit, remaining: limit - used - 1 };
  }

  const ref = db.collection('usage').doc(docId(key, date));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = snap.exists ? snap.data().count || 0 : 0;
    if (used >= limit) return { allowed: false, used, limit, remaining: 0 };
    tx.set(
      ref,
      {
        key,
        date,
        count: used + 1,
        // Configure a Firestore TTL policy on `expireAt` so old usage rows delete themselves.
        expireAt: Timestamp.fromMillis(Date.now() + 1000 * 60 * 60 * 24 * 35),
      },
      { merge: true },
    );
    return { allowed: true, used: used + 1, limit, remaining: limit - used - 1 };
  });
}

/** Give a scan back when the analysis failed through no fault of the user. */
export async function refund(key) {
  await bump(key, saDate(), -1);
}

async function bump(key, date, delta) {
  if (!db) {
    const id = docId(key, date);
    memory.set(id, Math.max(0, (memory.get(id) ?? 0) + delta));
    return;
  }
  await db
    .collection('usage')
    .doc(docId(key, date))
    .set(
      { key, date, count: FieldValue.increment(delta), expireAt: Timestamp.fromMillis(Date.now() + 1000 * 60 * 60 * 24 * 35) },
      { merge: true },
    );
}

export async function peek(key, limit) {
  const date = saDate();
  let used = 0;
  if (!db) used = memory.get(docId(key, date)) ?? 0;
  else {
    const snap = await db.collection('usage').doc(docId(key, date)).get();
    used = snap.exists ? Math.max(0, snap.data().count || 0) : 0;
  }
  return { used, limit, remaining: limit === -1 ? -1 : Math.max(0, limit - used) };
}
