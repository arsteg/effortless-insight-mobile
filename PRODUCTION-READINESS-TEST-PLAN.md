# EffortlessInsight Mobile — Production Go/No-Go Manual Test Plan

**Rule:** the app ships **only when every case in Sections 1–21 passes** AND every item in
Section 22 (Known Blockers) is resolved. Each case states the **production-correct**
expected result. Cases marked **⚠️ EXPECTED TO FAIL (Bxx)** are known to fail against the
current build — they map to a blocker in Section 22 and gate release.

Stack: Expo SDK 56, React Native 0.85, expo-router, Zustand + React Query, axios,
i18n-js, Razorpay, expo-camera/-image-picker/-document-picker, expo-local-authentication,
expo-secure-store, expo-notifications, NetInfo. Scheme `effortlessinsight`.

---

## Remediation status — 2026-07-21

A remediation pass fixed most blockers in code (all changes type-check clean; verify on
device per the cases below). The ⚠️ markers in Sections 1–21 predate this pass.

**Fixed in code (verify on device):**
- **B1** — real multi-page PDF now generated with `pdf-lib` (was a JSON manifest). `src/utils/pdfGenerator.ts`
- **B2** — removed the fake `Math.random()` edge-detection/auto-capture; capture is manual. (True CV edge-detection still needs an ML model.) `app/(tabs)/upload.tsx`
- **B3** — offline queue: auto-sync on reconnect, exponential backoff, terminally-failed items stop retrying, queue-full evicts oldest (no lost action), and the task toggle now shows a toast. NetInfo honours `isInternetReachable`. `offlineQueue.ts`, `uiStore.ts`, `tasks.tsx`
- **B4** — biometric now actually gates/restores the session (`initialize` + `unlockWithBiometric`). `authStore.ts`, `login.tsx`
- **B6** — removed the decorative Profile Push toggle (now links to real settings) and the non-functional Dark Mode toggle. `profile.tsx`
- **B8** — subscription errors are surfaced (not masked as "no subscription"); the paywall now **fails closed** on a check error. `api/billing.ts`, `useBilling.ts`
- **B9** — language subtitle strings un-swapped; i18n is now reactive across all screens (`useSyncExternalStore`); GSTN history shows an error state. `language.tsx`, `i18n/index.ts`, `useTranslation.ts`, `gstn-history.tsx`
- **B10** — notice detail has a 404/deleted state; the notifications tab has an error/retry state. `notices/[id].tsx`, `(tabs)/notifications.tsx`
- **B11** — upload "Open Settings" works; register Terms/Privacy links open; 2FA "backup code" is a working entry mode. `upload.tsx`, `register.tsx`, `two-factor.tsx`
- **B12** — API base URL now reads `app.json extra.apiUrl`; no `localhost` default. `utils/constants.ts`
- **B13** — register password policy aligned to the stricter reset/change rule (special char). `register.tsx`
- **B5 (code part)** — the Settings Push toggle now requests OS permission + registers the token. `settings/notifications.tsx`
- **B-mime** — single-image upload normalized to JPEG so the declared type is accurate. **B-toast** — a real `ToastContainer` is mounted. **B-list-tap** — the in-app list tap uses the same validated navigation as push. **B-search** — the notices search is debounced.

**Reclassified — not a real defect:**
- **B7** — the GSTN connect flow is **GSTIN-based OTP** (server sends an OTP to the taxpayer's registered contact); it needs **no** username credential, so no credential-entry UI is required. (Minor: the OTP timer hardcodes 300s instead of the server's `ExpiresAt` — worth aligning.)

**Still outstanding — needs assets, product decisions, or large effort (NOT code-fixable here):**
- **B5 (assets)** — `google-services.json`, the APNs key, and the FCM V1 service-account key must come from your Firebase console + be uploaded to EAS. Android push will not build/deliver without them.
- **B14** — a real automated test suite + jest type config (`@types/jest` and `axios-mock-adapter` were added; meaningful coverage is a large effort).
- **Full i18n adoption** — the engine is now reactive, but actually wrapping every screen's copy in `t()` (~30 screens) is large mechanical work.
- **Billing management screens** — invoices / cancel / pause / add-seats / coupon exist in the API but have no UI; building them needs UX/scope decisions.
- **Change Photo** (avatar upload) and **quiet-hours time editing** — need a picker + a backend contract.
- **Real document edge-detection / perspective / grayscale enhancement** — needs an on-device CV/ML model.

---

## 0. Before you start

