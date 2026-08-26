import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createR2ProviderFromEnv, R2DocumentStorageProvider } from "./r2DocumentStorageProvider";

const ENV_KEYS = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] as const;

describe("createR2ProviderFromEnv", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("throws listing every missing env var, not just the first", () => {
    for (const key of ENV_KEYS) delete process.env[key];

    expect(() => createR2ProviderFromEnv()).toThrowError(
      /R2_ENDPOINT.*R2_ACCESS_KEY_ID.*R2_SECRET_ACCESS_KEY.*R2_BUCKET_NAME/
    );
  });

  it("throws naming only the specific var(s) missing", () => {
    process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    delete process.env.R2_BUCKET_NAME;

    expect(() => createR2ProviderFromEnv()).toThrowError(/R2_BUCKET_NAME/);
    expect(() => createR2ProviderFromEnv()).not.toThrowError(/R2_ENDPOINT/);
  });

  it("constructs successfully when all four vars are present", () => {
    process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_BUCKET_NAME = "bucket";

    expect(createR2ProviderFromEnv()).toBeInstanceOf(R2DocumentStorageProvider);
  });
});
