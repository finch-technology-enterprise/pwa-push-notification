import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

function suppressDeprecatedWarning(): Plugin {
  return {
    name: "suppress-deprecated-warning",
    config(config) {
      config.build ??= {};
      config.build.rollupOptions ??= {};
      const onwarn = config.build.rollupOptions.onwarn;
      config.build.rollupOptions.onwarn = (warning, warn) => {
        if (warning.message?.includes("inlineDynamicImports")) return;
        if (typeof onwarn === "function") onwarn(warning, warn);
        else warn(warning);
      };
    },
  };
}

export default defineConfig(({ mode }) => ({
  build: {
    outDir: "build",
    assetsDir: "static/media",
    sourcemap: true,
  },
  server: {
    port: 3000,
    proxy: {
      "/v1": "http://localhost:8787",
      "/config.js": "http://localhost:8787",
    },
  },
  plugins: [
    react(),
    suppressDeprecatedWarning(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      strategies: "injectManifest",
      devOptions: {
        enabled: true,
        type: "module",
        navigateFallback: "index.html",
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
        globIgnores: ["config.js", "app.html"],
        manifestTransforms: [
          (entries) => ({
            manifest: entries.map((entry) =>
              entry.url === "index.html"
                ? { ...entry, url: "app.html" }
                : entry,
            ),
          }),
        ],
      },
      manifest:
        mode === "development"
          ? {
              theme_color: "#317f6f",
              icons: [
                {
                  src: "/static/images/pwa-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
              ],
            }
          : false,
    }),
  ],
}));
