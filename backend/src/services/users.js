import { db, FieldValue } from '../firebase.js';
import { config } from '../config.js';

export const PLAN_IDS = ['free', 'pro', 'business'];

/** Business-only features. */
export const canUseBusinessMode = (plan) => plan === 'business';

export function planInfo(plan) {
  const p = config.plans[plan] ?? config.plans.free;
  return { id: plan, label: p.label, dailyScans: p.dailyScans };
}

export async function getOrCreateUser(uid, { email = null, name = null } = {}) {
  if (!db) return { uid, email, name, plan: 'free', links: {} };
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    const fresh = { email, name, plan: 'free', links: {}, createdAt: FieldValue.serverTimestamp() };
    await ref.set(fresh);
    return { uid, email, name, plan: 'free', links: {} };
  }
  const data = snap.data();
  // Keep profile details current without an extra write on every request.
  if ((email && data.email !== email) || (name && data.name !== name)) {
    await ref.update({ email: email ?? data.email, name: name ?? data.name });
  }
  return {
    uid,
    email: email ?? data.email ?? null,
    name: name ?? data.name ?? null,
    plan: PLAN_IDS.includes(data.plan) ? data.plan : 'free',
    links: data.links || {},
  };
}

export async function setPlan(uid, plan) {
  if (!PLAN_IDS.includes(plan)) throw new Error(`Unknown plan "${plan}"`);
  await db.collection('users').doc(uid).set({ plan, planUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
