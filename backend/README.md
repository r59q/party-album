# Backend MVP

Minimal API for Party Album guest uploads using S3-compatible storage.

## Endpoints

1. GET /health
2. GET /guest
3. GET /display
4. GET /tools/join
5. GET /tools/qr.svg?value=...
6. POST /uploads/init
7. POST /uploads/complete
8. POST /photos/:photoId/delete
9. GET /events/:eventId/photos/timeline

## Quick Start

1. Copy environment file:

cp .env.example .env

2. Set MinIO credentials and endpoint in .env.

3. Run development server:

npm run dev

## Docker Deploy

1. Copy and edit environment file:

cp .env.example .env

2. Build and start container:

docker compose -f docker-compose.backend.yml up -d --build

3. View logs:

docker compose -f docker-compose.backend.yml logs -f

4. Stop container:

docker compose -f docker-compose.backend.yml down

Notes:

1. Persistent photo metadata is stored in backend/data via bind mount.
2. Keep your event token stable in .env during the event so NFC tags do not need rewrites.
3. If MinIO runs outside Docker on your LAN, set S3_ENDPOINT to a host reachable from the container.

Default URL:

http://localhost:8787

Guest page URL:

http://localhost:8787/guest?eventId=sample-event&token=replace-with-long-lived-event-token

Join tool URL:

http://localhost:8787/tools/join

Display page URL:

http://localhost:8787/display?eventId=sample-event&token=replace-with-long-lived-event-token

The guest page infers:

1. eventId from URL query param eventId (fallback: sample-event)
2. token from URL query param token
3. timezone from browser locale settings

The join tool provides:

1. Standard join URL generation with eventId and token
2. NFC payload text (same URI)
3. Printable/downloadable SVG QR code

Token enforcement:

1. Guest upload and timeline endpoints validate event token.
2. Keep token long-lived for the event duration to avoid rewriting NFC tags.
3. Configure tokens using EVENT_TOKENS_JSON and optional EVENT_DEFAULT_TOKEN.

The display page provides:

1. Full-screen ambient photo wall for tablet display
2. Automatic background refresh every 10 seconds
3. Change detection to avoid unnecessary rerendering

## Upload Flow

1. Frontend calls POST /uploads/init with eventId, token, and file metadata.
2. API returns presigned PUT URL and objectKey.
3. Frontend uploads directly to MinIO using PUT.
4. Frontend calls POST /uploads/complete with token.
5. API verifies object exists and records metadata.

## Guest UI

1. Use the Take or Choose Photo button to open mobile camera or gallery.
2. Preview appears before upload.
3. Upload commits the photo using presigned URL flow.
4. Timeline reloads and shows photos grouped by hour with weekday/hour labels.

## Notes

1. This MVP stores photo metadata in local JSON under DATA_DIR.
2. Next step is replacing local JSON with PostgreSQL.