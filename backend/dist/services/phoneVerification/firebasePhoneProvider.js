"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebasePhoneProvider = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const PROJECT_ID = 'miniguru-prod';
// Must match firebaseStorageService.ts — whichever file initialises the
// default Firebase app first wins, and Storage calls bucket() with no name.
const BUCKET_NAME = 'miniguru-prod.firebasestorage.app';
const MAX_PROOF_AGE_SECONDS = 10 * 60;
let app = null;
function ensureApp() {
    if (app)
        return app;
    if ((0, app_1.getApps)().length > 0) {
        app = (0, app_1.getApps)()[0];
        return app;
    }
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw)
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set.');
    app = (0, app_1.initializeApp)({ credential: (0, app_1.cert)(JSON.parse(raw)), storageBucket: BUCKET_NAME });
    return app;
}
exports.firebasePhoneProvider = {
    name: 'firebase',
    mode: 'client',
    isConfigured() {
        return !!(process.env.FIREBASE_WEB_API_KEY && process.env.FIREBASE_WEB_APP_ID && process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    },
    clientConfig() {
        if (!process.env.FIREBASE_WEB_API_KEY || !process.env.FIREBASE_WEB_APP_ID)
            return null;
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
    async verifyClientProof(phoneE164, proof) {
        const auth = (0, auth_1.getAuth)(ensureApp());
        const decoded = await auth.verifyIdToken(proof);
        if (decoded.firebase?.sign_in_provider !== 'phone')
            return false;
        const numberMatches = decoded.phone_number === phoneE164;
        // A proof must be fresh — stops an old token being replayed later.
        const isFresh = Date.now() / 1000 - Number(decoded.auth_time || 0) <= MAX_PROOF_AGE_SECONDS;
        // Privacy: Firebase creates a user record (holding the phone number) when a
        // code is confirmed. We only need the yes/no answer, so remove that record now.
        // Best-effort — if this ever fails, verification itself must still work.
        try {
            await auth.deleteUser(decoded.uid);
        }
        catch (_) {
            /* leave it; can be cleared by hand in Firebase Console → Authentication → Users */
        }
        return numberMatches && isFresh;
    },
};
