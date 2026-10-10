/*
 * Desktop phone-frame viewer: Birdie in an iframe sized like a real phone, with a drawn
 * status bar and home indicator, device presets and a couple of demo controls.
 * On a phone (narrow or touch) the chrome disappears and the app fills the screen.
 */
import "./viewer.css";

interface Device {
  id: string;
  label: string;
  w: number;
  h: number;
  /** Status bar and home-indicator strips, the parts of the screen iOS/Android reserve. */
  top: number;
  bottom: number;
  radius: number;
  cutout: "island" | "hole" | "none";
}

const DEVICES: Device[] = [
  { id: "se", label: "iPhone SE", w: 375, h: 667, top: 20, bottom: 0, radius: 6, cutout: "none" },
  { id: "13", label: "iPhone 13", w: 390, h: 844, top: 47, bottom: 34, radius: 47, cutout: "island" },
  { id: "max", label: "Pro Max", w: 430, h: 932, top: 54, bottom: 34, radius: 55, cutout: "island" },
  { id: "pixel", label: "Pixel 8", w: 412, h: 915, top: 36, bottom: 24, radius: 40, cutout: "hole" },
];

const KEY = "birdie.viewer.device";
const APP_SRC = import.meta.env.VITE_TARGET === "artifact" ? "app.html" : "./";
const BEZEL = 12;
const PAD = 28;

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: just don't remember */
  }
};

let device = DEVICES.find((d) => d.id === read(KEY)) ?? DEVICES[1];

const root = document.getElementById("viewer")!;
root.innerHTML = `
  <header class="bar" aria-label="Phone viewer controls">
    <div class="brand">
      <span class="wordmark">birdie</span>
      <span class="kicker">Phone preview</span>
    </div>
    <div class="controls">
      <div class="segmented" role="radiogroup" aria-label="Device">
        ${DEVICES.map((d) => `<button type="button" role="radio" data-device="${d.id}">${d.label}</button>`).join("")}
      </div>
      <span class="size" aria-live="polite"></span>
      <button type="button" class="icon" data-act="reload" title="Reload" aria-label="Reload">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>
      </button>
      <button type="button" class="text" data-act="reset">Restart onboarding</button>
      <a class="text" data-act="open" href="${APP_SRC}" target="_blank" rel="noopener">Open full screen ↗</a>
    </div>
  </header>
  <main class="stage">
    <div class="scaler">
      <div class="phone">
        <div class="screen">
          <div class="status" aria-hidden="true">
            <span class="time">9:41</span>
            <span class="cutout"></span>
            <span class="glyphs">
              <svg viewBox="0 0 18 12" width="18" height="12"><rect x="0" y="8" width="3" height="4" rx="0.8"/><rect x="5" y="5.5" width="3" height="6.5" rx="0.8"/><rect x="10" y="3" width="3" height="9" rx="0.8"/><rect x="15" y="0" width="3" height="12" rx="0.8"/></svg>
              <svg viewBox="0 0 16 12" width="16" height="12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0z"/><path d="M8 5.6a6 6 0 0 1 4.3 1.8l-1.2 1.2a4.3 4.3 0 0 0-6.2 0L3.7 7.4A6 6 0 0 1 8 5.6z"/><path d="M8 1.8a9.8 9.8 0 0 1 7 2.9l-1.2 1.2a8.1 8.1 0 0 0-11.6 0L1 4.7a9.8 9.8 0 0 1 7-2.9z"/></svg>
              <svg viewBox="0 0 27 12" width="27" height="12"><rect x="0.5" y="0.5" width="23" height="11" rx="3.2" fill="none" stroke="currentColor" opacity="0.4"/><rect x="2" y="2" width="20" height="8" rx="2"/><path d="M25 4v4a2 2 0 0 0 0-4z" opacity="0.4"/></svg>
            </span>
          </div>
          <iframe title="Birdie" src="${APP_SRC}" allow="clipboard-write; web-share"></iframe>
          <div class="home" aria-hidden="true"><span></span></div>
        </div>
      </div>
    </div>
  </main>
`;

const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
const frame = $<HTMLIFrameElement>("iframe");
const scaler = $<HTMLDivElement>(".scaler");
const bar = $<HTMLElement>(".bar");

function apply() {
  const s = root.style;
  s.setProperty("--w", `${device.w}px`);
  s.setProperty("--h", `${device.h}px`);
  s.setProperty("--top", `${device.top}px`);
  s.setProperty("--bottom", `${device.bottom}px`);
  s.setProperty("--radius", `${device.radius}px`);
  s.setProperty("--bezel", `${BEZEL}px`);
  root.dataset.cutout = device.cutout;
  root.dataset.device = device.id;
  root.querySelectorAll<HTMLButtonElement>("[data-device]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.device === device.id)));
  $(".size").textContent = `${device.w} × ${device.h - device.top - device.bottom}`;
  fit();
}

/** Shrink the phone to fit short laptop screens; never enlarge it. */
function fit() {
  const totalW = device.w + BEZEL * 2;
  const totalH = device.h + BEZEL * 2;
  const availH = window.innerHeight - bar.offsetHeight - PAD * 2;
  const availW = window.innerWidth - PAD * 2;
  const k = Math.min(1, availH / totalH, availW / totalW);
  scaler.style.setProperty("--k", String(Math.max(0.4, k)));
  scaler.style.width = `${totalW * k}px`;
  scaler.style.height = `${totalH * k}px`;
}

root.addEventListener("click", (e) => {
  const t = (e.target as Element).closest<HTMLElement>("[data-device],[data-act]");
  if (!t) return;
  if (t.dataset.device) {
    device = DEVICES.find((d) => d.id === t.dataset.device) ?? device;
    write(KEY, device.id);
    apply();
  } else if (t.dataset.act === "reload") {
    frame.contentWindow?.location.reload();
  } else if (t.dataset.act === "reset") {
    // The app clears its own state so a pending save can't write it back.
    frame.contentWindow?.postMessage({ birdie: "reset" }, location.origin);
  }
});

// Arrow keys move between devices, like any radio group.
$(".segmented").addEventListener("keydown", (e) => {
  const ke = e as KeyboardEvent;
  if (ke.key !== "ArrowRight" && ke.key !== "ArrowLeft") return;
  const i = DEVICES.indexOf(device) + (ke.key === "ArrowRight" ? 1 : -1);
  device = DEVICES[(i + DEVICES.length) % DEVICES.length];
  write(KEY, device.id);
  apply();
  root.querySelector<HTMLButtonElement>(`[data-device="${device.id}"]`)?.focus();
});

// The desk follows the reader theme, live: the app's saves fire `storage` here.
function syncTheme() {
  try {
    const s = JSON.parse(read("birdie.state.v1") || "{}");
    document.documentElement.dataset.desk = s?.prefs?.theme || "dark";
  } catch {
    document.documentElement.dataset.desk = "dark";
  }
}
window.addEventListener("storage", (e) => e.key === "birdie.state.v1" && syncTheme());
frame.addEventListener("load", syncTheme);
window.addEventListener("resize", fit);

apply();
