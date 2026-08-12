# Mobile Production Gap Analysis — 2026-08-10

All gaps, prioritized. Each entry: severity, area, file(s), current vs expected, why it matters, evidence, recommended fix, production-blocking?

Cross-references: prior IDs (B*/C*/M* from 2026-07-31, BUG-* from 2026-08-01) noted where a finding was re-verified.

---

## P0 — Must Fix Before Production (release is impossible or broken for all users)

**P0-1. Production API host does not exist** — *API/config* — `app.json:74`, `src/utils/constants.ts:15`
Current: default API URL `https://api.effortlessinsight.com`. Expected: the live host. Evidence: DNS lookup 2026-08-10 — `.com` = NXDOMAIN; `api.effortlessinsight.in` = A 13.126.249.33; web `.env.example` uses `.in`. Every API call in a store build fails. Also reconcile `infrastructure/terraform/variables.tf` + `performance-tests` (still `.com`). Fix: change both defaults to `https://api.effortlessinsight.in`, pin `EXPO_PUBLIC_API_URL` in eas.json production env. (Supersedes BUG-06.) **Blocks: yes.**

**P0-2. All binary assets missing** — *Build* — `assets/` (only 2 SVGs)
`icon.png`, `splash.png`, `adaptive-icon.png`, `notification-icon.png`, `favicon.png`, `sounds/notification.wav` are referenced by app.json but absent → prebuild/EAS build fails; store submission impossible. Confirmed by expo-doctor. (B3.) Fix: generate/export assets. **Blocks: yes.**

**P0-3. Firebase config files missing** — *Build/push* — app.json `ios.googleServicesFile`, `android.googleServicesFile`
`google-services.json` and `GoogleService-Info.plist` referenced, absent → prebuild fails; FCM/APNs impossible. (B1.) Console work: create Firebase project, download files, upload APNs key + FCM service account to EAS credentials. **Blocks: yes.**

**P0-4. EAS projectId is a placeholder** — *Build/push* — `app.json extra.eas.projectId = "effortless-insight-mobile"`
Not a UUID → EAS build unlinked; `getExpoPushTokenAsync({projectId})` fails → push registration can never succeed. (B2.) Fix: `eas init`. **Blocks: yes.**

**P0-5. GSTN integration entirely broken — double URL prefix** — *API* — `src/services/api/gstn.ts:16`
`BASE_URL='/api/v1/gstn'` on a client whose baseURL already ends `/api/v1` → all requests hit `/api/v1/api/v1/gstn/*` (no such route; backend `GstnController` = `api/v1/gstn`). Four screens dead (integrations, OTP, settings, history). Fix: `const BASE_URL = '/gstn'`. **Blocks: yes (advertised feature is 100% broken).**

**P0-6. No crash reporting or analytics** — *Observability* — whole app
Zero Sentry/Crashlytics (verified grep). Production failures would be invisible — with this many config risks, flying blind is not survivable. Fix: add `sentry-expo` (or `@sentry/react-native`), wire ErrorBoundary.onError + API-error breadcrumbs. **Blocks: yes (operational).**

**P0-7. Razorpay unsupported on New Architecture** — *Payments* — `react-native-razorpay ^3.0.0`, `app/billing/checkout.tsx`
expo-doctor: incompatible with RN 0.85 New Arch. Checkout may crash/no-op in production builds — revenue path. Fix: device-test an EAS build; if broken, disable new-arch or switch integration (web checkout via in-app browser). **Blocks: yes until verified on device.**

**P0-8. Missing runtime dependency `expo-constants`** — *Build* — `package.json`
Directly imported (`src/utils/constants.ts:5`, `pushNotifications.ts`) but not declared; works only transitively via expo-router. expo-doctor: "may crash outside Expo Go". Also missing: `react-native-worklets` (reanimated peer). Fix: `npx expo install expo-constants` (+ remove unused reanimated or add worklets). **Blocks: yes.**

