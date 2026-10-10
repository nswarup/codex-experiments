import { smooth } from "@/lib/motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageSquare } from "lucide-react";
import { setTour, useApp } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { cue, buzz } from "@/lib/feedback";

const STEPS = [
  {
    target: "opening",
    title: "Tap an underlined phrase to read about it.",
    body: "Try it now. You get a short preview first, then Read opens the full topic.",
  },
  {
    target: "lede",
    title: "Highlight any text to ask Birdie about it.",
    body: "Press and drag over a sentence, then tap Ask Birdie. Your question opens with that passage attached.",
  },
  {
    target: "search",
    title: "Tap the search icon to read about anything.",
    body: "Type a topic, like “dogs’ sense of smell”, and Birdie will write a short piece with fun facts related to it.",
  },
] as const;

const GAP = 14;
const ARROW_H = 10;
const EDGE = 16;
const EASE = [0.23, 1, 0.32, 1] as const;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  /** Where the arrow should point, in viewport x. */
  pointX: number;
  /** Step 2 only: where the sample Ask Birdie pill sits, under the highlighted sentence. */
  pill?: { left: number; top: number };
}

const PILL_W = 132;
const PILL_H = 42;

/** The lede's first sentence, and the part of it shown as highlighted. */
function sentenceRanges(el: HTMLElement): { sentence: Range; highlight: Range } | null {
  const node = [...el.childNodes].find((n): n is Text => n.nodeType === Node.TEXT_NODE && !!(n as Text).data.trim());
  if (!node) return null;
  const text = node.data;
  const m = /[.?!](?=\s|$)/g;
  let end = -1;
  for (let x = m.exec(text); x; x = m.exec(text)) {
    if (x.index > 30) {
      end = x.index + 1;
      break;
    }
  }
  if (end < 0) end = Math.min(text.length, 140);
  // Highlight the back half of the sentence, starting on a word, like a real drag would.
  let start = Math.floor(end * 0.42);
  while (start < end && text[start] !== " ") start++;
  start = Math.min(end - 1, start + 1);
  const sentence = document.createRange();
  sentence.setStart(node, 0);
  sentence.setEnd(node, end);
  const highlight = document.createRange();
  highlight.setStart(node, start);
  highlight.setEnd(node, end);
  return { sentence, highlight };
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
  // Step 2 spotlights one sentence (not the whole lede), with a sample pill under it.
  if (target === "lede") {
    const ranges = sentenceRanges(el);
    if (ranges) {
      const sr = ranges.sentence.getBoundingClientRect();
      const lines = ranges.highlight.getClientRects();
      const endLine = lines[lines.length - 1] ?? sr;
      const boxTop = sr.top - 10;
      const boxH = sr.height + 20;
      const pillLeft = Math.min(window.innerWidth - PILL_W - 16, Math.max(16, endLine.left + endLine.width / 2 - PILL_W / 2));
      const pillTop = boxTop + boxH + 12;
      return {
        top: boxTop,
        left: r.left - 14,
        width: r.width + 28,
        height: boxH,
        pointX: pillLeft + PILL_W / 2,
        pill: { left: pillLeft, top: pillTop },
      };
    }
  }
  const height = r.height;
  return {
    top: r.top - pad,
    left: r.left - pad,
    width: r.width + pad * 2,
    height: height + pad * 2,
    pointX: target === "opening" ? first.left + Math.min(first.width / 2, 70) : r.left + r.width / 2,
  };
}

const same = (a: Box | null, b: Box | null) =>
  !!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.height - b.height) < 0.5 && Math.abs(a.width - b.width) < 0.5;

