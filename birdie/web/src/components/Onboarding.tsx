import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { CATEGORY_BLURB, CATEGORY_LIST } from "@/content";
import { finishOnboarding, updateInterests, useApp } from "@/lib/store";
import type { Category } from "@/lib/types";
import { cue, buzz } from "@/lib/feedback";
import { cn } from "@/lib/cn";
import { BirdMark } from "./ui";

const NONE: never[] = [];

const MIN = 3;

function usePicks(mode: "onboard" | "edit", onDone?: () => void) {
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
  return { picked, n, ready, toggle, submit, status };
}

/**
 * Settings → Edit interests: the same picks in the reader's own theme, inside a sheet.
 * First run uses the branded screen below.
 */
export function InterestPicker({ onDone }: { mode?: "edit"; onDone?: () => void }) {
  const { picked, ready, toggle, submit, status } = usePicks("edit", onDone);
  return (
    <div className="flex h-full flex-col font-sans">
      <div className="flex-1 px-6 pt-1">
        <p className="mt-0 text-[15px] leading-snug text-muted">
          Pick at least {MIN}.
          <br />
          Birdie mixes in a few surprises too.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 pb-28" role="group" aria-label="Interests">
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
      <div className="sticky inset-x-0 bottom-0 bg-gradient-to-t from-sheet from-70% to-transparent px-6 pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]">
        <div className="mx-auto max-w-[512px]">
          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            className={cn(
              "press h-[52px] w-full rounded-full text-[16px] font-semibold tracking-[-0.005em] transition-[background-color,color] duration-150 ease-out",
              ready ? "bg-accent text-accent-fg" : "glass relative bg-inset text-muted",
            )}
          >
            Save
          </button>
          <p className="sr-only" aria-live="polite">
            {status}
          </p>
        </div>
      </div>
    </div>
  );
}

/** One small bird in the flock: two arcs, like a "v" in flight. */
function birdPath(x: number, y: number, s: number) {
  const f = (v: number) => v.toFixed(1);
  return `M${f(x - s)} ${f(y)}Q${f(x - s / 2)} ${f(y - s)} ${f(x)} ${f(y - s * 0.12)}Q${f(x + s / 2)} ${f(y - s)} ${f(x + s)} ${f(y)}`;
}

/**
 * A starling cloud in the sky. Each pick adds birds and draws the flock a little tighter;
 * it carries no words and nothing depends on it.
 */
function Flock({ n }: { n: number }) {
  const birds = useMemo(() => {
    const count = 26 + Math.min(n, 8) * 8;
    const tight = Math.min(1, n / 5);
    const out: { d: string; lead: boolean }[] = [];
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt((i + 0.5) / count);
      const loose = 1 - 0.35 * tight;
      const x = 238 + Math.cos(a) * r * 165 * loose + Math.sin(i * 1.3) * 8;
      const y = 160 + Math.sin(a) * r * 82 * loose + Math.sin(a * 2) * 14 * tight;
      const s = 3.6 + ((i * 7) % 5) * 0.75;
      out.push({ d: birdPath(x, y, s), lead: i % 4 === 0 });
    }
    return out;
  }, [n]);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 390 380"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {birds.map((b, i) => (
        <path
          key={i}
          d={b.d}
          fill="none"
          stroke={b.lead ? "var(--color-sage-ink)" : "var(--color-cream)"}
          strokeWidth={b.lead ? 1.9 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flock-bird"
        />
      ))}
    </svg>
  );
}

/** First run: sage sky with the flock and the headline, a cream sheet of topics below. */
export function Onboarding() {
  const { picked, n, ready, toggle, submit, status } = usePicks("onboard");

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="min-h-dvh bg-sage font-brand text-brand-ink"
    >
      <div className="relative mx-auto h-[clamp(300px,44dvh,376px)] max-w-[560px] overflow-hidden">
        <Flock n={n} />
        <div className="absolute top-[calc(env(safe-area-inset-top,0px)+20px)] left-6 flex items-center gap-2 text-cream">
          <BirdMark size={30} wing="var(--color-sage-deep)" eye="var(--color-sage)" />
          <span className="text-[19px] font-bold tracking-[-0.02em]">birdie</span>
        </div>
        <h1 className="absolute right-6 bottom-7 left-6 text-[44px] leading-none font-bold tracking-[-0.045em] text-cream">
          My favorite
          <br />
          topics
        </h1>
      </div>

      <div className="mx-auto min-h-[calc(100dvh-clamp(300px,44dvh,376px))] max-w-[560px] rounded-t-[30px] bg-cream px-6 pt-[22px] pb-36">
        <p className="mb-4 text-[14px] text-brand-muted">Pick 3 or more.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Topics">
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
                  "press chip-hit flex h-[38px] items-center rounded-full border px-[15px] text-[15px] transition-[background-color,border-color,color] duration-[120ms] ease-out",
                  on ? "border-sage-deep bg-sage-deep font-semibold text-cream" : "border-cream-line bg-transparent font-medium text-brand-ink",
                )}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-cream from-70% to-transparent px-6 pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">
        <div className="mx-auto max-w-[512px]">
          {/* The label never changes; the button simply becomes available at three picks. */}
          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            className={cn(
              "press h-[54px] w-full rounded-full text-[16px] font-semibold transition-[background-color,color] duration-150 ease-out",
              ready ? "bg-sage-deep text-cream" : "bg-cream-inset text-brand-muted",
            )}
          >
            Continue
          </button>
          <p className="sr-only" aria-live="polite">
            {status}
          </p>
        </div>
      </div>
    </motion.main>
  );
}
