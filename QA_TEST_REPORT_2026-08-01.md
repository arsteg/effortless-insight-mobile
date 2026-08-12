# EffortlessInsight Mobile — End-to-End QA Test Report

**Date:** 2026-08-01
**Build:** `@effortlessinsight/mobile` (Expo SDK 56, React Native 0.85.3, expo-router)
**Method:** Real interaction with the running app via the Expo **web** target (driven through a browser), the live local API (`http://localhost:59111/api/v1`), direct API probing, database inspection, and static analysis (type-check, jest, lint, source review).

---

## Executive Summary

- **Overall quality score: 42/100.**
- **Overall readiness: Not production ready.** The app does not build without a missing dependency, its test suite cannot run, the client/server contracts diverge in several places, and end-to-end onboarding (register → verify → login) could not be completed in this environment.
- **Critical blockers:** (1) a missing `pdf-lib` dependency that breaks the entire build; (2) registration is impossible in this environment because verification-email delivery fails and the backend rolls the whole registration back; (3) the API base domain is inconsistent across the codebase (`.com` vs `.in`).
- **Recommendation:** Fix the build/dependency and API-contract issues, decouple registration from synchronous email delivery (or provide a dev/mock email path), reconcile the API domain, then re-run a full authenticated pass.

### What was and wasn't testable

| Area | Coverage | Why |
|---|---|---|
| Build / bundling | ✅ Verified | Reproduced the failure, fixed it, rebuilt |
| Static (type-check, jest, lint) | ✅ Verified | Ran the tooling |
| Unauthenticated screens (login, register, validation, network, error states) | ✅ Verified by real interaction | Drove them in the browser |
| Auth API behavior (login, register, /auth/me) | ✅ Verified | Real network + direct API probing |
| Authenticated area (tabs, notices, tasks, upload, profile, settings, billing, notifications) | ❌ **Blocked** | Could not obtain a working local account (see BUG-02 / ENV) |
| Native-only (push, biometrics, offline, camera, PDF, rotation, background) | ❌ Not testable on web target | No emulator automation available; web build used |

---

## Environment

- **Mobile:** Expo SDK 56 web build started with `EXPO_PUBLIC_API_URL=http://localhost:59111` on `http://localhost:8081`, driven via browser automation.
- **API:** running (F5) on `https://localhost:59110` / `http://localhost:59111`; reachable from the web build (CORS preflight `OPTIONS` → 204 confirmed).
- **DB inspected:** Postgres container `effortlessinsight-db` (`localhost:5432`). **Note:** this DB has 0 users and 0 login-audit rows, yet the API returns `EMAIL_EXISTS`/processes logins — so the running API is connected to a *different* database than this container (see ENV-01).
- **Fix applied during testing:** installed the missing `pdf-lib` package (`npm i pdf-lib --legacy-peer-deps`) and cleared the Metro cache to unblock the build.

---

## Test Coverage & Evidence

| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | Web build / bundle | ❌→✅ after fix | Metro: "Unable to resolve module pdf-lib" → after install, "Web Bundled … 3388 modules" |
| 2 | App boots, routes unauthenticated user to /login | ✅ | App loaded → `Loading…` → redirected to `/login` |
| 3 | Login: invalid email format | ✅ validation works | "Please enter a valid email address" |
| 4 | Login: short password | ✅ validation works | "Password must be at least 6 characters" |
| 5 | Login: wrong credentials | ✅ (400) but see BUG | POST `/auth/login` → 400, shows "Invalid email or password" |
| 6 | Login screen on load | ❌ BUG-04 | Leaked banner "No refresh token available"; `GET /auth/me` → 401 |
| 7 | Register: client validation | ⚠️ partial | Enforces special char but the helper text doesn't mention it |
| 8 | Register: submit | ❌ BUG-02 / BUG-03 | POST `/auth/register` → 400; UI shows raw "Request failed with status code 400" |
| 9 | Register (direct API, valid payload) | ❌ blocked | `EMAIL_SEND_FAILED` — "registration was not saved" |
| 10 | Authenticated flows | ❌ not reached | No working local account |

---

## Bugs

### BUG-01 — Missing `pdf-lib` dependency breaks the entire build *(Critical)*
- **Steps:** `npx expo start --web` (or `tsc --noEmit`, or open the Upload screen on native).
- **Expected:** App builds and runs.
- **Actual:** Metro fails: "Unable to resolve module `pdf-lib` from `src/utils/pdfGenerator.ts`". The whole app fails to bundle; type-check also errors ("Cannot find module 'pdf-lib'").
- **Root cause:** `src/utils/pdfGenerator.ts` imports `pdf-lib` (used by `app/(tabs)/upload.tsx`) but it is not in `package.json`.
- **Affected files:** `src/utils/pdfGenerator.ts`, `app/(tabs)/upload.tsx`, `package.json`.
- **Suggested fix / applied:** Added `pdf-lib` to dependencies (`npm i pdf-lib --legacy-peer-deps`) and cleared Metro cache. **Applied — build now succeeds.** Commit the `package.json`/lockfile change.
- **Retest:** ✅ Web bundle succeeds (3388 modules), app boots.

