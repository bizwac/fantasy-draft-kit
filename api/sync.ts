import { pullBackup, pushBackup } from "./_lib/syncStore";

// Already gated by middleware.ts's Basic Auth (matches every route) —
// no separate auth here, same as api/adp.ts.
//
// Node.js runtime (the default — no `config.runtime = "edge"` here),
// unlike api/adp.ts. @vercel/blob's package directly imports Node
// built-ins (crypto, stream, undici) with no Edge-runtime export
// condition declared, so bundling it for Edge fails at build time.
// Node's runtime still supports this same Web-standard
// Request/Response handler shape, so the code otherwise looks identical
// to the Edge functions in this project.
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
