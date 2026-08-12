# Mobile App — Production Gap Analysis (2026-07-31)

Deep review of `effortless-insight-mobile` against the requirement blueprint
`docs/12-Mobile-Application/12-Mobile-Application.md`, including verification of the
2026-07-21 remediation pass. Supersedes the coverage sections of `GAP_ANALYSIS.md`;
the manual test plan in `PRODUCTION-READINESS-TEST-PLAN.md` still applies for
on-device verification.

**Verdict: NOT production-ready yet — but close.** The application code itself is in
good shape (all screens exist, type-check passes, the earlier remediation held up
under re-review). What blocks release is almost entirely **build configuration and
assets** (Firebase files, EAS project ID, app icons/splash, babel config), plus a
handful of real code defects listed below.

---

## 1. Verification runs (this review)

| Check | Result |
|---|---|
| `tsc --noEmit` (type-check) | ✅ PASS, 0 errors |
| `jest` test suite | ✅ PASS (exit 0) — **but see §5: the tests are placebo; they don't exercise real app code** |
| `eslint` | ⏭ not run in this review |
| 2026-07-21 remediation claims | 14 of 16 verified TRUE in current code; 2 partial (see §6) |

---

## 2. Requirements coverage matrix

Status vs the blueprint. ✅ = implemented, 🟡 = partial, ❌ = missing.

### Auth
| Requirement | Status | Notes |
|---|---|---|
| Login / Register / Forgot password | ✅ | `app/(auth)/*` — zod validation, OAuth buttons, resend, deep-linked reset |
| Two-factor (beyond spec) | ✅ | incl. backup-code entry mode (verify backend accepts backup code in the `code` field — no separate flag is sent) |
| Biometric login | 🟡 | Logic works and gates session restore, BUT: not release-configured (missing `NSFaceIDUsageDescription` + `expo-local-authentication` plugin) and a bypass edge case (§4-C3) |
| Secure token storage | ✅ | `expo-secure-store` on native |

### Dashboard
| Requirement | Status | Notes |
|---|---|---|
| Greeting | ✅ | time-based, first name |
| "Needs attention" banner (due ≤ 3 days) | 🟡 | triggers on *overdue* count, not "due within 3 days"; urgent list uses ≤ 7 days |
| Quick stats: Active / Due Soon / **Tasks Today** | 🟡 | shows Active / Due Soon / Overdue — no "tasks today" stat |
| Urgent deadlines list + View All | ✅ | |
| Recent activity feed | ❌ | exists only inside Notice Detail, not on dashboard |

### Notices
| Requirement | Status | Notes |
|---|---|---|
| List + filters + search (debounced) | ✅ | 400 ms debounce |
| Infinite scroll | ✅ | |
| List performance (FlashList, memoized) | 🟡 | plain `FlatList`; `NoticeCard` not memoized; header re-created every keystroke |
| Detail: risk badge, demand, deadline, workflow progress, tabs, AI summary, comments, documents, advance-stage | ✅ | exceeds spec (7 tabs); has 404/deleted state |
| Detail: tasks checklist | 🟡 | displays tasks but no toggle inside detail (toggle only on Tasks tab) |

### Scan / Upload
| Requirement | Status | Notes |
|---|---|---|
| Camera + document frame + capture/gallery/flash | ✅ | manual capture (fake auto-detect removed from shipping screen) |
| Multi-page scan, reorder/remove, real PDF | ✅ | `pdf-lib`, verified real PDF output |
| Upload with progress | ✅ | |
| Edge detection (true CV) | ❌ | acknowledged: needs an ML model; manual capture is the accepted fallback |
| Single-page in multi-page mode | ❌ **defect** | always fails (§4-C1) |

### Tasks
| Requirement | Status | Notes |
|---|---|---|
| List, update/toggle | ✅ | toast on failure/offline only |
| Create task | 🟡 | only from Notice Detail; no create on Tasks tab |
| Tab badge count | ❌ | badge exists on Notifications tab only |

