import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

const API = process.env.BIRDIE_API ?? "http://localhost:8787";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Birdie",
        short_name: "Birdie",
        description: "Something worth knowing, whenever you have a few minutes.",
        theme_color: "#121212",
        background_color: "#121212",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        globIgnores: ["**/*cyrillic*", "**/*greek*", "**/*vietnamese*"],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: { port: 5173, proxy: { "/api": { target: API, changeOrigin: true } } },
  preview: { proxy: { "/api": { target: API, changeOrigin: true } } },
  build: { chunkSizeWarningLimit: 1200 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
