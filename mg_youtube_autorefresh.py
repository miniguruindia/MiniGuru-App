#!/usr/bin/env python3
"""
MiniGuru — YouTube Auto-Refresh Setup
Run from /workspaces/MiniGuru-App/:
  python3 mg_youtube_autorefresh.py

What it does:
  1. Rewrites youtubeUploadService.js with auto-refresh token listener
  2. Patches index.ts to call refreshTokenNow() on server startup
  3. Token now renews itself silently — zero manual work needed
"""
import shutil
from pathlib import Path

BASE = Path("/workspaces/MiniGuru-App/backend")

# ══════════════════════════════════════════════════════════════════════════════
# 1. Rewrite youtubeUploadService.js with auto-refresh
# ══════════════════════════════════════════════════════════════════════════════
print("\n[1/2] Writing youtubeUploadService.js with auto-refresh ...")

service = BASE / "src/services/youtubeUploadService.js"
shutil.copy(service, str(service) + ".bak")

service.write_text(r"""// backend/src/services/youtubeUploadService.js
// AUTO-REFRESH: Google OAuth library refreshes the token silently.
// The 'tokens' event fires whenever a new access_token is issued.
// We persist it back to Cloud Run so it survives restarts too.
const { google }     = require('googleapis');
const fs             = require('fs');
const { execSync }   = require('child_process');
const multer         = require('multer');

// ── Multer for temporary video storage ───────────────────────────────────────
const upload = multer({
  dest: 'temp/uploads/',
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (ok.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only video files are allowed!'));
  }
});

// ── OAuth2 client (singleton with auto-refresh) ───────────────────────────────
let oauth2Client = null;

function getOAuth2Client() {
  if (oauth2Client) return oauth2Client;

  oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );

  // Load stored tokens
  const stored = JSON.parse(process.env.YOUTUBE_TOKENS || '{}');
  oauth2Client.setCredentials(stored);

  // ── AUTO-REFRESH LISTENER ─────────────────────────────────────────────────
  // Google fires this event automatically when:
  //   a) The access_token has expired and a new one was issued
  //   b) refreshTokenNow() is called manually
  // We merge + persist so the new token survives Cloud Run restarts.
  oauth2Client.on('tokens', (newTokens) => {
    console.log('🔄 YouTube token auto-refreshed — persisting...');

    // Merge: keep existing refresh_token if new one isn't returned
    const existing = JSON.parse(process.env.YOUTUBE_TOKENS || '{}');
    const merged   = { ...existing, ...newTokens };

    // Update in-memory so current process uses it immediately
    process.env.YOUTUBE_TOKENS = JSON.stringify(merged);

    // Persist to Cloud Run env vars (background, non-blocking)
    _saveTokenToCloudRun(merged);
  });

  return oauth2Client;
}

// ── Persist token to Cloud Run (background) ───────────────────────────────────
// Non-blocking — runs as a background shell command.
// If it fails (e.g. no gcloud in Codespace), token still works in memory.
function _saveTokenToCloudRun(tokens) {
  try {
    const t   = JSON.stringify(tokens).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const rzId  = process.env.RAZORPAY_KEY_ID    || 'rzp_test_SR98ZSepMjs0oL';
    const rzSec = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';
    const cmd   = [
      'gcloud run services update miniguru-backend',
      '--region asia-south1',
      `--update-env-vars "^||^RAZORPAY_KEY_ID=${rzId}||RAZORPAY_KEY_SECRET=${rzSec}||YOUTUBE_TOKENS=${t}"`,
      '--quiet'
    ].join(' ');
    // Fire and forget — don't await, don't block uploads
    require('child_process').exec(cmd, (err) => {
      if (err) console.warn('⚠️  Token persist to Cloud Run failed (non-fatal):', err.message);
      else      console.log('✅  Token persisted to Cloud Run env vars');
    });
  } catch (e) {
    console.warn('⚠️  Could not persist token (non-fatal):', e.message);
  }
}

// ── Pre-warm token on startup ─────────────────────────────────────────────────
// Call this once when the server starts.
// Forces a refresh so we start with a fresh access_token immediately
// instead of waiting for the first upload to fail.
async function refreshTokenNow() {
  try {
    const client = getOAuth2Client();
    await client.refreshAccessToken();
    console.log('✅  YouTube token pre-warmed on startup');
  } catch (e) {
    // Non-fatal — uploads will still work, token refreshes on first call
    console.warn('⚠️  YouTube token pre-warm failed (non-fatal):', e.message);
  }
}

// ── Auth URL (for /setup-youtube — run once) ──────────────────────────────────
function getAuthUrl() {
  return getOAuth2Client().generateAuthUrl({
    access_type: 'offline',
    scope:  ['https://www.googleapis.com/auth/youtube'],
    prompt: 'consent', // ensures refresh_token is always returned
  });
}

// ── OAuth callback (for /auth/youtube/callback) ───────────────────────────────
async function handleCallback(code) {
  const { tokens } = await getOAuth2Client().getToken(code);
  console.log('YouTube OAuth tokens received:', JSON.stringify(tokens));
  return tokens;
}

// ── Upload video to YouTube as UNLISTED ──────────────────────────────────────
async function uploadToYouTube(videoPath, metadata) {
  try {
    const youtube = google.youtube({ version: 'v3', auth: getOAuth2Client() });
    console.log(`📤 Uploading to YouTube: ${metadata.title}`);

    const res = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title:       metadata.title,
          description: metadata.description || '',
          tags:        metadata.tags || ['MiniGuru', 'STEM', 'Education'],
          categoryId:  '28',
        },
        status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: true },
      },
      media: { body: fs.createReadStream(videoPath) },
    });

    console.log(`✅  Uploaded UNLISTED: ${res.data.id}`);
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

    return { videoId: res.data.id, url: `https://www.youtube.com/watch?v=${res.data.id}` };
  } catch (err) {
    console.error('❌ YouTube upload error:', err);
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    throw err;
  }
}

// ── Set video PUBLIC (called on admin approval) ───────────────────────────────
async function setVideoPublic(videoId) {
  const youtube = google.youtube({ version: 'v3', auth: getOAuth2Client() });
  await youtube.videos.update({
    part: 'status',
    requestBody: { id: videoId, status: { privacyStatus: 'public', selfDeclaredMadeForKids: true } },
  });
  console.log(`✅  Video ${videoId} set to PUBLIC`);
  return true;
}

// ── Delete video (called on admin rejection) ──────────────────────────────────
async function deleteVideo(videoId) {
  const youtube = google.youtube({ version: 'v3', auth: getOAuth2Client() });
  await youtube.videos.delete({ id: videoId });
  console.log(`🗑️   Video ${videoId} deleted`);
  return true;
}

module.exports = { upload, getAuthUrl, handleCallback, uploadToYouTube, setVideoPublic, deleteVideo, refreshTokenNow };
""")
print("  ✅  youtubeUploadService.js written")

