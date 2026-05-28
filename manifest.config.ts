import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Ape Intel",
  version: "0.0.6",
  description:
    "Community sentiment + news panel for Scalable Capital security pages.",
  browser_specific_settings: {
    gecko: {
      id: "ape-intel@lmueller.dev",
      strict_min_version: "121.0",
      data_collection_permissions: {
        required: ["none"],
      },
    },
  },
  permissions: ["storage"],
  host_permissions: [
    "https://api.openfigi.com/*",
    "https://apewisdom.io/*",
    "https://tradestie.com/*",
    "https://api.stocktwits.com/*",
  ],
  background: {
    scripts: ["src/background/index.ts"],
  },
  content_scripts: [
    {
      matches: ["https://de.scalable.capital/broker/security*"],
      js: ["src/content/index.tsx"],
      run_at: "document_idle",
    },
  ],
});
