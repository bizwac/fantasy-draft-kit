import { db } from "@/lib/db";
import { fetchWithTimeout } from "./fetchWithTimeout";
import { normalizeName } from "./normalize";

interface HuddlePlayerLink {
  id: number;
  slug: string;
}

// The slug itself is the match key (e.g. "james-conner") — no need to
// parse a display name out of the depth-chart page's noisy React SSR
// markup; normalizing "james-conner" the same way normalizeName()
// normalizes "James Conner" lands on the same key.
function nameKeyFromSlug(slug: string): string {
  return normalizeName(slug.replace(/-/g, " "));
}

export async function refreshHuddlePlayerIndex(): Promise<number> {
  const res = await fetchWithTimeout("/api/huddlePlayers", 20000);
  if (!res.ok) throw new Error(`TheHuddle player index request failed (${res.status})`);
  const json = (await res.json()) as { players?: HuddlePlayerLink[] };
  const links = Array.isArray(json.players) ? json.players : [];

  const entries = links.map((link) => ({
    nameKey: nameKeyFromSlug(link.slug),
    huddleId: link.id,
    slug: link.slug
  }));

  if (entries.length > 0) {
    await db.huddlePlayers.bulkPut(entries);
  }
  return entries.length;
}

export function huddleNewsUrl(entry: { huddleId: number; slug: string }): string {
  return `https://tools.thehuddle.com/player/${entry.huddleId}/${entry.slug}`;
}
