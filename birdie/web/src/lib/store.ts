import { useSyncExternalStore } from "react";
import type { Category, Prefs, Profile, Saved, Topic } from "./types";
import { applyAsk, applyEngagement, applyTap, createProfile, drift, markSeen, repick } from "./ranking";
import { CORPUS_BY_ID } from "@/content";

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
}

const KEY = "birdie.state.v1";

export const DEFAULT_PREFS: Prefs = {
  theme: "dark",
  size: 2,
  spacing: 1,
  sound: true,
  haptics: true,
  lab: { nudges: "cards", hook: "mono", wildcardLabel: false, transition: "slide" },
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
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const base = initial();
    return {
      ...base,
      ...parsed,
      prefs: { ...base.prefs, ...parsed.prefs, lab: { ...base.prefs.lab, ...parsed.prefs?.lab } },
    };
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
    /* storage full or blocked: the app keeps working in memory */
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
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
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
  return CORPUS_BY_ID[id] ?? state.generated[id];
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

export function startSession() {
  setState((s) => (s.profile ? { profile: drift(s.profile) } : {}));
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

export function addGenerated(t: Topic) {
  setState((s) => ({ generated: { ...s.generated, [t.id]: t } }));
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
  } catch {
    /* ignore */
  }
  state = initial();
  listeners.forEach((l) => l());
}
