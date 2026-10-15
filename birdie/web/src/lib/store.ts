import { useSyncExternalStore } from "react";
import { CATEGORIES, type Category, type Prefs, type Profile, type Saved, type Topic } from "./types";
import { applyAsk, applyEngagement, applyTap, applyVote, createProfile, drift, markSeen, repick } from "./ranking";
import { CORPUS_BY_ID, loadedBody } from "@/content";

export interface AppState {
  version: 1;
  onboarded: boolean;
  /** 0 = no tour; 1-3 = the coachmark step showing. */
  tour: number;
  profile: Profile | null;
  prefs: Prefs;
  saved: Saved[];
  generated: Record<string, Topic>;
  recentSearches: string[];
  /** Last time the app was in use, so a "session" means a real break, not a reload. */
  lastActiveAt: number;
}

const KEY = "birdie.state.v1";

/** Categories renamed when the list grew to 20; old saves keep their picks and scores. */
const RENAMED: Record<string, Category> = { Places: "Travel", Clothing: "Fashion" };

export const DEFAULT_PREFS: Prefs = {
  theme: "dark",
  size: 2,
  spacing: 1,
  sound: true,
  haptics: true,
  lab: { nudges: "cards", hook: "mono", wildcardLabel: false, transition: "slide", feed: "endless", glass: true },
};

function initial(): AppState {
  return {
    version: 1,
    onboarded: false,
    tour: 0,
    profile: null,
    prefs: DEFAULT_PREFS,
    saved: [],
    generated: {},
    recentSearches: [],
    lastActiveAt: 0,
  };
}

const THEMES = ["dark", "sepia", "light"] as const;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const clampInt = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;

/** Accept only what the app can render: a bad or old save must never crash the reader. */
/** Exported for tests: turns whatever was saved into a valid state. */
export function sanitize(parsed: unknown): AppState {
  const base = initial();
  if (!isObj(parsed)) return base;
  const p = isObj(parsed.prefs) ? parsed.prefs : {};
  const lab = isObj(p.lab) ? p.lab : {};
  const prefs: Prefs = {
    ...base.prefs,
    ...p,
    theme: THEMES.includes(p.theme as never) ? (p.theme as Prefs["theme"]) : base.prefs.theme,
    size: clampInt(p.size, 0, 4, base.prefs.size),
    spacing: clampInt(p.spacing, 0, 2, base.prefs.spacing),
    sound: typeof p.sound === "boolean" ? p.sound : base.prefs.sound,
    haptics: typeof p.haptics === "boolean" ? p.haptics : base.prefs.haptics,
    lab: { ...base.prefs.lab, ...lab } as Prefs["lab"],
  };
  let profile: Profile | null = null;
  if (isObj(parsed.profile)) {
    const pr = parsed.profile;
    const picked = [
      ...new Set(
        (Array.isArray(pr.picked) ? pr.picked : [])
          .map((c) => (typeof c === "string" ? (RENAMED[c] ?? c) : null))
          .filter((c): c is Category => !!c && (CATEGORIES as readonly string[]).includes(c)),
      ),
    ];
    const fresh = createProfile(picked);
    const oldCat: Record<string, number> = {};
    if (isObj(pr.cat)) {
      for (const [k, v] of Object.entries(pr.cat)) if (typeof v === "number") oldCat[RENAMED[k] ?? k] = v;
    }
    profile = {
      picked,
      cat: { ...fresh.cat, ...oldCat },
      tag: isObj(pr.tag) ? (pr.tag as Record<string, number>) : {},
      seen: (Array.isArray(pr.seen) ? pr.seen : []).filter((x): x is Profile["seen"][number] => isObj(x) && typeof x.id === "string"),
      sessions: typeof pr.sessions === "number" ? pr.sessions : 0,
      votes: isObj(pr.votes)
        ? Object.fromEntries(Object.entries(pr.votes).filter((e): e is [string, 1 | -1] => e[1] === 1 || e[1] === -1))
        : {},
    };
  }
  const generated: Record<string, Topic> = {};
  if (isObj(parsed.generated)) {
    for (const [k, v] of Object.entries(parsed.generated)) {
      if (isObj(v) && typeof v.title === "string" && Array.isArray(v.bullets)) {
        const t = v as unknown as Topic;
        generated[k] = RENAMED[t.category] ? { ...t, category: RENAMED[t.category] } : t;
      }
    }
  }
  const onboarded = parsed.onboarded === true && !!profile && profile.picked.length > 0;
  return {
    ...base,
    onboarded,
    tour: onboarded ? clampInt(parsed.tour, 0, 3, 0) : 0,
    profile,
    prefs,
    // A save whose article was never written (demo placeholder, failed job) can't be opened: drop it.
    saved: (Array.isArray(parsed.saved) ? parsed.saved : []).filter(
      (x): x is Saved => isObj(x) && typeof x.id === "string" && (!!CORPUS_BY_ID[x.id] || !!generated[x.id]),
    ),
    generated,
    recentSearches: (Array.isArray(parsed.recentSearches) ? parsed.recentSearches : []).filter((x): x is string => typeof x === "string").slice(0, 8),
    lastActiveAt: typeof parsed.lastActiveAt === "number" ? parsed.lastActiveAt : 0,
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : initial();
  } catch {
    return initial();
  }
}

let state: AppState = typeof window === "undefined" ? initial() : load();
const listeners = new Set<() => void>();
let saveTimer: number | undefined;

