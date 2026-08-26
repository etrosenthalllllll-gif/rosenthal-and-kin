#!/usr/bin/env node
// Manual invocation of the Sheets tracker import (PLAN.md P0-11).
// Run from app/: node scripts/run-tracker-import.mjs
//
// Requires DATABASE_URL, GOOGLE_SHEETS_CLIENT_EMAIL,
// GOOGLE_SHEETS_PRIVATE_KEY, and GOOGLE_SHEETS_TRACKER_SPREADSHEET_ID to
// already be set in the environment (Render sets these for the deployed
// app; running locally needs them in app/.env).
import { PrismaClient } from "@prisma/client";
import { runTrackerImport } from "../src/lib/runTrackerImport.ts";
import { getTrackerSpreadsheetIdFromEnv } from "../src/lib/sheetsClient.ts";

const prisma = new PrismaClient();

const summary = await runTrackerImport(prisma, getTrackerSpreadsheetIdFromEnv());

console.log(`Created: ${summary.created}`);
console.log(`Skipped: ${summary.skipped}`);
console.log(`Duplicates: ${summary.duplicates}`);
for (const outcome of summary.outcomes) {
  if (outcome.kind !== "CREATE") {
    console.log(`  ${outcome.kind}: ${JSON.stringify(outcome)}`);
  }
}

await prisma.$disconnect();
