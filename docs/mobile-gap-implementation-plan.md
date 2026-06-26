# Mobile Gap Implementation Plan

## Executive Summary

This document outlines the implementation plan for 8 P0 mobile features currently missing from the Effortless Insight Mobile App. Based on thorough codebase exploration, most backend APIs already exist - the primary work is mobile UI implementation.

---

## Current Implementation Discovery

### Architecture Overview
- **Framework:** Expo/React Native with Expo Router (file-based routing)
- **State Management:** Zustand stores (auth, UI, offline)
- **Data Fetching:** TanStack React Query with caching
- **API Client:** Axios with token refresh interceptors
- **Storage:** expo-secure-store (tokens), AsyncStorage (cache)
- **UI:** Custom components with design system constants

### Existing Infrastructure
| Component | Status | Location |
|-----------|--------|----------|
| Navigation | Complete | `app/_layout.tsx`, file-based routing |
| Auth Flow | Complete | `app/(auth)/`, `src/stores/authStore.ts` |
| API Layer | Complete | `src/services/api/` |
| Notice CRUD | Complete | `app/notices/[id].tsx` |
| Comments | Partial | Basic text comments only |
| Tasks | Complete | Full CRUD implemented |
| Camera/Upload | Basic | Single image capture only |
| Settings | Minimal | Most redirect to web |
| i18n | Missing | No localization setup |
| Deep Linking | Basic | Notifications only |

---

## Feature Implementation Details

### 1. Profile Editing & Change Password

#### Current State
- Profile screen redirects to web app via `Linking.openURL()`
- No native profile editing
- No change password screen

#### Backend APIs Available
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/v1/auth/me` | Exists | Get profile |
| `PUT /api/v1/auth/change-password` | Exists | Change password |
| `PATCH /api/v1/auth/me` | Exists | Update profile |

#### Files to Modify
- `app/(tabs)/profile.tsx` - Add edit mode
- `src/services/api/auth.ts` - Add changePassword method

#### New Files to Create
- `app/settings/edit-profile.tsx` - Profile editing screen
- `app/settings/change-password.tsx` - Password change screen
- `src/components/common/PasswordInput.tsx` - Password input with visibility toggle

#### Implementation Approach
1. Create `PasswordInput` reusable component
2. Build `edit-profile.tsx` with form validation (react-hook-form + zod)
3. Build `change-password.tsx` with current/new/confirm fields
4. Update profile screen to navigate to new screens instead of web

---

### 2. Reset Password & Email Verification Deep Links

#### Current State
- Forgot password screen exists but token handling is missing
- No deep link handling for reset/verify tokens
- App scheme: `effortlessinsight://`

#### Backend APIs Available
| Endpoint | Status |
|----------|--------|
| `POST /api/v1/auth/forgot-password` | Exists |
| `POST /api/v1/auth/reset-password` | Exists |
| `POST /api/v1/auth/verify-email` | Exists |

#### Files to Modify
- `app.json` - Add deep link paths
- `app/_layout.tsx` - Handle incoming deep links
- `app/(auth)/forgot-password.tsx` - Update flow

#### New Files to Create
- `app/(auth)/reset-password.tsx` - Password reset with token
- `app/(auth)/verify-email.tsx` - Email verification handler

#### Implementation Approach
1. Configure deep link paths in `app.json`
2. Create reset-password screen that extracts token from URL
3. Create verify-email screen with success/error states
4. Add deep link listener in root layout

---

### 3. Response Drafting (RES-001)

#### Current State
- Notice detail screen has no response drafting
- Backend has complete response API

