import crypto from 'node:crypto';
import { db, FieldValue } from '../firebase.js';
import { sha256, HttpError } from './util.js';

const MAX_KEYS = 5;

/** Personal access keys: used by the browser extension and by Business API integrations. */
export async function createApiKey(uid, label) {
  if (!db) throw new HttpError(503, 'Accounts are not available.');
  const existing = await db.collection('apiKeys').where('uid', '==', uid).count().get();
  if (existing.data().count >= MAX_KEYS) {
    throw new HttpError(400, `You can have up to ${MAX_KEYS} keys. Revoke one first.`);
  }
  const key = `cc_${crypto.randomBytes(24).toString('base64url')}`;
  const id = sha256(key);
  const record = {
    uid,
    label: String(label || 'Untitled key').slice(0, 60),
    prefix: key.slice(0, 9),
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: null,
  };
  await db.collection('apiKeys').doc(id).set(record);
  // The full key is returned exactly once; only its hash is stored.
  return { id, key, label: record.label, prefix: record.prefix };
}

export async function listApiKeys(uid) {
  if (!db) return [];
  const snap = await db.collection('apiKeys').where('uid', '==', uid).get();
  return snap.docs
    .map((d) => {
      const k = d.data();
      return {
        id: d.id,
        label: k.label,
        prefix: k.prefix,
        createdAt: k.createdAt?.toDate?.().toISOString() ?? null,
        lastUsedAt: k.lastUsedAt?.toDate?.().toISOString() ?? null,
      };
    })
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export async function revokeApiKey(uid, id) {
  if (!db) return false;
  const ref = db.collection('apiKeys').doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data().uid !== uid) return false;
  await ref.delete();
  return true;
}

/** @returns {Promise<string|null>} uid that owns the key */
export async function resolveApiKey(key) {
  if (!db || typeof key !== 'string' || !key.startsWith('cc_')) return null;
  const ref = db.collection('apiKeys').doc(sha256(key));
  const snap = await ref.get();
  if (!snap.exists) return null;
  ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => {});
  return snap.data().uid;
}
