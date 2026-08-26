// Real DocumentStorageProvider backed by Cloudflare R2 (S3-compatible),
// PLAN.md P0-7. R2 speaks the S3 API, so this uses the AWS SDK's S3
// client pointed at R2's endpoint rather than a Cloudflare-specific SDK.
//
// Not unit-tested against a live bucket -- same reasoning as
// bullMqJobQueue.ts: that would make tests depend on network state. The
// DocumentStorageProvider *interface* (src/lib/providers/types.ts) is
// what callers actually depend on, so a fake implementing it is what
// tests should use, not this file directly.
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  DocumentStorageProvider,
  UploadedObject,
} from "./types";

export interface R2Config {
  accountEndpoint: string; // e.g. https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export class R2DocumentStorageProvider implements DocumentStorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor(config: R2Config) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: "auto", // R2 doesn't use AWS regions; "auto" is R2's documented value
      endpoint: config.accountEndpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(key: string, data: Buffer, mimeType: string): Promise<UploadedObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: mimeType,
      })
    );

    return { storageKey: key, sizeBytes: data.byteLength, mimeType };
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/**
 * Builds an R2DocumentStorageProvider from the Render env vars
 * (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).
 * Throws early and clearly if any are missing, rather than letting a
 * vague SDK error surface later at upload time.
 */
export function createR2ProviderFromEnv(): R2DocumentStorageProvider {
  const accountEndpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  const missing = [
    ["R2_ENDPOINT", accountEndpoint],
    ["R2_ACCESS_KEY_ID", accessKeyId],
    ["R2_SECRET_ACCESS_KEY", secretAccessKey],
    ["R2_BUCKET_NAME", bucket],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Cannot create R2 document storage provider: missing env var(s): ${missing.join(", ")}`
    );
  }

  return new R2DocumentStorageProvider({
    accountEndpoint: accountEndpoint!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
  });
}
