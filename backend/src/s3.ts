import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config";

export const s3Client = new S3Client({
  region: config.s3Region,
  endpoint: config.s3Endpoint,
  forcePathStyle: config.s3ForcePathStyle,
  credentials: {
    accessKeyId: config.s3AccessKeyId,
    secretAccessKey: config.s3SecretAccessKey
  }
});

export async function createPresignedUploadUrl(objectKey: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: objectKey,
    ContentType: contentType
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: config.s3PresignExpiresSeconds
  });
}

export async function objectExists(objectKey: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: config.s3Bucket,
        Key: objectKey
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function createPresignedReadUrl(objectKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.s3Bucket,
    Key: objectKey
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: config.s3PresignExpiresSeconds
  });
}

export async function deleteObjectByKey(objectKey: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: config.s3Bucket,
      Key: objectKey
    })
  );
}