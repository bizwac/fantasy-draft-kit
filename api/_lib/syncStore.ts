import { get, put } from "@vercel/blob";

export interface SyncResult {
  status: number;
  contentType: string;
  body: string;
}

function errorResult(status: number, message: string): SyncResult {
  return { status, contentType: "application/json", body: JSON.stringify({ error: message }) };
}

// Shared by every blob this app backs up to (personal data + each
// player-data table) — fixed pathname + allowOverwrite so there's
// always exactly one current copy per path, not an ever-growing
// history. Private access (the store here is configured private) —
// `get()` handles the authenticated read the same way `put()` handles
// the authenticated write, both via BLOB_READ_WRITE_TOKEN, rather than
// us hand-rolling auth headers against a guessed URL/token format. The
// client never sees the Blob store directly — everything stays behind
// the same Basic Auth gate that already protects every other route
// (middleware.ts matches /(.*), including /api/*).
async function pullNamedBackup(path: string, notFoundMessage: string): Promise<SyncResult> {
  try {
    const result = await get(path, { access: "private" });
    if (!result?.stream) {
      return errorResult(404, notFoundMessage);
    }
    const body = await new Response(result.stream).text();
    return { status: 200, contentType: "application/json", body };
  } catch (err) {
    return errorResult(502, `Couldn't reach blob storage: ${(err as Error).message}`);
  }
}

async function pushNamedBackup(
  path: string,
  rawBody: string,
  maxBytes: number,
  isValidShape: (parsed: unknown) => boolean,
  shapeErrorMessage: string
): Promise<SyncResult> {
  if (rawBody.length > maxBytes) {
    return errorResult(413, `Too large (${Math.round(rawBody.length / 1024)} KB, limit ${Math.round(maxBytes / 1024 / 1024)} MB).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return errorResult(400, "Body isn't valid JSON.");
  }
  if (!isValidShape(parsed)) {
    return errorResult(400, shapeErrorMessage);
  }

  try {
    await put(path, rawBody, {
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

const BACKUP_PATH = "fade-signal-backup.json";
const BACKUP_MAX_BYTES = 5 * 1024 * 1024;

export async function pullBackup(): Promise<SyncResult> {
  return pullNamedBackup(BACKUP_PATH, "No backup has been pushed yet.");
}

export async function pushBackup(rawBody: string): Promise<SyncResult> {
  return pushNamedBackup(
    BACKUP_PATH,
    rawBody,
    BACKUP_MAX_BYTES,
    (parsed) => typeof parsed === "object" && parsed !== null && "version" in parsed && "overrides" in parsed,
    "Doesn't look like a Fade Signal backup export."
  );
}

// Player-pool data (ADP, injuries, projections, season stats, news
// links) is kept in its own blob per table rather than folded into the
// personal-data backup above: it's an order of magnitude bigger (the
// full player table alone), changes on a completely different rhythm
// (a 24h refresh clock / CSV import, not every pick), and Vercel Node
// functions hard-cap a single request body around 4.5MB regardless of
// any limit set here — splitting by table keeps each request safely
// under that ceiling instead of risking one giant payload tipping over
// it as the dataset grows.
const PLAYER_DATA_PATHS: Record<string, string> = {
  players: "fade-signal-players.json",
  seasonStats: "fade-signal-season-stats.json",
  huddlePlayers: "fade-signal-huddle-players.json"
};
const PLAYER_DATA_MAX_BYTES = 4 * 1024 * 1024;

export async function pullPlayerDataTable(table: string): Promise<SyncResult> {
  const path = PLAYER_DATA_PATHS[table];
  if (!path) return errorResult(400, `Unknown table "${table}".`);
  return pullNamedBackup(path, "No player data has been pushed yet.");
}

export async function pushPlayerDataTable(table: string, rawBody: string): Promise<SyncResult> {
  const path = PLAYER_DATA_PATHS[table];
  if (!path) return errorResult(400, `Unknown table "${table}".`);
  return pushNamedBackup(
    path,
    rawBody,
    PLAYER_DATA_MAX_BYTES,
    (parsed) => typeof parsed === "object" && parsed !== null && "exportedAt" in parsed && "rows" in parsed && Array.isArray((parsed as { rows: unknown }).rows),
    "Doesn't look like a Fade Signal player-data export."
  );
}
