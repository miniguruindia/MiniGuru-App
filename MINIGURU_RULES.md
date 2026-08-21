# MINIGURU — PROJECT RULES
## Non-Negotiable Rules for All Development Sessions

**Project:** MiniGuru Innovation Private Limited | Ujjain MP
**App:** miniguru.in | **Backend:** miniguru-backend-130420985234.asia-south1.run.app | **Admin:** admin.miniguru.in
**Last updated:** August 21, 2026

---

## 🔴 CRITICAL — Breaking these causes data loss, outages, or misattributed money/Goins

| # | Rule | Why |
|---|---|---|
| 1 | **Goins = user.score ONLY — NEVER wallet.balance** | wallet.balance = real Razorpay money. Mixing causes financial corruption |
| 25 | ~~Goins = motivation tracker ONLY. Never deducted.~~ **SUPERSEDED Aug 2026 — see Rule 25b** | Materials now cost Goins again; negative balance (debt) allowed |
| 25b | **Materials cost Goins at video upload. If it goes negative, planning/upload is never blocked — debt is repaid by earning more Goins. Approving a MATERIAL_OVERSPEND audit record never credits Goins** | Reversing this without the debt-not-credit distinction breaks the whole design — materials become free again |
| 26 | **Shop = Amazon affiliate (miniguru08-21) only. No own-store/Razorpay flows yet** | No own inventory until confirmed |
| 19 | **Always --update-env-vars, NEVER --set-env-vars on Cloud Run** | --set-env-vars wipes ALL env vars including DATABASE_URL |
| 23 | **Verify DATABASE_URL exists after any Cloud Run env operation** | Silent DB connection loss = all APIs return 500 |
| 27 | **Always rebuild dist/ before Cloud Run deploy** | Cloud Run runs dist/ JS, not src/ TS — skipping this silently ignores every backend change |
| 36 | **A project's owner during a child PIN session is the child's `linkedUserId`, never the mentor's JWT `userId`** | Misattributes uploads and Goins to the wrong account — see `resolveSubject.ts` / `createProject` |

---

## 🟠 BACKEND DEPLOY — Every single time, no exceptions

```bash
# Step 1: In Codespace — compile TypeScript → dist/
cd /workspaces/MiniGuru-App/backend
npm run build
cp src/services/youtubeUploadService.js dist/services/

# Step 2: Force-add dist/ (may be gitignored)
cd /workspaces/MiniGuru-App
git add -f backend/dist/
git add -A
git commit -m "..."
git push origin main

# Step 3: In Cloud Shell — deploy
cd ~/MiniGuru-App && git pull
gcloud run deploy miniguru-backend --source backend --region asia-south1 --project miniguru-prod
```

**Why:** Cloud Run runs `dist/` JS — NOT `src/` TypeScript. If dist/ is not rebuilt and committed, ALL backend changes are silently ignored. (Rule 27)

**After any AI-review or Firebase-Storage change:** also verify `GEMINI_API_KEY` / `FIREBASE_SERVICE_ACCOUNT_JSON` survive alongside `DATABASE_URL`:
```bash
gcloud run services describe miniguru-backend --region asia-south1 \
  --format="value(spec.template.spec.containers[0].env)" | tr ';' '\n' | grep -E "DATABASE|GEMINI|FIREBASE"
```

---

## 🟡 FLUTTER DEPLOY — Every time Flutter code changes

```bash
cd /workspaces/MiniGuru-App/app/miniguru
flutter build web --release --no-tree-shake-icons
firebase deploy --only hosting
```

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
| 22 | Never use SMTP on Cloud Run — always use SendGrid or HTTP-based email API | Google Cloud blocks SMTP ports 25, 465, 587 |
| 23 | Always --update-env-vars. Verify DATABASE_URL after any env op | DB connection silently lost |
| 24 | YOUTUBE_TOKENS in Secret Manager only — never as env var | Double-slash `//` in token breaks gcloud parsing. Same applies to FIREBASE_SERVICE_ACCOUNT_JSON (Rule 40) |
| 25 | ~~Goins = motivation tracker ONLY. Never deducted for anything~~ **SUPERSEDED Aug 2026** — see Rule 25b below | Was the June 2, 2026 architecture; formally reversed, not accidentally drifted |
| 25b | Materials cost Goins, deducted once at video upload (not live during planning — drafts are local-only, upload is the one reliable server round-trip). If it goes negative, upload still proceeds; an already-resolved `GoinTopUpRequest` (requestType: MATERIAL_OVERSPEND, status: APPROVED, decidedByRole: AUTO) is logged for admin's audit trail. The debt is real and repaid by earning more Goins normally — approving/auto-resolving a MATERIAL_OVERSPEND record must NEVER credit Goins, or materials become free again | Confirmed design, Aug 2026. The original DIRECT_TOPUP flow (child/mentor directly asks for bonus Goins) is unaffected and still credits on approval — only MATERIAL_OVERSPEND is credit-free |
| 26 | Shop = Amazon affiliate (miniguru08-21) only for now | No own-inventory Razorpay until explicitly confirmed |
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
| Codespace | bug-free-fiesta-69xwgg4jwj6r34gpv |
| Amazon tag | miniguru08-21 (ALWAYS this tag, hardcoded everywhere) |
| Admin login | admin@miniguru.in / Nisarg@311 |
| SendGrid | Free plan, 100/day, domain: miniguru.in |
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
Email                         → SendGrid (not SMTP — Cloud Run blocks SMTP)
Video                         → YouTube Data API v3
YouTube tokens                → Google Secret Manager (not env var)
AI video review               → Gemini 3.5 Flash (free tier), local file
                                 before YouTube upload, confidence >= 0.85
                                 to auto-publish, else human review queue
Amazon affiliate              → miniguru08-21 (Associates account)
Contact verification          → On-demand OTP via SendGrid (email only —
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

*MINIGURU_RULES.md — Last updated August 21, 2026*
*55 rules across 20+ development sessions*