export function Tour() {
  const step = useApp((s) => s.tour);
  const [box, setBox] = useState<Box | null>(null);
  const tryIt = () => {
    const el = find("opening");
    if (!el) return;
    buzz(6);
    sawCover.current = false;
    setPaused(true);
    el.click();
  };
  const [tip, setTip] = useState<{ w: number; h: number; left: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // Step 1 can be done for real: tapping the phrase opens its preview. The tour steps aside
  // while the preview (or the topic, after Read) is open, and returns at step 2.
  const [paused, setPaused] = useState(false);
  const covered = useUi((u) => !!u.overlay || u.stack.length > 1);
  const sawCover = useRef(false);
  useEffect(() => {
    if (!paused) return;
    if (covered) sawCover.current = true;
    else if (sawCover.current) {
      sawCover.current = false;
      setPaused(false);
      setTour(2);
    }
  }, [paused, covered]);
  const active = step >= 1 && step <= STEPS.length && !paused;
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
      // Park the target high on screen so the tooltip fits underneath and the title stays readable
      // above an opening; the lede sits just under the top bar.
      const r = el.getBoundingClientRect();
      const want = s.target === "lede" ? 96 : window.innerHeight * 0.3;
      const scroller = el.closest<HTMLElement>('[data-scroller="feed"]');
      if (scroller && Math.abs(r.top - want) > 24) scroller.scrollTop += r.top - want;
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

  // The tooltip's real size decides where it can go. Only while the tour runs, and only on
  // real size changes: the ResizeObserver covers late font loads and wrapping.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!active || !el) return;
    const read = () => {
      // Card height plus a constant for the arrow: whether the arrow sits above or below
      // must never change the measurement, or placement would flip back and forth.
      const card = el.querySelector<HTMLElement>("[data-tip-card]");
      const r = { w: el.offsetWidth, h: (card?.offsetHeight ?? el.offsetHeight) + ARROW_H, left: el.offsetLeft };
      if (!r.w) return;
      setTip((t) => (t && t.w === r.w && t.h === r.h && t.left === r.left ? t : r));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active, step, !!box]);

  useEffect(() => {
    if (!active) setBox(null);
  }, [active]);

  // Step 2 shows a sample highlight on the real sentence (CSS Custom Highlight; skipped where unsupported).
  useEffect(() => {
    if (!active || s?.target !== "lede") return;
    const reg = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    const el = find("lede");
    const ranges = el && sentenceRanges(el);
    if (!reg || !HighlightCtor || !ranges) return;
    reg.set("birdie-tour", new HighlightCtor(ranges.highlight));
    return () => void reg.delete("birdie-tour");
  }, [active, s, box?.top]);

  // Escape skips the tour, but not the same Escape that just closed the step-1 preview
  // (the tour comes back mid-keypress, so that key event would reach us too).
  const shownAt = useRef(0);
  useEffect(() => {
    if (active) shownAt.current = performance.now();
  }, [active, step]);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && performance.now() - shownAt.current > 300 && skip();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Leave the reader at the top of the first topic, wherever the tour scrolled to.
  const finish = () => {
    setTour(0);
    document.querySelector('[data-scroller="feed"]')?.scrollTo({ top: 0, behavior: smooth() });
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
    const bottom = box.pill ? box.pill.top + PILL_H : box.top + box.height;
    const fitsBelow = bottom + GAP + tipH + EDGE <= vh;
    const fitsAbove = box.top - GAP - tipH >= EDGE;
    const lowerHalf = box.top + box.height / 2 > vh / 2;
    if (fitsBelow && (step === 1 || !(lowerHalf && fitsAbove))) {
      placement = "below";
      top = bottom + GAP;
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
          {s.target === "opening" && (
            <button
              type="button"
              aria-label="Try it: open the preview"
              onClick={tryIt}
              className="absolute cursor-pointer rounded-2xl"
              style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
            />
          )}
          {box.pill && (
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0, transform: "translateY(-4px) scale(0.96)" }}
              animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
              transition={{ duration: 0.2, delay: 0.12, ease: EASE }}
              className="glass-heavy glass-ink pointer-events-none absolute flex items-center justify-center gap-2 rounded-full bg-strong font-serif text-[15px] font-semibold text-bg shadow-[var(--shadow)]"
              style={{ left: box.pill.left, top: box.pill.top, width: PILL_W, height: PILL_H }}
            >
              <MessageSquare size={16} strokeWidth={1.9} /> Ask Birdie
            </motion.div>
          )}

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
              <div data-tip-card className="rounded-2xl bg-strong px-5 py-[18px] text-bg" style={{ boxShadow: "var(--shadow)" }}>
                <div className="font-mono text-[11.5px] font-medium tracking-[0.1em] uppercase opacity-70">
                  {step} of {STEPS.length}
                </div>
                <p className="mt-2 font-serif text-[19px] leading-[1.35] font-semibold text-balance">{s.title}</p>
                <p className="mt-2 font-serif text-[16px] leading-[1.5] text-pretty opacity-85">{s.body}</p>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={step < STEPS.length ? skip : back}
                    className="press -ml-2 h-11 px-2 font-serif text-[15px] underline underline-offset-4 opacity-75"
                  >
                    {step < STEPS.length ? "Skip tour" : "Back"}
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