#### Backend APIs Available
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/notices/{id}/responses` | GET | List responses |
| `/notices/{id}/responses/latest` | GET | Get latest |
| `/notices/{id}/responses/draft` | POST | Save draft |
| `/notices/{id}/responses/{rid}/submit-for-review` | POST | Submit |
| `/notices/{id}/responses/{rid}/approve` | POST | Approve |
| `/notices/{id}/responses/{rid}/mark-submitted` | POST | Mark submitted |

#### Files to Modify
- `app/notices/[id].tsx` - Add Response tab
- `src/services/api/notices.ts` - Add response methods
- `src/hooks/useNotices.ts` - Add response hooks
- `src/types/notice.ts` - Add response types

#### New Files to Create
- `src/components/notices/ResponseDraftEditor.tsx` - Draft editor
- `src/components/notices/ResponseStatusBadge.tsx` - Status display

#### Implementation Approach
1. Add response types and API methods
2. Create response hooks (useResponses, useSaveDraft, useSubmitResponse)
3. Add "Response" tab to notice detail
4. Build draft editor with auto-save (debounced)
5. Add submit/approve workflow UI

---

### 4. View Original Notice PDF (NOT-US-013)

#### Current State
- Uses `Linking.openURL()` to open in browser
- No inline viewing or caching

#### Backend APIs Available
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/notices/{id}/download` | GET | Get signed URL |
| `/notices/{id}/attachments/{aid}/download` | GET | Get attachment URL |

#### Dependencies to Add
```json
"react-native-pdf": "^6.7.x",
"@react-native-community/progress-bar-android": "^1.0.x"
```

#### Files to Modify
- `app/notices/[id].tsx` - Add view PDF button
- `package.json` - Add PDF dependencies

#### New Files to Create
- `app/notices/pdf-viewer.tsx` - Full-screen PDF viewer
- `src/components/notices/PDFViewer.tsx` - PDF component

#### Implementation Approach
1. Install react-native-pdf (requires expo prebuild)
2. Create PDF viewer screen with:
   - Loading state with progress
   - Page navigation
   - Zoom controls
   - Share/download buttons
3. Add "View Original" button to notice header
4. Cache PDFs locally for offline viewing

---

### 5. Hindi / Internationalization (RPT-003)

#### Current State
- All strings hardcoded in English
- Backend sends `summaryHi` for Hindi AI summaries
- No i18n library installed

#### Dependencies to Add
```json
"i18next": "^23.x",
"react-i18next": "^14.x",
"expo-localization": "^15.x"
```

#### New Files to Create
```
src/i18n/
├── index.ts           # i18n configuration
├── locales/
│   ├── en.json        # English translations
│   └── hi.json        # Hindi translations
└── LanguageProvider.tsx
```
- `app/settings/language.tsx` - Language picker screen

#### Files to Modify
- `app/_layout.tsx` - Wrap with I18nProvider
- `app/(tabs)/profile.tsx` - Add language setting
- All screen files - Replace hardcoded strings

#### Implementation Approach
1. Install i18next, react-i18next, expo-localization
2. Create i18n configuration with fallback
3. Extract all strings to locale files (~200 keys)
4. Add language switcher in settings
5. Persist language preference
6. Ensure proper Hindi font rendering

---

### 6. Advanced Mobile Scanning (NOT-MOBILE-004)

#### Current State
- Single image capture with expo-camera
- Decorative frame overlay (no detection)
- No crop/rotate/enhance

#### Dependencies to Add
```json
"react-native-document-scanner-plugin": "^1.x",
"react-native-image-crop-picker": "^0.40.x"
```

#### Files to Modify
- `app/(tabs)/upload.tsx` - Complete rewrite
- `package.json` - Add scanner dependencies

#### New Files to Create
- `src/components/scanner/MultiPageScanner.tsx` - Multi-page UI
- `src/components/scanner/PageThumbnails.tsx` - Page preview strip
- `src/components/scanner/ImageEditor.tsx` - Crop/rotate UI
- `src/components/scanner/DocumentEnhancer.tsx` - Enhancement controls
- `src/utils/pdfGenerator.ts` - Combine images to PDF

#### Implementation Approach
1. Install document scanner plugin (requires prebuild)
2. Build multi-page scanning flow:
   - Capture page → Add to stack
   - Show thumbnail strip at bottom
   - Allow reorder/delete pages
3. Add edge detection using ML Kit
4. Build image editor:
   - Manual crop adjustment
   - Rotation (90°, 180°, 270°)
   - Enhance (contrast, brightness)
5. Generate PDF from multiple images
6. Upload final document

---

### 7. Activity Timeline (COL-008)

#### Current State
- Backend API exists (`/notices/{id}/activity`)
- Hooks exist but minimal
- No UI implementation

#### Backend APIs Available
| Endpoint | Description |
|----------|-------------|
| `GET /notices/{id}/activity` | Notice activity feed |
| `GET /activity` | Organization activity |

