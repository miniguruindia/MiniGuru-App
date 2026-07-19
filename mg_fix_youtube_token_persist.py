#!/usr/bin/env python3
"""
mg_fix_youtube_token_persist.py

Rule 24 compliance fix: YOUTUBE_TOKENS must live ONLY in Secret Manager,
never as a Cloud Run env var. The auto-refresh listener in
youtubeUploadService.js was writing YOUTUBE_TOKENS back via
`gcloud run services update --update-env-vars`, which conflicts with the
existing --update-secrets YOUTUBE_TOKENS=YOUTUBE_TOKENS:latest binding and
is the likely root cause of the dropped secret binding from the
July 18-19 session.

Run from repo root:
    cd /workspaces/MiniGuru-App
    python3 mg_fix_youtube_token_persist.py
"""
import re
import sys

PATH = "backend/src/services/youtubeUploadService.js"

with open(PATH, "r") as f:
    content = f.read()

OLD_BLOCK = '''// ── Persist token to Cloud Run (background) ───────────────────────────────────
// Non-blocking — runs as a background shell command.
// If it fails (e.g. no gcloud in Codespace), token still works in memory.
function _saveTokenToCloudRun(tokens) {
  try {
    const t   = JSON.stringify(tokens).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"');
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
}'''

NEW_BLOCK = '''// ── Persist token to Secret Manager (background) ──────────────────────────────
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
}'''

count = content.count(OLD_BLOCK)
if count != 1:
    print(f"❌ ABORTING — expected exactly 1 match, found {count}")
    sys.exit(1)

content = content.replace(OLD_BLOCK, NEW_BLOCK)

with open(PATH, "w") as f:
    f.write(content)

print(f"✅ Patched {PATH} — _saveTokenToCloudRun now uses Secret Manager, not env vars")
