import { useEffect, useLayoutEffect, useState } from "react";
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

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function find(target: string): HTMLElement | null {
  const scope = document.querySelector('[data-scroller="feed"]') ?? document;
  return scope.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

export function Tour() {
  const step = useApp((s) => s.tour);
  const [box, setBox] = useState<Box | null>(null);
  const active = step >= 1 && step <= STEPS.length;
  const s = active ? STEPS[step - 1] : null;

  useLayoutEffect(() => {
    if (!s) return;
    let raf = 0;
    let el: HTMLElement | null = null;
    const started = performance.now();
    const pad = s.target === "search" ? 4 : 8;
    const measure = () => {
      el = el?.isConnected ? el : find(s.target);
      if (el) {
        const r = el.getBoundingClientRect();
        setBox((b) => {
          const next = { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
          return b && Math.abs(b.top - next.top) < 0.5 && Math.abs(b.left - next.left) < 0.5 && Math.abs(b.height - next.height) < 0.5 ? b : next;
        });
      }
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

  useEffect(() => {
    if (!active) setBox(null);
  }, [active]);

  const next = () => {
    buzz(6);
    if (step >= STEPS.length) {
      cue("success", { emphasis: "subtle" });
      setTour(0);
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
    setTour(0);
  };

  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const below = box ? box.top + box.height + 240 < vh : true;
  const tipTop = box ? (below ? box.top + box.height + 14 : Math.max(16, box.top - 14)) : vh / 2;
  const arrowLeft = box ? Math.min(Math.max(box.left + Math.min(box.width / 2, 60) - 24, 12), (typeof window !== "undefined" ? window.innerWidth : 390) - 72) : 40;

  return (
    <AnimatePresence>
      {active && box && s && (
        <motion.div
          key="tour"
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          role="dialog"
          aria-modal="true"
          aria-label={`Tour, step ${step} of ${STEPS.length}`}
        >
          {/* Spotlight: one rounded hole in a dimmed screen. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-2xl"
            initial={false}
            animate={{ top: box.top, left: box.left, width: box.width, height: box.height }}
            transition={{ duration: 0.4, ease: [0.77, 0, 0.175, 1] }}
            style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.72), 0 0 0 2px var(--text)" }}
          />
          <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="absolute inset-x-6 mx-auto max-w-[420px]"
              style={below ? { top: tipTop } : { bottom: vh - tipTop }}
              initial={{ opacity: 0, transform: `translateY(${below ? 6 : -6}px) scale(0.98)` }}
              animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
              exit={{ opacity: 0, transform: "scale(0.98)", transition: { duration: 0.12 } }}
              transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            >
              {below && <Arrow left={arrowLeft} up />}
              <div className="rounded-2xl bg-strong px-5 py-[18px] text-bg" style={{ boxShadow: "var(--shadow)" }}>
                <div className="font-mono text-[11.5px] font-medium tracking-[0.1em] uppercase opacity-70">
                  {step} of {STEPS.length}
                </div>
                <p className="mt-2 font-serif text-[19px] leading-[1.35] font-semibold">{s.title}</p>
                <p className="mt-2 font-serif text-[16px] leading-[1.5] opacity-85">{s.body}</p>
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
              {!below && <Arrow left={arrowLeft} />}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Arrow({ left, up = false }: { left: number; up?: boolean }) {
  return (
    <svg
      width="18"
      height="10"
      viewBox="0 0 18 10"
      aria-hidden="true"
      className="block"
      style={{ marginLeft: Math.max(14, left - 24), transform: up ? undefined : "rotate(180deg)" }}
    >
      <path d="M0 10L9 0l9 10z" fill="var(--strong)" />
    </svg>
  );
}
