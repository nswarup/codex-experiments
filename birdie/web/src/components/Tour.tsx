import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageSquare } from "lucide-react";
import { setTour, useApp } from "@/lib/store";
import { cue, buzz } from "@/lib/feedback";

const STEPS = [
  {
    target: "opening",
    title: "Tap an underlined phrase to read about it.",
    body: "You get a short preview first. Tap Read to open the full topic.",
  },
  {
    target: "lede",
    title: "Highlight any text to ask Birdie about it.",
    body: "Press and drag over a sentence, then tap Ask Birdie. Your question opens with that passage attached.",
  },
  {
    target: "search",
    title: "Tap the search icon to read about anything.",
    body: "Type a few words, like “dogs’ sense of smell”, and Birdie writes a short piece on exactly that.",
  },
] as const;

const GAP = 14;
const EDGE = 16;
const EASE = [0.23, 1, 0.32, 1] as const;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  /** Where the arrow should point, in viewport x. */
  pointX: number;
}

function find(target: string): HTMLElement | null {
  const scope = document.querySelector('[data-scroller="feed"]') ?? document;
  return scope.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

function measureTarget(target: string): Box | null {
  const el = find(target);
  if (!el) return null;
  // Spotlight the whole bullet for an opening, so the hole never cuts through words.
  const area = target === "opening" ? (el.closest("li") as HTMLElement | null) ?? el : el;
  const r = area.getBoundingClientRect();
  const first = el.getClientRects()[0] ?? el.getBoundingClientRect();
  const pad = target === "search" ? 4 : 8;
  return {
    top: r.top - pad,
    left: r.left - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
    pointX: target === "opening" ? first.left + Math.min(first.width / 2, 70) : r.left + r.width / 2,
  };
}

const same = (a: Box | null, b: Box | null) =>
  !!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.height - b.height) < 0.5 && Math.abs(a.width - b.width) < 0.5;

