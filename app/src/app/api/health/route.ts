// Basic liveness check (doc 12 "HEALTH CHECK SYSTEM" — this is the
// LIVENESS tier only; READINESS/DEPENDENCY/FUNCTIONAL checks against a
// real database come once P0-10 (hosting) unblocks).
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", service: "rosenthal-and-kin" });
}
