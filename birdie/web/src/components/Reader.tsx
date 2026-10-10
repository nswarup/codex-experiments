import { useEffect, useLayoutEffect, useRef } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { getState, getTopic, useApp } from "@/lib/store";
import { getUi, openOverlay, popPage, pushTopic, useUi, type Page } from "@/lib/ui";
import { smooth } from "@/lib/motion";
import { cue } from "@/lib/feedback";
import { Feed } from "./Feed";
import { TopicPage } from "./TopicPage";
import { Overlays } from "./Overlays";
import { SelectionAsk } from "./SelectionAsk";
import { Tour } from "./Tour";

const EASE = [0.32, 0.72, 0, 1] as const; // iOS-like drawer curve

// The element focused just before any tap or key, captured before navigation changes it.
let lastFocus: Element | null = null;
if (typeof document !== "undefined") {
  const track = () => {
    const a = document.activeElement;
    if (a && a !== document.body && !(a as HTMLElement).closest?.("[role=dialog]")) lastFocus = a;
  };
  document.addEventListener("pointerdown", track, true);
  document.addEventListener("keydown", track, true);
}

/** Desktop: / to search, Esc to go back, j / k for the next or previous topic in the feed. */
function useShortcuts(depth: number) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, [contenteditable=true]") || t.closest("[role=dialog]"))) return;
      if (getUi().overlay) return;
      if (e.key === "/") {
        e.preventDefault();
        openOverlay({ kind: "search" });
      } else if (e.key === "Escape" && depth > 1) {
        popPage();
      } else if ((e.key === "j" || e.key === "k") && depth === 1) {
        const feed = document.querySelector<HTMLElement>('[data-scroller="feed"]');
        if (!feed) return;
        // One landing line for both keys, so k after j finds the previous article, not this one.
        const land = feed.getBoundingClientRect().top + 48;
        const arts = [...feed.querySelectorAll<HTMLElement>("[data-article]")];
        const next =
          e.key === "j"
            ? arts.find((a) => a.getBoundingClientRect().top > land + 24)
            : [...arts].reverse().find((a) => a.getBoundingClientRect().top < land - 24);
        if (next) feed.scrollTo({ top: feed.scrollTop + next.getBoundingClientRect().top - land, behavior: smooth() });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [depth]);
}

export function Reader() {
  const stack = useUi((s) => s.stack);
  const transition = useApp((s) => s.prefs.lab.transition);
  const depth = stack.length;
  // Search covers the whole screen: everything behind it leaves the tab order and the screen reader.
  const searching = useUi((s) => s.overlay?.kind === "search");
  useShortcuts(depth);

  // A shared link (#topic-id) opens that topic on top of the feed.
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    try {
      history.replaceState(history.state, "", location.pathname + location.search);
    } catch {
      /* sandboxed */
    }
    if (getTopic(id) && getState().tour === 0) pushTopic(id);
  }, []);

  // Back returns focus to whatever opened the page (a nudge, a peek's Read).
  const openers = useRef<(Element | null)[]>([]);
  const prevDepth = useRef(depth);
  useLayoutEffect(() => {
    if (depth > prevDepth.current) openers.current.push(lastFocus);
    else if (depth < prevDepth.current) {
      let el: Element | null | undefined = null;
      for (let i = depth; i < prevDepth.current; i++) el = openers.current.pop();
      if (el instanceof HTMLElement && el.isConnected) window.setTimeout(() => el.focus({ preventScroll: true }), 60);
    }
    prevDepth.current = depth;
  }, [depth]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg">
      <div className="relative mx-auto h-full max-w-[640px] overflow-hidden" inert={searching || undefined}>
        {/* The feed stays mounted underneath every pushed page. */}
        <motion.div
          className="absolute inset-0"
          animate={
            transition === "slide"
              ? { transform: depth > 1 ? "translateX(-22%)" : "translateX(0%)" }
              : { opacity: depth > 1 ? 0 : 1 }
          }
          transition={{ duration: 0.32, ease: EASE }}
          aria-hidden={depth > 1 || undefined}
          inert={depth > 1 || undefined}
        >
          <Feed />
          <Dim on={depth > 1} />
        </motion.div>
        <AnimatePresence initial={false}>
          {stack.slice(1).map((page, i) => (
            <PageLayer key={page.key} page={page} isTop={i === depth - 2} covered={i < depth - 2} transition={transition} />
          ))}
        </AnimatePresence>
      </div>
      <Overlays />
      <SelectionAsk />
      <Tour />
    </div>
  );
}