export function Tour() {
  const step = useApp((s) => s.tour);
  const [box, setBox] = useState<Box | null>(null);
  const [tip, setTip] = useState<{ w: number; h: number; left: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const active = step >= 1 && step <= STEPS.length;
  const s = active ? STEPS[step - 1] : null;

  useLayoutEffect(() => {
    if (!s) return;
    let raf = 0;
    const started = performance.now();
    // Bring the target on screen the first time it exists (a long title can push the first
    // linked bullet below the fold, and the article may mount after the tour does).
    let scrolled = s.target === "search";
    const reveal = () => {
      const el = find(s.target);
      if (scrolled || !el) return;
      scrolled = true;
      const r = el.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight * 0.55) el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    };
    const measure = () => {
      reveal();
      const next = measureTarget(s.target);
      if (next) setBox((b) => (same(b, next) ? b : next));
      // Keep tracking while entry animations, scroll resets and font loading settle.
      if (performance.now() - started < 1200) raf = requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(() => measure());
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [s]);

  // The tooltip's real size decides where it can go.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    // Layout metrics, not getBoundingClientRect: the entry scale must not feed back into placement.
    const read = () => {
      const r = { w: el.offsetWidth, h: el.offsetHeight, left: el.offsetLeft };
      setTip((t) => (t && t.w === r.w && t.h === r.h && t.left === r.left ? t : r));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  });

  useEffect(() => {
    if (!active) setBox(null);
  }, [active]);

  // Leave the reader at the top of the first topic, wherever the tour scrolled to.
  const finish = () => {
    setTour(0);
    document.querySelector('[data-scroller="feed"]')?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    buzz(6);
    if (step >= STEPS.length) {
      cue("success", { emphasis: "subtle" });
      finish();
    } else {
      cue("navigate", { emphasis: "subtle" });
      setTour(step + 1);
    }
  };
  const back = () => {
    cue("navigate", { direction: "back", emphasis: "subtle" });
    setTour(Math.max(1, step - 1));
  };
  const skip = () => {
    cue("close", { emphasis: "subtle" });
    finish();
  };

  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const tipH = tip?.h ?? 260;
  let placement: "below" | "above" | "clamped" = "below";
  let top = 0;
  if (box) {
    const fitsBelow = box.top + box.height + GAP + tipH + EDGE <= vh;
    const fitsAbove = box.top - GAP - tipH >= EDGE;
    const lowerHalf = box.top + box.height / 2 > vh / 2;
    if (fitsBelow && !(lowerHalf && fitsAbove)) {
      placement = "below";
      top = box.top + box.height + GAP;
    } else if (fitsAbove) {
      placement = "above";
      top = box.top - GAP - tipH;
    } else {
      placement = "clamped";
      top = Math.max(EDGE, vh - tipH - EDGE);
    }
    top = Math.min(Math.max(top, EDGE), Math.max(EDGE, vh - tipH - EDGE));
  }
  const arrowX = box && tip ? Math.min(Math.max(box.pointX - tip.left - 9, 18), tip.w - 36) : 24;

  return (
    <AnimatePresence>
      {active && box && s && (
        <motion.div
          key="tour"
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.22, ease: EASE }}
          role="dialog"
          aria-modal="true"
          aria-label={`Tour, step ${step} of ${STEPS.length}`}
        >
          {/* Spotlight: one rounded hole in a theme-tinted dim. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-2xl"
            initial={false}
            animate={{ top: box.top, left: box.left, width: box.width, height: box.height }}
            transition={{ duration: 0.26, ease: EASE }}
            style={{ boxShadow: "0 0 0 9999px var(--tour-scrim), 0 0 0 2px var(--text)" }}
          />
          <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              ref={tipRef}
              className="absolute inset-x-6 mx-auto max-w-[420px]"
              style={{ top }}
              initial={{ opacity: 0, transform: `translateY(${placement === "above" ? -6 : 6}px) scale(0.98)` }}
              animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
              exit={{ opacity: 0, transform: "scale(0.98)", transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              {placement === "below" && <Arrow x={arrowX} up />}
              <div className="rounded-2xl bg-strong px-5 py-[18px] text-bg" style={{ boxShadow: "var(--shadow)" }}>
                <div className="font-mono text-[11.5px] font-medium tracking-[0.1em] uppercase opacity-70">
                  {step} of {STEPS.length}
                </div>
                <p className="mt-2 font-serif text-[19px] leading-[1.35] font-semibold text-balance">{s.title}</p>
                <p className="mt-2 font-serif text-[16px] leading-[1.5] text-pretty opacity-85">{s.body}</p>
                {s.target === "lede" && (
                  <div className="mt-3 flex items-center gap-2" aria-hidden="true">
                    <span className="rounded bg-hl px-1 font-serif text-[15px] text-[var(--hl-text)]">a sentence</span>
                    <span className="flex h-8 items-center gap-1.5 rounded-full bg-bg px-3 font-serif text-[13.5px] font-semibold text-strong">
                      <MessageSquare size={14} strokeWidth={2} /> Ask Birdie
                    </span>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={step === 1 ? skip : back}
                    className="press -ml-1 h-11 px-1 font-serif text-[15px] underline underline-offset-4 opacity-75"
                  >
                    {step === 1 ? "Skip tour" : "Back"}
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    autoFocus
                    className="press h-11 rounded-full bg-bg px-5 font-serif text-[15px] font-semibold text-strong"
                  >
                    {step === STEPS.length ? "Start reading" : "Next"}
                  </button>
                </div>
              </div>
              {placement === "above" && <Arrow x={arrowX} />}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Arrow({ x, up = false }: { x: number; up?: boolean }) {
  return (
    <svg
      width="18"
      height="10"
      viewBox="0 0 18 10"
      aria-hidden="true"
      className="block"
      style={{ marginLeft: x, transform: up ? undefined : "rotate(180deg)" }}
    >
      <path d="M0 10L9 0l9 10z" fill="var(--strong)" />
    </svg>
  );
}
