# MINIGURU — PROJECT STRUCTURE & STATE
## Living reference — committed to git, kept current each session

**Last updated:** July 8, 2026 | Supersedes the March 2026 Master Reference doc (that one is stale and lives outside git)

---

## 1. What MiniGuru Is

A STEAM education platform for Indian children aged 8–14, built on a real-world project loop:
plan a project → pick materials (Goins-costed, not real money) → build it → upload a video →
admin (or AI) reviews it → approved video publishes on YouTube + awards Goins (motivation points,
never spendable) → community sees it.

Three account types: **Child/Individual**, **Parent/Guardian (Mentor)**, **School/T-LAB**.
Both self-registration and admin-managed creation (`admin.miniguru.in/schools`) are supported
side by side for School/T-LAB — this was a deliberate decision, not an oversight.

---

## 2. Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| App | Flutter Web | Locked at 3.27.4 |
| Backend | Node.js + Express + TypeScript | Compiled to `dist/`, that's what Cloud Run runs |
| Admin | Next.js (App Router) | Vercel, auto-deploys on push to `main` |
| Database | MongoDB Atlas | `cluster0.ykoud6h.mongodb.net` via Prisma 5.22.0 |
| Images | Firebase Storage | `materials/` folder, now with direct admin upload/delete |
| Email | SendGrid | Free tier, 100/day — SMTP is blocked on Cloud Run |
| Video | YouTube Data API v3 | Unlisted on upload, Public on approval |
| AI review | Gemini 3.5 Flash | Free tier, separate GCP project, no billing enabled |
| Hosting | Firebase Hosting (app) / Cloud Run (backend) / Vercel (admin) | |

---

## 3. Core Data Model (Prisma) — Key Fields Only

### User
`id, email, passwordHash, name, age, role, phoneNumber, score (Goins), profilePhoto,
isMentor, mentorType (PARENT|SCHOOL|TLAB|COMMUNITY), guardianInfo, children[], wallet,
guardianEmail, emailVerified, phoneVerified, verificationOtpHash/Expiry/Target,
pendingEmail/pendingPhone, contactChangeApprovalFor/RequestedAt`

- `score` = Goins. Motivation tracker only — **never deducted, never spendable** (Rule 25).
- `wallet.balance` = real ₹ (Razorpay) — intentionally kept at 0, unrelated system (Rule 1).
- Contact verification (Section 6 below) added July 2026 — optional, on-demand, approval-gated changes.

### ChildProfile
`id, guardianId, name, age, grade, avatar, pinHash, score, linkedUserId`

- Every child — whether added by a mentor or self-registered — gets an independent `User`
  login via `linkedUserId`. **This is the field that matters for ownership/attribution**,
  not `ChildProfile.id` itself (see Section 5).

### Project
`id, title, description, video{url}, materials[], userId, categoryId, status
(pending|published), collaborators[{userId,name}], aiVerdict, aiReason, aiConfidence,
aiReviewedAt`

- `userId` is the true owner — a `User.id`, never a `ChildProfile.id`.
- `collaborators` — shared/group projects, planning-time only, instant-add, equal Goins split
  on approval (owner absorbs any rounding remainder).
- `aiVerdict` etc. — set by the AI first-pass reviewer before human review (Section 4).

### Material
`id, seqId, name, imageUrl, icon, category, unit, goinsPrice, priceEstimate, amazonASIN,
amazonUrl, showInShop, showInPlanning, isActive`

- Same record serves both the Goins-costed planning picker AND the Amazon-affiliate shop —
  `showInShop`/`showInPlanning` toggle which surfaces it in.
- `imageUrl` can now be set via direct admin upload (Section 7) or manually pasted, both fine.

### ProductSuggestion
`id, childName, userId, suggestion, category, requestedGoinsPrice, status
(pending|approved|added|rejected), resolvedMaterialId, adminNotes, resolvedAt`

- Fed by the shop's "suggest a product" box and the material picker's "add your own item"
  custom-material flow. Status workflow added July 2026 (Section 8).

---

## 4. AI Video Review (wired in July 2026)

`aiVideoReviewService.ts` — `reviewVideoFile(localPath, mimeType)` using Gemini 3.5 Flash,
2fps frame sampling, deliberately conservative prompt (defaults to UNSURE on any doubt).

**Must run BEFORE the YouTube upload** — `youtubeUploadService.js` deletes the local file
immediately after upload (win or lose), so this is a hard ordering constraint, not a preference.