### BUG-02 — Registration cannot complete: email-send failure rolls back the whole registration *(Critical / blocker)*
- **Steps:** Register any new account (UI or `POST /api/v1/auth/register` with a valid payload).
- **Expected:** Account created; user proceeds to verify email.
- **Actual:** `{ code: "EMAIL_SEND_FAILED", message: "We could not send the verification email. Your registration was not saved - please try again." }`. No account is created.
- **Root cause:** `AuthService.RegisterAsync` (`…/Services/Auth/AuthService.cs:119-148`) sends the verification email synchronously and, on `EmailDeliveryException`, **deletes the just-created user and aborts**. In this environment SES email delivery fails (sandbox/creds), so no one can register. This hard-couples account creation to email-infrastructure availability (an SES blip = registration outage).
- **Affected files:** `Services/Auth/AuthService.cs` (backend), `src/services/api/auth.ts` (mobile).
- **Suggested fix:** Make verification email best-effort/asynchronous (create the account, queue the email, allow resend), or provide a dev/console email transport so local onboarding works. Return a resend path instead of discarding the account.
- **Retest:** ❌ Still blocked.

### BUG-03 — API validation errors surface as a raw axios string *(High)*
- **Steps:** Submit a registration/login that the server rejects with a 400 validation error.
- **Expected:** The field-level message (e.g., "Password should not contain sequential or repeated characters").
- **Actual:** UI shows **"Request failed with status code 400"**.
- **Root cause:** The backend returns ASP.NET `ValidationProblemDetails` (`{ title, errors: { field: [...] } }`), but `getApiErrorMessage` (`src/services/api/client.ts:127-135`) only reads `error.response.data.message`; when absent it falls back to `error.message` (the generic axios string). The `errors`/`title` shape is never parsed.
- **Affected files:** `src/services/api/client.ts`.
- **Suggested fix:** In `getApiErrorMessage`, also handle `data.errors` (flatten the first message) and `data.title`. This affects **all** validation errors app-wide.
- **Retest:** ❌ Reproducible.

### BUG-04 — Leaked internal error "No refresh token available" on the login screen *(Medium)*
- **Steps:** Load the app while logged out.
- **Expected:** Clean login screen.
- **Actual:** A red banner "No refresh token available" appears on `/login`.
- **Root cause:** On boot the app calls `GET /api/v1/auth/me` → 401; the axios response interceptor (`src/services/api/client.ts:60-116`) attempts a refresh, throws `new Error('No refresh token available')`, and that internal message bubbles into the UI. Also, calling `/auth/me` before any token exists is unnecessary.
- **Affected files:** `src/services/api/client.ts`, boot/auth bootstrap.
- **Suggested fix:** Don't call `/auth/me` (or don't attempt refresh) when no token is stored; never surface raw interceptor errors to the UI on the unauthenticated path.
- **Retest:** ❌ Reproducible (network: `/auth/me` → 401 confirmed).

### BUG-05 — Client password policy is weaker than and inconsistent with the server *(Medium)*
- **Observed rules:** Register helper text says *"Min 8 characters with uppercase, lowercase, and number"*; client also enforces a **special character** (not documented in the helper); the **server additionally** rejects **sequential or repeated characters** (`"Password should not contain sequential or repeated characters."`) — which the client never checks. Login screen advertises a **different** minimum ("at least 6 characters") than register ("min 8").
- **Impact:** Users craft a password that passes the client, then get a confusing server rejection (made worse by BUG-03).
- **Suggested fix:** Single source of truth for the password policy; show all rules in the helper text; mirror server rules client-side.

### BUG-06 — API base domain inconsistent across the codebase (`.com` vs `.in`) *(High / config)*
- **Observed:** mobile (`app.json:74`, `src/utils/constants.ts:15`), `infrastructure/terraform/variables.tf`, and `performance-tests` all use `api.effortlessinsight.**com**`; the browser extension (`gst-notice-guard`) and web app `.env.example` use `api.effortlessinsight.**in**`.
- **Impact:** At least one set of clients points at the wrong host in production. The mobile app will hit `.com`; if the live API is `.in`, the mobile app is broken in production.
- **Suggested fix:** Reconcile to the canonical domain everywhere.

---

## UI / UX Issues

- Interactive controls (Sign In, Sign Up, Forgot Password, SSO) render as non-semantic `generic` nodes on web — **no button/link roles** (accessibility gap; also brittle for automation/screen readers).
- Login and Register route content are **both mounted in the DOM simultaneously** on the web target (observed overlapping element trees) — potential focus/hydration/z-index issue on web.
- Error copy for empty/invalid credentials ("Invalid email or password") is fine, but raw technical strings (BUG-03/04) leak to users.
- Password requirement text differs between login and register (BUG-05) — inconsistent and confusing.

