import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import mkcert from "vite-plugin-mkcert";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
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
        // App shell precache only; the player dataset is cached separately
        // (see src/lib/offlineCache.ts) after prep-step validation, never
        // opportunistically, so a bad refresh can't clobber good data.
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,ico}"],
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src")
    }
  }
}));
