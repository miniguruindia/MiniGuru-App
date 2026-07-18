"use strict";
// backend/src/services/firebaseStorageService.ts
//
// Lets admin directly upload/replace/delete material images from the admin
// panel, instead of the old manual "download from Drive → resize → drag
// into Firebase Console" workflow. Uses the Firebase Admin SDK server-side
// (NOT the client SDK) — needs a service account key, see setup note below.
//
// SETUP REQUIRED (one-time, in Firebase Console + Cloud Run):
//   1. Firebase Console → miniguru-prod → Project Settings → Service Accounts
//      → "Generate new private key" → downloads a JSON file.
//   2. That JSON contains a private key with embedded newlines/slashes —
//      exactly the kind of value that breaks `--update-env-vars` (Rule 24
//      precedent with YOUTUBE_TOKENS). Store it in Secret Manager instead:
//        gcloud secrets create FIREBASE_SERVICE_ACCOUNT_JSON --data-file=/path/to/downloaded-key.json
//        gcloud run services update miniguru-backend --region asia-south1 \
//          --set-secrets FIREBASE_SERVICE_ACCOUNT_JSON=FIREBASE_SERVICE_ACCOUNT_JSON:latest
//   3. Also add it to your local backend/.env for Codespace testing (as a
//      single-line JSON string) — NOT committed to git, same as every other
//      secret in this project.
//
// Bucket is the SAME one already used for material images:
// miniguru-prod.firebasestorage.app (NOT .appspot.com — Rule 30 territory).
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicUrlFor = publicUrlFor;
exports.uploadMaterialImage = uploadMaterialImage;
exports.deleteMaterialImage = deleteMaterialImage;
exports.generateUploadUrl = generateUploadUrl;
exports.downloadToTempFile = downloadToTempFile;
exports.deleteFromStorage = deleteFromStorage;
const app_1 = require("firebase-admin/app");
const storage_1 = require("firebase-admin/storage");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto_1 = require("crypto");
const BUCKET_NAME = 'miniguru-prod.firebasestorage.app';
let app = null;
function ensureInitialized() {
    if (app)
        return app;
    if ((0, app_1.getApps)().length > 0) {
        app = (0, app_1.getApps)()[0];
        return app;
    }
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set. Direct image upload/delete is unavailable until ' +
            'a Firebase service account key is added (see firebaseStorageService.ts setup note).');
    }
    const serviceAccount = JSON.parse(raw);
    app = (0, app_1.initializeApp)({
        credential: (0, app_1.cert)(serviceAccount),
        storageBucket: BUCKET_NAME,
    });
    return app;
}
function extensionFromMime(mimeType) {
    const map = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/webp': 'webp',
        'image/gif': 'gif',
    };
    return map[mimeType] || 'jpg';
}
function publicUrlFor(storagePath) {
    const encoded = encodeURIComponent(storagePath);
    return `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encoded}?alt=media`;
}
/**
 * Uploads a material image buffer to Firebase Storage under materials/ and
 * returns the same kind of public URL every existing material image already
 * uses. Overwrites cleanly if called again for the same materialId (new
 * timestamp in the filename, so browsers/CDNs won't serve a stale cached
 * copy of the old image at the same URL).
 */
async function uploadMaterialImage(buffer, mimeType, materialId) {
    const firebaseApp = ensureInitialized();
    const ext = extensionFromMime(mimeType);
    const storagePath = `materials/${materialId}-${Date.now()}.${ext}`;
    const bucket = (0, storage_1.getStorage)(firebaseApp).bucket();
    const file = bucket.file(storagePath);
    await file.save(buffer, {
        metadata: { contentType: mimeType, cacheControl: 'public, max-age=31536000' },
        public: true,
        validation: false,
    });
    return publicUrlFor(storagePath);
}
/**
 * Deletes a previously-uploaded material image given its full public URL.
 * Safe to call on a URL that doesn't point at our bucket (e.g. a manually
 * pasted external URL from before this feature existed) — silently no-ops
 * rather than throwing, since there's nothing in our bucket to remove.
 */
async function deleteMaterialImage(imageUrl) {
    if (!imageUrl || !imageUrl.includes(BUCKET_NAME))
        return; // not one of ours — nothing to delete
    const firebaseApp = ensureInitialized();
    const match = imageUrl.match(/\/o\/([^?]+)/);
    if (!match)
        return;
    const storagePath = decodeURIComponent(match[1]);
    const bucket = (0, storage_1.getStorage)(firebaseApp).bucket();
    try {
        await bucket.file(storagePath).delete();
    }
    catch (err) {
        // Already gone / never existed — not an error worth surfacing.
        if (err?.code !== 404)
            throw err;
    }
}
/**
 * Generates a short-lived (15 min) signed URL the CLIENT can PUT a file to
 * DIRECTLY — completely bypassing Cloud Run's hard, non-configurable 32MB
 * request body limit, since the upload goes straight to Firebase Storage
 * (a separate Google service) and never touches our own backend's request
 * body at all. Used for video/thumbnail uploads from the Flutter app.
 */
async function generateUploadUrl(folder, ownerUserId, filename, contentType) {
    const firebaseApp = ensureInitialized();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${folder}/${ownerUserId}/${Date.now()}-${safeFilename}`;
    const bucket = (0, storage_1.getStorage)(firebaseApp).bucket();
    const file = bucket.file(storagePath);
    const [uploadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType,
    });
    return { uploadUrl, storagePath };
}
/**
 * Downloads a previously-uploaded file from Firebase Storage to a local
 * temp path on Cloud Run's own disk, for the existing AI review / YouTube
 * upload code (which both expect a local file path) to keep working
 * completely unchanged. This is a server-to-server transfer — Cloud Run's
 * 32MB limit only applies to requests coming INTO Cloud Run from outside,
 * never to Cloud Run's own outbound calls, so this direction is unaffected.
 */
async function downloadToTempFile(storagePath) {
    const firebaseApp = ensureInitialized();
    const bucket = (0, storage_1.getStorage)(firebaseApp).bucket();
    const ext = path.extname(storagePath) || '.mp4';
    const localPath = path.join(os.tmpdir(), `${(0, crypto_1.randomUUID)()}${ext}`);
    await bucket.file(storagePath).download({ destination: localPath });
    return localPath;
}
/**
 * Best-effort cleanup of a temp video upload once YouTube has it — never
 * throws, since a cleanup failure should never affect the actual response.
 * NEVER call this on a thumbnail path — the thumbnail's Firebase Storage
 * URL is the permanent Project.thumbnail reference, not a temp file.
 */
async function deleteFromStorage(storagePath) {
    try {
        const firebaseApp = ensureInitialized();
        const bucket = (0, storage_1.getStorage)(firebaseApp).bucket();
        await bucket.file(storagePath).delete();
    }
    catch (err) {
        // Already gone / never existed / any other issue — logging would be
        // nice but this must never throw and never block a response.
    }
}
