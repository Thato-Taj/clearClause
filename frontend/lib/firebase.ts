// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDCe2M6fM8_Hh4V0nyRYHCT92ZY_FhNkNw",
  authDomain: "clearclause-382dd.firebaseapp.com",
  projectId: "clearclause-382dd",
  storageBucket: "clearclause-382dd.firebasestorage.app",
  messagingSenderId: "850426715762",
  appId: "1:850426715762:web:e31f1d67e41102920a2ceb",
  measurementId: "G-XH5BR2PNN9"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
//const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
