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

import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

const BUCKET_NAME = 'miniguru-prod.firebasestorage.app';
let app: App | null = null;

function ensureInitialized(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0]!;
    return app;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON is not set. Direct image upload/delete is unavailable until ' +
      'a Firebase service account key is added (see firebaseStorageService.ts setup note).'
    );
  }
  const serviceAccount = JSON.parse(raw);
  app = initializeApp({
    credential: cert(serviceAccount),
    storageBucket: BUCKET_NAME,
  });
  return app;
}

function extensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mimeType] || 'jpg';
}

function publicUrlFor(storagePath: string): string {
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
export async function uploadMaterialImage(
  buffer: Buffer,
  mimeType: string,
  materialId: string
): Promise<string> {
  const firebaseApp = ensureInitialized();
  const ext = extensionFromMime(mimeType);
  const storagePath = `materials/${materialId}-${Date.now()}.${ext}`;
  const bucket = getStorage(firebaseApp).bucket();
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
export async function deleteMaterialImage(imageUrl: string): Promise<void> {
  if (!imageUrl || !imageUrl.includes(BUCKET_NAME)) return; // not one of ours — nothing to delete
  const firebaseApp = ensureInitialized();
  const match = imageUrl.match(/\/o\/([^?]+)/);
  if (!match) return;
  const storagePath = decodeURIComponent(match[1]);
  const bucket = getStorage(firebaseApp).bucket();
  try {
    await bucket.file(storagePath).delete();
  } catch (err: any) {
    // Already gone / never existed — not an error worth surfacing.
    if (err?.code !== 404) throw err;
  }
}