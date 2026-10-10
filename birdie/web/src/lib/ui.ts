/**
 * Navigation stack + overlay state, mirrored into browser history so the phone's
 * back gesture closes sheets and pops pages the way a native app would.
 *
 * Every pushed page and every open overlay owns one history entry, tagged with
 * { depth, overlay }. popstate reconciles the in-app stack to whatever entry the
 * browser landed on, so back, forward and reloads can't drift out of sync.
 */
import { useSyncExternalStore } from "react";

export type Page =
  | { key: string; kind: "feed" }
  | { key: string; kind: "topic"; id: string; from?: string };

export type Overlay =
  | { kind: "peek"; opening: string; linkId: string | null; fromTopicId: string; jobId?: string }
  | { kind: "chat"; topicId: string; highlight?: string }
  | { kind: "search" }
  | { kind: "settings" }
  | { kind: "library"; tab?: "saved" | "history" }
  | { kind: "why"; topicId: string; reason?: "match" | "wildcard" | "opened" }
  | { kind: "interests" };

/** Overlays that cover the page fully enough that reading time should pause. */
export const COVERING: Overlay["kind"][] = ["search", "chat", "library", "interests"];

interface UiState {
  stack: Page[];
  overlay: Overlay | null;
}

type Entry = { birdie: true; depth: number; overlay: boolean };

const FEED: Page = { key: "feed", kind: "feed" };
let ui: UiState = { stack: [FEED], overlay: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let seq = 0;
/** popstate events we caused ourselves and should ignore. */
let pendingPops = 0;

export function useUi<T>(sel: (s: UiState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => sel(ui),
    () => sel(ui),
  );
}

export const getUi = () => ui;

const entry = (depth: number, overlay: boolean): Entry => ({ birdie: true, depth, overlay });

function safe(fn: () => void) {
  try {
    fn();
  } catch {
    /* history unavailable (sandboxed iframe): the in-app stack still works */
  }
}

function goBack(n = 1) {
  if (n <= 0) return;
  pendingPops++;
  safe(() => history.go(-n));
}

export function pushTopic(id: string, from?: string) {
  const top = ui.stack[ui.stack.length - 1];
  const hadOverlay = !!ui.overlay;
  if (top.kind === "topic" && top.id === id) {
    if (hadOverlay) closeOverlay();
    return;
  }
  const stack = [...ui.stack, { key: `t${++seq}-${id}`, kind: "topic" as const, id, from }];
  ui = { stack, overlay: null };
  // An open overlay's entry becomes the new page's entry.
  safe(() => (hadOverlay ? history.replaceState(entry(stack.length, false), "") : history.pushState(entry(stack.length, false), "")));
  emit();
}

export function popPage() {
  if (ui.stack.length <= 1) return;
  const extra = ui.overlay ? 1 : 0;
  ui = { stack: ui.stack.slice(0, -1), overlay: null };
  emit();
  goBack(1 + extra);
}

export function popToFeed() {
  const n = ui.stack.length - 1 + (ui.overlay ? 1 : 0);
  if (n <= 0) return;
  ui = { stack: [FEED], overlay: null };
  emit();
  goBack(n);
}

export function openOverlay(o: Overlay) {
  const had = !!ui.overlay;
  ui = { ...ui, overlay: o };
  safe(() => (had ? history.replaceState(entry(ui.stack.length, true), "") : history.pushState(entry(ui.stack.length, true), "")));
  emit();
}

export function closeOverlay() {
  if (!ui.overlay) return;
  ui = { ...ui, overlay: null };
  emit();
  goBack(1);
}

/** Back to a fresh feed (used by "Start over"). */
export function resetUi() {
  const n = ui.stack.length - 1 + (ui.overlay ? 1 : 0);
  ui = { stack: [FEED], overlay: null };
  emit();
  goBack(n);
}

if (typeof window !== "undefined") {
  // Tag the entry the app was loaded on as the base (depth 1). Older entries from a
  // previous visit are walked past by the reconcile step below.
  safe(() => history.replaceState(entry(1, false), ""));

  window.addEventListener("popstate", (e) => {
    if (pendingPops > 0) {
      pendingPops--;
      return;
    }
    const st = (e.state ?? null) as Entry | null;
    const depth = st?.birdie ? st.depth : 1;
    const overlayHere = !!st?.overlay;
    let changed = false;
    if (ui.overlay && !overlayHere) {
      ui = { ...ui, overlay: null };
      changed = true;
    }
    if (depth < ui.stack.length) {
      ui = { ...ui, stack: ui.stack.slice(0, Math.max(1, depth)) };
      changed = true;
    } else if (depth > ui.stack.length || (overlayHere && !ui.overlay)) {
      // Forward into pages we no longer hold, or a stale entry from before a reload:
      // step back to where the app really is.
      const over = depth - ui.stack.length + (overlayHere && !ui.overlay ? 1 : 0);
      goBack(Math.max(1, over));
    }
    if (changed) emit();
  });
}