### Offline support
| Requirement | Status | Notes |
|---|---|---|
| Notice list cache (24 h) + offline viewing | ✅ | |
| Offline queue: comment / task_update | ✅ | retry ×3, backoff, failed-queue, eviction, auto-sync on reconnect |
| Offline queue: document_upload | ❌ | processor throws "must be retried manually"; nothing enqueues uploads |
| Notice **detail** offline fallback | ❌ | only the list is cached; tapping a notice offline fails |
| Sync-on-startup | 🟡 | syncs only on connectivity *transition*; queued actions from a previous session wait until a toggle |

### Push notifications
| Requirement | Status | Notes |
|---|---|---|
| Permission, token registration (platform+deviceId), refresh listener | ✅ | code complete |
| Foreground handler, cold-start tap routing | ✅ | |
| Android channels (critical/regular/tasks/collaboration) | ✅ | created in code |
| **Actually delivering remote push** | ❌ | blocked by missing Firebase config + invalid EAS projectId (§3) |
| Background data-only handler | ❌ | no `registerTaskAsync`/TaskManager |

### Settings / Profile
| Requirement | Status | Notes |
|---|---|---|
| Profile view/edit, language, biometric toggle, notification prefs, privacy policy | ✅ | push toggle correctly requests OS permission + registers token before persisting |
| Profile photo upload | 🟡 | explicit "Coming Soon" stub |

### i18n / Billing (beyond spec)
| Area | Status | Notes |
|---|---|---|
| i18n engine reactive (en/hi) | ✅ | engine reactive; full copy adoption across ~30 screens still outstanding |
| Razorpay checkout, server-side signature verify | ✅ | paywall fails closed on errors |

---

## 3. Release blockers (must fix — mostly config/assets, not code)

