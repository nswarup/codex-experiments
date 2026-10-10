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

/** On Vercel, a missing password means "not set up yet": stay closed rather than open. */
export const misconfigured = () => !!process.env.VERCEL && !authEnabled();

export function isAuthed(c: Context): boolean {
  if (!authEnabled()) return !misconfigured();
  return validSession(getCookie(c, COOKIE));
}

/** Checks a raw session cookie value (shared with the Vercel middleware). */
export function validSession(raw: string | undefined): boolean {
  if (!authEnabled()) return !misconfigured();
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
  if (misconfigured()) return c.html(setupPage(), 503);
  if (isAuthed(c)) return next();
  const path = new URL(c.req.url).pathname;
  if (path === "/login" || path === "/api/login" || path === "/api/health" || path === "/icon.svg" || path === "/icon-192.png") return next();
  if (path.startsWith("/api/")) return c.json({ error: "Please sign in again." }, 401);
  const nextPath = path === "/" ? "" : `?next=${encodeURIComponent(path)}`;
  return c.redirect(`/login${nextPath}`, 302);
};

export const SESSION_COOKIE = COOKIE;

/* ------------------------------------------------------------------ */
/* Sign-in and setup pages: the sage brand, self-contained (no app code). */
/* ------------------------------------------------------------------ */

const MARK = `<svg aria-hidden="true" width="30" height="30" viewBox="0 0 64 64"><path d="M45 13a9 9 0 0 1 8.6 6.4L61 21.5l-7 3.2C53 40 41 52 25 52H5l9-8.5C10.5 39 10 33 12.6 28 17 19.5 27 16 35.5 19.2 37.4 15.5 41 13 45 13z" fill="#f1efe6"/><path d="M15 44C17 31 28 24.5 43 27c-3.5 12-14 18-28 17z" fill="#3f5a48"/><circle cx="47" cy="19.5" r="2.2" fill="#6f8d77"/></svg>`;

/** A starling cloud drawn once at startup: small "v" birds on a golden-angle spiral. */
const FLOCK = (() => {
  const f = (v: number) => v.toFixed(1);
  const paths: string[] = [];
  const count = 46;
  for (let i = 0; i < count; i++) {
    const a = i * 2.39996;
    const r = Math.sqrt((i + 0.5) / count);
    const x = 215 + Math.cos(a) * r * 175 + Math.sin(i * 1.3) * 8;
    const y = 230 + Math.sin(a) * r * 110 + Math.sin(a * 2) * 14;
    const sz = 3.4 + ((i * 7) % 5) * 0.75;
    const lead = i % 4 === 0;
    paths.push(
      `<path d="M${f(x - sz)} ${f(y)}Q${f(x - sz / 2)} ${f(y - sz)} ${f(x)} ${f(y - sz * 0.12)}Q${f(x + sz / 2)} ${f(y - sz)} ${f(x + sz)} ${f(y)}" stroke="${lead ? "#2f4536" : "#f1efe6"}" stroke-width="${lead ? 1.9 : 1.5}"/>`,
    );
  }
  return `<svg class="flock" aria-hidden="true" viewBox="0 0 390 400" preserveAspectRatio="xMidYMid slice" fill="none" stroke-linecap="round" stroke-linejoin="round">${paths.join("")}</svg>`;
})();

const BRAND_CSS = `
  :root { --sage:#6f8d77; --deep:#3f5a48; --ink:#1e2620; --muted:#5e6b62; --cream:#f1efe6; --field:#e6e6da; --line:#c9cfc6; --inset:#e1e2d6; --danger:#a3402a; color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { background: var(--sage); color: var(--ink); font: 16px/1.4 "Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
  .page { min-height: 100%; max-width: 560px; margin: 0 auto; display: flex; flex-direction: column; }
  .sky { position: relative; flex: 0 0 clamp(240px, 42dvh, 380px); overflow: hidden; }
  .flock { position: absolute; inset: 0; width: 100%; height: 100%; }
  .brand { position: absolute; top: calc(env(safe-area-inset-top,0px) + 20px); left: 24px; display: flex; align-items: center; gap: 8px; color: var(--cream); font-size: 19px; font-weight: 700; letter-spacing: -0.02em; }
  .sheet { flex: 1; background: var(--cream); border-radius: 30px 30px 0 0; padding: 32px 24px calc(env(safe-area-inset-bottom,0px) + 32px); }
  h1 { margin: 0; font-size: 32px; line-height: 1.05; font-weight: 600; letter-spacing: -0.035em; }
  p.sub { margin: 10px 0 22px; color: var(--muted); font-size: 15px; }
  code { background: var(--field); padding: 2px 6px; border-radius: 6px; }
`;

