// @ts-check
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";

// The Wix packages are replaced by small stand-ins backed by Cloudflare D1, so
// the pages and lib code keep their imports unchanged (see src/platform/).
const shim = (file) => fileURLToPath(new URL(`./src/platform/wix/${file}`, import.meta.url));

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: cloudflare({ platformProxy: { enabled: true }, imageService: "passthrough" }),
  integrations: [tailwind(), react()],
  vite: {
    resolve: {
      alias: {
        "@wix/data": shim("data.ts"),
        "@wix/essentials": shim("stubs.ts"),
        "@wix/members": shim("stubs.ts"),
        "@wix/ecom": shim("stubs.ts"),
        "@wix/redirects": shim("stubs.ts"),
        "@wix/astro-pages": shim("stubs.ts"),
      },
    },
    cacheDir: "node_modules/.cache/.vite",
  },
  devToolbar: {
    enabled: false,
  },
  image: {
    domains: ["static.wixstatic.com"],
  },
});
