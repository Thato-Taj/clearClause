import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebase web config is public by design; access is enforced by Firestore rules and the API.
const firebaseConfig = {
  apiKey: 'AIzaSyDCe2M6fM8_Hh4V0nyRYHCT92ZY_FhNkNw',
  authDomain: 'clearclause-382dd.firebaseapp.com',
  projectId: 'clearclause-382dd',
  storageBucket: 'clearclause-382dd.firebasestorage.app',
  messagingSenderId: '850426715762',
  appId: '1:850426715762:web:e31f1d67e41102920a2ceb',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
