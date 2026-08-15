import { pullBackup, pushBackup } from "./_lib/syncStore";

// Already gated by middleware.ts's Basic Auth (matches every route) —
// no separate auth here, same as api/adp.ts.
export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  const result =
    request.method === "GET"
      ? await pullBackup()
      : request.method === "PUT"
        ? await pushBackup(await request.text())
        : { status: 405, contentType: "application/json", body: JSON.stringify({ error: "Method not allowed" }) };

  return new Response(result.body, {
    status: result.status,
    headers: { "Content-Type": result.contentType, "Cache-Control": "no-store" }
  });
}
