import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("8787"),
  CORS_ORIGIN: z.string().default("*"),
  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.string().default("true"),
  S3_PRESIGN_EXPIRES_SECONDS: z.string().default("300"),
  UPLOAD_MAX_BYTES: z.string().default("15728640"),
  DATA_DIR: z.string().default("./data"),
  EVENT_TOKEN_REQUIRED: z.string().default("true"),
  EVENT_DEFAULT_TOKEN: z.string().default(""),
  EVENT_TOKENS_JSON: z.string().default("{}")
});

function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
}

export const config = {
  port: Number(parsed.data.PORT),
  corsOrigin: parsed.data.CORS_ORIGIN,
  s3Endpoint: parsed.data.S3_ENDPOINT,
  s3Region: parsed.data.S3_REGION,
  s3Bucket: parsed.data.S3_BUCKET,
  s3AccessKeyId: parsed.data.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: parsed.data.S3_SECRET_ACCESS_KEY,
  s3ForcePathStyle: parseBoolean(parsed.data.S3_FORCE_PATH_STYLE),
  s3PresignExpiresSeconds: Number(parsed.data.S3_PRESIGN_EXPIRES_SECONDS),
  uploadMaxBytes: Number(parsed.data.UPLOAD_MAX_BYTES),
  dataDir: parsed.data.DATA_DIR,
  eventTokenRequired: parseBoolean(parsed.data.EVENT_TOKEN_REQUIRED),
  eventDefaultToken: parsed.data.EVENT_DEFAULT_TOKEN,
  eventTokens: parseEventTokens(parsed.data.EVENT_TOKENS_JSON)
};

function parseEventTokens(rawJson: string): Record<string, string> {
  try {
    const parsedJson = JSON.parse(rawJson) as unknown;
    if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) {
      return {};
    }

    const entries = Object.entries(parsedJson as Record<string, unknown>)
      .filter(([eventId, token]) => eventId.trim().length > 0 && typeof token === "string" && token.length > 0)
      .map(([eventId, token]) => [eventId.trim(), token as string]);

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}