import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Ape Intel",
  version: "0.0.13",
  description:
    "Community sentiment + news panel for supported broker security pages.",
  action: {
    default_title: "Ape Intel — Trending",
    default_popup: "src/popup/index.html",
  },
  options_ui: {
    page: "src/options/index.html",
    open_in_tab: true,
  },
  browser_specific_settings: {
    gecko: {
      id: "ape-intel@lmueller.dev",
      strict_min_version: "121.0",
      data_collection_permissions: {
        required: ["none"],
      },
    },
  },
  permissions: ["storage", "alarms"],
  host_permissions: [
    "https://api.openfigi.com/*",
    "https://apewisdom.io/*",
    "https://api.tradestie.com/*",
    "https://api.stocktwits.com/*",
    "https://finnhub.io/*",
  ],
  background: {
    scripts: ["src/background/index.ts"],
  },
  content_scripts: [
    {
      // Per-broker URL filtering happens in the Broker registry (src/lib/isin.ts).
      // Scalable narrows to the security path; Smartbroker+ is an SPA with a
      // variable /p/<portfolioId>/ segment, so we match the host broadly and let
      // the registry + observeIsin pick out asset pages regardless of entry point.
      matches: [
        "https://de.scalable.capital/broker/security*",
        "https://app.smartbrokerplus.de/*",
      ],
      js: ["src/content/index.tsx"],
      run_at: "document_idle",
    },
  ],
});
