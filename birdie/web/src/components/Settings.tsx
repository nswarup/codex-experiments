import { useState } from "react";
import { flushSync } from "react-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { resetEverything, setTour, updateLab, updatePrefs, useApp } from "@/lib/store";
import { openOverlay, popToFeed } from "@/lib/ui";
import { cue } from "@/lib/feedback";
import { IconButton, Segmented, Sheet, SheetHeader, Switch } from "./ui";
import { cn } from "@/lib/cn";
import type { Theme } from "@/lib/types";

const THEMES: { value: Theme; label: string; bg: string; fg: string }[] = [
  { value: "light", label: "Light", bg: "#fbfaf7", fg: "#1c1c1c" },
  { value: "sepia", label: "Sepia", bg: "#f4ecd8", fg: "#5b4636" },
  { value: "dark", label: "Dark", bg: "#121212", fg: "#cfc8ba" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="font-mono text-[11.5px] font-medium tracking-[0.1em] text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="press flex h-12 items-center justify-between text-left text-text" onClick={onClick}>
      {label}
      <ChevronRight size={17} strokeWidth={1.7} className="text-muted" aria-hidden="true" />
    </button>
  );
}

/** Cross-fade the whole screen between themes where the browser can; otherwise switch at once. */
function switchTheme(theme: Theme) {
  const apply = () => {
    document.documentElement.dataset.readerTheme = theme;
    flushSync(() => updatePrefs({ theme }));
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(apply);
  else apply();
}

/**
 * The Design lab is for reviewing open design calls, not for readers. It shows in this
 * prototype; a production build sets VITE_LAB=off to remove it.
 */
const SHOW_LAB = import.meta.env.VITE_LAB !== "off";

const CAN_VIBRATE = typeof navigator !== "undefined" && "vibrate" in navigator;

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const prefs = useApp((s) => s.prefs);
  const [labOpen, setLabOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <SheetHeader title="Settings" onClose={onClose} />
      <div className="no-scrollbar min-h-0 overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom,0px)+28px)]" data-vaul-no-drag>

        <div className="mt-2 flex flex-col gap-6">
          <Section title="Theme">
            <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2.5">
              {THEMES.map((t) => {
                const on = prefs.theme === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      cue("select", { emphasis: "subtle" });
                      switchTheme(t.value);
                    }}
                    className={cn("press flex h-16 flex-col items-center justify-center rounded-xl font-serif text-[15px] ring-inset", on ? "ring-2 ring-strong" : "ring-1 ring-chip")}
                    style={{ background: t.bg, color: t.fg }}
                  >
                    <span className="text-[20px] leading-none">Aa</span>
                    <span className={cn("mt-1 text-[13px]", on && "font-semibold")}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Text size">
            <div className="flex h-[52px] items-center justify-between rounded-xl border border-sheet-line px-2">
              <IconButton
                label="Smaller text"
                disabled={prefs.size === 0}
                onClick={() => {
                  cue("select", { direction: "back", emphasis: "subtle" });
                  updatePrefs({ size: Math.max(0, prefs.size - 1) });
                }}
                className="text-[15px] disabled:opacity-30"
              >
                A
              </IconButton>
              <div className="flex items-center" role="radiogroup" aria-label="Text size">
                {[0, 1, 2, 3, 4].map((i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={i === prefs.size}
                    aria-label={`Text size ${i + 1} of 5`}
                    onClick={() => {
                      cue("select", { direction: i > prefs.size ? "forward" : "back", emphasis: "subtle" });
                      updatePrefs({ size: i });
                    }}
                    className="flex h-11 w-11 items-center justify-center"
                  >
                    <span
                      className={cn(
                        "rounded-full transition-[transform,background-color] duration-200",
                        i === prefs.size ? "h-3 w-3 bg-strong" : "h-2 w-2 bg-chip",
                      )}
                    />
                  </button>
                ))}
              </div>
              <IconButton
                label="Larger text"
                disabled={prefs.size === 4}
                onClick={() => {
                  cue("select", { direction: "forward", emphasis: "subtle" });
                  updatePrefs({ size: Math.min(4, prefs.size + 1) });
                }}
                className="text-[23px] disabled:opacity-30"
              >
                A
              </IconButton>
            </div>
          </Section>

          <Section title="Line spacing">
            <Segmented
              label="Line spacing"
              value={prefs.spacing}
              onChange={(v) => {
                cue("select", { emphasis: "subtle" });
                updatePrefs({ spacing: v });
              }}
              options={[
                { value: 0, label: "Compact" },
                { value: 1, label: "Comfy" },
                { value: 2, label: "Airy" },
              ]}
            />
          </Section>

          <Section title="Feel">
            <div className="flex flex-col divide-y divide-line">
              <Switch
                label="Sounds"
                checked={prefs.sound}
                onChange={(v) => {
                  updatePrefs({ sound: v });
                  if (v) cue("toggle");
                }}
              />
              {/* iPhones don't let web pages vibrate, so only offer it where it does something. */}
              {CAN_VIBRATE && <Switch label="Haptics" checked={prefs.haptics} onChange={(v) => updatePrefs({ haptics: v })} />}
            </div>
          </Section>

          <Section title="You">
            <div className="flex flex-col divide-y divide-line font-serif text-[16px]">
              <Row label="Edit interests" onClick={() => openOverlay({ kind: "interests", back: "settings" })} />
              <Row
                label="Replay the tour"
                onClick={() => {
                  // popToFeed also closes this sheet, in one history step.
                  popToFeed();
                  setTour(1);
                }}
              />
              <Row label="Saved and history" onClick={() => openOverlay({ kind: "library", tab: "saved", back: "settings" })} />
              <button
                type="button"
                className={cn("press h-12 text-left text-[var(--danger)]", confirmReset && "font-semibold")}
                onClick={() => {
                  // Two taps instead of confirm(): dialogs are blocked in embedded views.
                  if (!confirmReset) {
                    setConfirmReset(true);
                    window.setTimeout(() => setConfirmReset(false), 4000);
                    return;
                  }
                  resetEverything();
                  location.reload();
                }}
              >
                {confirmReset ? "Tap again to erase your interests, saves and history" : "Start over…"}
              </button>
            </div>
          </Section>

          {SHOW_LAB && (
          <section className="rounded-xl border border-dashed border-dot">
            <button
              type="button"
              onClick={() => setLabOpen((o) => !o)}
              aria-expanded={labOpen}
              className="press flex h-12 w-full items-center justify-between px-4 text-left"
            >
              <span className="font-mono text-[11.5px] font-medium tracking-[0.1em] text-muted uppercase">Design lab · for review</span>
              <ChevronDown size={17} strokeWidth={1.7} className={cn("text-muted transition-transform duration-200", labOpen && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {labOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-5 px-4 pt-1 pb-5">
                    <Section title="Hook font">
                      <Segmented
                        label="Hook font"
                        value={prefs.lab.hook}
                        onChange={(v) => updateLab({ hook: v })}
                        options={[
                          { value: "mono", label: <span className="font-mono text-[14px]">Mono</span> },
                          { value: "serif", label: <span className="italic">Serif</span> },
                        ]}
                      />
                    </Section>
                    <Section title="“Next, maybe…” style">
                      <Segmented
                        label="Nudge style"
                        value={prefs.lab.nudges}
                        onChange={(v) => updateLab({ nudges: v })}
                        options={[
                          { value: "cards", label: "Cards" },
                          { value: "list", label: "List" },
                        ]}
                      />
                    </Section>
                    <Section title="Feed">
                      <Segmented
                        label="Feed"
                        value={prefs.lab.feed}
                        onChange={(v) => updateLab({ feed: v })}
                        options={[
                          { value: "endless", label: "Endless" },
                          { value: "one", label: "One at a time" },
                        ]}
                      />
                    </Section>
                    <Section title="Page transition">
                      <Segmented
                        label="Page transition"
                        value={prefs.lab.transition}
                        onChange={(v) => updateLab({ transition: v })}
                        options={[
                          { value: "slide", label: "Slide" },
                          { value: "fade", label: "Fade" },
                        ]}
                      />
                    </Section>
                    <Switch
                      label="Label the wildcard nudge"
                      checked={prefs.lab.wildcardLabel}
                      onChange={(v) => updateLab({ wildcardLabel: v })}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
          )}
        </div>
      </div>
    </Sheet>
  );
}
