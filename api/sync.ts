import type { IncomingMessage, ServerResponse } from "node:http";
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
// Node.js runtime (the default — no `config.runtime = "edge"` here);
// @vercel/blob's package directly imports Node built-ins (crypto,
// stream, undici) with no Edge-runtime export condition declared, so
// bundling it for Edge fails at build time (unlike api/adp.ts, which is
// pure fetch and runs fine on Edge).
//
// This previously used the Web-standard (request: Request) => Response
// shape that works on Edge, on the assumption Node functions support it
// too — they don't, at least not on this account/platform version.
// Production threw "request.text is not a function": what's actually
// handed to a Node function handler here is a plain Node
// http.IncomingMessage, not a Fetch API Request. Written against the
// raw Node http primitives instead, which is unambiguous regardless of
// whatever convenience wrapping Vercel does or doesn't add on top.
async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const result =
    req.method === "GET"
      ? await pullBackup()
      : req.method === "PUT"
        ? await pushBackup(await readBody(req))
        : { status: 405, contentType: "application/json", body: JSON.stringify({ error: "Method not allowed" }) };

  res.statusCode = result.status;
  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Cache-Control", "no-store");
  res.end(result.body);
}
