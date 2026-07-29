# Party Album

Party Album is a shared, event-focused photo album where guests can scan an NFC tag or QR code, take photos, preview them, and upload to S3-compatible object storage (AWS S3, MinIO, and similar providers).

The product is designed to be simple for guests and highly compatible with iPhone and Android browsers, while also giving event hosts an admin interface with moderation and event controls.

## Core Product Goals

1. Guest flow should be fast and low-friction.
2. Camera capture should work on modern iPhone and Android browsers.
3. Guests can preview photos before upload.
4. Uploaded photos are stored in S3-compatible storage.
5. Guest gallery is grouped by hour to show event progression.
6. Host/admin gallery has the same timeline view plus administration tools.

## Documentation

- System design and implementation plan: docs/system-design-and-build-plan.md
- MinIO deployment integration: docs/minio-integration-next-steps.md
- Backend MVP quick start: backend/README.md

## Deployment

- Backend container deployment: backend/docker-compose.backend.yml

## Scope Summary

- Public guest page for photo capture and browsing
- Admin page for event setup, moderation, and storage/operational controls
- Hour-grouped gallery timeline
- Optional QR/NFC onboarding per event
- S3-compatible media storage

## Status

Planning complete. Backend MVP scaffold is implemented in backend/.
