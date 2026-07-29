# Party Album: System Documentation and Build Plan

## 1. Product Vision

Create an event album that guests can join by scanning an NFC tag or QR code. Guests can take photos in-browser, preview before upload, and add photos with minimal steps. Photos are stored in S3-compatible object storage and displayed in a timeline grouped by hour to reflect event progression.

The host gets an admin interface with moderation and operational controls.

## 2. User Roles and Capabilities

### Guest

1. Join event by URL, QR, or NFC deep link.
2. Open camera in browser.
3. Capture photo and preview it.
4. Retake or upload.
5. Browse public gallery grouped by hour.

### Host or Admin

1. Create event and configure metadata.
2. Generate guest join URL and QR payload.
3. Configure NFC tag payload to same URL.
4. Browse timeline grouped by hour.
5. Moderate photos: hide, unhide, delete, feature.
6. Manage guest upload settings and event status.

## 3. Experience Requirements

### Guest Simplicity

1. Maximum two taps after camera permission.
2. No mandatory sign-in for guest uploads.
3. Clear, large controls with mobile-first layout.
4. Retry flow if upload fails.

### iPhone and Android Compatibility

1. Primary capture path should use HTML file input with capture hint.
2. Optional advanced capture path can use MediaDevices API when available.
3. Use responsive layout and avoid browser-specific dependencies.
4. Handle Safari and Chrome permission prompts carefully.

## 4. High-Level Architecture

## Components

1. Frontend Web App
- Guest capture and timeline browsing.
- Admin timeline and moderation.

2. Backend API
- Event management.
- Upload authorization.
- Gallery queries grouped by hour.
- Admin moderation endpoints.

3. Storage Layer
- S3-compatible object storage for original images and optional thumbnails.

4. Database
- Metadata for events, photos, moderation state, upload tokens, audit logs.

5. Optional Background Worker
- Generate thumbnails, strip metadata, run image validation.

## Reference Data Flow

1. Guest scans QR or taps NFC, opens event guest URL.
2. Guest captures photo and sees local preview.
3. Guest taps upload.
4. Frontend requests short-lived upload authorization.
5. Frontend uploads directly to object storage using presigned URL.
6. Frontend confirms upload with backend.
7. Backend marks photo visible in guest timeline (unless moderation policy delays visibility).
8. Gallery queries return photos grouped by hour.

## 5. URL and Access Model

1. Event has a public guest token in URL for join and upload.
2. Admin uses authenticated account and role-based access.
3. Suggested URL patterns:
- /e/{eventSlug}?t={guestToken}
- /admin/events/{eventId}

Guest token should be long, random, and revocable.

## 6. Data Model (Initial)

### Event

- id
- slug
- title
- timezone
- startAt
- endAt
- guestTokenHash
- uploadPolicy (open, moderated, closed)
- createdBy
- createdAt

### Photo

- id
- eventId
- objectKey
- thumbnailKey (optional)
- capturedAtClient (optional)
- uploadedAt
- uploaderSessionId
- moderationStatus (visible, hidden, deleted, pending)
- width
- height
- mimeType
- sizeBytes

### AdminUser

- id
- email
- passwordHash or externalAuthId
- role
- createdAt

### AuditLog

- id
- actorType (admin, system)
- actorId
- eventId
- photoId (optional)
- action
- metadataJson
- createdAt

## 7. API Surface (MVP)

### Guest Endpoints

1. GET /api/events/{eventSlug}/public?token=...
- Returns event name, status, policy, and lightweight timeline summary.

2. POST /api/events/{eventId}/uploads/init
- Validates guest token and file metadata.
- Returns presigned upload URL and object key.

3. POST /api/events/{eventId}/uploads/complete
- Confirms object exists and writes photo record.

4. GET /api/events/{eventId}/photos/timeline
- Returns photos grouped by local event hour.

### Admin Endpoints

1. POST /api/admin/events
2. GET /api/admin/events/{eventId}
3. PATCH /api/admin/events/{eventId}
4. GET /api/admin/events/{eventId}/photos/timeline
5. POST /api/admin/photos/{photoId}/hide
6. POST /api/admin/photos/{photoId}/unhide
7. DELETE /api/admin/photos/{photoId}

## 8. Gallery Grouping by Hour

Grouping must be based on event timezone.

Algorithm:

1. Determine source timestamp for each photo:
- Prefer capturedAtClient if trustworthy and sane.
- Fallback to uploadedAt.

2. Convert timestamp to event timezone.

3. Bucket key format: YYYY-MM-DD HH:00.

4. Return ordered groups ascending for event progression.

### Guest View Rules

1. Show visible photos only.
2. Optionally show pending moderation placeholder if desired.

### Admin View Rules

1. Show all statuses.
2. Include moderation controls in each item.

## 9. Photo Capture and Preview Design

## Recommended Capture Strategy

