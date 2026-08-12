# Mobile Production Implementation Plan — 2026-08-10

Ordered plan derived from `MobileProductionGapAnalysis.md`. Complexity: S/M/L. "Status" is updated as work completes in this pass.

## Group 1 — Point at the real production environment (P0) 

| # | Change | Files | Complexity | Risk | Testing | Status |
|---|---|---|---|---|---|---|
| 1.1 | API URL `.com` → `.in` (default + app.json) | `src/utils/constants.ts`, `app.json` | S | Low — DNS-verified | tsc; manual login against prod later | **Planned this pass** |
| 1.2 | Pin `EXPO_PUBLIC_API_URL` in eas.json production profile | `eas.json` | S | Low | eas build --profile production | **Planned this pass** |
| 1.3 | Legal/help links `.com` → `.in` | `register.tsx`, `profile.tsx` | S | Low — verify pages exist on `.in` before store submission | Manual tap | **Planned this pass** |
| 1.4 | Reconcile terraform/perf-test domains (out of mobile repo) | `infrastructure/terraform/variables.tf`, `performance-tests` | S | Review with infra owner | n/a | Flagged for infra team |

## Group 2 — Fix broken API contracts (P0-5, P1-2, P1-3)

| # | Change | Files | Complexity | Risk | Testing | Status |
|---|---|---|---|---|---|---|
| 2.1 | GSTN `BASE_URL` `'/api/v1/gstn'` → `'/gstn'` | `src/services/api/gstn.ts:16` | S | Low — route verified against `GstnController` | tsc; on-device GSTN connect | **Planned this pass** |
| 2.2 | Workflow paths → `/workflows/notices/{id}/progress` & `/transition`, body `targetStageKey`; verify response DTO mapping; handle 402 | `src/services/api/notices.ts`, `app/notices/[id].tsx` | M | Medium — response shapes must match `WorkflowController` DTOs | tsc + manual | **Planned this pass** (path/body after DTO check) |
| 2.3 | Document-request submission → `/fulfill` multipart (field names from `DocumentRequestsController`) | `src/services/api/tasks.ts:273` | S | Low | manual | **Planned this pass** (after controller check) |
| 2.4 | Response Reject: backend route absent — pending product decision (Gap P1-4) | — | — | — | — | Requirement clarification |
| 2.5 | Profile edit + verify-email resend: **backend endpoints required** (P1-1, P1-5) | backend `AuthController`/new UsersController | M | Backend change | integration | Backend team |

## Group 3 — Auth/security code defects (P1-6..P1-11)

| # | Change | Files | Complexity | Risk | Testing | Status |
|---|---|---|---|---|---|---|
| 3.1 | Single-page multi-page upload branch fix | `app/(tabs)/upload.tsx` | S | Low | manual scan flows | **Planned this pass** |
| 3.2 | Biometric: require password when enabled-but-unavailable | `src/stores/authStore.ts` | S | Low | manual | **Planned this pass** |
| 3.3 | restoreSession: only clear tokens on 401/403, keep session on network errors | `src/stores/authStore.ts` | S | Low | manual offline launch | **Planned this pass** |
| 3.4 | Interceptor → authStore de-auth callback on refresh failure | `src/services/api/client.ts`, `authStore.ts` | M | Medium (avoid import cycles — callback registration) | tsc + manual | **Planned this pass** |
| 3.5 | Parse ValidationProblemDetails in `getApiErrorMessage` | `client.ts` | S | Low | unit test | **Planned this pass** |
| 3.6 | Login 2FA navigation: decide from login() result, not stale state | `app/(auth)/login.tsx`, `authStore.ts` | S | Low | manual 2FA | **Planned this pass** |
| 3.7 | OAuth ordering/state fixes | `src/components/auth/OAuthButtons.tsx` | M | Medium | manual OAuth (providers currently disabled server-side) | **Planned this pass** (ordering + state check) |
| 3.8 | Login password min 6 → aligned message (require non-empty; server is source of truth) | `login.tsx` | S | Low | manual | **Planned this pass** |

