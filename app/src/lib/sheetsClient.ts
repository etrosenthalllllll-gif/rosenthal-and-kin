// Real Google Sheets client -- PLAN.md P0-11. Authenticates as the
// `rosenthal-and-kin-sheets-import` service account (read-only access,
// granted by sharing the tracker Sheet directly with its email, same as
// sharing with any collaborator).
//
// Not unit-tested against a live Sheet -- same reasoning as
// bullMqJobQueue.ts / r2DocumentStorageProvider.ts: that would make tests
// depend on network state. src/lib/trackerImport.ts is where the actual
// decision logic lives and is tested; this file is exercised for real
// when the import job actually runs.
import { google } from "googleapis";
import type { TrackerRow } from "./trackerImport";

// Use googleapis' own bundled auth client rather than a standalone
// google-auth-library install -- two separately-installed copies of that
// package produce structurally-incompatible JWT types even at matching
// version numbers (a duplicate-package problem, not a real type error).
type JWT = InstanceType<typeof google.auth.JWT>;

const SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function buildAuthFromEnv(): JWT {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Cannot authenticate to Google Sheets: missing GOOGLE_SHEETS_CLIENT_EMAIL and/or GOOGLE_SHEETS_PRIVATE_KEY"
    );
  }

  return new google.auth.JWT({
    email: clientEmail,
    // Render's env var UI stores the literal newlines correctly, but some
    // dashboards/CI systems flatten them to the two-character sequence
    // "\n" -- normalize either representation defensively.
    key: privateKey.includes("\\n") ? privateKey.replace(/\\n/g, "\n") : privateKey,
    scopes: [SHEETS_READONLY_SCOPE],
  });
}

/**
 * Fetches every row of the tracker sheet (assumes the first row is the
 * header) and returns them as TrackerRow objects keyed by header name.
 * Rows shorter than the header (trailing blank cells Sheets omits) get
 * `undefined` for the missing trailing columns, which callers already
 * treat as "not present" throughout trackerImport.ts.
 *
 * `sheetName` defaults to the spreadsheet's actual first tab rather than
 * assuming "Sheet1" -- tabs created via scripts/automation (as this
 * tracker was) don't reliably keep Sheets' default name.
 */
export async function fetchTrackerRows(
  spreadsheetId: string,
  sheetName?: string
): Promise<TrackerRow[]> {
  const auth = buildAuthFromEnv();
  const sheets = google.sheets({ version: "v4", auth });

  const resolvedSheetName = sheetName ?? (await getFirstSheetTitle(sheets, spreadsheetId));

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: resolvedSheetName,
  });

  const values = res.data.values ?? [];
  if (values.length === 0) return [];

  const [header, ...rows] = values;
  return rows.map((row) => {
    const record: Record<string, string | undefined> = {};
    header.forEach((col: string, i: number) => {
      record[col] = row[i];
    });
    return record as TrackerRow;
  });
}

async function getFirstSheetTitle(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string
): Promise<string> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const title = meta.data.sheets?.[0]?.properties?.title;
  if (!title) {
    throw new Error(`Spreadsheet ${spreadsheetId} has no sheets, or its metadata is unreadable`);
  }
  return title;
}

export function getTrackerSpreadsheetIdFromEnv(): string {
  const id = process.env.GOOGLE_SHEETS_TRACKER_SPREADSHEET_ID;
  if (!id) {
    throw new Error("Missing GOOGLE_SHEETS_TRACKER_SPREADSHEET_ID env var");
  }
  return id;
}
