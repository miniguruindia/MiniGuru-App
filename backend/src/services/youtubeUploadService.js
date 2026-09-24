// backend/src/services/youtubeUploadService.js
// AUTO-REFRESH: Google OAuth library refreshes the token silently.
// The 'tokens' event fires whenever a new access_token is issued.
// We persist it back to Cloud Run so it survives restarts too.
const { google }     = require('googleapis');
const fs             = require('fs');
const { execSync }   = require('child_process');
const multer         = require('multer');

// Best-effort YouTube-quota tracking for the admin cost dashboard — never
// lets a tracking failure affect the real upload/publish call.
//
// (Sept 2026) videos.insert (upload) has its OWN separate quota bucket on
// Google's side, distinct from the shared 10,000/day pool everything else
// draws from — trackYoutubeUpload() below records against that separate
// bucket, never the shared one. See costTracking.ts for the full context.
function trackYoutubeUnits(units) {
  try {
    const { recordYoutubeUnits } = require('../utils/costTracking');
    recordYoutubeUnits(units).catch(() => {});
  } catch {
    // costTracking not resolvable (e.g. dist/ layout differs) — never block.
  }
}

function trackYoutubeUpload() {
  try {
    const { recordYoutubeUpload } = require('../utils/costTracking');
    recordYoutubeUpload().catch(() => {});
  } catch {
    // costTracking not resolvable (e.g. dist/ layout differs) — never block.
  }
}

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

// ── Persist token to Secret Manager (background) ──────────────────────────────
// Rule 24: YOUTUBE_TOKENS must live in Secret Manager ONLY, never as a Cloud
// Run env var. Writing it as --update-env-vars conflicts with the
// --update-secrets binding and can silently detach the secret from the
// service (this is what caused the July 18-19 outage). We write a new
// secret VERSION instead — this never touches env vars or the service's
// env/secret bindings at all.
// Non-blocking — fire and forget. If gcloud isn't available (e.g. plain
// Codespace dev run), this just fails quietly and the token still works
// in memory for the life of the process.
function _saveTokenToCloudRun(tokens) {
  try {
    const t = JSON.stringify(tokens);
    const { spawn } = require('child_process');
    const child = spawn('gcloud', [
      'secrets', 'versions', 'add', 'YOUTUBE_TOKENS',
      '--data-file=-'
    ], { stdio: ['pipe', 'ignore', 'ignore'] });
    child.stdin.write(t);
    child.stdin.end();
    child.on('error', (err) => {
      console.warn('⚠️  Token persist to Secret Manager failed (non-fatal):', err.message);
    });
    child.on('exit', (code) => {
      if (code === 0) console.log('✅  Token persisted as new YOUTUBE_TOKENS secret version');
      else console.warn(`⚠️  Token persist exited with code ${code} (non-fatal)`);
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
    // BUGFIX (Aug 2026): 'youtube' alone covers uploads, publish/unlisted
    // status changes, deletes, etc. — but commentThreads.insert (posting a
    // reply as the channel) requires the SEPARATE force-ssl scope. Without
    // it, YouTube returns "Request had insufficient authentication scopes"
    // on every comment push, even though the token is otherwise perfectly
    // healthy. Re-authorizing at /setup-youtube with BOTH scopes fixes it —
    // the new token (with both grants) then gets pasted into Secret
    // Manager exactly like any other token refresh (Rule 24).
    scope: [
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.force-ssl',
    ],
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
        status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false, embeddable: true },
      },
      media: { body: fs.createReadStream(videoPath) },
    });

    console.log(`✅  Uploaded UNLISTED: ${res.data.id}`);
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    trackYoutubeUpload(); // videos.insert — own separate bucket, cost 1

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
    requestBody: { id: videoId, status: { privacyStatus: 'public', selfDeclaredMadeForKids: false, embeddable: true } },
  });
  console.log(`✅  Video ${videoId} set to PUBLIC`);
  trackYoutubeUnits(50);
  return true;
}

// ── Set video PRIVATE (called on approval when the uploader explicitly
// chose Private — true YouTube Private, distinct from the Unlisted state
// every video starts in. Only reachable via videos.update, never at
// upload time, for the same reviewability reason Unlisted is used first. ──
async function setVideoPrivate(videoId) {
  const youtube = google.youtube({ version: 'v3', auth: getOAuth2Client() });
  await youtube.videos.update({
    part: 'status',
    requestBody: { id: videoId, status: { privacyStatus: 'private', selfDeclaredMadeForKids: false, embeddable: true } },
  });
  console.log(`🔒  Video ${videoId} set to PRIVATE`);
  trackYoutubeUnits(50);
  return true;
}

// ── Check YouTube's own reported status for a video (Sept 2026) ───────────────
// This is the mechanism for surfacing a Content ID block into MiniGuru's own
// admin review queue, WITHOUT needing YouTube Content Manager / CMS partner
// access (which this project does not have and is unlikely to ever qualify
// for at this scale). The public Data API does not expose live Content ID
// match results directly — but when a claim actually REJECTS the video (the
// common outcome for a full, unmodified copyrighted upload), that shows up
// as status.uploadStatus === 'rejected' with status.rejectionReason ===
// 'claim'. A claim that merely tracks/monetizes a video without blocking it
// is genuinely invisible via this API — be upfront about that limitation
// anywhere this result is surfaced (see the admin badge tooltip).
//
// Never throws — every caller treats a check failure as "unknown", never as
// a reason to block anything on its own (the ONE place this DOES block an
// action — publishAndAwardProject — only blocks on an actual, positive
// 'rejected'/'failed'/'deleted' result, never on a failed check itself).
async function checkVideoStatus(videoId) {
  try {
    const youtube = google.youtube({ version: 'v3', auth: getOAuth2Client() });
    const res = await youtube.videos.list({ part: 'status,contentDetails', id: videoId });
    trackYoutubeUnits(1); // videos.list — cheap, shared 10,000/day pool

    const item = res.data.items && res.data.items[0];
    if (!item) {
      // Not found via the API at all (deleted, or id somehow wrong).
      return {
        uploadStatus: 'notFound', statusReason: null, regionsBlocked: 0, checkedAt: new Date(),
      };
    }

    const status = item.status || {};
    const blocked = (item.contentDetails && item.contentDetails.regionRestriction &&
      item.contentDetails.regionRestriction.blocked) || [];

    return {
      uploadStatus: status.uploadStatus || null,
      // rejectionReason (e.g. "claim") only present when uploadStatus is
      // 'rejected'; failureReason only present when it's 'failed'. Never
      // both at once — collapse to one field for simplicity downstream.
      statusReason: status.rejectionReason || status.failureReason || null,
      regionsBlocked: blocked.length,
      checkedAt: new Date(),
    };
  } catch (err) {
    console.warn(`⚠️  checkVideoStatus(${videoId}) failed (non-fatal):`, err.message);
    return { uploadStatus: null, statusReason: null, regionsBlocked: 0, checkedAt: new Date(), error: err.message };
  }
}

// ── Delete video (called on admin rejection) ──────────────────────────────────
async function deleteVideo(videoId) {
  const youtube = google.youtube({ version: 'v3', auth: getOAuth2Client() });
  await youtube.videos.delete({ id: videoId });
  console.log(`🗑️   Video ${videoId} deleted`);
  return true;
}

module.exports = { upload, getAuthUrl, handleCallback, uploadToYouTube, setVideoPublic, setVideoPrivate, deleteVideo, checkVideoStatus, refreshTokenNow, getOAuth2Client };
