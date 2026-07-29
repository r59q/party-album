import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";

export type PhotoRecord = {
  photoId: string;
  eventId: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  capturedAtClient?: string;
  uploadedAt: string;
  moderationStatus: "visible" | "hidden" | "pending";
};

type StoreData = {
  photos: PhotoRecord[];
};

const storePath = path.join(config.dataDir, "photos.json");

async function ensureStoreExists(): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  try {
    await readFile(storePath, "utf8");
  } catch {
    const initialData: StoreData = { photos: [] };
    await writeFile(storePath, JSON.stringify(initialData, null, 2), "utf8");
  }
}

async function readStore(): Promise<StoreData> {
  await ensureStoreExists();
  const raw = await readFile(storePath, "utf8");
  return JSON.parse(raw) as StoreData;
}

async function writeStore(data: StoreData): Promise<void> {
  await writeFile(storePath, JSON.stringify(data, null, 2), "utf8");
}

export async function addPhoto(photo: PhotoRecord): Promise<void> {
  const data = await readStore();
  data.photos.push(photo);
  await writeStore(data);
}

export async function getEventPhotos(eventId: string): Promise<PhotoRecord[]> {
  const data = await readStore();
  return data.photos.filter((photo) => photo.eventId === eventId);
}

export async function getPhotoById(photoId: string): Promise<PhotoRecord | undefined> {
  const data = await readStore();
  return data.photos.find((photo) => photo.photoId === photoId);
}

export async function markPhotoHidden(photoId: string): Promise<PhotoRecord | undefined> {
  const data = await readStore();
  const photo = data.photos.find((item) => item.photoId === photoId);
  if (!photo) {
    return undefined;
  }

  photo.moderationStatus = "hidden";
  await writeStore(data);
  return photo;
}