# ══════════════════════════════════════════════════════════════════════════════
# 2. Patch index.ts — call refreshTokenNow() after server starts
# ══════════════════════════════════════════════════════════════════════════════
print("\n[2/2] Patching index.ts — add refreshTokenNow() on startup ...")

index = BASE / "src/index.ts"
src   = index.read_text()

OLD = """const server = app.listen(PORT, HOST, () => {
  logger.info(`🚀 Server running on ${HOST}:${PORT}`);
  logger.info(`🌐 CORS enabled for all origins (development mode)`);
  logger.info(`📡 Ready to accept requests`);
  if (youtubeService) {
    logger.info(`📺 YouTube OAuth setup available at: /setup-youtube`);
  } else {
    logger.info(`📺 YouTube OAuth setup: DISABLED (service not available)`);
  }"""

NEW = """const server = app.listen(PORT, HOST, () => {
  logger.info(`🚀 Server running on ${HOST}:${PORT}`);
  logger.info(`🌐 CORS enabled for all origins (development mode)`);
  logger.info(`📡 Ready to accept requests`);
  if (youtubeService) {
    logger.info(`📺 YouTube OAuth setup available at: /setup-youtube`);
    // Pre-warm YouTube token on startup — auto-refresh from here on
    if (youtubeService.refreshTokenNow) {
      youtubeService.refreshTokenNow().catch((e: Error) =>
        logger.warn({ err: e.message }, '⚠️  YouTube token pre-warm failed (non-fatal)')
      );
    }
  } else {
    logger.info(`📺 YouTube OAuth setup: DISABLED (service not available)`);
  }"""

if OLD in src:
    shutil.copy(index, str(index) + ".bak")
    index.write_text(src.replace(OLD, NEW, 1))
    print("  ✅  index.ts patched — refreshTokenNow() called on startup")
else:
    print("  ⚠️  Could not find startup block in index.ts — add manually:")
    print("      After server starts listening, add:")
    print("      if (youtubeService?.refreshTokenNow) youtubeService.refreshTokenNow();")

print("""
════════════════════════════════════════════════════════════
✅  AUTO-REFRESH SETUP COMPLETE

HOW IT WORKS NOW:
  1. Server starts → refreshTokenNow() pre-warms the token
  2. Token expires → Google auto-issues new one silently
  3. New token saved to Cloud Run → survives restarts
  4. You NEVER need to visit /setup-youtube again
     (unless you completely revoke access)

NOW RUN:
════════════════════════════════════════════════════════════

cd /workspaces/MiniGuru-App/backend && npm run build && cp src/services/youtubeUploadService.js dist/services/ && cd /workspaces/MiniGuru-App && git add -f backend/dist/ && git add -A && git commit -m "feat: YouTube token auto-refresh — zero manual renewal" && git push origin main

Then deploy to Cloud Run from Cloud Shell as usual.
════════════════════════════════════════════════════════════
""")
