import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [
    crx({
      manifest,
      browser: "firefox",
    }),
  ],
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "https://de.scalable.capital/",
      },
    },
    globals: true,
  },
});
