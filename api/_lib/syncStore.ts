import { get, put } from "@vercel/blob";

// The one JSON blob this personal, single-user app backs up to — same
// shape as the manual export/import in src/lib/personalRepo.ts, just
// automated. Fixed pathname + allowOverwrite so there's always exactly
// one current backup, not an ever-growing history. Private access (the
// store here is configured private) — `get()` handles the
// authenticated read the same way `put()` handles the authenticated
// write, both via BLOB_READ_WRITE_TOKEN, rather than us hand-rolling
// auth headers against a guessed URL/token format.
const BLOB_PATH = "fade-signal-backup.json";
const MAX_BYTES = 5 * 1024 * 1024;

export interface SyncResult {
  status: number;
  contentType: string;
  body: string;
}

function errorResult(status: number, message: string): SyncResult {
  return { status, contentType: "application/json", body: JSON.stringify({ error: message }) };
}

// The client never sees the Blob store directly — everything stays
// behind the same Basic Auth gate that already protects every other
// route (middleware.ts matches /(.*), including /api/*).
export async function pullBackup(): Promise<SyncResult> {
  try {
    const result = await get(BLOB_PATH, { access: "private" });
    if (!result?.stream) {
      return errorResult(404, "No backup has been pushed yet.");
    }
    const body = await new Response(result.stream).text();
    return { status: 200, contentType: "application/json", body };
  } catch (err) {
    return errorResult(502, `Couldn't reach blob storage: ${(err as Error).message}`);
  }
}

export async function pushBackup(rawBody: string): Promise<SyncResult> {
  if (rawBody.length > MAX_BYTES) {
    return errorResult(413, `Backup is too large (${Math.round(rawBody.length / 1024)} KB, limit 5 MB).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return errorResult(400, "Body isn't valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || !("version" in parsed) || !("overrides" in parsed)) {
    return errorResult(400, "Doesn't look like a Fade Signal backup export.");
  }

  try {
    await put(BLOB_PATH, rawBody, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0
    });
    return { status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return errorResult(502, `Couldn't write to blob storage: ${(err as Error).message}`);
  }
}
