# Mobile vs Web vs Backend Feature Matrix — 2026-08-10

Definitive checklist for mobile feature completeness. Sources: full route/service inventories of `effortless-insight-web`, `effortless-insight-admin`, `effortless-insight-mobile`, and controller-level inventory of `effortless-insight-api`, plus the blueprint `docs/12-Mobile-Application/12-Mobile-Application.md`.

**Expected on Mobile?** = judgment from the mobile blueprint + product workflows. "Clarify" = requirement clarification needed — do not assume.

**Status:** ✅ Complete · ⚠️ Partial · ❌ Missing · 🐛 Broken · 🔒 Security concern · ❓ Cannot verify

## Authentication & Account

| Feature | Web | Mobile | Backend | Expected on Mobile? | Mobile status | Gap / notes |
|---|---|---|---|---|---|---|
| Email/password login | ✅ | ✅ | ✅ | Yes | ✅ | 2FA-redirect stale-closure race (login.tsx:85–97) |
| Registration | ✅ | ✅ | ✅ | Yes | ⚠️ | Works; backend rolls back registration on email-send failure (platform bug); password helper text omits rules |
| Email verification (deep link) | ✅ | ✅ | ✅ | Yes | ⚠️ | Verify works; **Resend calls nonexistent endpoint** `/auth/verify-email/resend` |
| Forgot/reset password (deep link) | ✅ | ✅ | ✅ | Yes | ✅ | |
| 2FA TOTP + backup codes | ✅ | ✅ | ✅ | Yes | ✅ | |
| 2FA setup/disable | ✅ | ❌ | ✅ | Clarify | ❌ | Setup is QR-based — arguably web-only; mobile can't even disable |
| Biometric login | n/a | ✅ | n/a | Yes (blueprint) | 🐛 | Bypass when sensor becomes unavailable (authStore.ts:115); Face ID not release-configured |
| OAuth (Google/Microsoft) | ✅ | ✅ | ✅ (disabled in config) | Yes | ⚠️🔒 | getProfile-before-persist bug; tokens via redirect URL; state unverified |
| OTP (mobile number) login | ❌ | ❌ | ⚠️ (SMS stub) | No (backend not production-functional) | ❌ | Intentionally unused everywhere |
| Profile view | ✅ | ✅ | ✅ (`GET /auth/me`) | Yes | ✅ | |
| Profile edit | 🐛 | 🐛 | ❌ **no endpoint** | Yes | 🐛 | Mobile `PATCH /auth/me` and web `PUT /users/profile` both nonexistent — **backend gap, broken platform-wide** |
| Avatar upload | 🐛 | ❌ (stub) | ❌ no endpoint | Optional | ❌ | "Coming Soon" on mobile; backend endpoint missing anyway |
| Change password | ✅ | ✅ | ✅ | Yes | ✅ | |
| Session list/revoke | ✅ | ❌ (API layer only) | ✅ | Nice-to-have | ❌ | Mobile API exists, no UI |
| Org switching (multi-org) | ✅ (header switcher) | ❌ (API layer only) | ✅ | Yes for multi-org users | ❌ | `useSwitchOrganization` exists, unused **and buggy** (never persists new tokens) |
| Account deletion | ✅ | ❌ | ✅ (`DELETE /users/account`?) | Clarify | ❓ | Store policies (Apple 5.1.1(v)) require in-app account deletion — verify backend route & add before iOS submission |

## Onboarding & Organization

| Feature | Web | Mobile | Backend | Expected? | Status | Notes |
|---|---|---|---|---|---|---|
| Org creation + GSTIN live validation | ✅ | ✅ | ✅ | Yes | ✅ | Best form in the mobile app |
| Trial auto-start with plan carry-through | ✅ | ⚠️ | ✅ | Yes | ⚠️ | Mobile onboarding doesn't carry a pre-selected plan |
| GSTIN management (add/remove/primary) | ✅ | ❌ | ✅ | Clarify | ❌ | Mobile links out to web settings |
| Team/member management, invitations | ✅ | ❌ | ✅ | Web-only reasonable (admin flows) | ❌ | Viewing team members on mobile would help task assignment |
| Teams (groups), task templates, doc-request templates | ✅ | ❌ | ✅ | Web-only | ❌ | Administration — reasonable web-only |
| Org settings/deletion/ownership transfer | ✅ | ❌ | ✅ | Web-only | ❌ | Sensitive admin flows |

## Notices