### 0.1 Devices & environment
- Physical **Android** (API 33+) and **iOS** devices — required for camera, biometric, and push.
- A **production/preview EAS build** (not Expo Go) pointing at the intended API.
- Test accounts: **User A** and **User B** in the same org; each with verified email + mobile.
- A GST portal test connection (or a stub) for the GSTN flow; a Razorpay **test** account for billing.
- Backend reachable; access to backend logs/DB to confirm server-side effects.

### 0.2 Build/config preconditions (verify FIRST — most are Section 22 blockers)
- **API base URL** is the real backend, injected via `EXPO_PUBLIC_API_URL` at build time — NOT the default `https://localhost:59110`.
- **`google-services.json`** (Android) and APNs/FCM V1 key present in the EAS build; EAS `projectId` is a real UUID.
- Notification assets (`assets/notification-icon.png`, sound) present.
- Deep-link scheme `effortlessinsight` registered.

### 0.3 How to observe
- Watch the dev/preview build console and backend logs.
- Confirm server-side effects in the DB (notices, tasks, comments, subscriptions, gstn connections, push_tokens, notification_preferences).
- For push specifics, use the companion **Manual-Testing-Guide.md** (notification system).

---

## 1. Configuration & build (CFG)

**CFG-01** — App points at the correct API. Steps: launch, log in, watch network. Expected: requests go to the production API host, not `localhost`. **⚠️ EXPECTED TO FAIL (B12)** if `EXPO_PUBLIC_API_URL` isn't injected.
**CFG-02** — Push credentials present. Steps: on Android, receive a test push (see notification guide TOKEN-01/DELIV). Expected: token registers and delivery works. **⚠️ EXPECTED TO FAIL (B5)** if `google-services.json` is missing.
**CFG-03** — Deep link opens the app. Steps: open `effortlessinsight://reset-password?token=abc` from a note/browser. Expected: app opens to the reset screen.
**CFG-04** — Version/build metadata correct (about screen shows the shipped version).

---

## 2. App shell, navigation & route guards (NAV)

