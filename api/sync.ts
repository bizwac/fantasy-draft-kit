// Node's own ESM loader resolves this import at runtime (Vercel's Node
// function builder doesn't inline multi-file functions into one bundle
// the way the Edge builder does) — and unlike TypeScript/bundler
// resolution, Node's ESM loader requires the explicit extension on a
// relative import. Omitting it here previously produced
// ERR_MODULE_NOT_FOUND in production despite building and typechecking
// fine locally (Bundler resolution mode doesn't require it).
import { pullBackup, pushBackup } from "./_lib/syncStore.js";

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