**P0-9. iOS submit credentials empty / Play service account absent** — *Release* — `eas.json`
`appleId`/`ascAppId`/`appleTeamId` = ""; `google-play-service-account.json` absent and **not gitignored** (secret-commit risk when added). (B6.) Fix: fill credentials, gitignore the key file. **Blocks: yes (submission).**

**P0-10. Legal links point at dead domain** — *Store compliance* — `register.tsx:298,305`, `profile.tsx:131–172`
Privacy/terms/help URLs are on `effortlessinsight.com` (NXDOMAIN). Broken privacy-policy link = App Store/Play rejection trigger. Fix: point at `.in` equivalents (verify pages exist). **Blocks: yes.**

---

## P1 — Must Fix Before Production (broken features / security defects)

**P1-1. Profile editing calls a nonexistent endpoint** — *API/backend gap* — mobile `auth.ts:91` (`PATCH /auth/me`); backend has no profile-update route at all (web `PUT /users/profile` equally broken)
Every Save in Edit Profile fails. Fix requires a **backend** endpoint (recommend `PATCH /api/v1/auth/me` or a proper `PUT /users/profile`); then align both clients. *Requirement owner: backend.*

**P1-2. Workflow panel uses wrong routes** — *API* — `notices.ts:209,217`
Mobile: `/notices/{id}/workflow/progress|transition` + `{transitionKey}`. Backend: `/workflows/notices/{id}/progress|transition` + `{targetStageKey}`, feature-gated (402). Fix mobile paths/body; handle 402 with an upgrade prompt.

**P1-3. Document-request submission wrong route** — *API* — `tasks.ts:273`
`POST /document-requests/{id}/submissions` → backend route is `/fulfill` (multipart). Fix path (verify multipart field names against `DocumentRequestsController`).

**P1-4. Response "Reject" calls nonexistent endpoint** — *API* — `notices.ts:295`, Response tab in `app/notices/[id].tsx`
No backend route; web has no reject action either. Recommend removing the mobile-only Reject action (or add a backend route if product wants it — **requirement clarification needed**).

**P1-5. Verify-email "Resend" broken twice** — *API/auth* — `verify-email.tsx:64`, `auth.ts:132`
Endpoint `/auth/verify-email/resend` doesn't exist; and it's called from a deep-linked, unauthenticated context. Needs a backend anonymous resend endpoint (rate-limited, by email) — **backend work + clarification**.

**P1-6. Single-page upload in multi-page mode always fails** — *Upload* — `upload.tsx:297–350` (C1, re-verified)
With multi-page ON and exactly 1 page, code falls into the single-image branch and derefs `capturedImage!` (null in that mode). The most common real scan (1-page notice) fails. Fix branch to `isMultiPageMode && pages.length >= 1`.

**P1-7. Biometric gate bypass** — *Security* — `authStore.ts:115` (C3, re-verified)
If biometric was enabled and the sensor becomes unavailable/unenrolled, `initialize()` silently restores the session without any gate. Fix: when `biometricEnabled && !biometricAvailable`, do not auto-restore; require password login.

**P1-8. Offline cold start logs the user out** — *Auth/offline* — `authStore.ts:152–157`
`restoreSession` clears tokens on ANY `getProfile` failure, including network-offline. Fix: only clear on 401/403; keep cached session on network errors.

**P1-9. Refresh-failure doesn't de-authenticate the UI** — *Auth* — `client.ts:60–120` (M5, re-verified)
Interceptor clears storage but authStore stays `isAuthenticated:true` → zombie session until restart. Fix: interceptor → authStore callback (e.g. `setOnAuthFailure`) that resets auth state.

**P1-10. Validation errors surface as raw axios strings** — *Errors/UX* — `client.ts:127–135` (BUG-03, re-verified)
`getApiErrorMessage` ignores ASP.NET `ValidationProblemDetails` (`title`/`errors{}`) → "Request failed with status code 400" app-wide. Fix: parse `data.errors` (first message) and `data.title`.

