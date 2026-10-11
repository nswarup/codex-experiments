import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import fs from "node:fs";

const TOPICS_DIR = path.resolve(import.meta.dirname, "src/content/topics");
const WORD = /[A-Za-z0-9'’]+/g;

/**
 * `virtual:corpus-index`: the small part of every library topic that ranking, nudges, search
 * and peeks need (no lede or bullets). Article bodies load on demand, so the first download
 * stays small however large the library grows.
 */
function corpusIndex() {
  const ID = "virtual:corpus-index";
  const RESOLVED = "\0" + ID;
  return {
    name: "birdie-corpus-index",
    resolveId: (id: string) => (id === ID ? RESOLVED : undefined),
    load(this: { addWatchFile(f: string): void }, id: string) {
      if (id !== RESOLVED) return;
      const files = fs.readdirSync(TOPICS_DIR).filter((f) => f.endsWith(".json")).sort();
      const index = files.map((f) => {
        const file = path.join(TOPICS_DIR, f);
        this.addWatchFile(file);
        const t = JSON.parse(fs.readFileSync(file, "utf8"));
        const words =
          (t.lede.match(WORD)?.length ?? 0) + t.bullets.reduce((n: number, b: { text: string }) => n + (b.text.match(WORD)?.length ?? 0), 0);
        return { id: t.id, title: t.title, category: t.category, hook: t.hook, peek: t.peek, tags: t.tags, related: t.related, words };
      });
      return `export default ${JSON.stringify(index)};`;
    },
  };
}

const API = process.env.BIRDIE_API ?? "http://localhost:8787";

// `VITE_TARGET=artifact` builds the copy published as a Claude artifact: relative paths,
// no service worker (artifacts can't register one), output in dist-artifact/.
const ARTIFACT = process.env.VITE_TARGET === "artifact";

export default defineConfig({
  base: ARTIFACT ? "./" : "/",
  plugins: [
    corpusIndex(),
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
    rollupOptions: {
      input: { index: path.resolve(import.meta.dirname, "index.html"), viewer: path.resolve(import.meta.dirname, "viewer.html") },
      // The artifact host caps how many files a page can publish, so its copy keeps every
      // article body in one chunk. The web app loads each body as its own small file.
      output: ARTIFACT ? { manualChunks: (id: string) => (id.includes("/content/topics/") ? "corpus" : undefined) } : undefined,
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
