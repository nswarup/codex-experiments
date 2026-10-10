import { useState } from "react";
import { motion } from "motion/react";
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
    cue("toggle", { direction: on ? "forward" : "back", emphasis: "subtle" });
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

  const status = n >= MIN ? `${n} selected.` : `${n} selected. Pick ${MIN - n} more.`;

  return (
    // One quiet fade for the whole screen; nothing else moves on its own.
    <motion.div
      initial={mode === "onboard" ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn("flex flex-col font-sans", mode === "onboard" ? "min-h-dvh" : "h-full")}
    >
      <div className={cn("flex-1 px-6", mode === "onboard" ? "pt-[calc(env(safe-area-inset-top,0px)+20px)]" : "pt-1")}>
        {mode === "onboard" && (
          <>
            <Wordmark />
            {/* Serif headline bridges to the reading experience; everything you touch is sans. */}
            <h1 className="mt-10 font-serif text-[28px] leading-[1.15] font-medium tracking-[-0.01em] text-balance text-strong">
              What are you curious about?
            </h1>
          </>
        )}
        <p className={cn("text-[15px] leading-snug text-muted", mode === "onboard" ? "mt-2.5" : "mt-0")}>
          Pick at least {MIN}.
          <br />
          Birdie mixes in a few surprises too.
        </p>
        <div className={cn("flex flex-wrap gap-2", mode === "onboard" ? "mt-7 pb-32" : "mt-5 pb-28")} role="group" aria-label="Interests">
          {CATEGORY_LIST.map((c) => {
            const on = picked.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                title={CATEGORY_BLURB[c]}
                onClick={() => toggle(c)}
                className={cn(
                  // Compact, fixed-size pills: filled means picked, so nothing reflows and only colour changes.
                  "press chip-hit flex h-9 items-center rounded-full border px-3.5 text-[15px] font-medium tracking-[-0.005em] transition-[background-color,border-color,color] duration-[120ms] ease-out",
                  on ? "border-accent bg-accent text-accent-fg" : "border-chip bg-transparent text-text",
                )}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          // A soft fade instead of a hard rule, so the last pills read as "more below".
          "inset-x-0 bottom-0 bg-gradient-to-t from-70% to-transparent px-6 pt-6",
          // Fade into whatever surface the picker sits on: the page, or a sheet.
          mode === "onboard" ? "fixed from-bg pb-[calc(env(safe-area-inset-bottom,0px)+24px)]" : "sticky from-sheet pb-[calc(env(safe-area-inset-bottom,0px)+20px)]",
        )}
      >
        {/* 560px column minus its 24px gutters, so the button lines up with the pills. */}
        <div className="mx-auto max-w-[512px]">
          {/* The label never changes; the button simply becomes available. */}
          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            className={cn(
              "press h-[52px] w-full rounded-full text-[16px] font-semibold tracking-[-0.005em] transition-[background-color,color] duration-150 ease-out",
              ready ? "bg-accent text-accent-fg" : "glass relative bg-inset text-muted",
            )}
          >
            {mode === "onboard" ? "Continue" : "Save"}
          </button>
          <p className="sr-only" aria-live="polite">
            {status}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function Onboarding() {
  return (
    <main className="mx-auto max-w-[560px] bg-bg">
      <InterestPicker mode="onboard" />
    </main>
  );
}
