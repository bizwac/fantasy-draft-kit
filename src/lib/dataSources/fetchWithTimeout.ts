// Shared fetch wrapper for the prep-step network calls (spec §7b.2):
// bounded timeout, no following of redirects, and no throwing on
// non-2xx — callers decide how to fail soft.
export async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "error",
      credentials: "omit"
    });
  } finally {
    clearTimeout(timer);
  }
}
