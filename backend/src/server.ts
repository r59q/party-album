import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import cors from "cors";
import express from "express";
import QRCode from "qrcode";
import { z } from "zod";
import { config } from "./config";
import { createPresignedReadUrl, createPresignedUploadUrl, deleteObjectByKey, objectExists } from "./s3";
import { addPhoto, getEventPhotos, getPhotoById, markPhotoHidden, type PhotoRecord } from "./store";

const app = express();
const publicDir = path.resolve(__dirname, "../public");

function expectedTokenForEvent(eventId: string): string | null {
  return config.eventTokens[eventId] || config.eventDefaultToken || null;
}

function hasValidEventToken(eventId: string, token: string | undefined): boolean {
  const expected = expectedTokenForEvent(eventId);
  if (!expected) {
    return !config.eventTokenRequired;
  }
  return token === expected;
}

const parsedOrigins = config.corsOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: config.corsOrigin === "*" ? true : parsedOrigins
  })
);
app.use(express.json({ limit: "1mb" }));
app.use("/public", express.static(publicDir));

app.get("/", (_req, res) => {
  res.redirect("/guest");
});

app.get("/guest", (_req, res) => {
  res.sendFile(path.join(publicDir, "guest.html"));
});

app.get("/display", (_req, res) => {
  res.sendFile(path.join(publicDir, "display.html"));
});

app.get("/tools/join", (_req, res) => {
  res.sendFile(path.join(publicDir, "join-tool.html"));
});

