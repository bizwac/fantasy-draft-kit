import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { requestPersistentStorage } from "./lib/persistence";
import { autoPullIfLocalEmpty, installCloudSyncHooks } from "./lib/cloudSync";
import { startAutoRefreshWatch } from "./lib/dataSources/autoRefresh";
import "./styles/index.css";

void requestPersistentStorage();
installCloudSyncHooks();
void autoPullIfLocalEmpty();
startAutoRefreshWatch();

// registerType "autoUpdate" only controls what the service worker does
// once the browser decides to check for one — and the browser's own
// check is tied to navigation, which a client-side-routed SPA barely
// does. Registering here (instead of the default auto-injected script,
// see vite.config.ts's injectRegister: false) lets us also poll
// explicitly, so a long-lived session — an installed Home Screen PWA
// especially, which can sit open/backgrounded for days — actually picks
// up a new deploy instead of silently running stale code indefinitely.
//
// Finding a new SW isn't enough on its own, though: skipWaiting +
// clientsClaim (vite.config.ts) let the new worker take over instantly,
// but a tab that's already loaded keeps running the OLD JS it has in
// memory until something reloads it — this is exactly what left the
// site stuck showing a removed feature (Pre-Draft Checklist) on a phone
// that hadn't been reloaded since before a deploy. `controllerchange`
// fires the instant the new worker actually takes control, so reloading
// there closes the loop automatically. Safe to do unconditionally here:
// every pick/draft write already lands in IndexedDB immediately (see
// pickRepo.ts), so a reload can't lose draft data — worst case it clears
// something transient like an unsaved note or closes an open panel.
let refreshedForUpdate = false;
navigator.serviceWorker?.addEventListener("controllerchange", () => {
  if (refreshedForUpdate) return;
  refreshedForUpdate = true;
  window.location.reload();
});

registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    setInterval(() => void registration.update(), 60 * 60 * 1000);
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
