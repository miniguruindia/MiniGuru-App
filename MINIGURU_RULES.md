# MINIGURU — PROJECT RULES
## Non-Negotiable Rules for All Development Sessions

**Project:** MiniGuru Innovation Private Limited | Ujjain MP
**App:** miniguru.in | **Backend:** miniguru-backend-130420985234.asia-south1.run.app | **Admin:** admin.miniguru.in
**Last updated:** October 24, 2026

This file holds NO passwords, keys or database addresses, only where each secret lives. A secret pasted into chat, a doc or the repo counts as exposed: tell Pramod. (Key rotation is on hold by Pramod's decision, 22 Oct 2026.)

---

## 🔴 CRITICAL — Breaking these causes data loss, outages, or misattributed money/Goins

| # | Rule | Why |
|---|---|---|
| 1 | **Goins = user.score ONLY — NEVER wallet.balance** | wallet.balance = real Razorpay money. Mixing causes financial corruption |
| 25 | ~~Goins = motivation tracker ONLY. Never deducted.~~ **SUPERSEDED Aug 2026 — see Rule 25b** | Materials now cost Goins again; negative balance (debt) allowed |
| 25b | **(See also Rules 56 to 58.) Materials cost Goins at video upload. If it goes negative, planning/upload is never blocked — debt is repaid by earning more Goins. Approving a MATERIAL_OVERSPEND audit record never credits Goins** | Reversing this without the debt-not-credit distinction breaks the whole design — materials become free again |
| 26 | **Shop = Amazon affiliate (miniguru04-21) only. No own-store/Razorpay flows yet** | No own inventory until confirmed |
| 19 | **Always --update-env-vars, NEVER --set-env-vars on Cloud Run** | --set-env-vars wipes ALL env vars including DATABASE_URL |
| 23 | **Verify DATABASE_URL exists after any Cloud Run env operation** | Silent DB connection loss = all APIs return 500 |
| 27 | **Always rebuild dist/ before Cloud Run deploy** | Cloud Run runs dist/ JS, not src/ TS — skipping this silently ignores every backend change |
| 36 | **A project's owner during a child PIN session is the child's `linkedUserId`, never the mentor's JWT `userId`** | Misattributes uploads and Goins to the wrong account — see `resolveSubject.ts` / `createProject` |

---

## 🟠 BACKEND DEPLOY: every single time, from Cloud Shell (Codespace is not used any more)

Pramod deploys from a Claude-written patch script. One command per code block:

```bash
cd ~/MiniGuru-App && git pull origin main && python3 ~/patch_xxx.py
```
```bash
cd backend && npm install && npx prisma@5.22.0 generate && npm run build && cp src/services/youtubeUploadService.js dist/services/ && cd ..
```
```bash
git add -A && git add -f backend/dist/ && git commit -m "hyphenated-short-message" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" && git push origin main
```
```bash
cd backend && gcloud run deploy miniguru-backend --source . --region asia-south1 --project miniguru-prod --allow-unauthenticated; cd ..
```
```bash
gcloud run services describe miniguru-backend --region asia-south1 --project miniguru-prod --format="value(spec.template.spec.containers[0].env[].name)" | tr ';' '\n' | grep -cE "DATABASE_URL|JWT_SECRET|RESEND_API_KEY|GEMINI_API_KEY|YOUTUBE_CLIENT_SECRET"
```
(should print 5)
```bash
rm -f ~/patch_xxx.py
```

**Why:** Cloud Run runs `dist/` JS, NOT `src/` TypeScript. If dist/ is not rebuilt and committed, ALL backend changes are silently ignored (Rule 27).

App-only or admin-only patch: skip the build, deploy and secrets lines (commit and push only).

---

## 🟡 FLUTTER AND ADMIN DEPLOY

- **Flutter web** deploys itself: GitHub Action "Build & Deploy Flutter Web" runs when a push touches `app/miniguru/**` (or the workflow file) and publishes to Firebase Hosting. Flutter is locked at 3.27.4 (use `withOpacity`, not `withValues`). The Claude sandbox cannot compile Flutter, so ALWAYS check the Action run after a push. Manual fallback: `cd app/miniguru && flutter pub get && flutter build web --release --no-tree-shake-icons && firebase deploy --only hosting`.
- **Admin** (Next.js) deploys itself on Vercel when `admin/**` changes on main.

---

## 📋 ALL RULES

| # | Rule | Consequence of Breaking |
|---|---|---|
| 1 | Goins = user.score ONLY — NEVER wallet.balance | Financial data corruption |
| 2 | npm run dev in Codespace only. npm run build ONLY for dist/ compilation | youtubeUploadService.js breaks tsc |
| 3 | GoogleFonts.nunito(fontWeight: FontWeight.w900) — NEVER fredokaOne or poppins | Build crashes — fredokaOne not in google_fonts 6.2.1 |
| 4 | npx prisma@5.22.0 generate after EVERY schema.prisma change | Runtime errors — client doesn't match schema |
| 5 | Export default at END of route files | Routes defined after export are invisible to Express |
| 6 | req.user?.userId NOT req.user?.id in controllers | Auth breaks — middleware spreads userId separately |
| 7 | NEVER devcontainer.json on free Codespaces | Environment rebuild wipes Flutter installation |
| 8 | Import Prisma ONLY from utils/prismaClient.ts | Multiple client instances, connection pool issues |
| 9 | set +H before any sed with ! character | bash history expansion breaks the command |
| 10 | NEVER build Flutter + backend simultaneously | Flutter build kills backend process (RAM exhaustion) |
| 11 | npm run build is for dist/ compilation only — never for Codespace serving | Confusion between build modes |
| 12 | Always cp youtubeUploadService.js to dist/services/ after npm run build | Cloud Run crashes — .js file excluded from tsc |
| 13 | Create fresh .gcloudignore in Cloud Shell before every deploy | node_modules uploaded → deploy timeout |
| 14 | git add -f backend/dist/ before every commit with backend changes | dist/ not pushed → stale build on Cloud Run |
| 15 | MongoDB Atlas free tier pauses after 60 days inactivity | Backend fails silently — check cloud.mongodb.com on 500 errors |
| 16 | Cloudflare proxy MUST be grey/DNS-only for Firebase + Vercel records | SSL minting fails |
| 17 | FROM_EMAIL = connect@miniguru.in — NEVER noreply@ | Emails bounce |
| 18 | PORT is reserved by Cloud Run — never include in --update-env-vars | Container crash on startup |
| 19 | Always --update-env-vars, NEVER --set-env-vars or --env-vars-file | Wipes ALL Cloud Run env vars including DATABASE_URL |
| 20 | Firebase Storage for images — NEVER Google Drive for production image hosting | Google Drive rate-limits under load |
| 21 | Never run node script.js directly from Codespace for MongoDB Atlas connection | SRV DNS resolution fails in Codespace |
| 22 | Never use SMTP on Cloud Run. Email goes by the Resend HTTP API (active since Aug 2026; SendGrid is a dormant fallback) | Google Cloud blocks SMTP ports 25, 465, 587 |
| 23 | Always --update-env-vars. Verify DATABASE_URL after any env op | DB connection silently lost |
| 24 | YOUTUBE_TOKENS in Secret Manager only — never as env var | Double-slash `//` in token breaks gcloud parsing. Same applies to FIREBASE_SERVICE_ACCOUNT_JSON (Rule 40) |
| 25 | ~~Goins = motivation tracker ONLY. Never deducted for anything~~ **SUPERSEDED Aug 2026** — see Rule 25b below | Was the June 2, 2026 architecture; formally reversed, not accidentally drifted |
| 25b | Materials cost Goins, deducted once at video upload (not live during planning — drafts are local-only, upload is the one reliable server round-trip). If it goes negative, upload still proceeds; an already-resolved `GoinTopUpRequest` (requestType: MATERIAL_OVERSPEND, status: APPROVED, decidedByRole: AUTO) is logged for admin's audit trail. The debt is real and repaid by earning more Goins normally — approving/auto-resolving a MATERIAL_OVERSPEND record must NEVER credit Goins, or materials become free again | Confirmed design, Aug 2026. The original DIRECT_TOPUP flow (child/mentor directly asks for bonus Goins) is unaffected and still credits on approval — only MATERIAL_OVERSPEND is credit-free |
| 26 | Shop = Amazon affiliate (miniguru04-21) only for now | No own-inventory Razorpay until explicitly confirmed |
| 27 | ALWAYS rebuild dist/ before Cloud Run deploy | Cloud Run runs dist/ JS — src/ TS changes are ignored otherwise |
| 28 | Express route ordering: /admin/* routes MUST come before /:id | Express matches /:id for /admin/all — returns wrong handler |
| 29 | Use 'key' in body (not !== undefined) to check request body fields | Destructuring assigns undefined to missing keys — checks always false |
| 30 | Never replace Firebase imageUrl with Amazon product image URLs | Amazon images can expire or change — Firebase images are permanent |
| 31 | StatefulBuilder local vars reset on parent setState — use class-level vars for persistent state flags | Double-send bugs, UI state loss |
| 32 | Verify large file pastes (>200 lines) with `wc -l` + `tail -5` (+ brace/paren count where practical) before building or committing — especially on mobile Codespace | Mobile terminal pastes (and interrupted pastes) can silently truncate or corrupt with no error message |
| 33 | Never use literal emoji characters inside Python anchor-script string literals for `str.count()`/`str.replace()` matching | A visually identical emoji can carry an invisible variation-selector byte that fails exact-string matching silently — use Unicode escapes or emoji-free anchors |
| 34 | Test all multi-file Python patch scripts against a fresh clone with a real compile (tsc/flutter analyze) before handing off | Escaping bugs (dollar signs, backticks) generating Dart/TS code must be caught here, not in production |
| 35 | Commit and push at natural checkpoints, not only at end of session | GitHub deletes stopped Codespaces after 30 days inactivity — uncommitted work is unrecoverable |
| 36 | Project ownership during a child PIN session = `req.subject.linkedUserId` (via `resolveSubject` middleware), never the mentor's raw `req.user.userId` | Misattributes the project — and its Goins on approval — to the mentor instead of the child |
| 37 | `resolveSubject` must be wired into every route where "who owns/sees this" matters during a PIN session (uploads, "my projects" lists) — not just Goins endpoints | Silent misattribution wherever it's missing |
| 38 | Contact verification (email/phone) is always optional and on-demand — never block registration or any flow on it | Product decision — reduces friction for a closed school/family user base |
| 39 | Changing a VERIFIED contact requires OTP confirmation to the OLD contact, or falls back to manual admin approval — changing an UNVERIFIED one applies immediately | Prevents account takeover via a simple "change my email" call |
| 40 | FIREBASE_SERVICE_ACCOUNT_JSON (for direct material image upload) goes in Secret Manager, never as a plain Cloud Run env var | Same `//`/newline-in-value problem as YOUTUBE_TOKENS (Rule 24) |
| 41 | `ProductSuggestion.status` transitions (pending → approved/rejected/added) are admin-only and manual — "added" does NOT auto-create a Material | Admin must deliberately create the Material first, then mark the suggestion resolved, to avoid orphaned/mismatched entries |
| 42 | Run `flutter pub get` before `flutter build web` after any Codespace disk cleanup that touched `~/.pub-cache`, and as a standing first step in the Flutter deploy sequence generally | A missing-package build can still partially compile and deploy (fewer files than normal, ~14 instead of ~41) before the failure is caught — `flutter clean` is a different tool (stale compiled output) and does NOT fix this |
| 43 | Cloud Run enforces a hard, non-configurable 32MB limit on incoming request bodies — no memory/CPU/env setting can raise it | Any upload feature for files that can exceed a few MB must use the signed-URL-direct-to-Firebase-Storage pattern (`POST /project/request-upload-url` → client PUTs directly to Storage → small JSON POST with just the storage path), never a direct multipart POST to a Cloud Run endpoint |
| 44 | When debugging a "CORS blocked" / "Failed to fetch" error on Flutter Web, check in this order: (1) is the target domain in `web/index.html`'s CSP `connect-src`? (2) if it's a GCS/Firebase Storage URL, does the *bucket's own* CORS policy (`gsutil cors get`, separate from the app's Express CORS) allow the method being used? | Both have independently caused this exact symptom multiple times in this project — img.youtube.com, Firebase Storage images, storage.googleapis.com direct-upload all hit one or the other |
| 45 | Never throw a generic, hardcoded error message on a failed HTTP response in Flutter API/repository code — always surface the real status code and real response body text | A swallowed generic error cost this project 11 rounds of blind debugging on the July 2026 video-upload incident specifically |
| 46 | `authMiddleware.ts`'s `authenticateToken` only selects `{id, email, name, role}` for `req.user` — `isMentor` is NOT populated | Any new middleware/route needing `isMentor` (or any other field not in that list) must fetch a fresh user record from the DB — never trust `req.user.isMentor` |
| 47 | Never write `YOUTUBE_TOKENS` (or any Secret-Manager-bound secret) via `--update-env-vars` from application code — always `gcloud secrets versions add` | A plain env var with the same name as an existing secret binding can silently detach that binding — this was the real root cause of a token-loss incident in July 2026 |
| 48 | A CMS value must be stored as a genuine JSON object, never a formatted/markdown string | Flutter's `getCmsContent()` JSON-decodes the stored value; a raw string silently fails that decode and returns `null` with zero indication anything is wrong — found twice (FAQ `q`/`a` mismatch, Legal stored as markdown) |
| 49 | "Admin has an editable field for X" does not mean the app actually reads X — always verify both directions (what admin writes AND what the Flutter/web screen reads) when auditing any CMS-driven page | Found 3+ separate dead-field instances in one audit pass (About's Mission/Vision/Story, Consultancy's Services/FAQ, Community's old Happenings/Challenges/Ladder CMS tab) |
| 50 | `"use server"` at the top of an admin `utils/api/*.ts` file routes every call through an extra Vercel server-function hop (browser → Vercel function → backend → back through Vercel → browser) instead of a direct browser fetch | If a page feels slow, check whether it's still importing from one of these files. Fix pattern: read the `auth_token` cookie directly (`document.cookie` — it's deliberately set `httpOnly: false`) and `fetch()` the backend straight from the client component, bypassing `apiClient.ts`/`userApi.ts`/etc. entirely for that call site. Confirmed live in `people/page.tsx` (July 29) and `users/[id]/page.tsx` (Aug 2026) |
| 51 | Next.js 15's App Router hard-fails the production build (`next build` exits 1, not a warning) if a component uses `useSearchParams()` without a `<Suspense>` boundary | Vercel silently keeps serving the last successful deployment when this happens — always wrap from the start on any new page using it |
| 52 | Before assuming a stat/filter/count that's mysteriously always 0 or empty is a deep bug, check the literal string being filtered against the real enum/status values in the schema | The exact string `'approved'` was used as a filter in two places when that status has never existed (real values: pending/published/rejected) — same class of bug as Rule 48's CMS-string issue, just on the backend side |
| 53 | A UI element (button, form, card) that renders correctly and looks "built" is not proof it's wired to anything real | Found multiple instances of fully-styled, well-coded UI with nothing real behind it — a Daily Quest card and a Rank badge were both frozen hardcoded text for every user, forever, until rebuilt from scratch. Periodically ask "does this element's data genuinely come from somewhere live" when auditing an existing screen |
| 54 | A login ID ending in `@miniguru.in` cannot receive real email — the actual contact address is `guardianEmail` for a child account or `user.email` for a genuinely self-registered mentor account, and these two are NOT interchangeable | Confirmed at least one real bug from conflating them (mentor contact-email changes silently writing to the wrong field); flagged as a pattern worth checking anywhere "email" is displayed or written to |
| 55 | MongoDB/Prisma validates ObjectId format eagerly on *every* branch of an `OR` filter, even branches meant to match on an unrelated field type like email | A value that isn't a well-formed ObjectId anywhere in an `OR` array crashes the whole query, not just that one branch — construct OR-filters defensively when one branch may receive a non-ObjectId string |
| 56 | Goins ledger: every award or deduction writes a `GoinsEvent` row. Any new award site must be hooked into the ledger | Ladder period boards read the ledger; an unhooked award never shows on the Ladder |
| 57 | Daily Goins caps, per IST day, counted from the ledger: view Goins 20, comment Goins given 10, comment Goins received by makers 10. Over-cap actions still post but pay nothing. One view Goin per user per video per day | Stops Goins farming. Do not remove the ledger counting |
| 58 | Goins amounts: every new account starts with 100. Approval = 50 + 2x material cost + challenge bonus, split equally across owner and partners (owner takes the rounding). Automatic material price = pack price / pack size x 0.1, min 5, max 300, whole numbers; an admin-typed value locks the item (`goinsLocked`). Peer-rating bonus: same school 1x, else 2x | Core economy. Change only with Pramod's approval |
| 59 | Never run `prisma db push` until live Atlas indexes and schema.prisma have been compared | Oct 2026: two unique rules in the schema never existed live; the second one failed on real data. Both were removed from the schema on 17 Oct 2026 |
| 60 | Never dedupe `video_views` or add a unique index on it. Many rows per user per video are valid (one per day) | Would delete real data and break the daily Goin |
| 61 | Express route order: ALL fixed paths (`/admin/*`, `/feed`, `/lookup`) before any `/:id` route. Oct 2026: `/mentor/children/lookup` was captured as an id and returned a 500 | Extends Rule 28 |
| 62 | Create login IDs only via `backend/src/utils/uniqueLoginId.ts` (isLoginIdTaken, nextFreeLoginId, createUserWithFreeId). Logins are case-insensitive | Prevents duplicate IDs |
| 63 | Buttons that create data must disable themselves while sending | A double tap created a duplicate account (two User and two ChildProfile rows 0.3 s apart) |
| 64 | When a new field is added, check every whitelist or manual object builder (e.g. `getUserData()`, update and create handlers) | Whitelists silently drop new fields. Repeated bug class: challengeId, desiredPrivacyStatus, guardianEmail |
| 65 | Admin merge-accounts has NO undo. Take a database-only backup first and test on dummy accounts | Data cannot be restored otherwise |
| 66 | Account types: Child (self-registers by one tap, or added by parent/school), Parent (mentor: adds children, PIN vs child password, Add Existing Child by login ID), School/T-LAB (bulk add; admin-managed). An independent child can request to join a school (max 3 waiting; school approves). Removing a child soft-deactivates (keeps Goins and projects) | Reference for every account feature |
| 67 | Patch scripts: Python, contain a git diff, assert each anchor matches exactly once, tested with `git apply --check` on a SECOND fresh clone. Delivered as a file (SendUserFile), never as a long paste | Avoids truncated or mismatched patches |
| 68 | Verify claims against the real repo, not old logs | Several "built" items in old logs were never built |
| 69 | Working style with Pramod: one thing at a time, short plain replies, commands last, each command in its own code block, HTML mock-up and approval before any layout change, no secrets in chat. The app is for children aged 8 to 14: bright, playful, simple words | Pramod is a non-coder working only in Cloud Shell |
| 70 | Backups: the `backup` command in Cloud Shell writes an encrypted copy (code, database, settings, storage) into the Drive folder "MiniGuru Backups" (2 slots). Routine 1st and 15th. Passphrase typed at run time, kept on paper and with the trusted second person (Namita Maithil), never pasted in chat. Recovery steps: MINIGURU_RESTORE_PROMPT.md. Domain miniguru.in expires 30 April 2027 | Disaster recovery |
| 71 | Infrastructure: YouTube = single channel, children never connect accounts; every video waits for an explicit admin click (AI never auto-publishes); upload limit 200/day, granted 19 Oct 2026 for six months (re-apply about March 2027). Amazon = Creators API; Cloud Scheduler job `miniguru-amazon-refresh` (switch to materials-daily every 4 h is pending). Cloudflare: planned Always Use HTTPS ON + Min TLS 1.2 (not done) | Operational reference |
| 72 | **Cost controls: MiniGuru runs almost free on purpose (Google Cloud bill 1 to 23 Oct 2026: Rs 8.62, forecast about Rs 11 for the month).** (a) Artifact Registry repo `cloud-run-source-deploy` (asia-south1) keeps only the latest 3 images through a cleanup policy (set by Pramod, Oct 2026; before that: keep 5 and delete anything older than 7 days, which cut 5.5 GB to 0.87 GB, Aug 2026). Every `gcloud run deploy --source` adds an image, so never remove this policy. (b) Gemini lives in its own project (`gen-lang-client-0578136455`) with NO billing, so its cost is always Rs 0; never enable billing there. (c) Resend free plan: the app stops sending at 95 emails a day. (d) Videos upload straight to Firebase Storage by signed URL and are deleted after YouTube upload (Rule 43); images stay small. (e) Quota guards in `utils/costTracking.ts`: Shop AI search 10 a day per account and 150 a day for the site; Amazon search without login 3 a day per visitor; results cached 6 hours; phone SMS capped (provider not enabled); AI video review capped (150 MB files, 1450 a day). (f) Amazon Creators API, Cloud Scheduler (1 of 3 free jobs), GitHub Actions (public repo), Cloudflare Free and MongoDB Atlas free are all Rs 0. (g) Cloud Run is the only service that can grow: its free allowance covered Rs 44 of Rs 47 usage in Oct 2026. Before adding min-instances, always-on CPU, more memory or a faster scheduler, check the Cloud Run row in Billing reports first. (h) Read the monthly cost summary on the 1st; a jump above Rs 100 needs a look | A single forgotten setting (Artifact Registry growing for months) was 95 percent of the whole bill in Aug 2026 |

---

## 🔑 KEY CREDENTIALS & URLS

| Item | Value |
|---|---|
| App | https://miniguru.in |
| Backend | https://miniguru-backend-130420985234.asia-south1.run.app |
| Admin | https://admin.miniguru.in |
| GitHub | miniguruindia/MiniGuru-App |
| Firebase project | miniguru-prod (130420985234) |
| Firebase bucket | miniguru-prod.firebasestorage.app (NOT .appspot.com) |
| MongoDB | cluster0.ykoud6h.mongodb.net / db: miniguru |
| Codespace | bug-free-fiesta-69xwgg4jwj6r34gpv (unavailable until after 1 Nov 2026; Cloud Shell + GitHub Actions are used) |
| Amazon tag | miniguru04-21 (ALWAYS this tag, hardcoded everywhere) |
| Admin login | admin@miniguru.in / password kept in the founder's password manager (never in the repo) |
| Email (Resend) | Free plan, 100/day (app stops at 95), domain miniguru.in verified |
| FROM_EMAIL | connect@miniguru.in |
| Gemini project | gen-lang-client-0578136455 (free tier, no billing enabled) |
| Cloud Run project | miniguru-prod |
| Cloud Run region | asia-south1 |

---

## 🏗️ ARCHITECTURE SUMMARY

```
Flutter Web (miniguru.in)     → Firebase Hosting
Backend API (Node/TS)         → Google Cloud Run (runs dist/ JS)
Admin Panel (Next.js)         → Vercel (auto-deploys on git push to main)
Database                      → MongoDB Atlas (cluster0.ykoud6h)
Material Images                → Firebase Storage (materials/ folder) — now
                                 also directly uploadable/deletable from
                                 admin via firebase-admin SDK (Rule 40)
Email                         → Resend HTTP API (SendGrid dormant fallback;
                                 no SMTP, Cloud Run blocks it)
Video                         → YouTube Data API v3
YouTube tokens                → Google Secret Manager (not env var)
AI video review               → Gemini 3.5 Flash (free tier), local file
                                 before YouTube upload, confidence >= 0.85
                                 to auto-publish, else human review queue
Amazon affiliate              → miniguru04-21 (Associates account)
Contact verification          → On-demand OTP via Resend (email only —
                                 no SMS provider yet), approval-gated changes
```

---

## 📱 MATERIAL IMAGE URL PATTERN

```
https://firebasestorage.googleapis.com/v0/b/miniguru-prod.firebasestorage.app/o/materials%2F{filename}?alt=media
```

Direct upload/delete now available via admin.miniguru.in/materials (edit modal →
"Upload photo" / "Remove image"), backed by `firebaseStorageService.ts` using
the Firebase Admin SDK — requires `FIREBASE_SERVICE_ACCOUNT_JSON` in Secret
Manager (Rule 40). Manual gsutil/console upload still works as a fallback.

---

## 🚀 SESSION STARTUP CHECKLIST

```bash
# Terminal 1 — Backend
cd /workspaces/MiniGuru-App/backend && npm run dev

# Terminal 2 — Admin (optional)
cd /workspaces/MiniGuru-App/admin && npm run dev

# Make ports public
gh codespace ports visibility 5001:public 3000:public -c bug-free-fiesta-69xwgg4jwj6r34gpv

# Verify DB connection (must show ykoud6h)
grep DATABASE_URL /workspaces/MiniGuru-App/backend/.env

# Flutter (only if code changed)
cd /workspaces/MiniGuru-App/app/miniguru
flutter build web --release --no-tree-shake-icons
firebase deploy --only hosting
```

---

*MINIGURU_RULES.md — Last updated October 24, 2026*
*72 rules across 30+ development sessions*