**NAV-01** — Cold start unauthenticated → login. Steps: fresh install, launch. Expected: splash, then login screen.
**NAV-02** — Cold start authenticated (valid tokens) → tabs. Steps: relaunch after login. Expected: lands on Home without re-login.
**NAV-03** — Authenticated but no org → onboarding. Steps: log in as a user with no organization. Expected: redirected to onboarding welcome.
**NAV-04** — Authenticated visiting an auth route → tabs. Steps: while logged in, deep-link to `(auth)/login`. Expected: bounced to tabs.
**NAV-05** — Tab bar. Steps: tap each of the 6 tabs (Home, Notices, Scan, Tasks, Alerts, Profile). Expected: correct screen each; Alerts shows the unread badge (`9+` cap).
**NAV-06** — Deep link while logged out (reset-password). Steps: log out, open a reset-password deep link. Expected: reaches the reset screen and works (guard doesn't bounce it to login mid-flow). **⚠️ verify carefully (B-race)** — the guard and the deep-link handler can race.
**NAV-07** — Deep link verify-email while logged out. Expected: reaches verify screen; if it needs auth to resend, the UX is graceful (no dead-end). **⚠️ EXPECTED TO FAIL (B-verify)** — resend hits an authed endpoint.
**NAV-08** — Back-button / gesture behavior. Steps: navigate deep, use back. Expected: sane stack; onboarding "complete" can't be swiped back into.
**NAV-09** — Render error handling. Steps: force a screen error (if possible). Expected: ErrorBoundary shows a recoverable screen, not a white crash.

---

## 3. Authentication (AUTH)

**AUTH-01** — Login success. Steps: valid email + password, submit. Expected: lands on tabs; tokens stored.
**AUTH-02** — Login validation. Steps: bad email, short password (<6). Expected: inline validation errors; no request sent.
**AUTH-03** — Login wrong credentials. Expected: clear inline error; no crash.
**AUTH-04** — Remember me. Steps: log in with remember me; relaunch. Expected: session restored.
**AUTH-05** — OAuth login (Google/etc.). Steps: use an OAuth button. Expected: completes login (or routes to 2FA).
**AUTH-06** — Registration success. Steps: valid name/email/password (≥8, upper+lower+number), accept terms. Expected: "check your email" screen; no auto-login.
**AUTH-07** — Registration validation. Steps: weak password, unmatched confirm, terms unchecked. Expected: blocked with clear errors.
**AUTH-08** — Terms/Privacy links. Steps: tap Terms/Privacy on register. Expected: opens the documents. **⚠️ EXPECTED TO FAIL (B11)** — currently non-tappable text.
**AUTH-09** — Forgot password. Steps: submit an email. Expected: success screen shown regardless of whether the email exists (no user enumeration); resend works.
**AUTH-10** — Reset password valid token. Steps: open reset link, meet all 5 rules (incl. special char), submit. Expected: success; can log in with the new password.
**AUTH-11** — Reset password expired/invalid token. Expected: dedicated expired/error screen, not a generic alert.
**AUTH-12** — Reset password missing token. Expected: error state.
**AUTH-13** — Email verification (valid). Steps: open verify link. Expected: verified success; "already verified" also treated as success.
**AUTH-14** — Email verification resend. Expected: resend works from the flow. **⚠️ verify** it doesn't silently fail due to auth requirement (B-verify).
**AUTH-15** — 2FA entry. Steps: for a 2FA user, enter the 6-digit code. Expected: auto-advance, auto-submit on last digit, backspace focuses previous; success → tabs.
**AUTH-16** — 2FA wrong code. Expected: error, code cleared, refocus.
**AUTH-17** — 2FA backup code. Steps: tap "Use a backup code". Expected: a working backup-code entry. **⚠️ EXPECTED TO FAIL (B11)** — link is non-functional.
**AUTH-18** — Biometric enable. Steps: Profile → enable biometric; authenticate. Expected: flag persists; prompt appears.
**AUTH-19** — Biometric login restores session. Steps: with biometric enabled, kill app so tokens are gone/expired, relaunch, authenticate with Face/Touch ID. Expected: **session is restored and you land on tabs.** **⚠️ EXPECTED TO FAIL (B4)** — current biometric-on-login doesn't load tokens, so it bounces back to login.
**AUTH-20** — Token auto-refresh. Steps: let the access token expire during use (or force a 401). Expected: a single silent refresh replays the request; no visible logout; concurrent requests don't each refresh.
**AUTH-21** — Refresh token expired. Steps: expire/invalidate the refresh token, trigger a request. Expected: user is cleanly logged out and returned to login (no stuck error screen). **⚠️ verify** the app actively routes to login (currently relies on the next guard pass).
**AUTH-22** — Logout. Steps: Profile → Logout → confirm. Expected: push token deactivated, tokens cleared, back to login; relaunch does not auto-login.
**AUTH-23** — Session presence vs expiry. Steps: with a present-but-expired token, cold start. Expected: not treated as authenticated indefinitely; a failed profile/refresh logs out. **⚠️ verify (B-expiry)** — `hasValidTokens()` only checks presence.
**AUTH-24** — Web token storage. (If a web build is shipped) verify tokens aren't left in plaintext localStorage in a way that violates your security bar.

---

## 4. Onboarding (ONB)

**ONB-01** — Welcome → org. Steps: from welcome, Get Started. Expected: organization form.
**ONB-02** — Org GSTIN live validation. Steps: type a valid 15-char GSTIN. Expected: debounced validation, checkmark, state auto-filled.
**ONB-03** — Org GSTIN invalid. Steps: type malformed GSTIN. Expected: inline invalid indicator; submit blocked.
**ONB-04** — Org required fields. Steps: submit without name/state. Expected: blocked.
**ONB-05** — Org duplicate. Steps: use an existing GSTIN/name. Expected: friendly `GSTIN_EXISTS`/`ORG_NAME_EXISTS` error.
**ONB-06** — Org create success → complete → tabs. Expected: success animation, trial-started copy, into the app.
**ONB-07** — No skip. Expected: org creation is mandatory (documented product decision) — cannot bypass to tabs.

---

## 5. Home / dashboard (HOME)

**HOME-01** — Widgets render. Steps: open Home. Expected: greeting, overdue banner (if any), stat grid (Active/Due Soon/Overdue), upcoming deadlines (top 3), tasks this week (top 3), usage summary, quick actions.
**HOME-02** — Stat navigation. Steps: tap Active/Due Soon/Overdue. Expected: Notices list opens pre-filtered correctly.
**HOME-03** — Deadline/task cards navigate. Steps: tap an upcoming deadline / a task. Expected: notice detail opens; a task with no linked notice degrades gracefully (no dead tap).
**HOME-04** — Usage bars. Expected: reflect the current subscription; "unlimited" shown for limit 0/≥10000; amounts/units correct (verify paise/lakh assumptions).
**HOME-05** — Pull-to-refresh. Expected: all widgets refresh; partial data renders without blocking on the slowest query.

---

## 6. Notices list (NOTI-L)

**NOTI-L-01** — List loads with pagination. Steps: scroll. Expected: infinite scroll loads more (pageSize 20); footer spinner.
**NOTI-L-02** — Search. Steps: type a query. Expected: results filter correctly. **⚠️ verify perf (B-search)** — no debounce; watch for excessive requests.
**NOTI-L-03** — Filters. Steps: toggle status pills; use `overdue`/`due-soon` entry points. Expected: correct filtering.
**NOTI-L-04** — Card content. Expected: type, status, notice number, currency, deadline text (overdue/today/left/none), risk badge, overdue strip.
**NOTI-L-05** — Empty state. Steps: a filter with no results. Expected: EmptyState with an Upload action.
**NOTI-L-06** — Pull-to-refresh. Expected: refetches page 1.
**NOTI-L-07** — Offline. Steps: go offline, open Notices. Expected: cached first page shows; a clear indication that it's limited/cached (not an infinite spinner or silent blank).

---

## 7. Notice detail — all tabs (NOTI-D)

**NOTI-D-01** — Loads all sections. Steps: open a notice. Expected: header (type/number/risk), View Original PDF, stats, workflow stepper, 7 tabs populate.
**NOTI-D-02** — Deleted/404 notice. Steps: open a notice id that was deleted. Expected: a clear "not found / no longer available" state with a way back. **⚠️ EXPECTED TO FAIL (B10)** — currently stuck on the loading spinner.
**NOTI-D-03** — View original PDF. Steps: tap. Expected: a fresh signed URL opens the PDF in the in-app browser.
**NOTI-D-04** — Overview tab. Expected: type, category, GSTIN, dates, authority, period, tags.
**NOTI-D-05** — Analysis tab. Expected: AI summary, "what this means", action items, required documents; Hindi rendering when locale=hi and Hindi fields exist; empty state when no report.
**NOTI-D-06** — Response tab (draft). Steps: edit + Save Draft. Expected: saved; version shown; editable only in draft/rejected/no-response states.
**NOTI-D-07** — Response submit/approve/mark-submitted. Steps: submit for review (with notes), approve, mark submitted. Expected: each gated by status; confirm dialogs; server state updates.
**NOTI-D-08** — Tasks tab quick-create. Steps: create a task (title/desc/priority). Expected: appears in list; server task created.
**NOTI-D-09** — Comments tab. Steps: post a comment with @mention and a visibility toggle. Expected: appears; mention highlighted; visibility respected.
**NOTI-D-10** — Comments offline. Steps: post a comment offline. Expected: queued with clear feedback; syncs when back online (see OFFLINE section).
**NOTI-D-11** — Documents tab. Steps: fulfill a doc request via document picker. Expected: correct file-type filtering; upload succeeds; request status updates. **⚠️ verify (B-picker)** — accepted-format mapping is unreliable for images.
**NOTI-D-12** — Activity tab. Expected: cursor-paginated feed grouped by date; Load More works.
**NOTI-D-13** — Advance workflow. Steps: open transition modal, confirm. Expected: workflow advances; stepper updates.
**NOTI-D-14** — Attachments modal. Steps: open, tap a file. Expected: fresh signed URL opens.

---

## 8. Upload / scan (UPL)

**UPL-01** — Camera permission. Steps: first open of Scan. Expected: permission prompt; denial → a permission-denied screen with a **working "Open Settings"** button. **⚠️ EXPECTED TO FAIL (B11)** — the button is a no-op.
**UPL-02** — Single capture → upload. Steps: capture a document, upload. Expected: progress bar; success screen; the notice appears in the list.
**UPL-03** — Gallery pick (PNG) → upload. Steps: pick a PNG. Expected: uploads with the **correct** content type/name (not forced jpeg). **⚠️ verify (B-mime)**.
**UPL-04** — File type/size limits. Steps: pick a >10MB file or a disallowed type. Expected: rejected with a clear message. **⚠️ EXPECTED TO FAIL (B-limits)** — limits are defined but not enforced.
**UPL-05** — Multi-page scan → PDF upload. Steps: capture ≥2 pages, reorder/delete, upload. Expected: a **valid multi-page PDF** is produced and successfully processed server-side. **⚠️ EXPECTED TO FAIL (B1)** — currently uploads a JSON manifest of local URIs mislabeled as PDF; server can't process it.
**UPL-06** — Edge detection / enhancement. Steps: use auto-capture and an enhancement mode. Expected: real document edge detection and a real enhancement (grayscale/contrast/perspective). **⚠️ EXPECTED TO FAIL (B2)** — detection is random; enhancement only resizes.
**UPL-07** — Paywall on limit. Steps: exceed the notice-creation limit. Expected: PaywallModal → plans; upload blocked until upgrade.
**UPL-08** — Upload offline. Steps: attempt an upload offline. Expected: a clear "you're offline" message (not a silent failure).

---

## 9. Tasks (TASK)

**TASK-01** — My tasks list. Steps: open Tasks. Expected: infinite list; filter tabs (All/To Do/In Progress/Done); total + overdue counts.
**TASK-02** — Quick status toggle. Steps: tap a task checkbox. Expected: toggles todo↔done; server updates; UI reflects it.
**TASK-03** — Overdue indication. Expected: overdue tasks flagged; due dates correct.
**TASK-04** — Tap → notice. Steps: tap a task. Expected: opens the linked notice.
**TASK-05** — Offline toggle. Steps: toggle a task offline. Expected: **visible feedback** that it's queued, and the checkbox reflects the intended state; syncs later. **⚠️ EXPECTED TO FAIL (B3)** — currently only logs an error, no UI change.
**TASK-06** — Empty state. Expected: EmptyState for no tasks.

---

## 10. Billing (BILL)

**BILL-01** — No subscription state. Steps: user without a subscription opens Billing. Expected: "No Active Subscription" → View Plans.
**BILL-02** — Server error vs no-subscription. Steps: simulate a backend error on `/subscriptions/current`. Expected: a distinct **error** state with Retry — NOT a false "no subscription". **⚠️ EXPECTED TO FAIL (B8)** — non-401 errors are masked as empty.
**BILL-03** — Plans list & toggle. Steps: open Plans, toggle monthly/annually. Expected: prices update; annual discount shown; current plan marked.
**BILL-04** — Checkout summary. Steps: select a plan. Expected: correct price (paise→₹), monthly-equivalent for annual, savings %, trial banner, due-today vs due-after-trial.
**BILL-05** — Razorpay payment success. Steps: complete a test payment. Expected: Razorpay opens with correct order; on success the payment is **verified** server-side and the subscription activates; routed back to Billing showing the new plan.
**BILL-06** — Razorpay cancel. Steps: cancel the Razorpay sheet. Expected: silent return (no error alert).
**BILL-07** — Razorpay failure. Steps: force a failed payment. Expected: "Payment Failed" alert; no partial subscription.
**BILL-08** — Paywall fail-closed. Steps: simulate a usage-check outage, then attempt a limited action. Expected: the action is **blocked** (fails safe), not allowed through. **⚠️ EXPECTED TO FAIL (B8)** — currently fails open (defaults allowed).
**BILL-09** — Trial. Steps: new org. Expected: trial state reflected; button labels ("Start Free Trial").
**BILL-10** — Subscription management. Steps: attempt to view invoices / payment methods / cancel / pause / add seats / apply a coupon. Expected: these are reachable and functional. **⚠️ EXPECTED TO FAIL (B8)** — API/hooks exist but no screens; "Manage" only routes to plans. (If these are intentionally out of MVP scope, document that decision explicitly.)

---

## 11. GSTN integration (GSTN)

**GSTN-01** — Connections list. Steps: Profile → GST Portal / Integrations. Expected: org GSTIN connections listed with status; loading/empty/error (with Retry) states.
**GSTN-02** — Connect + OTP. Steps: connect a GSTIN. Expected: any required credentials can be entered, an OTP is requested, and the 6-digit OTP flow (5-min timer, resend cooldown) verifies successfully. **⚠️ EXPECTED TO FAIL (B7)** — there is **no credential-entry UI**; connect sends only the GSTIN id, so if the backend has no stored portal username the flow can't complete.
**GSTN-03** — OTP validation. Steps: wrong/expired OTP. Expected: clear error, remaining attempts; resend after cooldown; timer matches the real server expiry (not just a hardcoded 300s).
**GSTN-04** — Manual sync. Steps: trigger a sync. Expected: sync runs; result reflected; imported notices appear in Notices.
**GSTN-05** — Sync history. Steps: open history. Expected: logs with status/found/imported/skipped/failed/duration. A backend error shows an **error** state, not a false "No Sync History". **⚠️ EXPECTED TO FAIL (B9)** — history errors are masked as empty.
**GSTN-06** — Settings. Steps: toggle auto-sync, change interval, disconnect. Expected: persisted; disconnect works.

---

## 12. Profile & settings (PROF)

**PROF-01** — Profile renders. Expected: avatar initial, name, email, role; all sections present.
**PROF-02** — Edit profile. Steps: change name / mobile (valid Indian mobile), save. Expected: `PATCH /auth/me` succeeds; profile refreshes; Save enabled only when changed; email read-only.
**PROF-03** — Change photo. Steps: tap Change Photo. Expected: a working photo picker updates the avatar. **⚠️ EXPECTED TO FAIL (B6)** — "Coming Soon" stub.
**PROF-04** — Change password. Steps: current + new (5 rules incl. special char) + confirm. Expected: succeeds; wrong current password → inline field error; new must differ from current.
**PROF-05** — Password rule consistency. Steps: register a password valid at registration, then try to change to it. Expected: rules are **consistent** across register/reset/change. **⚠️ EXPECTED TO FAIL (B13)** — register requires 4 rules, change/reset require 5.
**PROF-06** — Push toggle (profile). Steps: toggle Push Notifications in Profile. Expected: it reflects and controls the real push preference. **⚠️ EXPECTED TO FAIL (B6)** — decorative local state only (use Settings → Notifications instead).
**PROF-07** — Dark mode. Steps: enable Dark Mode. Expected: the UI actually renders in dark theme. **⚠️ EXPECTED TO FAIL (B6)** — toggle persists but no dark styling exists.
**PROF-08** — Biometric toggle. Steps: enable/disable (only shown if hardware available). Expected: persists; used at login (see AUTH-19).
**PROF-09** — Clear cache & queue. Steps: tap Clear Cache. Expected: caches + offline queue cleared; count resets.
**PROF-10** — Help/About/Organization links. Expected: open as intended (Organization is web-only — documented).

---

## 13. Localization / i18n (I18N)

**I18N-01** — Switch to Hindi. Steps: Settings → Language → Hindi. Expected: the app UI switches to Hindi **across screens** and persists across restart. **⚠️ EXPECTED TO FAIL (B9-i18n)** — only 3 screens use i18n; most stay English, and `t` is non-reactive so mounted screens don't re-render.
**I18N-02** — Language screen copy. Steps: view the language screen in each language. Expected: subtitle/info strings are correct per language. **⚠️ EXPECTED TO FAIL (B-lang-swap)** — strings are swapped.
**I18N-03** — Notice analysis Hindi. Steps: a notice with Hindi AI fields, locale hi. Expected: analysis shows Hindi content.

---

## 14. Offline & sync (OFF)

**OFF-01** — Offline banner. Steps: disable network. Expected: "You are offline" banner appears.
**OFF-02** — Queue an action offline. Steps: offline, create a comment / toggle a task. Expected: the action is queued with clear user feedback; banner shows "N pending changes to sync".
**OFF-03** — Auto-sync on reconnect. Steps: re-enable network. Expected: **queued actions sync automatically**. **⚠️ EXPECTED TO FAIL (B3)** — sync only runs from the manual "Sync" button; there is no reconnect listener.
**OFF-04** — Manual sync. Steps: tap the banner "Sync". Expected: queue flushes to the server; successful items removed; banner updates.
**OFF-05** — Sync failure handling. Steps: cause an item to fail repeatedly. Expected: bounded retries with backoff, then a surfaced failure — not infinite silent retries. **⚠️ EXPECTED TO FAIL (B3)** — MAX_RETRIES doesn't stop retries; no backoff.
**OFF-06** — Queue full. Steps: exceed 100 queued actions. Expected: graceful handling (oldest dropped or user warned) — not a lost action with a confusing error. **⚠️ EXPECTED TO FAIL (B3)**.
**OFF-07** — Captive portal. Steps: connect to a network with no real internet. Expected: treated as offline (uses `isInternetReachable`). **⚠️ verify (B-netinfo)** — currently only `isConnected`.
**OFF-08** — Toasts visible. Steps: trigger a toast (success/error). Expected: it actually renders. **⚠️ verify (B-toast)** — confirm a ToastContainer is mounted.

---

## 15. Notifications (NOTIF)

Use **Manual-Testing-Guide.md** for full push coverage. Mobile-app-specific:
**NOTIF-01** — Alerts tab list. Steps: open Alerts. Expected: infinite list, all/unread filter, swipe read/delete, mark-all, unread badge.
**NOTIF-02** — Tap routes correctly. Steps: tap a notice/task notification in the list. Expected: opens the right screen; a spoofed/off-list `actionUrl` is refused. **⚠️ verify (B-list-tap)** — the in-app list tap trusts server ids/urls directly, bypassing the push-handler allowlist.
**NOTIF-03** — List error state. Steps: cause the list fetch to fail. Expected: an **error** state with retry — not a silent "empty". **⚠️ EXPECTED TO FAIL (B10)**.
**NOTIF-04** — Delete optimistic. Steps: delete a notification. Expected: removes immediately with rollback on failure.
**NOTIF-05** — Settings persistence. Steps: toggle channel/type/quiet-hours/digest prefs. Expected: persisted via `PUT /users/me/notification-preferences`; the Push channel toggle also affects real delivery/permission (not decorative). **⚠️ EXPECTED TO FAIL (B5)** — the Push toggle doesn't gate delivery/permission.
**NOTIF-06** — Quiet-hours time editing. Steps: edit quiet-hours times. Expected: editable and saved. **⚠️ EXPECTED TO FAIL (B6)** — "Coming Soon" stub.

---

## 16. Security (SEC)

**SEC-01** — Cross-user isolation. Steps: as B, verify you never see A's notices/tasks/notifications.
**SEC-02** — Token handling. Steps: inspect storage. Expected: tokens in SecureStore on native; acceptable handling on web per your security bar.
**SEC-03** — Deep-link/route-param safety. Steps: craft malicious deep links / notification payloads. Expected: no open redirect, no crash, no unauthorized navigation.
**SEC-04** — Logout clears everything. Steps: log out, inspect. Expected: tokens, user, push token, and sensitive caches cleared.
**SEC-05** — No secrets in logs. Steps: review console/network. Expected: no full tokens/PII logged.

---

## 17. Platform capabilities & permissions (PLAT)

**PLAT-01** — Camera permission lifecycle (grant/deny/re-grant via settings).
**PLAT-02** — Document/gallery pickers open and return files.
**PLAT-03** — Biometric hardware detection (shown only when available; graceful when not enrolled).
**PLAT-04** — Push permission (Android 13+ runtime, iOS) — see notification guide.
**PLAT-05** — Deep linking cold-start vs warm.
**PLAT-06** — Secure store persistence across restarts.

---

## 18. Performance (PERF)

**PERF-01** — Cold start time acceptable; splash doesn't hang.
**PERF-02** — Lists scroll smoothly at scale (100+ notices/tasks/notifications).
**PERF-03** — Search doesn't flood the backend (**B-search** — add debounce).
**PERF-04** — Memory stable over a long session (no listener leaks).
**PERF-05** — Images/uploads don't OOM on large captures.

---

## 19. Reliability (REL)

**REL-01** — Backgrounding/foregrounding preserves state.
**REL-02** — Network flaps handled (offline↔online) without crashes or stuck spinners.
**REL-03** — Rapid navigation doesn't crash or leak.
**REL-04** — Server 5xx handled with retry/error UI (no white screens).
**REL-05** — App survives a killed backend (graceful errors, recovery on return).

---

## 20. Accessibility & UX (UX)

**UX-01** — Tap targets adequate; forms usable with the keyboard.
**UX-02** — Loading/empty/error states exist for **every** data screen (see the ⚠️ gaps).
**UX-03** — Dynamic type / larger fonts don't break layouts.
**UX-04** — Color contrast acceptable (esp. status/risk badges).

---

## 21. Regression / negative (NEG)

**NEG-01** — Expired session mid-action recovers or logs out cleanly.
**NEG-02** — Duplicate rapid submits (double-tap Save/Submit) don't double-create.
**NEG-03** — Very long inputs (names, comments) handled (limits enforced).
**NEG-04** — Deleted entities (notice/task) opened from stale lists show a not-found state, not a crash/spinner.
**NEG-05** — Payment retried after a cancel completes correctly.

---

## 22. KNOWN BLOCKERS — must be fixed before this plan can pass (go/no-go hot list)

Each maps to ⚠️ cases above. **These are the release gate.**

| ID | Blocker | Impact | Where |
|---|---|---|---|
| **B1** | Multi-page scan uploads a **JSON manifest of local file URIs mislabeled as PDF**; real PDF builder is dead code | Multi-page upload is non-functional; server can't process it | `utils/pdfGenerator.ts:138-202`, `upload.tsx` |
| **B2** | Edge detection is `Math.random()`; enhancement modes only resize (no grayscale/contrast/perspective) | "Smart scan" features are fake | `upload.tsx:122-133,293-297` |
| **B3** | **No auto-sync on reconnect**; no backoff; failed items retry forever; queue-full loses actions; offline task toggle gives no feedback | Offline edits silently stranded; poor offline UX | `storage/offlineQueue.ts`, `stores/uiStore.ts`, `tasks.tsx:66-75` |
| **B4** | Biometric login on the login screen **cannot restore a session** (no token load) | Biometric "login" is misleading/broken | `login.tsx:75-81`, `authStore.ts` |
| **B5** | `google-services.json`/APNs config absent; push is Expo-token only; Settings Push toggle doesn't gate delivery/permission | Android push build/delivery fails; misleading toggle | `app.json`, `settings/notifications.tsx` |
| **B6** | Decorative/stub controls: Profile Push toggle, Dark Mode (no dark theme), Change Photo, quiet-hours time edit | Users toggle things that do nothing | `profile.tsx:58,246-251`, `edit-profile.tsx:113`, `settings/notifications.tsx` |
| **B7** | GSTN connect has **no credential-entry UI**; sends only the GSTIN id | GST portal connection can't complete without stored creds | `gstn-settings.tsx`, `integrations.tsx`, `api/gstn.ts` |
| **B8** | Billing: usage-check **fails open** (paywall bypass on outage); subscription errors masked as "no subscription"; invoices/cancel/pause/coupon/payment-methods have **no UI** | Revenue-leak risk; hidden failures; incomplete billing | `api/billing.ts:72-96`, `hooks/useBilling.ts` |
| **B9** | i18n wired in only 3 screens; `t` non-reactive; GSTN/history errors masked as empty; language subtitle strings swapped | Hindi mostly doesn't work; masked errors | `i18n/*`, `language.tsx:50-53,92-94`, `gstn-history.tsx` |
| **B10** | Notice detail has **no 404/deleted state** (stuck spinner); Notifications tab has **no error state** | Dead-end spinners on missing data | `notices/[id].tsx:179-181`, `(tabs)/notifications.tsx` |
| **B11** | Dead UI affordances: 2FA "backup code", upload "Open Settings", Terms/Privacy links | Broken buttons in critical flows | multiple |
| **B12** | Default API base URL is `https://localhost:59110`; `app.json extra.apiUrl` is unused | **Prod app hits localhost if env not injected** | `utils/constants.ts:8`, `app.json` |
| **B13** | Password rules inconsistent: register (4) vs reset/change (5, +special char) | A valid registered password can be un-changeable | `register.tsx`, `change-password.tsx`, `reset-password.tsx` |
| **B14** | No meaningful automated test coverage; `GAP_ANALYSIS.md` is stale | Low regression safety net | `__tests__/`, `GAP_ANALYSIS.md` |

Additional **verify** items (may be acceptable, confirm intent): search has no debounce; upload MIME always jpeg; document-picker format filter unreliable; NetInfo ignores `isInternetReachable`; confirm a Toast renderer is mounted; refresh-failure doesn't proactively route to login; `hasValidTokens()` checks presence not expiry; in-app notification list tap bypasses the push-handler allowlist.

---

## 23. GO / NO-GO SIGN-OFF

**NO-GO** if any Section 22 blocker is unresolved or any ⚠️ case still fails.

| Gate | Pass? |
|---|---|
| G1 Config: real API URL, Firebase files, EAS UUID (CFG-01..02, B12, B5) | ☐ |
| G2 Auth: login/register/reset/2FA/refresh/logout + biometric restores session (AUTH-01..23, B4) | ☐ |
| G3 Onboarding end-to-end (ONB) | ☐ |
| G4 Notices list + detail incl. 404 state (NOTI-L, NOTI-D, B10) | ☐ |
| G5 Upload: single works; multi-page produces a real PDF; limits enforced (UPL, B1/B2) | ☐ |
| G6 Tasks incl. offline feedback (TASK, B3) | ☐ |
| G7 Billing: payment verified; paywall fails closed; errors distinct (BILL, B8) | ☐ |
| G8 GSTN connect completes incl. credentials; errors surfaced (GSTN, B7/B9) | ☐ |
| G9 Profile/settings: password consistency, no decorative controls shipped as functional (PROF, B6/B13) | ☐ |
| G10 Offline: auto-sync on reconnect, bounded retries (OFF, B3) | ☐ |
| G11 Notifications end-to-end (see Manual-Testing-Guide.md) + list error state (NOTIF, B10) | ☐ |
| G12 Security isolation & no secret leakage (SEC) | ☐ |
| G13 Reliability/performance under load & network flaps (PERF/REL) | ☐ |
| G14 i18n works if Hindi is a launch requirement (I18N, B9) — or Hindi explicitly deferred | ☐ |

> If some blockers are deliberately deferred (e.g., billing management screens, full i18n),
> record that as an explicit product decision with scope notes — don't silently ship a
> ⚠️ case as "passing". This plan assumes a full-feature production release.
