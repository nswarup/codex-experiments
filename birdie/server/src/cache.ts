/**
 * A small on-disk cache of finished articles, keyed by the normalised subject, so a
 * subject Birdie has already written comes back instantly instead of being rewritten.
 * Lives in server/.cache/topics.json (gitignored). Set BIRDIE_CACHE=off to disable.
 */
import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve(import.meta.dirname, "..", ".cache");
const FILE = path.join(DIR, "topics.json");
const MAX = 500;
const enabled = process.env.BIRDIE_CACHE !== "off" && process.env.NODE_ENV !== "test";

let store: Record<string, { text: string; at: number }> = {};
if (enabled) {
  try {
    store = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    store = {};
  }
}

const key = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");

export function cacheGet(query: string): string | undefined {
  return enabled ? store[key(query)]?.text : undefined;
}

export function cachePut(query: string, text: string) {
  if (!enabled) return;
  store[key(query)] = { text, at: Date.now() };
  const keys = Object.keys(store);
  if (keys.length > MAX) {
    keys.sort((a, b) => store[a].at - store[b].at).slice(0, keys.length - MAX).forEach((k) => delete store[k]);
  }
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(store));
  } catch {
    /* read-only disk: keep the in-memory copy */
  }
}
