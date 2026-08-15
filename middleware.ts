// Gates the entire deployed site behind HTTP Basic Auth. This is a
// personal single-user tool with no accounts of its own, so a
// full auth system would be pure overhead — Basic Auth checked here at
// the edge (credentials never touch the client bundle, compared server-
// side against Vercel env vars) is the standard lightweight way to keep
// a personal deployment private. Browsers cache the credentials for the
// origin once entered, so this is a one-time prompt in practice.
//
// Runs before every request, including static assets and /api/adp —
// also closes off the ADP proxy from anonymous internet use.
export const config = {
  matcher: "/(.*)"
};

// The browser's own PWA machinery (manifest link, service worker
// registration/update check) fetches these without replaying cached
// Basic Auth credentials the way a normal navigation does — they 401
// silently instead of prompting, which breaks install/offline-refresh
// even for an already-authenticated user. None of these leak anything
// sensitive (brand assets + app shell code, no draft data), so they're
// exempt from the gate; everything else, including /api, stays behind it.
const PUBLIC_PATHS = /^\/(manifest\.webmanifest|sw\.js|registerSW\.js|workbox-[\w-]+\.js|brand\/.*\.png)$/;

function unauthorized(): Response {
  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Fade Signal", charset="UTF-8"' }
  });
}

export default function middleware(request: Request): Response | undefined {
  const { pathname } = new URL(request.url);
  if (PUBLIC_PATHS.test(pathname)) {
    return undefined;
  }

  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASS;

  // Fail closed only if credentials are actually configured; if the env
  // vars aren't set (e.g. a preview deploy without them), don't lock
  // everyone out silently — that's a deploy misconfiguration to notice
  // via the missing env var, not something this file should paper over.
  if (!expectedUser || !expectedPass) {
    return unauthorized();
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);
    if (user === expectedUser && pass === expectedPass) {
      return undefined; // let the request through
    }
  }

  return unauthorized();
}