#### Files to Modify
- `app/notices/[id].tsx` - Add Activity tab
- `src/services/api/tasks.ts` - Verify activity endpoint
- `src/hooks/useTasks.ts` - Add useNoticeActivity hook

#### New Files to Create
- `src/components/activity/ActivityTimeline.tsx` - Timeline component
- `src/components/activity/ActivityItem.tsx` - Single activity
- `src/components/activity/ActivityIcon.tsx` - Type-based icons

#### Implementation Approach
1. Add activity types and hooks
2. Build ActivityTimeline component with:
   - Grouped by date
   - Type-specific icons
   - User avatars
   - Relative timestamps
3. Add "Activity" tab to notice detail
4. Implement infinite scroll with cursor pagination

---

### 8. Mentions & Comment Visibility (CM-003/CM-006)

#### Current State
- Plain text comments only
- No @mention support
- No visibility selector

#### Backend APIs Available
- Comments API supports `visibility` field
- Comments API supports `mentions` array
- No dedicated user search endpoint (use members list)

#### Files to Modify
- `app/notices/[id].tsx` - Update CommentsTab
- `src/services/api/tasks.ts` - Update comment types
- `src/hooks/useTasks.ts` - Update comment hooks
- `src/types/task.ts` - Add mention/visibility types

#### New Files to Create
- `src/components/comments/MentionInput.tsx` - @mention input
- `src/components/comments/MentionSuggestions.tsx` - User dropdown
- `src/components/comments/VisibilitySelector.tsx` - Visibility toggle
- `src/components/comments/CommentItem.tsx` - Enhanced comment

#### Implementation Approach
1. Update comment types to include visibility and mentions
2. Build MentionInput with:
   - Detect @ trigger
   - Show user suggestions
   - Insert mention tokens
3. Build VisibilitySelector:
   - Toggle: Internal / Public
   - Clear visual indicator
4. Update comment creation payload
5. Render mentions as highlighted links
6. Show visibility badge on comments

---

## API Dependencies Summary

| Feature | Backend Status | Notes |
|---------|----------------|-------|
| Profile Edit | Partial | Need to verify PATCH /auth/me works |
| Change Password | Ready | `PUT /auth/change-password` exists |
| Reset Password | Ready | Deep link handling needed |
| Response Drafting | Ready | Full API available |
| PDF Viewing | Ready | Download URLs available |
| i18n | N/A | Frontend only |
| Scanning | N/A | Frontend only |
| Activity | Ready | API available |
| Mentions | Ready | Need user search for suggestions |
| Visibility | Ready | API supports visibility field |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PDF viewer requires native code | Medium | Use expo-dev-client, document prebuild requirement |
| Scanner plugin native dependency | Medium | Same as above |
| Hindi font rendering issues | Low | Test on physical devices, add custom font if needed |
| Large PDF files performance | Medium | Implement page-by-page loading, cache management |
| Offline mentions | Low | Require online for @mention suggestions |
| Breaking auth flow | High | Comprehensive testing of all auth scenarios |

---

## Implementation Order

### Phase 1: Foundation (Day 1-2)
1. Profile Editing & Change Password
2. Reset Password Deep Links

### Phase 2: Core Features (Day 3-4)
3. Response Drafting
4. Activity Timeline

### Phase 3: Advanced Features (Day 5-6)
5. Mentions & Comment Visibility
6. PDF Viewing

### Phase 4: Enhancement (Day 7-8)
7. Hindi/i18n
8. Advanced Scanning

---

## Test Coverage Requirements

- [ ] Unit tests for new hooks
- [ ] Component tests for new UI
- [ ] Integration tests for auth flows
- [ ] Deep link handling tests
- [ ] Offline behavior tests
- [ ] Hindi text rendering tests

---

## Deliverables Checklist

- [ ] Profile editing screen
- [ ] Change password screen
- [ ] Reset password deep link flow
- [ ] Email verification deep link flow
- [ ] Response drafting tab
- [ ] PDF viewer screen
- [ ] Hindi translation files
- [ ] Language switcher
- [ ] Multi-page scanner
- [ ] Activity timeline tab
- [ ] @mention support in comments
- [ ] Comment visibility toggle

---

*Document created: Implementation ready to begin*
