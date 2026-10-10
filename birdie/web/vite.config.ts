import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

const API = process.env.BIRDIE_API ?? "http://localhost:8787";

// `VITE_TARGET=artifact` builds the copy published as a Claude artifact: relative paths,
// no service worker (artifacts can't register one), output in dist-artifact/.
const ARTIFACT = process.env.VITE_TARGET === "artifact";

export default defineConfig({
  base: ARTIFACT ? "./" : "/",
  plugins: [
    react(),
    tailwindcss(),
    !ARTIFACT && VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Birdie",
        short_name: "Birdie",
        description: "Something worth knowing, whenever you have a few minutes.",
        theme_color: "#6f8d77",
        background_color: "#f1efe6",
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
        // The sign-in page and API always come from the server, never the offline cache.
        navigateFallbackDenylist: [/^\/api\//, /^\/login/],
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: { port: 5173, proxy: { "/api": { target: API, changeOrigin: true } } },
  preview: { proxy: { "/api": { target: API, changeOrigin: true } } },
  build: {
    chunkSizeWarningLimit: 1200,
    outDir: ARTIFACT ? "dist-artifact" : "dist",
    // viewer.html = the desktop phone-frame preview around the app.
    rollupOptions: { input: { index: path.resolve(import.meta.dirname, "index.html"), viewer: path.resolve(import.meta.dirname, "viewer.html") } },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
