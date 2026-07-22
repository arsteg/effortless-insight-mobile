# Mobile App — Gap Analysis

Scope: Effortless Insight mobile app (`effortless-insight-mobile`, Expo Router + React Query + Zustand). Backend is ASP.NET Core (`effortless-insight-api`, base `/api/v1`). Status reflects the repo as scanned on 2026-06-26.

---

Feature: Profile Editing
Status: Partial
Remaining Work:
- Backend `PATCH /auth/me` does not exist — `authApi.updateProfile` will fail at runtime (BLOCKER).
- Profile image upload is a "Coming Soon" alert; no upload endpoint exists.
Files:
- app/settings/edit-profile.tsx, src/services/api/auth.ts (updateProfile), effortless-insight-api/.../AuthController.cs

Feature: Change Password
Status: Complete
Remaining Work:
- None — native screen with validation wired to `PUT /auth/change-password`.
Files:
- app/settings/change-password.tsx, src/services/api/auth.ts

Feature: Reset Password & Email Verification Deep Links
Status: Complete
Remaining Work:
- Optional: add iOS associatedDomains / Android intentFilters for https universal links (only custom scheme today).
Files:
- app/(auth)/reset-password.tsx, app/(auth)/verify-email.tsx, app/_layout.tsx, app.json

Feature: Response Drafting (RES-001)
Status: Complete
Remaining Work:
- None — draft/submit/approve/mark-submitted API + ResponseTab UI exist and are wired.
Files:
- src/services/api/notices.ts, src/hooks/useNotices.ts, app/notices/[id].tsx (ResponseTab)

Feature: View Original Notice PDF (NOT-US-013)
Status: Partial
Remaining Work:
- View + download work via presigned URL in browser; Share action is missing.
- No in-app PDF renderer (opens in Custom Tab / browser).
Files:
- app/notices/[id].tsx (handleViewOriginalPdf), src/services/api/notices.ts (getDownloadUrl)

Feature: Hindi Localization / i18n (RPT-003)
Status: Partial
Remaining Work:
- `useTranslation` keeps per-hook state; switching language does NOT re-render mounted screens (no shared store, no init in _layout).
- Most screens use hardcoded English (login, notices tab, most notice-detail tabs) instead of `t()`.
Files:
- src/i18n/index.ts, src/hooks/useTranslation.ts, app/_layout.tsx, app/settings/language.tsx, src/i18n/locales/{en,hi}.ts

Feature: Advanced Mobile Scanning (NOT-MOBILE-004)
Status: Partial
Remaining Work:
- Single-page only: no multi-page capture, reorder, or delete.
- Enhance modes (auto/document/grayscale) are placeholders (resize only); no crop/rotate/edge detection.
Files:
- app/(tabs)/upload.tsx, src/hooks/useNotices.ts (useUploadNotice), src/services/api/notices.ts (uploadNotice)

Feature: Activity Timeline (COL-008)
Status: Complete
Remaining Work:
- None — cursor-paginated `useNoticeActivity` + ActivityTab UI (icons, date grouping, Load More) exist.
Files:
- src/hooks/useTasks.ts (useNoticeActivity), app/notices/[id].tsx (ActivityTab), src/services/api/tasks.ts

Feature: Mentions & Comment Visibility (CM-003 / CM-006)
Status: Partial
Remaining Work:
- Visibility (internal/all) selector + badges complete; server enforces internal-comment filtering.
- Mentions are display-only: no @-autocomplete picker; client never builds mention tokens (no org-members fetch).
- Backend matches mentions on `UserName`, which is NOT exposed in the members DTO (contract gap).
Files:
- app/notices/[id].tsx (CommentsTab), src/services/api/organizations.ts, src/types/notice.ts

---

## Blockers (require backend / contract work)

- **Profile update**: `PATCH /auth/me` is not implemented on `AuthController` — name/phone/avatar/preferences cannot be saved from mobile.
- **Profile image upload**: no avatar upload endpoint exists.
- **Mention @username**: no user-search endpoint; org-members list lacks the `UserName` handle the backend uses to resolve mentions, so exact @username matching can't be guaranteed from mobile.
- **PDF/attachments**: delivered as time-limited presigned URLs (two-step fetch), not authenticated binary streams.

## Notes

- Component patterns: `src/components/common` (Button, Input, PasswordInput, EmptyState, LoadingSpinner). Styling is `StyleSheet.create` + `COLORS/SPACING` constants (nativewind present but unused). API hooks are React Query in `src/hooks`.
