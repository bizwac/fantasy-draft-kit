// Fantasy Football Calculator's ADP API has no CORS headers, so a
// browser can't call it directly (confirmed: curl gets a clean 200,
// browser fetch gets a CORS-blocked "Failed to fetch"). This is the one
// piece of server code in an otherwise fully static/offline app — a
// same-origin passthrough with no auth, no secrets, no state. Shared
// between the Vercel function (api/adp.ts) and the Vite dev-server
// middleware (vite.config.ts) so local dev and prod behave identically.

const UPSTREAM_BASE = "https://fantasyfootballcalculator.com/api/v1/adp";
const ALLOWED_FORMATS = new Set(["ppr", "half-ppr", "standard"]);

export interface AdpProxyResult {
  status: number;
  contentType: string;
  body: string;
}

function badRequest(message: string): AdpProxyResult {
  return { status: 400, contentType: "application/json", body: JSON.stringify({ error: message }) };
}

export async function proxyAdpRequest(params: URLSearchParams): Promise<AdpProxyResult> {
  const format = params.get("format") ?? "";
  const teamsRaw = params.get("teams") ?? "";
  const yearRaw = params.get("year") ?? "";

  if (!ALLOWED_FORMATS.has(format)) {
    return badRequest(`format must be one of: ${[...ALLOWED_FORMATS].join(", ")}`);
  }
  const teams = Number(teamsRaw);
  if (!Number.isInteger(teams) || teams < 2 || teams > 20) {
    return badRequest("teams must be an integer between 2 and 20");
  }
  const year = Number(yearRaw);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return badRequest("year must be a plausible 4-digit year");
  }

  const upstreamUrl = `${UPSTREAM_BASE}/${format}?teams=${teams}&year=${year}`;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(10000)
    });
  } catch (err) {
    return {
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: `Upstream fetch failed: ${(err as Error).message}` })
    };
  }

  const text = await upstreamRes.text();
  if (!upstreamRes.ok) {
    return { status: 502, contentType: "application/json", body: JSON.stringify({ error: `Upstream returned ${upstreamRes.status}` }) };
  }
  return { status: 200, contentType: "application/json", body: text };
}
