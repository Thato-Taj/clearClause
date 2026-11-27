import { db, FieldValue } from '../firebase.js';

const scansOf = (uid) => db.collection('users').doc(uid).collection('scans');

const toIso = (ts) => (ts?.toDate ? ts.toDate().toISOString() : ts ?? null);

/**
 * Persist an analysis result. The original document is never stored — only the
 * findings (which include short quotes) — to keep personal information to a minimum.
 */
export async function saveScan(uid, result, { channel = 'web', fileName = null } = {}) {
  if (!db) return null;
  const ref = await scansOf(uid).add({
    ...result,
    fileName,
    channel,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function listScans(uid, { limit = 50 } = {}) {
  if (!db) return [];
  const snap = await scansOf(uid).orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => {
    const s = d.data();
    return {
      id: d.id,
      title: s.title,
      documentType: s.documentType,
      fileName: s.fileName ?? null,
      channel: s.channel ?? 'web',
      language: s.language,
      score: s.scores?.overall ?? null,
      band: s.scores?.band ?? null,
      counts: s.scores?.counts ?? null,
      createdAt: toIso(s.createdAt),
    };
  });
}

export async function getScan(uid, id) {
  if (!db) return null;
  const snap = await scansOf(uid).doc(id).get();
  if (!snap.exists) return null;
  const s = snap.data();
  return { ...s, id: snap.id, createdAt: toIso(s.createdAt) };
}

export async function updateScan(uid, id, patch) {
  if (!db) return;
  await scansOf(uid).doc(id).update(patch);
}

export async function deleteScan(uid, id) {
  if (!db) return false;
  const ref = scansOf(uid).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

/** POPIA s 24: let people delete everything we hold about them. */
export async function deleteAllUserData(uid) {
  if (!db) return;
  const scans = await scansOf(uid).listDocuments();
  const batchSize = 400;
  for (let i = 0; i < scans.length; i += batchSize) {
    const batch = db.batch();
    scans.slice(i, i + batchSize).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  for (const col of ['apiKeys', 'channelLinks']) {
    const snap = await db.collection(col).where('uid', '==', uid).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await db.collection('users').doc(uid).delete();
}
