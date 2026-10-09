// backend/src/services/phoneVerification/firebasePhoneProvider.ts
//
// Firebase Phone Auth. The browser (Firebase JS SDK, loaded from index.html)
// sends and checks the SMS code, then gives us a Firebase ID token. We never
// trust the browser's word — we verify the token's signature with the Admin
// SDK and confirm the phone number INSIDE the token is the one on this
// account. Nothing from Firebase is stored; we only flip phoneVerified.
//
// Public web settings (not secrets — they ship in every Firebase web app):
//   FIREBASE_WEB_API_KEY   Firebase Console → Project settings → Your apps → Web app → apiKey
//   FIREBASE_WEB_APP_ID    same place → appId
//   FIREBASE_AUTH_DOMAIN   optional, defaults to miniguru-prod.firebaseapp.com
// Until both of the first two are set, isConfigured() is false and the app
// shows "being set up" instead of failing.

import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { PhoneVerificationProvider } from './types';

const PROJECT_ID = 'miniguru-prod';
// Must match firebaseStorageService.ts — whichever file initialises the
// default Firebase app first wins, and Storage calls bucket() with no name.
const BUCKET_NAME = 'miniguru-prod.firebasestorage.app';
const MAX_PROOF_AGE_SECONDS = 10 * 60;

let app: App | null = null;

function ensureApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0]!;
    return app;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set.');
  app = initializeApp({ credential: cert(JSON.parse(raw)), storageBucket: BUCKET_NAME });
  return app;
}

export const firebasePhoneProvider: PhoneVerificationProvider = {
  name: 'firebase',
  mode: 'client',

  isConfigured() {
    return !!(process.env.FIREBASE_WEB_API_KEY && process.env.FIREBASE_WEB_APP_ID && process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  },

  clientConfig() {
    if (!process.env.FIREBASE_WEB_API_KEY || !process.env.FIREBASE_WEB_APP_ID) return null;
    return {
      apiKey: process.env.FIREBASE_WEB_API_KEY,
      appId: process.env.FIREBASE_WEB_APP_ID,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${PROJECT_ID}.firebaseapp.com`,
      projectId: PROJECT_ID,
    };
  },

  async sendOtp() {
    throw new Error('Firebase sends the SMS from the browser — the backend never sends it.');
  },

  async verifyOtp() {
    throw new Error('Firebase checks the code in the browser — use verifyClientProof.');
  },

  async verifyClientProof(phoneE164: string, proof: string) {
    const decoded = await getAuth(ensureApp()).verifyIdToken(proof);
    if (decoded.firebase?.sign_in_provider !== 'phone') return false;
    if (decoded.phone_number !== phoneE164) return false;
    // A proof must be fresh — stops an old token being replayed later.
    if (Date.now() / 1000 - Number(decoded.auth_time || 0) > MAX_PROOF_AGE_SECONDS) return false;
    return true;
  },
};
