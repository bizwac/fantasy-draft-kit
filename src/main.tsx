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
