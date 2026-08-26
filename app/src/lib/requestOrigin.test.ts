import { describe, it, expect } from "vitest";
import { getPublicOrigin } from "./requestOrigin";
import type { NextRequest } from "next/server";

function fakeRequest(headers: Record<string, string>, fallbackOrigin: string): NextRequest {
  return {
    headers: { get: (name: string) => headers[name] ?? null },
    nextUrl: { origin: fallbackOrigin },
  } as unknown as NextRequest;
}

describe("getPublicOrigin", () => {
  it("uses X-Forwarded-Host/Proto when present (the Render case)", () => {
    const req = fakeRequest(
      { "x-forwarded-host": "rosenthal-and-kin-app.onrender.com", "x-forwarded-proto": "https" },
      "http://localhost:10000"
    );
    expect(getPublicOrigin(req)).toBe("https://rosenthal-and-kin-app.onrender.com");
  });

  it("defaults forwarded proto to https when only the host header is present", () => {
    const req = fakeRequest({ "x-forwarded-host": "example.com" }, "http://localhost:10000");
    expect(getPublicOrigin(req)).toBe("https://example.com");
  });

  it("falls back to req.nextUrl.origin when there is no proxy in front (local dev)", () => {
    const req = fakeRequest({}, "http://localhost:3000");
    expect(getPublicOrigin(req)).toBe("http://localhost:3000");
  });
});
