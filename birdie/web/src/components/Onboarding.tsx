import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CATEGORY_BLURB, CATEGORY_LIST } from "@/content";
import { finishOnboarding, updateInterests, useApp } from "@/lib/store";
import type { Category } from "@/lib/types";
import { cue, buzz } from "@/lib/feedback";
import { cn } from "@/lib/cn";
import { Wordmark } from "./ui";

const NONE: never[] = [];

const MIN = 3;

/**
 * Twitter/X-style interest picker. Used for first-run onboarding and, with `mode="edit"`,
 * from settings to change interests later.
 */
export function InterestPicker({ mode = "onboard", onDone }: { mode?: "onboard" | "edit"; onDone?: () => void }) {
  const existing = useApp((s) => s.profile?.picked ?? NONE);
  const [picked, setPicked] = useState<Category[]>(mode === "edit" ? existing : []);
  const n = picked.length;
  const unchanged = mode === "edit" && n === existing.length && picked.every((c) => existing.includes(c));
  const ready = n >= MIN && !unchanged;

  const toggle = (c: Category) => {
    const on = !picked.includes(c);
    setPicked((p) => (on ? [...p, c] : p.filter((x) => x !== c)));
    cue("toggle", { direction: on ? "forward" : "back" });
    buzz(5);
  };

  const submit = () => {
    if (!ready) return;
    cue("success", { emphasis: mode === "onboard" ? "normal" : "subtle" });
    buzz([8, 40, 8]);
    if (mode === "onboard") finishOnboarding(picked);
    else updateInterests(picked);
    onDone?.();
  };

  return (
    <div className={cn("flex flex-col", mode === "onboard" ? "min-h-dvh" : "h-full")}>
      <div className={cn("flex-1 px-6", mode === "onboard" ? "pt-[calc(env(safe-area-inset-top,0px)+20px)]" : "pt-2")}>
        {mode === "onboard" && <Wordmark />}
        {mode === "onboard" && (
        <motion.h1
          initial={{ opacity: 0, transform: "translateY(6px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className={cn("font-serif font-medium text-strong", mode === "onboard" ? "mt-10 text-[30px] leading-[1.2]" : "text-[24px]")}
        >
          What are you curious about?
        </motion.h1>
        )}
        <div className={cn("flex flex-wrap gap-2.5 pb-48", mode === "onboard" ? "mt-6" : "mt-1")} role="group" aria-label="Interests">
          {CATEGORY_LIST.map((c, i) => {
            const on = picked.includes(c);
            return (
              <motion.button
                key={c}
                type="button"
                aria-pressed={on}
                title={CATEGORY_BLURB[c]}
                onClick={() => toggle(c)}
                initial={{ opacity: 0, transform: "translateY(8px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.3, delay: 0.08 + i * 0.025, ease: [0.23, 1, 0.32, 1] }}
                className={cn(
                  // Filled means picked, like X's topic chips: no icon, so labels stay centred and rows never reflow.
                  "press flex h-[46px] items-center rounded-full border px-5 font-serif text-[16px] font-medium transition-colors duration-150",
                  on ? "border-accent bg-accent text-accent-fg" : "border-chip bg-transparent text-text",
                )}
              >
                {c}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          // A soft fade instead of a hard rule, so the last chips read as "more below".
          "inset-x-0 bottom-0 bg-gradient-to-t from-75% to-transparent px-6 pt-8",
          // Fade into whatever surface the picker sits on: the page, or a sheet.
          mode === "onboard" ? "fixed from-bg pb-[calc(env(safe-area-inset-bottom,0px)+28px)]" : "sticky from-sheet pb-[calc(env(safe-area-inset-bottom,0px)+20px)]",
        )}
      >
        <div className="mx-auto flex max-w-[640px] flex-col gap-3.5">
          <p className="text-center font-serif text-[15px] text-muted">Birdie mixes in a few surprises too.</p>
          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            aria-live="polite"
            className={cn(
              "press relative h-[54px] overflow-hidden rounded-full font-serif text-[17px] font-semibold",
              ready ? "bg-accent text-accent-fg" : "bg-line text-muted",
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={ready ? "next" : unchanged ? "same" : `pick-${n}`}
                initial={{ opacity: 0, filter: "blur(4px)", transform: "translateY(6px)" }}
                animate={{ opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" }}
                exit={{ opacity: 0, filter: "blur(4px)", transform: "translateY(-6px)" }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="inline-block"
              >
                {ready ? (mode === "onboard" ? "Next" : "Save interests") : unchanged ? "No changes yet" : `Pick at least ${MIN} (${n}/${MIN})`}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
    </div>
  );
}

export function Onboarding() {
  return (
    <main className="mx-auto max-w-[640px] bg-bg">
      <InterestPicker mode="onboard" />
    </main>
  );
}
