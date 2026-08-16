// TheHuddle's per-player news page (tools.thehuddle.com/player/{id}/{slug})
// has no CORS headers, so the browser can't call it directly — same
// reasoning as adpProxy.ts. Its numeric ID isn't derivable from a
// player's name (a wrong ID silently returns an empty page), so this
// pulls an id/slug index from their public depth-chart page instead —
// one page, plain server-rendered HTML (confirmed: 559 "/player/id/slug"
// links present without any JS execution), refreshed periodically rather
// than per-request.
const DEPTH_CHARTS_URL = "https://tools.thehuddle.com/nfl-depth-charts";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export interface HuddlePlayerLink {
  id: number;
  slug: string;
}

export interface HuddleProxyResult {
  status: number;
  contentType: string;
  body: string;
}

function parsePlayerLinks(html: string): HuddlePlayerLink[] {
  const seen = new Map<string, HuddlePlayerLink>();
  const re = /href="\/player\/(\d+)\/([a-z0-9-]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = Number(m[1]);
    const slug = m[2];
    if (!Number.isFinite(id) || !slug) continue;
    // A player can appear more than once (multiple depth-chart slots);
    // first occurrence's id/slug pairing is as good as any other.
    if (!seen.has(slug)) seen.set(slug, { id, slug });
  }
  return [...seen.values()];
}

export async function proxyHuddlePlayers(): Promise<HuddleProxyResult> {
  let res: Response;
  try {
    res = await fetch(DEPTH_CHARTS_URL, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      signal: AbortSignal.timeout(15000)
    });
  } catch (err) {
    return { status: 502, contentType: "application/json", body: JSON.stringify({ error: `Upstream fetch failed: ${(err as Error).message}` }) };
  }
  if (!res.ok) {
    return { status: 502, contentType: "application/json", body: JSON.stringify({ error: `Upstream returned ${res.status}` }) };
  }
  const html = await res.text();
  const players = parsePlayerLinks(html);
  if (players.length === 0) {
    return { status: 502, contentType: "application/json", body: JSON.stringify({ error: "No player links found in upstream response" }) };
  }
  return { status: 200, contentType: "application/json", body: JSON.stringify({ players }) };
}
