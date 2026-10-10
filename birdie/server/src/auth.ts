/**
 * A single shared password in front of the whole app (pages, assets and API).
 *
 * Set BIRDIE_PASSWORD to turn it on; leave it unset for local development. A correct
 * password sets a signed, HttpOnly session cookie that lasts 90 days. Changing the
 * password (or BIRDIE_SECRET) signs everyone out.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

const COOKIE = "birdie_session";
const MAX_AGE = 90 * 24 * 60 * 60; // seconds

export const password = () => process.env.BIRDIE_PASSWORD || "";
export const authEnabled = () => password().length > 0;

function key(): Buffer {
  // Without an explicit secret, derive one from the password so a new password ends old sessions.
  return createHash("sha256").update(`birdie:${process.env.BIRDIE_SECRET || ""}:${password()}`).digest();
}

function sign(issued: string): string {
  return createHmac("sha256", key()).update(issued).digest("base64url");
}

function sameSecret(a: string, b: string): boolean {
  // Hash first so lengths always match and timing reveals nothing about the password.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function isAuthed(c: Context): boolean {
  if (!authEnabled()) return true;
  const raw = getCookie(c, COOKIE);
  if (!raw) return false;
  const [issued, mac] = raw.split(".");
  if (!issued || !mac || !sameSecret(mac, sign(issued))) return false;
  const age = Date.now() / 1000 - Number(issued);
  return Number.isFinite(age) && age >= 0 && age < MAX_AGE;
}

const secure = (c: Context) =>
  c.req.header("x-forwarded-proto") === "https" || new URL(c.req.url).protocol === "https:";

/* Slow down guessing: 8 tries per 15 minutes per address. */
const attempts = new Map<string, number[]>();
const WINDOW = 15 * 60_000;
const TRIES = 8;