## Group 4 — Build/dependency readiness (P0-2/3/4/7/8/9, P1-15/16)

| # | Change | Complexity | Status |
|---|---|---|---|
| 4.1 | `npx expo install expo-constants expo-image-manipulator expo-localization` (fix missing dep + wrong majors + dup native module) | S | **Planned this pass** |
| 4.2 | Add `@react-native/jest-preset` devDep → make jest run; align `@types/jest` to 29 | S | **Planned this pass** |
| 4.3 | Remove unused `react-native-reanimated`, `nativewind`, `tailwindcss`, `ajv` | S | **Planned this pass** (verify 0 imports again before removal) |
| 4.4 | Add `babel.config.js` (babel-preset-expo) | S | **Planned this pass** |
| 4.5 | app.json: move splash under expo-splash-screen plugin; add `NSFaceIDUsageDescription` + expo-local-authentication plugin; add ios.buildNumber/android.versionCode | S | **Planned this pass** |
| 4.6 | .gitignore `google-play-service-account.json` | S | **Planned this pass** |
| 4.7 | Generate icon/splash/notification assets | M | **Console/design work — cannot generate binaries here; placeholder generation possible on request** |
| 4.8 | Firebase project + config files; `eas init` (real projectId); EAS credentials (APNs key, FCM SA); fill iOS submit creds | M | **Console work — requires accounts; blocked here** |
| 4.9 | Device-test Razorpay checkout on an EAS build; fallback plan if New-Arch incompatible | M | Blocked on 4.8 |
| 4.10 | Add ESLint config (eslint-config-expo) | S | **Planned this pass** |

## Group 5 — Observability (P0-6)

| # | Change | Complexity | Status |
|---|---|---|---|
| 5.1 | Add Sentry (sentry-expo), init in root layout, wire ErrorBoundary.onError, strip PII | M | **Planned this pass** — install + wiring; DSN to be provided via env (placeholder-safe: disabled when no DSN) |

## Group 6 — Robustness (P2 selections)

| # | Change | Status |
|---|---|---|
| 6.1 | Client-side file-size check (align constant to backend 25 MB) + per-call upload timeout (120 s) | **Planned this pass** |
| 6.2 | Remove dead detection UI on upload; delete fake scanner components + perspectiveCorrection + dead pdfGenerator fns + empty top-level dirs + share.ts | **Planned this pass** |
| 6.3 | appVersion from expo-constants | **Planned this pass** |
| 6.4 | Real tests: client refresh flow, offlineQueue, getApiErrorMessage, pdfGenerator validation | **Planned this pass** (initial set) |
| 6.5 | Notice-detail offline cache; sync-on-startup; role-gated UI; filter parity; i18n adoption; subscription management screen; org switcher | Backlog — next sprint |

## Sequencing & dependencies

1. Groups 1–3 + 6.1–6.3 are pure code — done in this pass, verified by tsc.
2. Group 4.1–4.6/4.10 are dependency/config — done in this pass, verified by expo-doctor/tsc/jest.
3. Group 4.7–4.9 + 5.1-DSN are **provisioning** (Firebase/EAS/Apple/Play/Sentry consoles) — the remaining human-blocking path to release.
4. After provisioning: EAS preview build → run `PRODUCTION-READINESS-TEST-PLAN.md` on physical devices (push delivery, biometric, camera, Razorpay live, deep links) → store submission.

## Completed-fix log (2026-08-10 pass)

All verified by `tsc --noEmit` (0 errors), `jest` (2 suites / 11 tests pass), `expo-doctor` (19/21, up from 16/21).