**P1-11. OAuth defects** — *Security* — `OAuthButtons.tsx:136–159`
(a) direct-token path calls `getProfile()` before tokens persist → 401/wrong user; (b) tokens transported in redirect URL query; (c) `state` never verified client-side. Fix ordering + verify state; move token delivery to code-exchange only (backend supports callback exchange).

**P1-12. Push delivery dead end-to-end** — *Push* — consequence of P0-3/P0-4 (C2)
Code is ready; delivery blocked by config. Verify on device after P0 fixes; add background data-only handling decision (currently none).

**P1-13. Test suite cannot run & has 0% real coverage; no ESLint config** — *Quality gate* — `jest.config.js`, `package.json` (B7 + QA finding, re-verified)
jest-expo needs `@react-native/jest-preset`; existing tests test mocks/reimplementations, not app code; lint script has no config. Fix: install preset, add eslint config, write real tests for `client.ts` refresh, `offlineQueue`, `usePaywall` fail-closed, `pdfGenerator`.

**P1-14. Registration hard-fails when verification email can't send** — *Backend* — `AuthController.cs:67–70`, `AuthService.RegisterAsync` (BUG-02, re-verified)
SES blip = registration outage ("registration was not saved"). Fix (backend): create account, queue email async, offer resend. *Requirement owner: backend.*

**P1-15. Wrong-major native modules** — *Build* — `expo-image-manipulator` 14.x & `expo-localization` 16.x (expected ~56.x); duplicate `expo-image-loader` native module
Native build hazard. Fix with `npx expo install expo-image-manipulator expo-localization`.

**P1-16. iOS Face ID not release-configured** — *Build/store* — app.json (B5, re-verified)
No `NSFaceIDUsageDescription`, `expo-local-authentication` not in plugins → crash on first Face ID prompt + rejection risk. Fix: add both.

**P1-18. Collaboration API envelope mismatch — tasks/comments/doc-requests/activity all returned `undefined`** — *API* — `src/services/api/tasks.ts` (19 call sites) **[FIXED this pass]**
The Tasks/Comments/DocumentRequests/Activity controllers return bare payloads (no `{success,data}` wrapper — verified per controller; the web app unwraps `response.data`), but mobile read `response.data.data` on every call. Tasks tab, Comments tab, Document Requests, and Activity feed were silently empty/broken. Also: `fulfillDocumentRequest` posted JSON to the multipart-only `/fulfill` (now `/mark-fulfilled`). Discovered during fix verification — a reminder that authenticated flows were never runtime-tested end-to-end.

**P1-17. In-app account deletion missing** — *Store policy* — no mobile UI
Apple App Review 5.1.1(v) requires account-deletion in apps with account creation. Verify backend `DELETE /users/account` exists (web references it) and add a mobile entry point (or at minimum a compliant link). **Clarify + implement before iOS submission.**

---

## P2 — Should Fix (quality/robustness; not launch-blocking individually)

