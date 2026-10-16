/**
 * Getting new versions onto the phone. The service worker keeps Birdie working offline, but
 * a home-screen app can stay open for days, so a fresh deploy waits until we hand it over:
 * at once if Birdie has only just opened and nobody is reading yet, otherwise the next time
 * the app goes to the background. Nothing ever reloads mid-article.
 */
const FRESH_MS = 5000;
const CHECK_MS = 30 * 60 * 1000;

export function startUpdates() {
  if (import.meta.env.DEV || import.meta.env.VITE_TARGET === "artifact" || !("serviceWorker" in navigator)) return;
  const sw = navigator.serviceWorker;
  const opened = Date.now();
  let reading = false;
  // Scrolling happens inside the feed, and scroll doesn't bubble, so listen in the capture phase.
  addEventListener("scroll", () => (reading = true), { capture: true, passive: true, once: true });

  // A first install shouldn't reload; only a swap from an older version should.
  const hadController = !!sw.controller;
  let reloading = false;
  sw.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  sw.register("/sw.js", { scope: "/" })
    .then((reg) => {
      const consider = () => {
        const waiting = reg.waiting;
        if (!waiting || !sw.controller) return;
        if (document.hidden || (!reading && Date.now() - opened < FRESH_MS)) waiting.postMessage({ type: "SKIP_WAITING" });
      };
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => w.state === "installed" && consider());
      });
      consider();
      const check = () => reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => (document.hidden ? consider() : check()));
      setInterval(check, CHECK_MS);
    })
    .catch(() => {});
}