function Dim({ on }: { on: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-black"
      initial={false}
      animate={{ opacity: on ? 0.28 : 0 }}
      transition={{ duration: 0.32, ease: EASE }}
    />
  );
}

function PageLayer({
  page,
  isTop,
  covered,
  transition,
}: {
  page: Extract<Page, { kind: "topic" }> | Page;
  isTop: boolean;
  covered: boolean;
  transition: "slide" | "fade";
}) {
  const x = useMotionValue(0);
  const boxShadow = useTransform(x, [0, 400], ["-12px 0 32px rgba(0,0,0,0.22)", "-12px 0 32px rgba(0,0,0,0)"]);
  const ref = useRef<HTMLDivElement>(null);

  // Edge swipe back: drag from the left edge, release past a third or with a quick flick.
  const drag = useRef<{ startX: number; startT: number; id: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!isTop || drag.current) return; // ignore extra fingers mid-drag
    if (e.pointerType === "mouse") return; // a desktop click near the edge isn't a swipe
    drag.current = { startX: e.clientX, startT: performance.now(), id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    x.set(Math.max(0, e.clientX - d.startX));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const dist = e.clientX - d.startX;
    const velocity = dist / Math.max(1, performance.now() - d.startT);
    const width = ref.current?.offsetWidth ?? 390;
    if (dist > width / 3 || velocity > 0.5) {
      cue("navigate", { direction: "back" });
      animate(x, width, { duration: 0.22, ease: [0.23, 1, 0.32, 1] }).then(() => popPage());
    } else {
      animate(x, 0, { duration: 0.25, ease: [0.23, 1, 0.32, 1] });
    }
  };

  // If the system takes the gesture (e.g. iOS's own edge-back), just settle back.
  const onPointerCancel = (e: React.PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    animate(x, 0, { duration: 0.2, ease: [0.23, 1, 0.32, 1] });
  };

  useEffect(() => {
    if (isTop) x.set(0);
  }, [isTop, x]);

  // Keyboard and screen-reader users land on the new page's title, not on <body>.
  useEffect(() => {
    if (!isTop) return;
    const t = window.setTimeout(() => {
      const h = ref.current?.querySelector<HTMLElement>("h1");
      if (!h || ref.current?.contains(document.activeElement)) return;
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(t);
  }, [isTop]);

  const slide = transition === "slide";
  return (
    <motion.div
      className="absolute inset-0"
      initial={slide ? { transform: "translateX(100%)" } : { opacity: 0, transform: "scale(0.985)" }}
      animate={
        slide
          ? { transform: covered ? "translateX(-22%)" : "translateX(0%)" }
          : { opacity: covered ? 0 : 1, transform: "scale(1)" }
      }
      exit={slide ? { transform: "translateX(100%)" } : { opacity: 0, transform: "scale(0.985)" }}
      transition={{ duration: 0.32, ease: EASE }}
      aria-hidden={!isTop || undefined}
      inert={!isTop || undefined}
    >
      {/* Inner layer follows the finger during an edge swipe. */}
      <motion.div ref={ref} className="absolute inset-0 bg-bg" style={slide ? { x, boxShadow } : undefined}>
        {page.kind === "topic" && <TopicPage id={page.id} />}
        <Dim on={covered} />
        {isTop && slide && (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 z-30 w-5"
            style={{ touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
