#!/usr/bin/env node
/**
 * Build Birdie as a Claude artifact (a phone-friendly demo with no server):
 *   node scripts/build-artifact.mjs
 * Produces web/dist-artifact/page.html (the artifact page body: the phone-frame viewer),
 * app.html (the app it frames) and
 * web/dist-artifact/files.json (published path -> local file) for the Artifact tool.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const web = path.join(root, "web");
const out = path.join(web, "dist-artifact");

execSync("npx vite build", { cwd: web, stdio: "inherit", env: { ...process.env, VITE_TARGET: "artifact" } });

/** The CSS and JS a built HTML entry links to. */
function refs(file) {
  const html = fs.readFileSync(path.join(out, file), "utf8");
  const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  const js = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  if (!js.length) throw new Error(`Couldn't find the built JS in ${file}`);
  return { css, js };
}
const app = refs("index.html");
const viewer = refs("viewer.html");
if (!app.css.length) throw new Error("Couldn't find the built CSS in index.html");
const links = (r) => [...r.css.map((h) => `<link rel="stylesheet" href="${h}">`), ...r.js.map((s) => `<script type="module" src="${s}"></script>`)];

// The artifact page is the phone-frame viewer (full-bleed on phones). The artifact wraps it in
// its own <!doctype><head><body> skeleton.
const page = `<title>Birdie</title>
<script>
  try {
    var s = JSON.parse(localStorage.getItem("birdie.state.v1") || "{}");
    document.documentElement.dataset.desk = (s.prefs && s.prefs.theme) || "dark";
  } catch (e) {}
</script>
<div id="viewer" class="viewer"></div>
${links(viewer).join("\n")}
`;
fs.writeFileSync(path.join(out, "page.html"), page);

// The app itself, framed by the viewer. Extra HTML files are served as-is, so it is a full document.
const appHtml = `<!doctype html>
<html lang="en" data-reader-theme="dark" data-glass="on">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
<meta name="color-scheme" content="dark light">
<title>Birdie</title>
<script>
  try {
    var s = JSON.parse(localStorage.getItem("birdie.state.v1") || "{}");
    document.documentElement.dataset.readerTheme = (s.prefs && s.prefs.theme) || "dark";
    document.documentElement.dataset.glass = s.prefs && s.prefs.lab && s.prefs.lab.glass === false ? "off" : "on";
  } catch (e) {
    document.documentElement.dataset.readerTheme = "dark";
  }
</script>
${app.css.map((h) => `<link rel="stylesheet" href="${h}">`).join("\n")}
</head>
<body>
<div id="root"></div>
${app.js.map((s) => `<script type="module" src="${s}"></script>`).join("\n")}
</body>
</html>
`;
fs.writeFileSync(path.join(out, "app.html"), appHtml);
const css = [...app.css, ...viewer.css];

const files = { "app.html": path.relative(root, path.join(out, "app.html")) };
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
console.log(`page.html (viewer) + ${Object.keys(files).length} files ready in ${path.relative(root, out)}`);
