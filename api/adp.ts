import { proxyAdpRequest } from "./_lib/adpProxy";

// Edge runtime: plain Web Request/Response, no Node-specific API surface,
// no @vercel/node dependency to drift out of sync with Vercel's actual
// runtime shape.
export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const url = new URL(request.url);
  const result = await proxyAdpRequest(url.searchParams);
  return new Response(result.body, {
    status: result.status,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400"
    }
  });
}