---

## Security Findings

- **Token storage:** access/refresh tokens use `expo-secure-store` (`src/services/storage/secure`) — good on native. Note: on the **web** target SecureStore falls back to `localStorage`, which is XSS-readable; if web is a shipping target, treat token storage accordingly.
- **No secrets found in the mobile bundle** beyond the API URL (expected).
- **Refresh flow** correctly clears tokens on refresh-endpoint 401 and queues concurrent requests (`client.ts`) — reasonable design.
- **Auth endpoints** skip the Authorization header correctly (`client.ts:41-50`).
- Could not test authorization/tenant behavior at runtime (auth blocked).

---

## Performance Findings

- Cold web bundle is heavy (~3,388 modules; ~30s clean build) — acceptable for web dev, but indicates a large dependency graph; review bundle size for native startup.
- The login screen keeps the main thread busy enough that screenshot script-injection repeatedly timed out — suggests a continuously-running animation/timer on an otherwise-idle screen (worth profiling for battery/CPU).
- Boot makes an avoidable `GET /auth/me` (401) before any token exists (BUG-04).

---

## Code Quality Issues

- **Test suite is broken:** `npm test` aborts immediately — `jest-expo` needs the `@react-native/jest-preset` peer dependency ("The React Native Jest preset … has moved to a separate package"). **Zero tests run.** (`jest.config.js`, `package.json`.)
- **Type-check fails:** `tsc --noEmit` errors — `pdf-lib` (BUG-01) and `__tests__/services/api.test.ts` missing jest global types (`it`, `expect`, `fail` not found → add `@types/jest` / `types` in tsconfig).
- `src/utils/pdfGenerator.ts` pulls a heavy web-oriented lib (`pdf-lib`) into the tab graph; consider lazy-loading it so it doesn't inflate startup.
- Error-handling helper doesn't understand the backend's standard error envelope (BUG-03) — centralize error parsing.

---

## Environment / Infrastructure Findings

### ENV-01 — Running API is not connected to the local DB container *(High — verify)*
The `effortlessinsight-db` container's `effortlessinsight` database has **0 rows** in `AspNetUsers` and `LoginAudits`, yet the running API returns `EMAIL_EXISTS` for `aanchal.arsteg@gmail.com` and processes login attempts. Therefore the API (F5) is pointed at a **different database** (Local.json resolves to `localhost:5432`, but EF design-time fell back to `Host=db`, indicating config ambiguity). **Consequence:** the GST-sync migration applied earlier (`AddGstSyncProductionHardening`) was applied to this container DB, which may **not** be the database the API actually uses. Verify the API's effective `ConnectionStrings:DefaultConnection` and re-apply the migration to the correct DB if needed.

---

## Final Assessment

**Production readiness: 42/100.**

- **Critical (3):** BUG-01 build blocker (fixed), BUG-02 registration/email hard-coupling (onboarding blocker), BUG-06 API domain `.com` vs `.in`.
- **High (3):** BUG-03 raw error surfacing, broken jest suite (no test safety net), ENV-01 DB/connection ambiguity.
- **Medium (3):** BUG-04 leaked login-screen error, BUG-05 password policy mismatch, failing type-check.
- **Low:** a11y roles on web, dual-mounted auth routes, avoidable `/auth/me` on boot, bundle size.

### Recommended next actions (in order)
1. Commit `pdf-lib` (BUG-01) and add it to CI so the build can't regress.
2. Decouple registration from synchronous email; add a dev/console email transport so onboarding is testable locally (BUG-02).
3. Fix `getApiErrorMessage` to parse ASP.NET `ValidationProblemDetails` (BUG-03).
4. Reconcile the API domain across mobile/infra/extension/web (BUG-06).
5. Repair the jest preset and `@types/jest`, get `tsc`/`jest` green (test safety net).
6. Fix the boot `/auth/me`/refresh leak (BUG-04) and unify the password policy (BUG-05).
7. Confirm the API's real database and that migrations target it (ENV-01), then re-run a full authenticated test pass (tabs, notices, tasks, upload/PDF, profile, settings, billing, notifications, offline, logout/login).

### Estimated effort remaining
- Fixes 1–6: ~1–2 focused days.
- Full authenticated + native (emulator/device) test pass once onboarding works: ~2–3 days.

---

### Coverage honesty note
Authenticated-area functionality (the majority of the app's screens) was **not** runtime-tested because a working local account could not be created (BUG-02) or seeded (ENV-01: the API's DB is not the inspectable local container, and I would not guess production credentials). Native-only capabilities (push, biometrics, camera, offline, rotation, background/foreground) are not exercisable on the web target and require an emulator/device with UI automation not available here. Findings above are all reproduced from real interaction, network traces, direct API responses, database queries, or source review — none are assumed from "the code looks correct."
