import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

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
        globIgnores: ["config.js"],
        // ponytail: no app.html mapping needed; we serve index.html directly
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