| # | Blocker | Detail |
|---|---|---|
| B1 | **Firebase config files missing** | `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) are referenced in `app.json` but absent → **prebuild/build fails**; no FCM/APNs push. Must be generated in the Firebase console; APNs key + FCM service account also uploaded to EAS credentials. |
| B2 | **EAS `projectId` invalid** | `app.json extra.eas.projectId = "effortless-insight-mobile"` (slug, not UUID). `getExpoPushTokenAsync` throws → push registration can never succeed. Run `eas init` to get the real UUID. |
| B3 | **All binary assets missing** | `assets/` has only 2 SVGs. Referenced but absent: `icon.png`, `splash.png`, `adaptive-icon.png`, `notification-icon.png`, `favicon.png`, `sounds/notification.wav` → build fails. |
| B4 | **`babel.config.js` missing** | Expo needs `babel-preset-expo`; reanimated 4 needs its worklets plugin last. Without it, Metro bundling breaks in a real build. |
| B5 | **Face ID not release-configured** | `NSFaceIDUsageDescription` absent and `expo-local-authentication` not in `app.json` plugins → runtime crash on first Face ID prompt + App Store rejection risk. |
| B6 | **iOS submit credentials empty** | `eas.json` `appleId`/`ascAppId`/`appleTeamId` blank; `google-play-service-account.json` referenced but absent → `eas submit` fails both stores. |
| B7 | **Test suite is placebo** | Passing tests don't import real app code (§5) — green CI gives false confidence. |

## 4. Code defects to fix (ordered by severity)

**Critical (breaks a primary flow):**
- **C1 — Single-page upload in multi-page mode always fails.** `app/(tabs)/upload.tsx:297-350`: with multi-page ON and exactly 1 page, the code falls into the single-image branch and dereferences `capturedImage!` which is null in that mode → guaranteed error. Fix the branch condition (`pages.length >= 1` when in multi-page mode).
- **C2 — Remote push dead end-to-end** until B1+B2 fixed (code itself is ready).
- **C3 — Biometric bypass edge case.** `authStore.ts:115`: if biometric was enabled but the sensor becomes unavailable/unenrolled, `initialize()` silently restores the session with **no** password fallback. Should require password when the biometric gate can't run.

**Major:**
- **M1 — Orphaned fake scanner still exported.** `src/components/scanner/DocumentScanner.tsx` retains the `Math.random()` fake edge-detection + auto-capture the remediation claimed removed (dead code today, but exported — one import from shipping). Delete or gut it.
- **M2 — No file-size/type enforcement on upload.** `FILE_CONFIG.MAX_SIZE_MB` never used; up to 100 pages allowed; 30 s axios timeout on multipart → big uploads fail generically. Enforce size client-side + raise upload timeout.
- **M3 — No upload cancellation.** No AbortController; navigating away mid-upload leaks the request and sets state on an unmounted screen.
- **M4 — Offline gaps** (see matrix): document_upload queue path throws; notice detail not cached; no sync-on-startup.
- **M5 — 401 hard-failure doesn't notify the auth store.** `client.ts:92-112` clears tokens but UI keeps stale authenticated state until next navigation.
- **M6 — Upload UI advertises detection that never happens.** "✓ Document detected" state, active-capture styling, and "auto-capture" tip are dead UI (`edgeDetected` never set true). Remove.

**Minor (polish):**
- Dashboard pull-to-refresh lacks try/finally (spinner can stick; unhandled rejection) — same in Notice Detail.
- Dashboard loading gate uses `&&` (partial zeros render); no error state.
- Tasks list: one shared `isPending` disables all checkboxes; no optimistic toggle.
- Offline detection via string match `includes('offline')` — brittle.
- Dead code: `createPdfContent`/`processImageForPdf` (invalid PDF builder), unused `Moon` import, dead `registerPushToken` duplicate API, hardcoded `appVersion: '1.0.0'`, unused `nativewind` dependency + missing `tailwind.config.js`.
- "due-soon" filter includes overdue; URL filters not clearable in UI.
- Backup-code 2FA submits in the `code` field with no flag — confirm backend contract.
- Refresh-response parsing loose (`data.data || data`); refresh waiter queue has no timeout.

## 5. Tests — passing but meaningless

`npx jest` exits green, but:
- `__tests__/services/api.test.ts` builds its own `MockAdapter(axios)` against **raw axios** — the real `client.ts` interceptors (auth header, 401 refresh, error normalization) are never imported or tested.
- `__tests__/components/Button.test.tsx` tests a **local reimplementation** of Button, not `components/common/Button.tsx`.
- Zero coverage of: offline queue, i18n store, paywall fail-closed, push service, NetInfo sync.

Minimum credible suite before release: import and test `client.ts` refresh flow, `offlineQueue.ts` retry/eviction/sync, `useBilling` fail-closed, and `pdfGenerator` validation.

## 6. 2026-07-21 remediation claims — re-verification summary

Held up (verified TRUE in current code): real pdf-lib PDF; manual capture in shipping screen; offline queue backoff/eviction/reconnect-sync; NetInfo `isInternetReachable`; biometric session gating; push toggle registers token; paywall fails closed; reactive i18n; API URL from config (no localhost); notice-detail 404 state; debounced search; Terms/Privacy links; JPEG normalization; ToastContainer.

Partially held: task-toggle toast (failure path only, not success); "validated navigation" (only the notifications list uses it). Regression risk: the fake edge-detection code still exists in the orphaned scanner component (M1).

## 7. Recommended path to production (ordered)

1. **Provision & config (1–2 days, mostly console work):** Firebase project → `google-services.json` + `GoogleService-Info.plist`; `eas init` (real projectId); APNs key + FCM service account into EAS credentials; generate icon/splash/notification assets; add `babel.config.js`; add `expo-local-authentication` plugin + Face ID string; fill `eas.json` submit credentials. This clears B1–B6.
2. **Fix critical code defects:** C1 (single-page multi-page upload), C3 (biometric fallback), M1 (delete fake scanner), M6 (dead detection UI).
3. **Upload robustness:** M2 (size limit + timeout), M3 (cancellation).
4. **Offline completeness:** notice-detail cache, document-upload queue (or remove the queue type and message honestly), sync-on-startup.
5. **Real tests** for the four core modules (§5) so the green suite means something.
6. **EAS build → run the manual go/no-go plan** (`PRODUCTION-READINESS-TEST-PLAN.md`) on physical Android + iOS devices — push delivery, biometric, camera, Razorpay live-mode, deep links.
7. Backlog (non-blocking): dashboard activity feed + tasks-today stat, FlashList migration, task create on Tasks tab, tab badge, full i18n copy adoption, profile photo upload.