app.get("/tools/qr.svg", async (req, res) => {
  const value = typeof req.query.value === "string" ? req.query.value : "";
  if (!value || value.length > 2048) {
    return res.status(400).json({ error: "invalid_value" });
  }

  try {
    const svg = await QRCode.toString(value, {
      type: "svg",
      width: 1024,
      margin: 1,
      errorCorrectionLevel: "M"
    });
    res.setHeader("Content-Type", "image/svg+xml");
    return res.send(svg);
  } catch (error) {
    return res.status(500).json({
      error: "qr_generation_failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.get("/photos/:photoId/view", async (req, res) => {
  const photo = await getPhotoById(req.params.photoId);
  if (!photo || photo.moderationStatus !== "visible") {
    return res.status(404).json({ error: "photo_not_found" });
  }

  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  if (!hasValidEventToken(photo.eventId, token)) {
    return res.status(401).json({ error: "invalid_event_token" });
  }

  try {
    const viewUrl = await createPresignedReadUrl(photo.objectKey);
    return res.redirect(viewUrl);
  } catch (error) {
    return res.status(500).json({
      error: "photo_view_failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

const initUploadSchema = z.object({
  eventId: z.string().min(1),
  token: z.string().optional(),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive()
});

const completeUploadSchema = z.object({
  eventId: z.string().min(1),
  token: z.string().optional(),
  photoId: z.string().uuid(),
  objectKey: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  capturedAtClient: z.string().datetime().optional()
});

const deletePhotoSchema = z.object({
  token: z.string().optional()
});

function fileExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (!ext.match(/^\.[a-z0-9]+$/)) {
    return ".jpg";
  }
  return ext;
}

function hourKeyIso(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:00`;
}

function hourRangeLabel(date: Date, timezone: string): string {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long"
  })
    .format(date)
    .toLowerCase();

  const start = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: true
  }).format(date);

  const endDate = new Date(date.getTime() + 60 * 60 * 1000);
  const end = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: true
  }).format(endDate);

  return `${weekday}, ${start}-${end}`;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/uploads/init", async (req, res) => {
  const parsed = initUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
  }

  const { eventId, token, fileName, contentType, sizeBytes } = parsed.data;
  if (!hasValidEventToken(eventId, token)) {
    return res.status(401).json({ error: "invalid_event_token" });
  }

  if (!contentType.startsWith("image/")) {
    return res.status(400).json({ error: "invalid_content_type" });
  }
  if (sizeBytes > config.uploadMaxBytes) {
    return res.status(400).json({ error: "file_too_large", maxBytes: config.uploadMaxBytes });
  }

  const photoId = crypto.randomUUID();
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const ext = fileExtension(fileName);
  const objectKey = `events/${eventId}/photos/${y}/${m}/${d}/${photoId}${ext}`;

  try {
    const uploadUrl = await createPresignedUploadUrl(objectKey, contentType);
    return res.json({
      photoId,
      objectKey,
      uploadUrl,
      expiresInSeconds: config.s3PresignExpiresSeconds
    });
  } catch (error) {
    return res.status(500).json({
      error: "upload_init_failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.post("/uploads/complete", async (req, res) => {
  const parsed = completeUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
  }

  const payload = parsed.data;
  if (!hasValidEventToken(payload.eventId, payload.token)) {
    return res.status(401).json({ error: "invalid_event_token" });
  }

  if (!payload.objectKey.startsWith(`events/${payload.eventId}/photos/`)) {
    return res.status(400).json({ error: "invalid_object_key" });
  }

  const exists = await objectExists(payload.objectKey);
  if (!exists) {
    return res.status(400).json({ error: "object_not_found" });
  }

  const record: PhotoRecord = {
    photoId: payload.photoId,
    eventId: payload.eventId,
    objectKey: payload.objectKey,
    contentType: payload.contentType,
    sizeBytes: payload.sizeBytes,
    capturedAtClient: payload.capturedAtClient,
    uploadedAt: new Date().toISOString(),
    moderationStatus: "visible"
  };

  await addPhoto(record);
  return res.status(201).json({ photo: record });
});

app.post("/photos/:photoId/delete", async (req, res) => {
  const parsed = deletePhotoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
  }

  const photo = await getPhotoById(req.params.photoId);
  if (!photo) {
    return res.status(404).json({ error: "photo_not_found" });
  }

  if (!hasValidEventToken(photo.eventId, parsed.data.token)) {
    return res.status(401).json({ error: "invalid_event_token" });
  }

  try {
    await deleteObjectByKey(photo.objectKey);
  } catch {
    // Keep deletion idempotent for guests. Metadata is hidden regardless of object state.
  }

  const updated = await markPhotoHidden(photo.photoId);
  return res.json({ ok: true, photo: updated ?? photo });
});

app.get("/events/:eventId/photos/timeline", async (req, res) => {
  const eventId = req.params.eventId;
  const timezone = typeof req.query.timezone === "string" && req.query.timezone ? req.query.timezone : "UTC";
  const token = typeof req.query.token === "string" ? req.query.token : undefined;

  if (!hasValidEventToken(eventId, token)) {
    return res.status(401).json({ error: "invalid_event_token" });
  }

  const photos = await getEventPhotos(eventId);
  const visiblePhotos = photos.filter((photo) => photo.moderationStatus === "visible");
  const ordered = visiblePhotos.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  const groups = new Map<string, PhotoRecord[]>();
  for (const photo of ordered) {
    const timestamp = photo.capturedAtClient ?? photo.uploadedAt;
    const key = hourKeyIso(new Date(timestamp), timezone);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(photo);
  }

  const timeline = Array.from(groups.entries()).map(([hour, items]) => {
      const photos = items.map((photo) => ({
        ...photo,
        viewUrl: `/photos/${photo.photoId}/view?token=${encodeURIComponent(token || "")}`
      }));

      const groupSourceTimestamp = items[0]?.capturedAtClient ?? items[0]?.uploadedAt;
      const label = groupSourceTimestamp
        ? hourRangeLabel(new Date(groupSourceTimestamp), timezone)
        : hour;

    return {
      hour,
      label,
      count: photos.length,
      photos
    };
  });

  return res.json({ eventId, timezone, timeline });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({
    error: "internal_error",
    message: err instanceof Error ? err.message : "Unknown error"
  });
});

app.listen(config.port, () => {
  console.log(`Party Album backend listening on http://localhost:${config.port}`);
});