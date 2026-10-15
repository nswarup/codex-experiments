/**
 * Vercel Routing Middleware: the password gate in front of everything Vercel serves,
 * including the built app's static files (which skip Functions). Same session cookie and
 * signing as the server (server/src/auth.ts), so signing in once covers pages and API.
 */
import { next } from "@vercel/functions";
import { SESSION_COOKIE, authEnabled, loginPage, setupPage, validSession } from "./server/src/auth.js";

export const config = {
  runtime: "nodejs",
  // Signing in, logging out and the health check go straight to the API, which checks them itself.
  matcher: "/((?!api/login|api/logout|api/health).*)",
};

function cookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

export default function middleware(req: Request) {
  if (!authEnabled()) return html(setupPage(), 503);
  const url = new URL(req.url);
  const authed = validSession(cookie(req, SESSION_COOKIE));
  if (url.pathname === "/login") return authed ? Response.redirect(new URL("/", url), 302) : html(loginPage());
  if (authed) return next();
  if (url.pathname.startsWith("/api/")) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (url.pathname === "/icon.svg" || url.pathname === "/icon-192.png" || url.pathname === "/apple-touch-icon.png") return next();
  const target = new URL("/login", url);
  if (url.pathname !== "/") target.searchParams.set("next", url.pathname);
  return Response.redirect(target, 302);
}
