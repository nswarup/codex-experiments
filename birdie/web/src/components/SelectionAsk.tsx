import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageSquare } from "lucide-react";
import { openOverlay, useUi } from "@/lib/ui";
import { useApp } from "@/lib/store";
import { cue, buzz } from "@/lib/feedback";

interface Sel {
  text: string;
  topicId: string;
  x: number;
  y: number;
  below: boolean;
}

const PILL_W = 148;

/**
 * Highlight any text in an article and an "Ask Birdie" pill appears next to it.
 * It sits below the selection so it doesn't fight the phone's own copy menu above.
 */
export function SelectionAsk() {
  const [sel, setSel] = useState<Sel | null>(null);
  const overlay = useUi((s) => s.overlay);
  const tour = useApp((s) => s.tour);

  useEffect(() => {
    let t = 0;
    const read = () => {
      const s = document.getSelection();
      if (!s || s.isCollapsed || s.rangeCount === 0) return setSel(null);
      const text = s.toString().replace(/\s+/g, " ").trim();
      if (text.length < 3) return setSel(null);
      const range = s.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const el = (node.nodeType === 1 ? (node as Element) : node.parentElement)?.closest("[data-article]");
      if (!el) return setSel(null);
      const rects = range.getClientRects();
      const last = rects[rects.length - 1] ?? range.getBoundingClientRect();
      const first = rects[0] ?? last;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const below = last.bottom + 64 < vh;
      const anchor = below ? last : first;
      const x = Math.min(vw - PILL_W - 12, Math.max(12, anchor.left + anchor.width / 2 - PILL_W / 2));
      const y = below ? last.bottom + 14 : Math.max(12, first.top - 58);
      setSel({ text: text.slice(0, 600), topicId: (el as HTMLElement).dataset.article!, x, y, below });
    };
    const onChange = () => {
      window.clearTimeout(t);
      t = window.setTimeout(read, 180);
    };
    document.addEventListener("selectionchange", onChange);
    // Scrolling moves the text: hide rather than chase it, then come back once it settles.
    const onScroll = () => {
      setSel((s) => (s ? null : s));
      onChange();
    };
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", onScroll, true);
      window.clearTimeout(t);
    };
  }, []);

  const visible = !!sel && !overlay && tour === 0;

  const ask = () => {
    if (!sel) return;
    cue("open");
    buzz(8);
    openOverlay({ kind: "chat", topicId: sel.topicId, highlight: sel.text });
    document.getSelection()?.removeAllRanges();
    setSel(null);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="ask"
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={ask}
          initial={{ opacity: 0, transform: `translateY(${sel!.below ? -4 : 4}px) scale(0.96)` }}
          animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
          exit={{ opacity: 0, transform: "scale(0.96)", transition: { duration: 0.12 } }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          className="press fixed z-40 flex h-[44px] items-center justify-center gap-2 rounded-full bg-strong px-4 font-serif text-[15.5px] font-semibold text-bg"
          style={{ left: sel!.x, top: sel!.y, width: PILL_W, boxShadow: "var(--shadow)", transformOrigin: sel!.below ? "top center" : "bottom center" }}
        >
          <MessageSquare size={17} strokeWidth={1.9} aria-hidden="true" />
          Ask Birdie
        </motion.button>
      )}
    </AnimatePresence>
  );
}