- **P2-1** Upload robustness: no client-side size check (`FILE_CONFIG.MAX_SIZE_MB` unused; constant says 10 MB, backend allows 25 MB — align to 25), 30 s timeout on multipart (raise per-call), no AbortController cancellation, state set on unmounted screen. (M2/M3.) `upload.tsx`, `notices.ts:86`.
- **P2-2** Dead "Document detected"/auto-capture UI on upload screen (`edgeDetected` never true). Remove. (M6.) `upload.tsx:646–667`.
- **P2-3** Fake scanner components still in tree: `src/components/scanner/DocumentScanner.tsx` (Math.random edge detection), `MultiPageScanner.tsx`, `perspectiveCorrection.ts` — unused; delete. (M1.)
- **P2-4** Offline gaps: notice **detail** not cached; queue sync only on connectivity transition (not cold start); `upload_document` queue type throws by design (remove type or implement); `update_notice_status` type has no producer. (M4.)
- **P2-5** Password policy mismatch: login `min(6)` vs register `min(8)`; server also rejects sequential/repeated chars that no client mirrors; register helper text omits special-char rule. (BUG-05.) `login.tsx:29`, `register.tsx:35`.
- **P2-6** Login 2FA navigation race (stale `requires2fa` closure) — `login.tsx:85–97`.
- **P2-7** Notice-detail mutations discard server error messages (hardcoded "Failed to …") — `[id].tsx:677,696,934,1116`; offline-queue message for comments not distinguished.
- **P2-8** No role-based UI gating: delete (RequireAdmin), assign (RequireManager) render for everyone; 403 → generic error.
- **P2-9** Mobile filter parity: add type/GSTIN filters; fix "overdue" to exclude closed/responded.
- **P2-10** app.json hygiene: invalid top-level `splash` key (SDK 56), no `buildNumber`/`versionCode`/`autoIncrement`, no eas.json production `env` pin, no `+not-found` route, no App/Universal Links.
- **P2-11** Unused deps: `nativewind`, `tailwindcss`, `ajv`, `react-native-reanimated` (0 imports; causes worklets peer error). Remove.
- **P2-12** Subscription management unreachable: cancel/pause/invoices hooks + APIs exist with no screen; Play policy prefers manageable subscriptions. Add minimal management screen or link-out.
- **P2-13** Org switching UI missing for multi-org users; `useSwitchOrganization` also fails to persist tokens if ever used. `useOrganization.ts:96–101`.
- **P2-14** i18n adoption: only 3 screens consume translations; either adopt across screens or drop the Hindi claim.
- **P2-15** `authStore` duplication (profile mapping ×3), `ApiResponse<T>` re-declared ×3, `completeOnboarding` sets refresh token to `''` when absent.
- **P2-16** Dashboard: pull-to-refresh without try/finally, partial-zero render, no error state; blueprint drift (due-≤3-days banner, tasks-today stat, activity feed).
- **P2-17** appVersion hardcoded `'1.0.0'` + deviceName hardcoded (`auth.ts:35–39`); use expo-constants/Platform.
- **P2-18** Notifications unread badge count never synced to app badge; `useUnreadCount` polls every 30 s regardless of app state.
- **P2-19** Backend hardening (API team): Swagger + dev exception page in all envs; committed credentials in appsettings.json; HS256 dev-secret fallback; `X-Organization-Id` fallback in tenant middleware.
- **P2-20** Web-target token storage = localStorage (only if web ever ships). QA a11y findings (no button roles on web) same condition.

## P3 — Nice to Have

- FlashList migration + NoticeCard memoization; lazy-load pdf-lib.
- Task creation from Tasks tab; task detail view (assignees/attachments/time); tab badge for tasks.
- AI features on mobile: auto-draft response, AI chat (backend `/messages/sync` fits mobile), similar notices.
- Reports/calendar read-only views; compliance score card.
- Session management UI; notification preference depth; SignalR live updates.
- Dead-code sweep: empty top-level dirs (`components/ hooks/ lib/ services/ types/`), `share.ts`, dead pdfGenerator functions, dark-mode plumbing, dead API methods (`markAsRead`, `downloadInvoicePdf`, auth.ts push pair, sessions), dead queue type.
- Enhancement modes that actually filter (currently resize-only); real edge detection (needs ML model — accepted fallback is manual capture).
- Profile photo upload (needs backend endpoint first).
- OTA updates decision (expo-updates absent — decide intentionally).

## Requirement Clarification Needed

1. **iOS payments**: selling the SaaS subscription in-app via Razorpay likely violates App Store IAP rules — decide iOS strategy (IAP, read-only, or external-link entitlement).
2. Response **Reject** action: product-desired (add backend route) or remove from mobile?
3. Verify-email **resend**: anonymous resend endpoint wanted?
4. Profile edit/avatar: which backend endpoint shape (affects web too)?
5. Mobile scope for: AI chat, auto-draft, reports, calendar, GST-sync notice browsing, WhatsApp prefs, approvals.
6. Account deletion in-app (P1-17) — confirm backend route and required UX.
7. Offline scope: is notice-detail offline viewing required (blueprint implies yes)?
8. ENV-01 (QA 2026-08-01): confirm which database the locally-run API targets (migration ambiguity) — environment, not product.
