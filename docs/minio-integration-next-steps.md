# MinIO Integration Next Steps

Current state:

1. MinIO deployed at minio.local:9000
2. Bucket created: party-album
3. Bucket privacy: private

HTTP-only note:

1. Running MinIO on plain HTTP is acceptable for a private home network or lab.
2. If your album web app is also served over HTTP on the same trusted network, uploads will work.
3. HTTPS becomes important when traffic leaves your trusted network or when guests connect over the public internet.

This is a good setup for Party Album because photos should not be publicly writable or listable.

## 1. Backend Storage Environment

Set these values in your backend environment:

S3_ENDPOINT=http://minio.local:9000
S3_BUCKET=party-album
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=replace-me
S3_SECRET_ACCESS_KEY=replace-me

Notes:

1. Keep bucket private.
2. Use presigned upload URLs from backend for guest uploads.
3. If backend and MinIO are on same private network, prefer internal DNS/IP for S3_ENDPOINT.
4. For local-only deployments, http:// endpoint is expected and valid.

## 2. Bucket Access Pattern

1. Frontend never gets root credentials.
2. Backend uses access key and secret.
3. Backend issues short-lived presigned PUT URLs for upload.
4. Backend issues short-lived presigned GET URLs or proxies image reads.

## 3. CORS Configuration for Browser Uploads

If guest browser uploads directly to MinIO with presigned URLs, CORS must allow your frontend origin.

Example cors.json:

[
  {
    "AllowedOrigin": ["https://album.example.com"],
    "AllowedMethod": ["PUT", "GET", "HEAD"],
    "AllowedHeader": ["*"],
    "ExposeHeader": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]

Apply with MinIO client:

mc alias set party http://minio.local:9000 YOUR_ACCESS_KEY YOUR_SECRET_KEY
mc cors set party/party-album ./cors.json

Replace https://album.example.com with your real frontend origin.

## 4. Quick Validation Checklist

1. Backend can list bucket metadata with configured credentials.
2. Backend can create presigned PUT URL for object key under events namespace.
3. Mobile browser can upload via presigned URL from event page.
4. Uploaded object is not publicly listable without signed access.

## 5. Suggested Object Key Pattern

events/{eventId}/photos/{yyyy}/{mm}/{dd}/{photoId}.jpg

This keeps data organized per event and day, and makes retention and cleanup easier.

## 6. When to Add HTTPS Later

Add TLS when any of the following becomes true:

1. Guests upload from outside your home network.
2. You expose the service with public DNS or port forwarding.
3. You need to protect admin credentials over untrusted networks.

Until then, LAN-only HTTP is a practical and common development or self-hosted setup.