export async function login(c: Context) {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (recent.length >= TRIES) return c.json({ error: "Too many tries. Wait a few minutes and try again." }, 429);
  const body = (await c.req.json().catch(() => null)) as { password?: unknown } | null;
  const given = typeof body?.password === "string" ? body.password : "";
  if (!authEnabled() || !sameSecret(given, password())) {
    recent.push(now);
    attempts.set(ip, recent);
    return c.json({ error: "That's not it. Try again." }, 401);
  }
  attempts.delete(ip);
  const issued = String(Math.floor(now / 1000));
  setCookie(c, COOKIE, `${issued}.${sign(issued)}`, {
    httpOnly: true,
    secure: secure(c),
    sameSite: "Lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return c.json({ ok: true });
}

export function logout(c: Context) {
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
}

/** Everything needs a session except the login page itself, logging in, and a bare health check. */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (isAuthed(c)) return next();
  const path = new URL(c.req.url).pathname;
  if (path === "/login" || path === "/api/login" || path === "/api/health" || path === "/icon.svg") return next();
  if (path.startsWith("/api/")) return c.json({ error: "Please sign in again." }, 401);
  const nextPath = path === "/" ? "" : `?next=${encodeURIComponent(path)}`;
  return c.redirect(`/login${nextPath}`, 302);
};

/** The sign-in page: one field, Birdie's look, the reader's theme. Self-contained, no app code. */
export function loginPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#121212">
<title>Birdie</title>
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<style>
  :root { --bg:#121212; --text:#cfc8ba; --strong:#e2dbcd; --muted:#9a9284; --line:#322f2b; --field:#1d1c19; --accent:#cfc8ba; --accent-fg:#121212; --danger:#d88a72; color-scheme: dark; }
  [data-t="sepia"] { --bg:#f4ecd8; --text:#5b4636; --strong:#3f2f22; --muted:#6b5743; --line:#e2d6bc; --field:#efe4cc; --accent:#5b4636; --accent-fg:#f8f1e1; --danger:#a4442c; color-scheme: light; }
  [data-t="light"] { --bg:#fbfaf7; --text:#1c1c1c; --strong:#161412; --muted:#5f5b55; --line:#e3dfd7; --field:#f3f0ea; --accent:#2a2723; --accent-fg:#fbfaf7; --danger:#b23c22; color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { background: var(--bg); color: var(--text); font: 16px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
  main { min-height: 100%; display: flex; flex-direction: column; justify-content: center; max-width: 400px; margin: 0 auto; padding: calc(env(safe-area-inset-top,0px) + 24px) 24px calc(env(safe-area-inset-bottom,0px) + 32px); }
  .mark { font: italic 500 22px/1 "Literata", Georgia, serif; color: var(--strong); }
  h1 { margin: 40px 0 0; font: 500 28px/1.15 "Literata", Georgia, serif; letter-spacing: -0.01em; color: var(--strong); }
  p.sub { margin: 10px 0 28px; color: var(--muted); font-size: 15px; }
  label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .field { display: flex; align-items: center; height: 52px; border-radius: 999px; background: var(--field); box-shadow: inset 0 0 0 1px var(--line); padding: 0 6px 0 20px; transition: box-shadow .15s ease; }
  .field:focus-within { box-shadow: inset 0 0 0 1.5px var(--strong); }
  .field.bad { animation: shake .32s cubic-bezier(.36,.07,.19,.97); box-shadow: inset 0 0 0 1.5px var(--danger); }
  input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; color: var(--strong); font: inherit; font-size: 16px; }
  input::placeholder { color: var(--muted); }
  .show { height: 40px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: var(--muted); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  button.go { margin-top: 12px; width: 100%; height: 52px; border: 0; border-radius: 999px; background: var(--accent); color: var(--accent-fg); font-family: inherit; font-size: 16px; font-weight: 600; letter-spacing: -0.005em; cursor: pointer; transition: opacity .15s ease, transform .12s ease; }
  button.go:active { transform: scale(.98); }
  button.go[disabled] { opacity: .55; cursor: default; }
  .err { min-height: 22px; margin: 12px 4px 0; color: var(--danger); font-size: 14px; }
  :focus-visible { outline: 2px solid var(--muted); outline-offset: 2px; }
  /* The rounded field shows focus itself; no square outline inside it. */
  input:focus-visible { outline: none; }
  @keyframes shake { 20%,60% { transform: translateX(-6px); } 40%,80% { transform: translateX(6px); } }
  @media (prefers-reduced-motion: reduce) { .field.bad { animation: none; } button.go { transition: none; } }
</style>
<script>
  // Same origin as the app: open in the reader's own theme.
  try { var s = JSON.parse(localStorage.getItem("birdie.state.v1") || "{}"); var t = s.prefs && s.prefs.theme; if (t) document.documentElement.dataset.t = t; } catch (e) {}
</script>
</head>
<body>
<main>
  <div class="mark">birdie</div>
  <h1>Something worth knowing</h1>
  <p class="sub">Enter the password to start reading.</p>
  <form id="f" novalidate>
    <label for="pw">Password</label>
    <div class="field" id="box">
      <input id="pw" name="password" type="password" autocomplete="current-password" enterkeyhint="go" placeholder="Password" autofocus required>
      <button type="button" class="show" id="show" aria-pressed="false">Show</button>
    </div>
    <button class="go" id="go" type="submit">Continue</button>
    <div class="err" id="err" role="alert" aria-live="polite"></div>
  </form>
</main>
<script>
  var f = document.getElementById("f"), pw = document.getElementById("pw"), go = document.getElementById("go"),
      err = document.getElementById("err"), box = document.getElementById("box"), show = document.getElementById("show");
  show.addEventListener("click", function () {
    var on = pw.type === "password"; pw.type = on ? "text" : "password";
    show.textContent = on ? "Hide" : "Show"; show.setAttribute("aria-pressed", String(on)); pw.focus();
  });
  pw.addEventListener("input", function () { err.textContent = ""; box.classList.remove("bad"); });
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!pw.value) { pw.focus(); return; }
    go.disabled = true; go.textContent = "Checking…";
    fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw.value }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok) {
          var next = new URLSearchParams(location.search).get("next") || "/";
          location.replace(next.charAt(0) === "/" && next.charAt(1) !== "/" ? next : "/");
          return;
        }
        err.textContent = (res.j && res.j.error) || "Something went wrong. Try again.";
        box.classList.remove("bad"); void box.offsetWidth; box.classList.add("bad");
        pw.select();
        go.disabled = false; go.textContent = "Continue";
      })
      .catch(function () {
        err.textContent = "Can't reach Birdie right now. Check your connection.";
        go.disabled = false; go.textContent = "Continue";
      });
  });
</script>
</body>
</html>`;
}