| Feature | Web | Mobile | Backend | Expected? | Status | Notes |
|---|---|---|---|---|---|---|
| Notice list + pagination + search | ✅ | ✅ | ✅ | Yes | ✅ | Debounced search, infinite scroll |
| Filters: status | ✅ | ✅ | ✅ | Yes | ✅ | |
| Filters: type / GSTIN / PAN / priority | ✅ | ❌ | ✅ | Yes (CA users manage many GSTINs) | ❌ | Mobile has status + overdue/due-soon only; "overdue" includes closed notices |
| Notice detail (overview/analysis/deadlines) | ✅ (10 tabs) | ✅ (7 tabs) | ✅ | Yes | ✅ | |
| Camera scan → multi-page PDF upload | n/a | ✅ | ✅ | Yes (mobile's flagship) | 🐛 | **Single page in multi-page mode always fails** (upload.tsx:311); no size pre-check; no cancellation |
| Gallery/file upload | ✅ | ✅ | ✅ | Yes | ✅ | |
| Batch/ZIP upload | ✅ | ❌ | ✅ | Web-only | ❌ | Reasonable |
| Manual notice entry (no file) | ❌ | ❌ | ✅ (`POST /notices/manual`) | Clarify | ❌ | Backend supports; neither client exposes |
| Duplicate detection warning | ✅ | ❌ | ✅ (SHA-256) | Nice-to-have | ❌ | Server rejects dupes; mobile shows generic error |
| AI analysis report + retry | ✅ | ✅ | ✅ | Yes | ✅ | |
| Real-time processing status (SignalR) | ✅ | ❌ | ✅ | Nice-to-have | ❌ | Mobile polls/refetches instead |
| Status updates / assign / delete | ✅ | ✅ | ✅ (role-gated) | Yes | ⚠️ | No role gating in mobile UI → 403s surface as generic errors |
| Attachments CRUD + download | ✅ | ✅ | ✅ | Yes | ✅ | |
| Original PDF view/download | ✅ | ✅ | ✅ | Yes | ✅ | Presigned URL → browser |
| Response drafting (manual) | ✅ | ✅ | ✅ | Yes | ✅ | |
| Response AI auto-draft | ✅ | ❌ | ✅ (`/responses/auto-draft`) | Yes — high-value approve-on-the-go flow | ❌ | Blueprint: "view AI analysis and approve responses" |
| Response lifecycle: submit-for-review / approve / mark-submitted | ✅ | ✅ | ✅ | Yes | ✅ | |
| Response reject | ❌ | 🐛 | ❌ **no endpoint** | Remove or add backend route | 🐛 | Mobile-only invented action; always 404s |
| Workflow panel (progress, advance stage) | ✅ | 🐛 | ✅ (`/workflows/...`, feature-gated) | Yes | 🐛 | **Wrong paths** (`/notices/{id}/workflow/*`) + wrong body key; also needs 402 handling |
| Workflow admin (templates, bulk, parallel branches, SLA) | ✅ | ❌ | ✅ | Web-only | ❌ | Reasonable |
| Similar notices | ✅ | ❌ | ✅ | Nice-to-have | ❌ | |
| AI chat on notice | ✅ (SSE) | ❌ | ✅ (incl. non-streaming `/messages/sync` for simple clients) | Yes — backend explicitly built a sync variant | ❌ | Big web/mobile gap |
| Comments + replies + reactions | ✅ | ✅ | ✅ | Yes | ✅ | Offline-queued; offline failure message generic in notice detail |
| Document requests: view | ✅ | ✅ | ✅ | Yes | ✅ | |
| Document requests: submit file | ✅ | 🐛 | ✅ (`/fulfill`) | Yes | 🐛 | Mobile posts to nonexistent `/submissions` |
| Reminders per notice | ✅ | ❌ | ✅ | Nice-to-have | ❌ | |
| Activity feed | ✅ | ✅ | ✅ | Yes | ✅ | |
| Export CSV/XLSX/PDF | ✅ | ❌ | ✅ | Web-only | ❌ | Reasonable |
| Notice files/folders manager | ✅ | ❌ | ✅ | Web-only | ❌ | |

## Tasks & Collaboration

| Feature | Web | Mobile | Backend | Expected? | Status | Notes |
|---|---|---|---|---|---|---|
| My tasks list + filters | ✅ | ✅ | ✅ | Yes | ✅ | Shared isPending disables all checkboxes |
| Task toggle/update (offline-queued) | ✅ | ✅ | ✅ | Yes | ✅ | |
| Task create | ✅ | ⚠️ | ✅ | Yes | ⚠️ | Only from notice detail; not from Tasks tab (blueprint wants both) |
| Task detail (assignees, deps, attachments, time tracking) | ✅ | ❌ | ✅ | Partial (view at least) | ❌ | Mobile shows checklist only |
| Approvals module | ⚠️ | ❌ | ✅ | Clarify | ❌ | Backend-rich; web partial; mobile absent |

## Dashboard, Reports, Calendar

| Feature | Web | Mobile | Backend | Expected? | Status | Notes |
|---|---|---|---|---|---|---|
| Dashboard stats + deadlines | ✅ | ✅ | ✅ | Yes | ⚠️ | Blueprint wants "due ≤3 days" banner + "tasks today" stat; mobile shows overdue-based banner, no tasks-today; no activity feed |
| Compliance score / charts | ✅ | ❌ | ✅ | Nice-to-have | ❌ | |
| Reports/analytics | ✅ | ❌ | ✅ | Clarify | ❌ | Even a read-only summary would serve CAs |
| Calendar | ✅ | ❌ | ✅ (data) | Clarify | ❌ | |

## Billing

| Feature | Web | Mobile | Backend | Expected? | Status | Notes |
|---|---|---|---|---|---|---|
| Plans catalog + trial start | ✅ | ✅ | ✅ | Yes | ✅ | |
| Paywall / usage limits | ✅ | ✅ | ✅ | Yes | ✅ | Fails closed (good); checkUsage fails open on 404 |
| Razorpay checkout | ✅ | ✅ | ✅ | Yes | ❓🐛 | `react-native-razorpay` unsupported on New Architecture — must device-test; Apple policy: SaaS subscription sold in-app on iOS may require IAP (**clarify before iOS launch**) |
| Subscription view | ✅ | ✅ | ✅ | Yes | ✅ | |
| Cancel/pause/resume/reactivate | ✅ | ❌ (API+hooks only) | ✅ | Yes (Google Play policy expects manageability; at minimum link out) | ❌ | Whole management layer exists unreached by any screen |
| Invoices + PDF | ✅ | ❌ (dead blob API) | ✅ | Nice-to-have | ❌ | |
| Seats, coupons, payment methods | ✅ | ❌ (API only) | ✅ | Web-only reasonable | ❌ | |

## Notifications

| Feature | Web | Mobile | Backend | Expected? | Status | Notes |
|---|---|---|---|---|---|---|
| In-app notification center | ✅ | ✅ | ✅ | Yes | ✅ | Swipe actions, unread tab, validated navigation |
| Push delivery | ✅ (FCM web) | 🐛 | ✅ (Expo tokens natively supported + receipt polling) | Yes | 🐛 | Code complete; **dead end-to-end**: placeholder EAS projectId, missing google-services.json / plist |
| Preferences (per-type/channel) | ✅ | ⚠️ | ✅ | Yes | ⚠️ | Mobile has a simplified prefs screen |
| WhatsApp channel | ✅ | ❌ | ✅ (feature-gated) | Clarify | ❌ | |
| SignalR real-time | ✅ | ❌ | ✅ | Nice-to-have | ❌ | Push covers mobile's need |

## GST Integrations

| Feature | Web | Mobile | Backend | Expected? | Status | Notes |
|---|---|---|---|---|---|---|
| GSTN portal API integration (OTP connect, sync, logs, settings) | ✅ | 🐛 | ✅ (`api/v1/gstn`, GSP disabled by config) | Yes (screens were built) | 🐛 | **All calls 404** — double `/api/v1` prefix (gstn.ts:16) |
| Chrome-extension GST sync administration | ✅ | ❌ | ✅ | **No — web-only by nature** | ❌ | Correctly absent |
| Synced-notice browsing/import | ✅ | ❌ | ✅ | Clarify | ❌ | |

## Admin Portal

All admin capabilities (tenant/user/plan/billing ops, AI ops, content, audit, admin RBAC) are **intentionally absent from mobile** — separate auth scheme, separate app. ✅ Correct.

## Platform/Store table

| Item | Status |
|---|---|
| Production API URL | 🐛 Points at NXDOMAIN `.com`; live host is `api.effortlessinsight.in` |
| Legal links (privacy/terms) | 🐛 Dead `.com` domain |
| Icons/splash/notification assets | ❌ Missing entirely |
| Firebase config files | ❌ Missing |
| EAS project/credentials | ❌ Placeholder projectId; empty iOS submit creds |
| Crash reporting | ❌ None |
| Deep links | ⚠️ Custom scheme only; no App/Universal Links; no +not-found |
| i18n (en/hi) | ⚠️ Engine + locale files complete; only 3 screens consume |
| Tests/lint | ❌ Jest can't run; no ESLint config |
