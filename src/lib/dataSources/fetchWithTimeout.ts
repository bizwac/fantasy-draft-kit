// Shared fetch wrapper for the prep-step network calls (spec §7b.2):
// bounded timeout, no following of redirects, and no throwing on
// non-2xx — callers decide how to fail soft. Used for both the external
// Sleeper API and our own same-origin /api/adp proxy (ffcalc.ts), which
// sits behind the site's Basic Auth middleware.
//
// No explicit `credentials` here — fetch's default, "same-origin", is
// what both callers actually need: it sends the cached Basic Auth
// credentials to /api/adp (same-origin) but still omits them for the
// cross-origin Sleeper call. An earlier explicit "omit" broke ADP
// refresh specifically on iOS Safari, which enforces the fetch spec's
// "omit means don't consult the HTTP auth cache" rule more strictly
// than desktop Chrome does — the request reached /api/adp without the
// site's auth, got a 401, and ADP silently failed while Sleeper (never
// needed the auth cache) kept working.
export async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "error"
    });
  } finally {
    clearTimeout(timer);
  }
}
