import { proxyHuddlePlayers } from "./_lib/huddleProxy";

// Edge runtime: plain Web Request/Response, same reasoning as api/adp.ts.
export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const result = await proxyHuddlePlayers();
  return new Response(result.body, {
    status: result.status,
    headers: {
      "Content-Type": result.contentType,
      // Rosters don't change minute to minute — a few hours of edge
      // caching cuts repeat load on TheHuddle without going stale in any
      // way that matters for draft-day use.
      "Cache-Control": "s-maxage=14400, stale-while-revalidate=86400"
    }
  });
}
