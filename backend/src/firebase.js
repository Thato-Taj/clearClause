import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { config } from './config.js';
import { log } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadServiceAccount() {
  if (process.env.FIREBASE_DISABLED === '1') return null;
  if (config.firebase.serviceAccountJson) {
    return JSON.parse(config.firebase.serviceAccountJson);
  }
  const candidates = [
    config.firebase.serviceAccountPath,
    path.join(__dirname, 'serviceAccountKey.json'),
    path.join(__dirname, '../serviceAccountKey.json'),
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) return null;
  return JSON.parse(fs.readFileSync(found, 'utf8'));
}

let db = null;
let auth = null;

try {
  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
    db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });
    auth = getAuth(app);
    log.info('firebase: connected', { project: serviceAccount.project_id });
  } else {
    log.warn('firebase: not configured — running without accounts, history or persistent quotas');
  }
} catch (err) {
  db = null;
  auth = null;
  log.error('firebase: failed to initialise', { error: err.message });
}

export { db, auth, FieldValue, Timestamp };
