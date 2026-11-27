import crypto from 'node:crypto';
import { db, FieldValue, Timestamp } from '../firebase.js';
import { pseudonym } from './util.js';

export const CHANNELS = ['telegram', 'whatsapp'];
const CODE_TTL_MS = 15 * 60 * 1000;

const linkId = (channel, channelUserId) => `${channel}_${pseudonym(`${channel}:${channelUserId}`)}`;

/** One-time 6-digit code the user sends to a bot to connect it to their account. */
export async function createLinkCode(uid) {
  if (!db) throw new Error('Accounts are not available.');
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(crypto.randomInt(100000, 1000000));
    const ref = db.collection('linkCodes').doc(code);
    const created = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists && snap.data().expiresAt.toMillis() > Date.now()) return false;
      tx.set(ref, { uid, expiresAt: Timestamp.fromMillis(Date.now() + CODE_TTL_MS) });
      return true;
    });
    if (created) return { code, expiresInMinutes: CODE_TTL_MS / 60000 };
  }
  throw new Error('Could not create a link code. Please try again.');
}

/** @returns {Promise<string|null>} the linked uid, or null if the code is invalid/expired */
export async function redeemLinkCode(code, channel, channelUserId) {
  if (!db || !/^\d{6}$/.test(code)) return null;
  const codeRef = db.collection('linkCodes').doc(code);
  const linkRef = db.collection('channelLinks').doc(linkId(channel, channelUserId));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(codeRef);
    if (!snap.exists || snap.data().expiresAt.toMillis() < Date.now()) return null;
    const { uid } = snap.data();
    tx.delete(codeRef);
    tx.set(linkRef, { uid, channel, linkedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection('users').doc(uid), { links: { [channel]: { linkedAt: new Date().toISOString() } } }, { merge: true });
    return uid;
  });
}

export async function getLinkedUid(channel, channelUserId) {
  if (!db) return null;
  const snap = await db.collection('channelLinks').doc(linkId(channel, channelUserId)).get();
  return snap.exists ? snap.data().uid : null;
}

export async function unlinkFromChat(channel, channelUserId) {
  if (!db) return false;
  const ref = db.collection('channelLinks').doc(linkId(channel, channelUserId));
  const snap = await ref.get();
  if (!snap.exists) return false;
  const { uid } = snap.data();
  await ref.delete();
  await db.collection('users').doc(uid).update({ [`links.${channel}`]: FieldValue.delete() });
  return true;
}

export async function unlinkFromAccount(uid, channel) {
  if (!db) return;
  const snap = await db.collection('channelLinks').where('uid', '==', uid).where('channel', '==', channel).get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  batch.update(db.collection('users').doc(uid), { [`links.${channel}`]: FieldValue.delete() });
  await batch.commit();
}

// Per-chat preferences (language). Stored against a pseudonym, never the raw number.
const prefsMemory = new Map();

export async function getChatPrefs(channel, channelUserId) {
  const id = linkId(channel, channelUserId);
  if (!db) return prefsMemory.get(id) ?? {};
  const snap = await db.collection('chatPrefs').doc(id).get();
  return snap.exists ? snap.data() : {};
}

export async function setChatPrefs(channel, channelUserId, prefs) {
  const id = linkId(channel, channelUserId);
  if (!db) {
    prefsMemory.set(id, { ...(prefsMemory.get(id) ?? {}), ...prefs });
    return;
  }
  await db.collection('chatPrefs').doc(id).set(prefs, { merge: true });
}