const page = (body: string, script = "") => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#6f8d77">
<title>Birdie</title>
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/icon-192.png">
<style>${BRAND_CSS}
  label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .field { display: flex; align-items: center; height: 54px; border-radius: 999px; background: var(--field); box-shadow: inset 0 0 0 1px var(--line); padding: 0 6px 0 20px; transition: box-shadow .15s ease; }
  .field:focus-within { box-shadow: inset 0 0 0 1.5px var(--deep); }
  .field.bad { animation: shake .32s cubic-bezier(.36,.07,.19,.97); box-shadow: inset 0 0 0 1.5px var(--danger); }
  input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; color: var(--ink); font: inherit; font-size: 16px; }
  input::placeholder { color: #6b756d; }
  .show { height: 42px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: var(--deep); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  button.go { margin-top: 14px; width: 100%; height: 54px; border: 0; border-radius: 999px; background: var(--deep); color: var(--cream); font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; transition: opacity .15s ease, transform .12s ease; }
  button.go:active { transform: scale(.98); }
  button.go[disabled] { background: var(--inset); color: var(--muted); cursor: default; }
  .err { min-height: 22px; margin: 12px 4px 0; color: var(--danger); font-size: 14px; }
  :focus-visible { outline: 2px solid var(--deep); outline-offset: 2px; }
  input:focus-visible { outline: none; }
  @keyframes shake { 20%,60% { transform: translateX(-6px); } 40%,80% { transform: translateX(6px); } }
  @media (prefers-reduced-motion: reduce) { .field.bad { animation: none; } button.go { transition: none; } }
</style>
</head>
<body>
<div class="page">
  <div class="sky">${FLOCK}<div class="brand">${MARK}<span>birdie</span></div></div>
  <main class="sheet">${body}</main>
</div>
${script}
</body>
</html>`;

/** Shown on a Vercel deploy that has no BIRDIE_PASSWORD yet. */
export function setupPage(): string {
  return page(
    `<h1>Almost ready</h1><p class="sub">This Birdie is locked until a password is set. In Vercel, add <code>BIRDIE_PASSWORD</code> (and <code>ANTHROPIC_API_KEY</code>) under Project Settings → Environment Variables, then redeploy.</p>`,
  );
}

/** The sign-in page: one field and the sage brand. Self-contained, no app code. */
export function loginPage(): string {
  return page(
    `<h1>Something worth knowing</h1>
  <p class="sub">Enter the password to start reading.</p>
  <form id="f" novalidate>
    <label for="pw">Password</label>
    <div class="field" id="box">
      <input id="pw" name="password" type="password" autocomplete="current-password" enterkeyhint="go" placeholder="Password" autofocus required>
      <button type="button" class="show" id="show" aria-pressed="false">Show</button>
    </div>
    <button class="go" id="go" type="submit" disabled>Continue</button>
    <div class="err" id="err" role="alert" aria-live="polite"></div>
  </form>`,
    `<script>
  var f = document.getElementById("f"), pw = document.getElementById("pw"), go = document.getElementById("go"),
      err = document.getElementById("err"), box = document.getElementById("box"), show = document.getElementById("show");
  show.addEventListener("click", function () {
    var on = pw.type === "password"; pw.type = on ? "text" : "password";
    show.textContent = on ? "Hide" : "Show"; show.setAttribute("aria-pressed", String(on)); pw.focus();
  });
  pw.addEventListener("input", function () { err.textContent = ""; box.classList.remove("bad"); go.disabled = !pw.value; });
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
</script>`,
  );
}
