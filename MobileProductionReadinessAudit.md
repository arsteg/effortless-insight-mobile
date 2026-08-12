# Mobile Production Readiness Audit — 2026-08-10

**Scope:** `effortless-insight-mobile` (Expo SDK 56, RN 0.85.3, expo-router), audited against the backend (`effortless-insight-api`, ASP.NET Core), the web app (`effortless-insight-web`, Next.js 16), the admin app, the AI service, and the product blueprints in `docs/`. This supersedes `PRODUCTION_GAP_ANALYSIS_2026-07-31.md` and incorporates re-verification of `QA_TEST_REPORT_2026-08-01.md`.

**Companion documents:**
- `MobileFeatureMatrix.md` — Web vs Mobile vs Backend feature comparison
- `MobileProductionGapAnalysis.md` — all gaps by P0/P1/P2/P3
- `MobileProductionImplementationPlan.md` — prioritized fix plan + completed fixes

**Verification legend:** ✅ Verified (ran/read/proved it) · 🟡 Partially verified · ❓ Not testable in this environment

---

## 1. Executive Summary

### Production Status: 🔴 NOT READY – CRITICAL ISSUES

The application *code* is substantially complete — all blueprint screens exist, the auth/offline/push code is thoughtfully written, and `tsc --noEmit` passes clean. But the app **cannot be built for the stores today** (all binary assets missing, Firebase config files missing, placeholder EAS project ID), and — decisively — **it is configured to talk to a production API host that does not exist**:

> `api.effortlessinsight.com` has **no DNS record** (verified by DNS lookup 2026-08-10). The live production host is `api.effortlessinsight.in` (A 13.126.249.33). The mobile app hardcodes `.com` in `app.json:74` and `src/utils/constants.ts:15`. A store build released today would fail **every API call**.

Beyond that, six mobile features call backend endpoints that **do not exist** (verified against controller routes): the entire GSTN portal integration (URL double-prefix bug), profile editing, verify-email resend, the notice workflow panel, document-request submission, and response rejection. There is **zero crash reporting**, the test suite cannot run (broken jest preset) and had 0% real coverage anyway, and ESLint has no config despite a lint script.

### What is genuinely good

- Auth flow: secure-store token storage, single-flight refresh queue, enforced biometric gate on session restore, 2FA incl. backup codes, deep-linked reset/verify.
- Offline design: NetInfo-aware queue with backoff/eviction, notice/task read caching, offline banner with manual sync.
- Push notification *code*: channels, token rotation handling, validated deep-link navigation, dedupe + retry (delivery is blocked only by config).
- Backend natively supports Expo push tokens (`ExponentPushToken[...]` → Expo push service, receipts polled every 20 min) — the integration design is correct.
- Notice detail screen is rich (7 tabs) and covers the core mobile use cases.

---

## 2. Verification Runs (this audit)

Initial state → state after this pass's fixes (see `MobileProductionImplementationPlan.md` completed-fix log):

| Check | Initial | After fixes |
|---|---|---|
| `npx tsc --noEmit` | ✅ PASS, 0 errors | ✅ PASS, 0 errors |
| `npx jest` | ❌ FAILS to start (missing `@react-native/jest-preset`); prior tests were placebo | ✅ **2 suites / 11 tests pass** — real tests of `getApiErrorMessage` and `offlineQueue`; placebo tests deleted |
| `npx eslint .` | ❌ No ESLint config existed; `lint` script never worked | ⚠️ Runs (eslint 9 + eslint-config-expo flat): **54 errors / 108 warnings**, all pre-existing (mostly `react/no-unescaped-entities`, react-hooks ordering) — triage backlog |
| `npx expo-doctor` | ❌ 16/21 passed | ⚠️ **19/21 passed** — remaining: missing binary assets (provisioning), `react-native-razorpay` New-Arch flag (device-test/decision) |
| DNS: `api.effortlessinsight.com` | ❌ **NXDOMAIN** — no record |
| DNS: `api.effortlessinsight.in` | ✅ A 13.126.249.33 (live production host) |
| Production build (EAS) | ❓ Not attempted — would fail: referenced asset files and `google-services.json`/`GoogleService-Info.plist` do not exist |
| Runtime on device/emulator | ❓ Not testable in this environment |