let dirty = false;
function flush() {
  if (!dirty) return;
  dirty = false;
  window.clearTimeout(saveTimer);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full: drop the older half of written topics (not saved ones) and try once more.
    try {
      const keep = new Set(state.saved.map((x) => x.id));
      const ids = Object.keys(state.generated).filter((id) => !keep.has(id));
      const generated = { ...state.generated };
      for (const id of ids.slice(0, Math.ceil(ids.length / 2))) delete generated[id];
      localStorage.setItem(KEY, JSON.stringify({ ...state, generated }));
    } catch {
      /* blocked entirely (private mode): the app keeps working in memory */
    }
  }
}

function persist() {
  if (typeof window === "undefined") return;
  dirty = true;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, 150);
}

if (typeof window !== "undefined") {
  // Never lose the last change when the app is closed or backgrounded.
  // A break starts when the app is hidden or closed; that moment decides the next session.
  const leave = () => {
    state = { ...state, lastActiveAt: Date.now() };
    dirty = true;
    flush();
  };
  window.addEventListener("pagehide", leave);
  window.addEventListener("beforeunload", leave);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && leave());
  // The desktop phone-frame viewer (viewer.html) can ask for a fresh start.
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.source !== window.parent || e.data?.birdie !== "reset") return;
    resetEverything();
    location.reload();
  });
}

export function getState() {
  return state;
}

export function setState(update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const patch = typeof update === "function" ? update(state) : update;
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useApp<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}

/* ----------------------------- actions ----------------------------- */

export function getTopic(id: string): Topic | undefined {
  const lib = CORPUS_BY_ID[id];
  if (lib) return loadedBody(id) ?? lib;
  return state.generated[id];
}

export function allTopics(): Topic[] {
  return [...Object.values(CORPUS_BY_ID), ...Object.values(state.generated)];
}

export function finishOnboarding(picked: Category[]) {
  setState((s) => ({
    onboarded: true,
    tour: 1,
    profile: s.profile ? repick(s.profile, picked) : createProfile(picked),
  }));
}

export function updateInterests(picked: Category[]) {
  setState((s) => ({ profile: s.profile ? repick(s.profile, picked) : createProfile(picked) }));
}

const SESSION_GAP = 30 * 60 * 1000;

/** Tastes fade a little per real session (a 30-minute break), never per reload. */
export function startSession() {
  const now = Date.now();
  setState((s) => (s.profile && now - s.lastActiveAt > SESSION_GAP ? { profile: drift(s.profile), lastActiveAt: now } : { lastActiveAt: now }));
}

export function setTour(step: number) {
  setState({ tour: step });
}

export function updatePrefs(p: Partial<Prefs>) {
  setState((s) => ({ prefs: { ...s.prefs, ...p } }));
}

export function updateLab(p: Partial<Prefs["lab"]>) {
  setState((s) => ({ prefs: { ...s.prefs, lab: { ...s.prefs.lab, ...p } } }));
}

function withProfile(fn: (p: Profile) => Profile) {
  setState((s) => (s.profile ? { profile: fn(s.profile) } : {}));
}

export function recordEngagement(t: Topic, e: number, prevE: number) {
  withProfile((p) => applyEngagement(p, t, e, prevE));
}

export function recordSeen(id: string) {
  withProfile((p) => markSeen(p, id));
}

export function recordTap(t: Topic) {
  withProfile((p) => applyTap(p, t));
}

export function recordAsk(t: Topic) {
  withProfile((p) => applyAsk(p, t));
}

export function voteOf(id: string): 1 | -1 | 0 {
  return state.profile?.votes?.[id] ?? 0;
}

/** Thumbs up or down; tapping the same thumb again takes the vote back. Returns the new vote. */
export function toggleVote(t: Topic, vote: 1 | -1): 1 | -1 | 0 {
  const next = voteOf(t.id) === vote ? 0 : vote;
  withProfile((p) => applyVote(p, t, next));
  return next;
}

export function isSaved(id: string) {
  return state.saved.some((s) => s.id === id);
}

export function toggleSaved(id: string): boolean {
  const on = !isSaved(id);
  setState((s) => ({
    saved: on ? [{ id, at: Date.now() }, ...s.saved] : s.saved.filter((x) => x.id !== id),
  }));
  return on;
}

const MAX_GENERATED = 150;

/** Keep written topics, oldest first out, but never ones that are saved or recently read. */
export function addGenerated(t: Topic) {
  setState((s) => {
    const generated = { ...s.generated, [t.id]: t };
    const ids = Object.keys(generated);
    if (ids.length > MAX_GENERATED) {
      const keep = new Set([t.id, ...s.saved.map((x) => x.id), ...(s.profile?.seen.slice(0, 50).map((x) => x.id) ?? [])]);
      for (const id of ids) {
        if (Object.keys(generated).length <= MAX_GENERATED) break;
        if (!keep.has(id)) delete generated[id];
      }
    }
    return { generated };
  });
}

export function addRecentSearch(q: string) {
  const v = q.trim();
  if (!v) return;
  setState((s) => ({
    recentSearches: [v, ...s.recentSearches.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 8),
  }));
}

export function clearRecentSearches() {
  setState({ recentSearches: [] });
}

export function resetEverything() {
  window.clearTimeout(saveTimer);
  dirty = false;
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem("birdie.resume.v1");
  } catch {
    /* ignore */
  }
  state = initial();
  listeners.forEach((l) => l());
}
