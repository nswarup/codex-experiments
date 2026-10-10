/**
 * Saving is acknowledged where it happens: the bookmark fills with a small spring, the
 * label reads "Saved", and a haptic tick lands. No toast for every save. The one exception
 * is the very first save, which says once where saved topics live. A dot on the Library
 * icon marks new saves until the Library is opened.
 */
import { notify } from "@/components/Notify";
import { useSyncExternalStore } from "react";
import { cue, buzz } from "./feedback";
import { openOverlay } from "./ui";

const HINT_KEY = "birdie.hint.saved";

let dot = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useSaveDot(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => dot,
    () => false,
  );
}

export function clearSaveDot() {
  if (!dot) return;
  dot = false;
  emit();
}

function hintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return true; // storage blocked: don't risk repeating the hint
  }
}

/** Call after toggling a save. `on` is the new state. */
export function savedFeedback(on: boolean) {
  cue("toggle", { direction: on ? "forward" : "back", emphasis: "subtle" });
  buzz(on ? [6, 30, 6] : 6);
  if (!on) return;
  dot = true;
  emit();
  if (hintSeen()) return;
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* fine */
  }
  notify("Saved to your Library", {
    action: { label: "View", onClick: () => openOverlay({ kind: "library", tab: "saved" }) },
    duration: 3200,
  });
}
