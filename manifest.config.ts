import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Ape Intel",
  version: "0.0.1",
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
  content_scripts: [
    {
      matches: ["https://de.scalable.capital/broker/security*"],
      js: ["src/content/index.tsx"],
      run_at: "document_idle",
    },
  ],
});