1. Primary: input type file with accept image/* and capture environment.
2. Secondary: MediaDevices getUserMedia plus canvas capture for devices that support it and where UX benefits are clear.

Reason: file input path remains the most compatible across iPhone and Android browsers.

## Preview Flow

1. After file selection, generate preview using URL.createObjectURL.
2. Present actions: Retake, Upload.
3. Do not upload until user confirms Upload.

## Upload Safety Checks

1. Validate MIME type and file extension.
2. Enforce file size limits.
3. Optionally compress client-side for large images.

## 10. S3-Compatible Storage Strategy

1. Use abstraction that supports endpoint URL, region, access key, secret key, path-style toggle.
2. Keep bucket private by default.
3. Use presigned PUT URLs for client upload.
4. Serve gallery with presigned GET URLs or proxied image endpoint.
5. Namespace object keys by event and date.

Example key pattern:

events/{eventId}/photos/{yyyy}/{mm}/{dd}/{photoId}.jpg

Supported providers:

- AWS S3
- MinIO
- Cloudflare R2
- Backblaze B2 S3 API

## 11. Security and Abuse Controls

1. Use short-lived presigned upload URLs.
2. Verify completed upload object metadata server-side.
3. Apply per-event and per-IP rate limits.
4. Allow host to rotate or disable guest token.
5. Strip EXIF metadata in background worker if privacy policy requires it.
6. Enforce strict content type allowlist.
7. Add CSRF protection for admin actions.
8. Log admin moderation actions in audit log.

## 12. Admin Tooling Requirements

1. Event dashboard:
- Event info and status.
- QR value display and download.
- Copyable guest URL.

2. Timeline moderation:
- Hide, unhide, delete.
- Filter by status.

3. Operational controls:
- Open or close uploads.
- Token rotation.
- Storage health check.

## 13. Suggested Technology Choices

These are pragmatic, stable choices for compatibility and quick delivery.

1. Frontend:
- Next.js or another React framework with server rendering support.
- Plain responsive CSS or utility CSS framework.

2. Backend:
- Node.js with TypeScript.
- REST API.

3. Database:
- PostgreSQL.

4. Object Storage:
- Any S3-compatible endpoint.

5. Queue and Worker (optional after MVP):
- Redis queue for thumbnail and metadata processing.

## 14. MVP Delivery Plan

## Phase 1: Foundation

1. Repo structure, environment configuration, linting, CI.
2. Database schema for events, photos, admins.
3. Storage client with S3-compatible configuration.

Exit criteria:

- Local environment runs app and API.
- Upload init endpoint can generate valid presigned URLs.

## Phase 2: Guest Capture and Upload

1. Guest event page with camera input.
2. Local preview with retake and upload confirmation.
3. Upload init and complete API integration.
4. Basic error handling and retry.

Exit criteria:

- iPhone Safari and Android Chrome can capture, preview, and upload.

## Phase 3: Guest Timeline Grouped by Hour

1. Timeline API grouped by event timezone hour.
2. Mobile-first timeline UI.
3. Pagination or lazy loading.

Exit criteria:

- Guests can browse by hourly groups and observe event progression.

## Phase 4: Admin Interface and Moderation

1. Admin authentication.
2. Admin timeline with status filters.
3. Hide, unhide, delete actions.
4. Event controls and token rotation.

Exit criteria:

- Host can fully manage event photos and upload policy.

## Phase 5: Hardening and Launch

1. Rate limits and abuse protections.
2. Optional thumbnail worker and EXIF stripping.
3. Monitoring, alerts, backup policy.
4. End-to-end test pass and pilot event.

Exit criteria:

- Production-ready deployment with observability and rollback plan.

## 15. Test Plan

## Functional Tests

1. Guest join via URL, QR, NFC.
2. Capture and preview flow.
3. Upload success and failure handling.
4. Hour-based grouping correctness across timezone boundaries.
5. Admin moderation actions reflected in guest view.

## Device and Browser Matrix

1. iPhone:
- Safari latest major version.
- Chrome latest major version.

2. Android:
- Chrome latest major version.
- Samsung Internet latest major version.

## Non-Functional Tests

1. Concurrent uploads under event peak.
2. Object storage outage behavior.
3. API rate-limiting behavior.
4. Security checks for upload tampering.

## 16. Deployment and Operations

1. Deploy frontend and API behind HTTPS.
2. Configure object storage credentials via environment variables.
3. Enable structured logs and dashboard metrics.
4. Define backup and retention policy.
5. Prepare incident runbook for storage/API failures.

## 17. Open Decisions to Finalize

1. Guest visibility policy:
- Immediate publish vs moderation-first.

2. Privacy policy:
- Whether EXIF data should be removed before display.

3. Authentication method for admins:
- Password login vs external provider.

4. Image transformations:
- On upload, on read, or both.

5. Event lifecycle:
- Archive strategy and storage retention period.

## 18. Initial Backlog (Actionable Tickets)

1. Create project scaffold with frontend, backend, and shared types.
2. Implement event schema and migrations.
3. Build S3-compatible storage client and upload init endpoint.
4. Build guest capture page with preview and commit flow.
5. Implement upload complete endpoint and metadata persistence.
6. Implement guest timeline API with hour grouping and timezone support.
7. Build guest timeline UI.
8. Add admin auth and event dashboard.
9. Add moderation endpoints and admin timeline controls.
10. Add rate limiting, audit logs, and deployment configs.

This document can be used as the working blueprint for implementation from MVP to production launch.