**API contracts & environment**
- ✅ 1.1–1.3 API + legal/help URLs `.com` → `.in` (`constants.ts`, `app.json`, `register.tsx`, `profile.tsx`); `EXPO_PUBLIC_API_URL` pinned in eas.json production env. ⚠️ Verify `app.effortlessinsight.in` / `help.effortlessinsight.in` pages exist before store submission (only apex + api DNS were verified).
- ✅ 2.1 GSTN double `/api/v1` prefix fixed (`gstn.ts` → `/gstn`).
- ✅ 2.2 Workflow: paths → `/workflows/notices/{id}/progress` + `/transition` (`targetStageKey` body), bare-DTO unwrapping, availableTransitions merged from its real endpoint.
- ✅ 2.3 Document submission → `/fulfill` (multipart, `file`/`note` form fields, bare-DTO response).
- ✅ **NEW (P1-18)** Entire `tasks.ts` envelope fixed: collaboration controllers return bare payloads; all 19 call sites changed from `response.data.data` → `response.data`; `fulfillDocumentRequest` re-routed to `/mark-fulfilled`.
- ✅ Dead `authApi.registerPushToken`/`unregisterPushToken` (nonexistent `/notifications/register`) removed; live `/push-tokens` path untouched.

**Auth/security defects**
- ✅ 3.1 Single-page multi-page upload branch (`pages.length >= 1`).
- ✅ 3.2 Biometric enabled-but-unavailable no longer bypasses the gate (password fallback).
- ✅ 3.3 `restoreSession` keeps cached session on network errors; clears only on 401/403.
- ✅ 3.4 `setOnAuthFailure` callback: refresh failure now de-authenticates the store (no more zombie sessions).
- ✅ 3.5 `getApiErrorMessage` parses ASP.NET ValidationProblemDetails (`errors{}`, `title`), with tests.
- ✅ 3.6 Login 2FA navigation reads post-login store state (stale-closure race fixed).
- ✅ 3.7 OAuth: tokens persisted before `getProfile`; client-side `state` verification added.
- ✅ 3.8 Login password rule relaxed to "required" (server is source of truth).

**Build/dependencies/tooling**
- ✅ 4.1 `expo-constants` declared; `expo-image-manipulator`/`expo-localization` fixed to ~56.x (duplicate `expo-image-loader` native module resolved); patch-level lags aligned via `expo install --fix`.
- ✅ 4.2 Jest works: `@react-native/jest-preset` added, `@types/jest` → 29, `@testing-library/react-native` → 14, transformIgnorePatterns fixed for `expo-*` ESM.
- ✅ 4.3 Removed unused deps: `react-native-reanimated`, `nativewind`, `tailwindcss`, `ajv` (also clears the `react-native-worklets` peer error).
- ✅ 4.4 `babel.config.js` added (babel-preset-expo).
- ✅ 4.5 app.json: splash moved under expo-splash-screen plugin (schema-valid); `NSFaceIDUsageDescription` + `expo-local-authentication` plugin; `ios.buildNumber`/`android.versionCode`; `autoIncrement` in eas.json production.
- ✅ 4.6 `.gitignore` now covers `google-play-service-account.json`, `google-services.json`, `GoogleService-Info.plist`.
- ✅ 4.10 ESLint works: eslint 9 + `eslint.config.js` (eslint-config-expo/flat). 54 pre-existing errors / 108 warnings left to triage.
- ✅ 6.1 Client-side 25 MB size check (matches backend) + 120 s upload timeout.
- ✅ 6.2 (partial) Dead code deleted: fake scanner components (M1), `perspectiveCorrection.ts`, `share.ts`, dead pdfGenerator functions, empty top-level scaffold dirs, placebo tests. Dead "Document detected" UI in upload.tsx **not yet removed** (pending).
- ✅ 6.3 `appVersion` from expo-constants.
- ✅ 6.4 Initial real tests: error-message parsing (7) + offline queue (4).

**Still open (blocking release, needs accounts/consoles or decisions)**
- ❌ 4.7 Binary assets (icon/splash/adaptive/notification/favicon/sound).
- ❌ 4.8 Firebase config files, real EAS projectId (`eas init`), EAS credentials, iOS submit creds.
- ❌ 4.9 Razorpay New-Arch device test (or fallback strategy).
- ❌ 5.1 Crash reporting (Sentry) — not installed this pass; needs DSN/provisioning decision.
- ❌ Backend items: profile-update endpoint (P1-1), verify-email resend (P1-5), registration email decoupling (P1-14).
- ❌ Requirement clarifications: response Reject, iOS payments/IAP, account deletion UI, notice-detail offline cache.
