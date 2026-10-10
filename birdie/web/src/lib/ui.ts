/**
 * Navigation stack + overlay state. Pages are kept mounted underneath so the feed
 * keeps its scroll position when a topic is pushed on top and popped again.
 */
import { useSyncExternalStore } from "react";

export type Page =
  | { key: string; kind: "feed" }
  | { key: string; kind: "topic"; id: string; from?: string };

export type Overlay =
  | { kind: "peek"; opening: string; linkId: string | null; fromTopicId: string; jobId?: string }
  | { kind: "chat"; topicId: string; highlight?: string; starter?: string }
  | { kind: "search" }
  | { kind: "settings" }
  | { kind: "library"; tab?: "saved" | "history" }
  | { kind: "why"; topicId: string; reason?: "match" | "wildcard" | "opened" }
  | { kind: "interests" };

interface UiState {
  stack: Page[];
  overlay: Overlay | null;
  /** Direction of the last stack change, for transitions. */
  dir: 1 | -1;
}

let ui: UiState = { stack: [{ key: "feed", kind: "feed" }], overlay: null, dir: 1 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let seq = 0;

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

export function pushTopic(id: string, from?: string) {
  const top = ui.stack[ui.stack.length - 1];
  if (top.kind === "topic" && top.id === id) return;
  ui = { ...ui, dir: 1, stack: [...ui.stack, { key: `t${++seq}-${id}`, kind: "topic", id, from }], overlay: null };
  try {
    history.pushState({ birdie: ui.stack.length }, "");
  } catch {
    /* ignore */
  }
  emit();
}

/** Pop one page. `fromHistory` is set when the browser's back already moved history. */
export function popPage(fromHistory = false) {
  if (ui.stack.length <= 1) return;
  ui = { ...ui, dir: -1, stack: ui.stack.slice(0, -1) };
  emit();
  if (!fromHistory) {
    try {
      history.back();
      ignoreNextPop = true;
    } catch {
      /* ignore */
    }
  }
}

export function popToFeed() {
  const n = ui.stack.length - 1;
  if (n <= 0) return;
  ui = { ...ui, dir: -1, stack: ui.stack.slice(0, 1) };
  emit();
  try {
    ignoreNextPop = true;
    history.go(-n);
  } catch {
    /* ignore */
  }
}

let ignoreNextPop = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    if (ignoreNextPop) {
      ignoreNextPop = false;
      return;
    }
    if (ui.overlay) {
      ui = { ...ui, overlay: null };
      emit();
      return;
    }
    popPage(true);
  });
}

export function openOverlay(o: Overlay) {
  ui = { ...ui, overlay: o };
  emit();
}

export function closeOverlay() {
  if (!ui.overlay) return;
  ui = { ...ui, overlay: null };
  emit();
}
