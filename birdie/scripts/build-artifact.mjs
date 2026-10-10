#!/usr/bin/env node
/**
 * Build Birdie as a Claude artifact (a phone-friendly demo with no server):
 *   node scripts/build-artifact.mjs
 * Produces web/dist-artifact/page.html (the artifact page body) and
 * web/dist-artifact/files.json (published path -> local file) for the Artifact tool.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const web = path.join(root, "web");
const out = path.join(web, "dist-artifact");

execSync("npx vite build", { cwd: web, stdio: "inherit", env: { ...process.env, VITE_TARGET: "artifact" } });

const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
const js = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"/g)].map((m) => m[1]);
if (!css.length || !js.length) throw new Error("Couldn't find the built CSS/JS in index.html");

// The artifact wraps this in its own <!doctype><head><body> skeleton.
const page = `<title>Birdie</title>
${css.map((h) => `<link rel="stylesheet" href="${h}">`).join("\n")}
<script>
  try {
    var s = JSON.parse(localStorage.getItem("birdie.state.v1") || "{}");
    document.documentElement.dataset.readerTheme = (s.prefs && s.prefs.theme) || "dark";
  } catch (e) {
    document.documentElement.dataset.readerTheme = "dark";
  }
</script>
<div id="root"></div>
${js.map((s) => `<script type="module" src="${s}"></script>`).join("\n")}
`;
fs.writeFileSync(path.join(out, "page.html"), page);

const files = {};
for (const f of fs.readdirSync(path.join(out, "assets"))) {
  // Latin subsets only: the corpus is English and every face has a fallback.
  if (/cyrillic|greek|vietnamese/.test(f)) continue;
  if (f.endsWith(".woff") && !f.endsWith(".woff2")) continue;
  files[`assets/${f}`] = path.relative(root, path.join(out, "assets", f));
}
fs.writeFileSync(path.join(out, "files.json"), JSON.stringify(files, null, 2));

// Drop the unused font files from the CSS so nothing points at a missing path.
for (const c of css) {
  const p = path.join(out, c.replace(/^\.\//, ""));
  let text = fs.readFileSync(p, "utf8");
  text = text.replace(/,?\s*url\([^)]*\.woff\)\s*format\("woff"\)/g, "");
  fs.writeFileSync(p, text);
}
console.log(`page.html + ${Object.keys(files).length} files ready in ${path.relative(root, out)}`);
