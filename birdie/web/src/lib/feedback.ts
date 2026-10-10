/**
 * Sound (Cuelume) and haptics, both gated by the reader's preferences.
 * Cues are chosen by job, per Cuelume's guidance: taps for actions, open/close for sheets,
 * navigate for page moves, toggle for bookmarks, select for chips, ready for finished writing.
 */
import { play, setEnabled, setVolume, type SoundName, type PlayOptions } from "cuelume";
import { getState, subscribe } from "./store";

let enabled = true;
function sync() {
  const s = getState().prefs.sound;
  if (s !== enabled) {
    enabled = s;
    setEnabled(s);
  }
}
sync();
setVolume(0.55);
subscribe(sync);

export function cue(name: SoundName, opts: PlayOptions = {}) {
  if (!getState().prefs.sound) return;
  try {
    play(name, { emphasis: "subtle", ...opts });
  } catch {
    /* audio unavailable */
  }
}

export function buzz(pattern: number | number[] = 8) {
  if (!getState().prefs.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

/** Light tap feedback for a pressable control. */
export function tapFeedback() {
  cue("tap");
  buzz(6);
}