---

## 3. API Integration Audit — mobile calls vs actual backend routes

Every mobile service call was matched against backend controller routes. Backend base: all routes under `/api/v1`, camelCase JSON, `{success, data}` envelope. Mobile client base URL: `{host}/api/v1` (`src/utils/constants.ts:23`).

### 3.1 Contract breaks — mobile calls endpoints that DO NOT exist (all ✅ verified against controllers)

| # | Mobile call | File | Backend reality | Impact |
|---|---|---|---|---|
| A1 | **All GSTN calls** — `gstn.ts` prefixes `/api/v1/gstn` onto a client whose baseURL already ends `/api/v1` → requests go to `/api/v1/api/v1/gstn/*` | `src/services/api/gstn.ts:16` | `GstnController` is at `api/v1/gstn` | **Entire GSTN integration dead**: `settings/integrations.tsx`, `gstn-otp.tsx`, `gstn-settings.tsx`, `gstn-history.tsx` all 404 |
| A2 | `PATCH /auth/me` (profile update) | `src/services/api/auth.ts:91` | `AuthController` has only `GET /auth/me`. **No profile-update endpoint exists anywhere in the backend** (no UsersController; web's `PUT /users/profile` is equally broken) | Edit Profile screen saves always fail |
| A3 | `POST /auth/verify-email/resend` | `src/services/api/auth.ts:132` | No such route (only `POST /auth/verify-email`) | "Resend Verification Email" always fails; also called from an unauthenticated deep-link screen with an `[Authorize]`-style expectation |
| A4 | `GET /notices/{id}/workflow/progress`, `POST /notices/{id}/workflow/transition` (body `{transitionKey}`) | `src/services/api/notices.ts:209,217` | Workflow lives at `api/v1/workflows/notices/{id}/progress` and `.../transition` (body `TargetStageKey`), gated by `[RequiresFeature("workflows")]` → 402 for plans without it | Notice-detail workflow panel & "advance stage" dead |
| A5 | `POST /document-requests/{id}/submissions` (multipart) | `src/services/api/tasks.ts:273` | Backend route is `POST /document-requests/{id}/fulfill` (multipart) | Uploading a requested document from mobile always fails |
| A6 | `POST /notices/{id}/responses/{respId}/reject` | `src/services/api/notices.ts:295` | No reject route exists (response lifecycle: draft → submit-for-review → approve → mark-submitted; web has no reject either) | Reject button in Response tab 404s |
| A7 | `POST /notifications/register`, `DELETE /notifications/unregister` | `src/services/api/auth.ts:171,181` | No such routes; correct route is `/push-tokens` (which `notifications.ts` uses) | Dead code only — live push path is correct |
| A8 | `POST /notifications/test-push` | `src/services/api/notifications.ts` | No such route | Dead code (settings "test" uses a local notification) |
| A9 | **All collaboration calls unwrap the wrong envelope** — `tasks.ts` read `response.data.data` on every call | `src/services/api/tasks.ts` (19 call sites) | Tasks/Comments/DocumentRequests/Activity controllers return **bare** payloads (no `{success, data}` wrapper — verified per-controller; the web app unwraps them as `response.data`) | Every tasks, comments, document-request, and activity call returned `undefined` → Tasks tab, Comments tab, Activity tab silently empty/broken. Discovered during fix verification; never caught because authenticated flows were never runtime-tested |

### 3.2 Contract matches (✅ verified sample)

Login/refresh/2FA/forgot/reset/verify-email, notices CRUD + upload (multipart, 25 MB limit server-side) + statistics + download + report/retry + attachments + responses draft/submit-for-review/approve/mark-submitted, tasks (`/tasks/my`, CRUD), comments + reactions + replies, activity, notifications list/read/read-all/delete/unread-count, notification preferences, `/push-tokens` register/deactivate, plans/subscriptions/usage/invoices/payment-methods/coupons, organizations + GSTIN validation, `/auth/switch-organization`, OAuth endpoints.

### 3.3 Integration-quality findings

- **Refresh flow**: single-flight with waiter queue (`client.ts:60–120`) — good; matches backend's strict rotation (15-min access tokens, refresh token dies on first use). **Gap:** on refresh failure the interceptor clears storage but never informs `authStore` → UI stays "authenticated" with every request failing until restart (prior-audit M5, still open).
- **Error parsing** (`client.ts:127–131`): only reads `data.message`. Backend validation errors are ASP.NET `ValidationProblemDetails` (`{title, errors:{field:[...]}}`) → users see **"Request failed with status code 400"** (QA BUG-03, still open ✅ re-verified).
- **402 handling**: `usePaywall` fails closed (good); `checkUsage` fails open on 404 — inconsistent philosophy, acceptable net behavior but should be documented.
- **Timeouts/retry**: global 30 s; React Query retries (2 queries / 1 mutations). **No per-call timeout raise and no cancellation (AbortController) on the multipart upload path** — large multi-page PDFs on slow networks will hit the 30 s wall (prior M2/M3, still open).
- **No client-side file-size enforcement**: `FILE_CONFIG.MAX_SIZE_MB` (10 MB — also inconsistent with the backend's 25 MB) is never used; oversized uploads fail server-side with a generic error.
- Mobile "overdue" filter approximates with `dueBefore=now` and no status filter → includes closed/responded notices.

---

## 4. Authentication & Security Audit

| Area | Status | Evidence |
|---|---|---|
| Token storage (native) | ✅ Complete | expo-secure-store (`src/services/storage/secure.ts`) |
| Token storage (web target) | 🔒 Concern | Falls back to plain `localStorage` (secure.ts:11–37) — XSS-readable; acceptable only if the web target never ships |
| Refresh flow | ⚠️ Partial | Single-flight queue correct; **auth-store desync on hard 401** (§3.3); waiter queue has no timeout |
| Biometric gate | 🐛 Broken edge | Enforced on restore (authStore.ts:115) **but bypassed if the sensor becomes unavailable/unenrolled after enabling** — `biometricAvailable=false` skips the gate and silently restores the session (prior C3, ✅ still open) |
| Offline cold start | 🐛 Broken | `restoreSession` catch clears tokens on **any** profile-fetch failure including plain network failure → offline app launch logs the user out, contradicting the offline design (authStore.ts:152–157) |
| 2FA | ✅ Complete | TOTP + backup-code mode; backup codes posted in the same `code` field — backend accepts (✅ `/auth/2fa/login` exists); partial token kept in memory only |
| Login navigation | 🐛 Race | `login.tsx:85–97` checks stale `requires2fa` closure and always `router.replace('/(tabs)')` before the 2FA effect kicks in |
| OAuth | 🔒 Concerns | (a) tokens returned via redirect-URL query string; (b) `getProfile()` called before tokens persist (OAuthButtons.tsx:136–146) → 401s; (c) `state` never verified client-side |
| Password policy | ⚠️ Inconsistent | Login zod `min(6)` vs register `min(8)`+special vs server (8+, plus sequential/repeated-char rejection the client never mirrors) — QA BUG-05 ✅ still open |
| Password reset / verify email | ✅ Complete | Deep-linked, expired/invalid states handled |
| Session management UI | ❌ Missing | `getSessions`/`revokeSession` API exists (both sides) but no mobile screen uses it |
| Authorization (roles) | ⚠️ Partial | Backend enforces (RequireManager on assign, RequireAdmin on delete, 402 feature gates, EF tenant query filters on org_id claim — verified). Mobile does **no role-based UI gating**: delete/assign actions render for all roles and fail with generic errors on 403 |
| Secrets in app | ✅ Clean | Only the API URL; no keys in the bundle |
| Backend-side notes | 🔒 For API team | Swagger UI + developer exception page enabled in **all** environments; committed credentials in `appsettings.json`; HS256 dev-secret fallback; `X-Organization-Id` header fallback in tenant middleware |

---

## 5. Feature Completeness (summary — full matrix in `MobileFeatureMatrix.md`)

Status counts for mobile-expected capabilities: see matrix. Headlines:

- **Complete on mobile**: login/register/2FA/biometric, dashboard, notice list/detail (7 tabs), camera scan + multi-page PDF upload, tasks, comments, notifications center, push (code), billing paywall + Razorpay checkout, onboarding with live GSTIN validation, GSTN screens (code — dead due to A1).
- **Broken on mobile (backend contract)**: GSTN integration, profile edit, workflow panel, document-request submission, response reject, verify-email resend (§3.1).
- **Missing on mobile but plausibly expected**: AI chat on notices (backend has SSE + a non-streaming `/messages/sync` variant explicitly for such clients), notice filters parity (type/GSTIN/PAN), reports/analytics (even read-only), calendar, team viewing, notification preferences depth, subscription management UI (cancel/pause/invoices — the API layer + hooks exist on mobile but no screen consumes them), org switching UI (multi-org users are stuck), session management.
- **Reasonably web-only**: Chrome-extension GST sync administration, bulk operations, response long-form editor with attachments, workflow template/parallel-branch admin, WhatsApp ops, team/teams/task-template administration, data exports, checkout with coupons/seats (mobile has basic checkout — fine).
- **Platform-wide backend gaps** (not mobile's fault): no profile-update, avatar, user-preferences, or account-deletion endpoints (A2 — web's entire `users.ts` API layer targets a controller that doesn't exist), no verify-email resend endpoint (A3), and the web Reports page calls `GET /reports` + `GET /reports/export` which also don't exist (ReportingController only exposes `types`/`definitions`/`schedules` routes — verified 2026-08-10).

---

## 6. Navigation & UX

- All routes reachable; no dead-ends; auth redirects + deep links (reset/verify/OAuth/notification taps) handled in root layout. ✅
- No `+not-found` route — unknown deep links render nothing.
- No universal links / Android App Links (`associatedDomains`/`intentFilters` absent) — `effortlessinsight://` scheme only.
- Loading/empty/error states: broadly present (skeletons on notifications, retryable errors, 404-notice state). Dashboard: pull-to-refresh lacks try/finally; loading gate renders partial zeros; no error state (prior minor, still open).
- Confirmations exist for destructive actions (logout, notice delete).
- Tasks tab: one shared `isPending` disables **all** checkboxes during any toggle.
- Upload screen still renders dead "Document detected ✓" edge-detection UI that can never trigger (`edgeDetected` never set; prior M6 ✅ still open).
- Accessibility: no accessibility labels/roles audit passed; QA report found interactive controls render without button/link roles on web target. Touch targets generally ≥44pt via shared Button. Hindi support is cosmetic (§8).

## 7. Forms & Validation

Auth forms use zod + RHF with double-submit guards — solid. Notice-detail forms (draft/task/comment) are presence-only with **server error messages discarded** ("Failed to save" hardcoded — `[id].tsx:677,696,934,1116`), which combined with §3.3 error parsing means users rarely see the real reason. Organization onboarding form is the best in the app (debounced server GSTIN validation with autofill). Password policy inconsistency per §4.

## 8. i18n

Engine is reactive and complete (en/hi, 264 keys × 17 sections, full parity) — but only **3 of ~30 screens** consume it (`profile`, `notices/[id]` partially, `settings/language`). Everything else is hardcoded English. Shipping "Hindi support" in this state is a false advertisement; either adopt the locale files across screens or do not list Hindi.

## 9. Offline & Lifecycle

Queue (comments/tasks): 3 retries, exponential backoff, eviction at 100 (drops oldest), manual retry of failed items, auto-sync on reconnect. ✅ Solid.
Gaps: `upload_document` queue type intentionally throws (nothing enqueues it — honest but the type should go); `update_notice_status` queue type has no producer (dead); notice **detail** not cached (offline tap on a notice fails); sync only fires on connectivity *transition*, not cold start; **offline cold start logs the user out** (§4 — the worst offline bug).

## 10. Files & Media

Camera/gallery/multi-page scan → real pdf-lib PDF (✅ `pdf-lib` now committed — QA BUG-01 fixed). Enhancement modes are cosmetic (all three just resize). **C1 (✅ still open): in multi-page mode with exactly 1 page, `upload.tsx:311` falls to the single-image branch and dereferences `capturedImage!` (null in that mode) → guaranteed failure of the most common scan (one-page notice with multi-page toggled).** No size/type pre-validation, no cancellation, 30 s timeout (§3.3). Downloads open presigned URLs in the browser — consistent with backend design (15-min URL expiry). Invoice-PDF blob API is dead code (no consumer; blob handling would not work on RN anyway).

## 11. Android & iOS Production Readiness (build config)

✅ Verified via expo-doctor + file checks:

| Item | Status |
|---|---|
| Binary assets (`icon.png`, `splash.png`, `adaptive-icon.png`, `notification-icon.png`, `favicon.png`, `sounds/notification.wav`) | ❌ **All missing** — `assets/` has 2 SVGs only. Build/submission blocker |
| `google-services.json` / `GoogleService-Info.plist` | ❌ Missing but referenced in app.json → prebuild fails; FCM/APNs push impossible |
| EAS `projectId` | ❌ Placeholder slug, not a UUID → EAS build unlinked; `getExpoPushTokenAsync` fails |
| `babel.config.js` | ❌ Missing (SDK-56 default may cover it, but reanimated is a dependency; add the standard file) |
| app.json schema | ❌ Top-level `splash` invalid for SDK 56 (must move under expo-splash-screen plugin) |
| Version management | ❌ No `buildNumber`/`versionCode`/`autoIncrement` |
| iOS submit credentials (`eas.json`) | ❌ Empty strings; `google-play-service-account.json` absent **and not gitignored** (risk of committing a secret when added) |
| Face ID | ❌ `NSFaceIDUsageDescription` missing; `expo-local-authentication` not in plugins → crash/rejection risk |
| Production env pinning | ❌ No `env` in any eas.json profile — a stray `EXPO_PUBLIC_API_URL` in EAS secrets would silently win |
| Camera/photo usage strings | ✅ Present and descriptive |
| Bundle IDs | ✅ `com.effortlessinsight.app` both platforms |
| OTA updates | Not configured (no expo-updates) — decide intentionally |
| Privacy/Terms links | 🐛 Point at `effortlessinsight.com/*` — **domain does not resolve** (store-review rejection risk) |

## 12. Dependencies

- Expo SDK 56 is a current, store-submittable line (expo-doctor raised no SDK deprecation).
- ❌ **Missing peer/direct deps**: `expo-constants` (directly imported by constants.ts & pushNotifications.ts but not declared!), `react-native-worklets` (reanimated peer), `@react-native/jest-preset` (jest-expo peer — why tests can't run).
- ❌ **Wrong-major versions**: `expo-image-manipulator` 14.x (expected ~56.x — also drags a duplicate `expo-image-loader` native module, a native build hazard), `expo-localization` 16.x (expected ~56.x), `@types/jest` 30 (expected 29.x).
- ⚠️ **`react-native-razorpay` is unsupported on the New Architecture** (RN 0.85 is New-Arch) — the checkout screen may not function in a production build. Must be device-tested or replaced before selling subscriptions from mobile.
- Unused: `nativewind` + `tailwindcss` (no config, no usage), `ajv`, `react-native-reanimated` (0 imports yet causes the worklets peer failure).

## 13. Error Handling & Observability

- **Crash reporting/analytics: none.** No Sentry/Crashlytics/anything (0 grep hits). The admin web app has Sentry; mobile has nothing. A production incident would be invisible.
- Single root ErrorBoundary (retry + dev-only detail) — fine, but its `onError` goes nowhere.
- 39 console statements; none log tokens/PII (verified); several deliberate empty catches; a few genuinely swallowed (GSTIN validation error → silent).
- Server messages discarded in notice-detail mutations; raw axios strings surfaced on validation errors (§3.3).

## 14. Performance

- Notices list is plain `FlatList` with non-memoized `NoticeCard` and header re-created per keystroke (works; FlashList/memoization is backlog).
- `useUnreadCount` polls every 30 s regardless of screen/app-state.
- pdf-lib in the tab bundle graph inflates startup; consider lazy import.
- QA report observed continuous main-thread activity on the idle login screen (likely animation/timer) — worth profiling.
- Images normalized/resized before upload (good). No virtualization issues elsewhere; lists are paginated/infinite.

## 15. Tests

- Suite **cannot run** (missing `@react-native/jest-preset`).
- Even when it ran (07-31), it was placebo: `api.test.ts` tests its own axios mock; `Button.test.tsx` tests an inline reimplementation. **Effective coverage of production code: 0%.** (Prior B7 ✅ still true.)
- No store/hook/queue/pdf tests. ESLint config absent.

## 16. Code Quality

- `tsc` clean; `any` usage moderate (25, mostly catch blocks).
- Dead code inventory: empty top-level `components/ hooks/ lib/ services/ types/` dirs; `src/components/scanner/*` (contains the **fake `Math.random()` edge detection** — prior M1 ✅ still open) + `perspectiveCorrection.ts`; `share.ts`; dead pdfGenerator functions (`createPdfContent`/`processImageForPdf`); dark-mode plumbing never wired; dead API/hook layers (sessions, invoice PDF, billing management set, `useOrganization` set — incl. a **buggy-if-ever-used** `useSwitchOrganization` that never persists the new tokens); `update_notice_status` queue type; upload edge-detection UI states.
- Duplication: profile→UserDto mapping ×3 in authStore; `ApiResponse<T>` re-declared ×3; local `formatCurrency` re-implementations.
- One TODO: `auth.ts:38` appVersion hardcoded `'1.0.0'`; deviceName hardcoded `'iPhone'`/`'Android Device'`.

---

## 17. Production Readiness Scorecard

| Area | Status | Score | Critical issues |
|---|---|---:|---|
| Features | ⚠️ Broad but 6 features call nonexistent endpoints | 5/10 | GSTN, profile edit, workflow, doc-request submission dead |
| API Integration | 🐛 Contract divergence + dead prod host | 3/10 | `.com` host NXDOMAIN; A1–A6 |
| Authentication | ⚠️ Good core, real edge defects | 6/10 | C3 biometric bypass, offline logout, 401 desync, OAuth issues |
| Authorization | ⚠️ Backend solid; mobile UI ungated | 6/10 | No role gating in UI; generic 403 errors |
| Security | ⚠️ Native storage good; web target + OAuth concerns | 6/10 | localStorage on web, tokens in redirect URL |
| Navigation | ✅ Solid | 8/10 | No +not-found, no app links |
| UX | ⚠️ | 6/10 | Raw error strings, dead detection UI, English-only reality |
| Error Handling | ⚠️ | 4/10 | ValidationProblemDetails unparsed; server messages discarded |
| Performance | ⚠️ Acceptable for launch scale | 6/10 | FlatList, polling, bundle size |
| Testing | ❌ | 1/10 | Suite can't run; 0% real coverage; no lint |
| Android Production Readiness | ❌ | 2/10 | Assets, Firebase file, projectId, versionCode |
| iOS Production Readiness | ❌ | 1/10 | Assets, plist, Face ID string, empty submit creds |
| Code Quality | ⚠️ | 6/10 | Dead code volume; duplication; else healthy |
| Observability | ❌ | 1/10 | No crash reporting/analytics at all |

**Overall: ~3.9/10 — 🔴 NOT READY.**

---

## 18. Final Answer

> **"If this mobile application were submitted to the App Store and Google Play and released to real customers today, would you be confident that it is production-ready?"**

**No — and today it would not even reach customers.** The submission itself would fail: every icon/splash asset referenced by `app.json` is missing and the Firebase config files it references don't exist, so the EAS/prebuild step errors out before a binary exists. If those were stubbed and a build forced through, the app would boot pointing at `api.effortlessinsight.com` — a host with **no DNS record** — so login, and everything after it, would fail for 100% of users. Push notifications cannot deliver (placeholder EAS project ID + no FCM/APNs config), payments run on a library unsupported by this RN version's architecture, six visible features call backend routes that don't exist, there is no crash reporting to even learn any of this from the field, and the safety net (tests/lint) is non-functional.

The encouraging part: the distance to "ready" is mostly **configuration, provisioning, and a dozen well-understood code fixes**, not architecture. The core flows (auth, notices, scan-to-PDF upload, tasks, offline queue, push code) are genuinely well built. With the P0 list in `MobileProductionGapAnalysis.md` cleared, a device-level QA pass (especially Razorpay checkout and push delivery on physical devices), and real tests around the auth/offline core, this app is realistically 2–4 focused weeks from a credible production release.
