import type { VercelRequest, VercelResponse } from "@vercel/node";
import { proxyAdpRequest } from "./_lib/adpProxy";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const params = new URLSearchParams();
  for (const key of ["format", "teams", "year"]) {
    const value = req.query[key];
    if (typeof value === "string") params.set(key, value);
  }

  const result = await proxyAdpRequest(params);
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.status(result.status).setHeader("Content-Type", result.contentType).send(result.body);
}
