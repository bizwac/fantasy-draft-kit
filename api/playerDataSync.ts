import type { IncomingMessage, ServerResponse } from "node:http";
// See api/sync.ts for why this needs the explicit .js extension and the
// raw Node http handler shape instead of the Web-standard Request/
// Response one — same Node-function constraints apply here.
import { pullPlayerDataTable, pushPlayerDataTable } from "./_lib/syncStore.js";

// Already gated by middleware.ts's Basic Auth (matches every route) —
// no separate auth here, same as api/sync.ts and api/adp.ts.
//
// Node.js runtime (the default), same reason as api/sync.ts: @vercel/
// blob isn't Edge-compatible.
async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "", "http://localhost");
  const table = url.searchParams.get("table") ?? "";

  const result =
    req.method === "GET"
      ? await pullPlayerDataTable(table)
      : req.method === "PUT"
        ? await pushPlayerDataTable(table, await readBody(req))
        : { status: 405, contentType: "application/json", body: JSON.stringify({ error: "Method not allowed" }) };

  res.statusCode = result.status;
  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Cache-Control", "no-store");
  res.end(result.body);
}
