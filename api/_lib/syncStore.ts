import { head, put } from "@vercel/blob";

// The one JSON blob this personal, single-user app backs up to — same
// shape as the manual export/import in src/lib/personalRepo.ts, just
// automated. Fixed pathname + allowOverwrite so there's always exactly
// one current backup, not an ever-growing history.
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

// GET: the client never sees the Blob's own URL — everything stays
// behind the same Basic Auth gate that already protects every other
// route (middleware.ts matches /(.*), including /api/*), rather than
// handing out a second, unauthenticated way to reach the data.
export async function pullBackup(): Promise<SyncResult> {
  try {
    const info = await head(BLOB_PATH);
    const upstream = await fetch(info.url, { signal: AbortSignal.timeout(10000) });
    if (!upstream.ok) {
      return errorResult(502, `Blob storage returned ${upstream.status}`);
    }
    const body = await upstream.text();
    return { status: 200, contentType: "application/json", body };
  } catch (err) {
    const message = (err as Error).message ?? "";
    if (message.includes("not found") || message.includes("404")) {
      return errorResult(404, "No backup has been pushed yet.");
    }
    return errorResult(502, `Couldn't reach blob storage: ${message}`);
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
      access: "public",
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
