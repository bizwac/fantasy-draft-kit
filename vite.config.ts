import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import mkcert from "vite-plugin-mkcert";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { proxyAdpRequest } from "./api/_lib/adpProxy.ts";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Mirrors api/adp.ts so `npm run dev` behaves the same as the deployed
// Vercel function without needing `vercel dev`.
function adpDevProxyPlugin(): Plugin {
  return {
    name: "adp-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/api/adp", async (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const result = await proxyAdpRequest(url.searchParams);
        res.statusCode = result.status;
        res.setHeader("Content-Type", result.contentType);
        res.end(result.body);
      });
    }
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    adpDevProxyPlugin(),
    // Yahoo OAuth requires an HTTPS redirect URI even for localhost.
    command === "serve" && mkcert(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["brand/icon-mono-512.png"],
      manifest: {
        name: "Fade Signal — Draft-Day Kit",
        short_name: "Fade Signal",
        description: "Offline-capable fantasy football draft-day kit.",
        theme_color: "#202327",
        background_color: "#202327",
        display: "standalone",
        orientation: "landscape",
        icons: [
          { src: "/brand/icon-dark-192.png", sizes: "192x192", type: "image/png" },
          { src: "/brand/icon-dark-512.png", sizes: "512x512", type: "image/png" },
          { src: "/brand/icon-dark-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        // App shell precache only; the player dataset lives in IndexedDB
        // (see src/lib/dataSources/refresh.ts), written only after full
        // validation, so a bad refresh can't clobber good cached data.
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,ico}"],
        navigateFallbackDenylist: [/^\/api\//],
        // Versioned precache + purge old caches on activate (spec §7b.5)
        // so a bad deploy can't strand the user on stale cached code.
        cleanupOutdatedCaches: true,
        clientsClaim: true
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src")
    }
  }
}));