Routing (in `projectController.ts`'s `createProject`):
- **APPROVE** (confidence ≥ 0.85, enforced inside the service) → `publishAndAwardProject()`
  auto-publishes to YouTube + awards Goins. Same function the admin "Approve" button uses —
  one code path, not two.
- **REJECT** → video still uploads (Unlisted) — Cloud Run's disk is ephemeral, so the upload
  always happens regardless of verdict. Project stays `pending`, admin sees a red badge.
- **UNSURE** → same as REJECT + email alert to `miniguru.in@gmail.com`.

Threshold currently left at 0.85 (safer, more human review) rather than lowered — revisit
once there's real data on how often genuine good videos land below it.

---

## 5. Child Session Isolation (fixed July 2026)

`resolveSubject` middleware reads the `X-Child-Profile-Id` header (already sent by Flutter's
`_buildHeaders()` on every request during a PIN session) and resolves `req.subject`:
`{ subjectId, isChild, linkedUserId, ... }`.

**Critical distinction:** `subjectId` = `ChildProfile.id` during a child session, but
`Project.userId` is a foreign key to `User`. Anything that creates/attributes a real DB
record (uploads, "my projects" lists) **must use `req.subject.linkedUserId`**, not
`subjectId` directly. Wired into `POST /project` and `GET /project` so far
(`projectRoutes.ts`) — was previously only wired into 3 Goins endpoints, which is what
caused the original misattribution bug.

If a legacy `ChildProfile` has no `linkedUserId` yet, the upload fails loudly with a 400
rather than silently crediting the mentor.

---

## 6. Contact Verification & Change Approval (added July 2026)

Design: **verification is always optional, on-demand, never blocks anything.** An unverified
email/phone just shows an "Unverified" badge in the app — verify whenever you want.

Changing a contact:
- **Unverified** → applies immediately, still unverified after.
- **Verified** → needs approval:
  - Email: OTP sent to the OLD verified email. Confirm it, change applies, new email starts
    unverified again (re-verify independently).
  - Phone: no SMS provider exists yet (no Twilio/etc — email uses free-tier SendGrid only).
    Any phone verification or phone-change-via-OTP request routes straight to **manual admin
    approval** (`admin.miniguru.in/contact-changes`), clearly messaged as such.

Endpoints: `POST /auth/verification/send-otp`, `/confirm-otp`, `/request-change`,
`/confirm-change-otp` (all authenticated). Admin: `GET/POST /admin/contact-change-requests/*`.

**Known gap:** phone verification itself is not deliverable without adding an SMS provider
(cost — conflicts with the zero-budget approach used everywhere else). The plumbing
(`phoneVerified`, admin approval path) is ready for whenever that's added.

---

## 7. Direct Material Image Upload (added July 2026)

`firebaseStorageService.ts` wraps the Firebase Admin SDK (v14, modular API —
`initializeApp`/`cert` from `firebase-admin/app`, `getStorage` from `firebase-admin/storage`)
to upload/delete material images straight from the admin panel, replacing the old
"download from Drive → resize → drag into Firebase Console" manual workflow.

**Setup dependency:** needs `FIREBASE_SERVICE_ACCOUNT_JSON` (a Firebase service account key,
downloaded once from Firebase Console → Project Settings → Service Accounts) in Secret
Manager — same pattern as `YOUTUBE_TOKENS` (Rule 40), since the key contains characters that
break `--update-env-vars`.

`POST /materials/admin/:id/image` (multipart, field name `image`) and
`DELETE /materials/admin/:id/image`. Old image is cleaned up from Storage automatically when
replaced, so orphaned files don't accumulate.

---

## 8. ProductSuggestion Resolution Workflow (added July 2026)

Status: `pending → approved → added` or `→ rejected`, with `adminNotes` and
`resolvedMaterialId` for traceability. Admin page: `admin.miniguru.in/product-suggestions`.

**Important:** marking a suggestion "added" does NOT auto-create the Material — admin must
create it normally via the Materials page first (with an Amazon ASIN if relevant), then
mark the suggestion resolved. This is deliberate — avoids orphaned/mismatched links.

---

## 9. Open Decisions / Known Gaps (carried forward)

| Item | Status |
|---|---|
| Self-registration for School/T-LAB | **Resolved** — keep both self-registration AND admin-managed `/schools`, side by side, permanently |
| OTP/email verification for Parent & School registration | **Resolved differently than originally scoped** — not required at registration; optional/on-demand verification + approval-gated changes instead (Section 6) |
| ProductSuggestion schema refinement | **Done** (Section 8) |
| Direct material image upload | **Done** (Section 7) |
| Phone verification (actual SMS delivery) | **Still open** — needs an SMS provider (cost decision), plumbing is ready |
| AI review confidence threshold (0.85) | Left as-is deliberately — revisit with real launch data |
| `sample_mflix` in Atlas | Unverified whether ever dropped — check Atlas console (frees 164MB/512MB quota) |
| Amazon ASINs | Ongoing manual admin task — last known count 40/201 |
| Community Challenges/Resources content | CMS wiring works — verify real content has been typed in via admin/content |

---

## 10. Where Things Live (quick file map)

```
backend/src/
  controllers/
    auth/            — login, register, OTP registration flow, contact verification, userController
    project/          — create/update/list projects, AI review call site, collaborators
    admin/            — video approval (+ publishAndAwardProject), product suggestions
  services/
    aiVideoReviewService.ts       — Gemini review, never throws, defaults to UNSURE
    firebaseStorageService.ts     — material image upload/delete
    emailService.ts               — SendGrid wrapper, used everywhere
    project/project.ts            — Project create/list, now AI-fields aware
  middleware/
    resolveSubject.ts   — child PIN session → real User.id resolution
    authMiddleware.ts   — authenticateToken, authorizeAdmin
  routes/
    projectRoutes.ts, materialsRoutes.ts, authRoutes.ts, adminRoutes.ts,
    schoolAccountRoutes.ts, shopRoutes.ts, goinsRoutes.ts, leaderboardRoutes.ts

admin/app/
  materials/           — materials CRUD + Amazon ASIN setup + direct image upload
  schools/[id]/         — school/T-LAB account + full student roster management
  product-suggestions/ — NEW — suggestion resolution workflow
  contact-changes/     — NEW — manual approval queue for unreachable-old-contact changes
  videos/              — video approval queue, AI verdict badge column

app/miniguru/lib/
  widgets/
    contactVerificationCard.dart — NEW — reusable verify/change UI, add to profile screens
  screens/navScreen/   — home (materials strip), shop, community, profile
  screens/mentor/      — PIN entry, child picker, bulk registration, Goin top-up approval
  network/MiniguruApi.dart — all API calls (~900+ lines)
```

---

*This file is meant to be kept current — update the relevant section whenever a session
changes architecture, not just the session log. Session logs record history; this records
the present.*
