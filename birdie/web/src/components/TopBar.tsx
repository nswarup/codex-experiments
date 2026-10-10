import { useEffect, useRef, useState } from "react";
import { ChevronLeft, LibraryBig, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useSaveDot } from "@/lib/saveFeedback";
import { IconButton, Wordmark } from "./ui";
import { openOverlay, popPage, popToFeed } from "@/lib/ui";
import { cue, buzz } from "@/lib/feedback";
import { cn } from "@/lib/cn";

/**
 * Sticky top bar for a scrolling page. It tucks away while reading downward and
 * comes back as soon as the reader scrolls up, like a good e-reader.
 */
export function TopBar({
  scroller,
  back = false,
  title,
  backLabel,
}: {
  scroller: React.RefObject<HTMLElement | null>;
  back?: boolean;
  title?: string;
  /** Where Back goes ("Feed" or the previous topic), shown in the button until you scroll. */
  backLabel?: string;
}) {
  const [hidden, setHidden] = useState(false);
  const newSave = useSaveDot();
  const [scrolled, setScrolled] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let last = el.scrollTop;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = el.scrollTop;
        const dy = y - last;
        if (Math.abs(dy) > 6) {
          setHidden(dy > 0 && y > 120);
          last = y;
        }
        setScrolled(y > 8);
        // Reading progress through the article under the reading line: 0 at its top,
        // 1 once its last line is on screen.
        const box = el.getBoundingClientRect();
        const head = box.top + 56;
        const line = box.top + box.height * 0.4;
        let progress = 0;
        for (const a of el.querySelectorAll<HTMLElement>("[data-article]")) {
          const r = a.getBoundingClientRect();
          if (r.bottom < box.top || r.top > box.bottom) continue;
          if (r.top <= line && r.bottom >= line) {
            const span = Math.max(1, r.height - (box.bottom - head));
            progress = Math.min(1, Math.max(0, (head - r.top) / span));
            break;
          }
        }
        if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [scroller]);

  return (
    <header
      className={cn(
        "topbar sticky top-0 z-20 bg-bg pt-[env(safe-area-inset-top,0px)] transition-[transform,border-color] duration-200 ease-[var(--ease-out)]",
        scrolled ? "border-b border-line" : "border-b border-transparent",
      )}
      style={{ transform: hidden ? "translateY(-100%)" : "translateY(0)" }}
    >
      <div aria-hidden="true" className="scroll-edge" />
      <div className="mx-auto flex h-14 max-w-[34em] items-center justify-between pr-3 pl-2" style={{ fontSize: "var(--read-size)" }}>
        <div className="flex min-w-0 items-center">
          {back ? (
            <>
              <BackButton label={backLabel ?? "Back"} collapsed={scrolled && !!title} />
              <span
                className={cn(
                  "ml-1.5 block min-w-0 flex-1 truncate font-sans text-[15px] font-semibold tracking-[-0.01em] text-strong transition-opacity duration-200",
                  scrolled && title ? "opacity-100" : "opacity-0",
                )}
                aria-hidden={!(scrolled && title)}
              >
                {title}
              </span>
            </>
          ) : (
            <span className="pl-4">
              <Wordmark />
            </span>
          )}
        </div>
        {/* One floating capsule for the page's controls (Liquid glass when it's on). */}
        <div className="glass relative flex shrink-0 items-center rounded-full">
          <IconButton
            label="Search"
            data-tour="search"
            onClick={() => {
              cue("open", { emphasis: "subtle" });
              openOverlay({ kind: "search" });
            }}
          >
            <Search size={21} strokeWidth={1.6} />
          </IconButton>
          {/* Same icons on every page, so nothing jumps between the feed and a topic. */}
          {(
            <IconButton
              label={newSave ? "Saved and history, new saved topic" : "Saved and history"}
              onClick={() => {
                cue("open", { emphasis: "subtle" });
                openOverlay({ kind: "library" });
              }}
            >
              <span className="relative">
                <LibraryBig size={20} strokeWidth={1.6} />
                {/* A small dot says "something new is in here" after a save, until the Library is opened. */}
                <AnimatePresence>
                  {newSave && (
                    <motion.span
                      aria-hidden="true"
                      initial={{ opacity: 0, transform: "scale(0.4)" }}
                      animate={{ opacity: 1, transform: "scale(1)" }}
                      exit={{ opacity: 0, transform: "scale(0.4)" }}
                      transition={{ type: "spring", stiffness: 520, damping: 22 }}
                      className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-[var(--danger)] ring-2 ring-bg"
                    />
                  )}
                </AnimatePresence>
              </span>
            </IconButton>
          )}
          <IconButton
            label="Reading settings"
            onClick={() => {
              cue("open", { emphasis: "subtle" });
              openOverlay({ kind: "settings" });
            }}
            className="font-serif text-[18px]"
          >
            Aa
          </IconButton>
        </div>
      </div>
      <div
        ref={bar}
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-px h-[2px] origin-left bg-dot"
        style={{ transform: "scaleX(0)", transition: "transform 120ms linear" }}
      />
    </header>
  );
}

/**
 * Back, the modern way: a glass pill that says where it goes ("‹ Feed"), folding into a
 * chevron circle once you scroll so the page title can take over. The chevron nudges left
 * on press, and a long press jumps straight to the feed (like iOS's back-button history).
 */
function BackButton({ label, collapsed }: { label: string; collapsed: boolean }) {
  const timer = useRef(0);
  const longPressed = useRef(false);
  const start = () => {
    longPressed.current = false;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      cue("navigate", { direction: "back" });
      buzz([8, 30, 8]);
      popToFeed();
    }, 480);
  };
  const cancel = () => window.clearTimeout(timer.current);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <motion.button
      type="button"
      layout
      transition={{ layout: { duration: 0.24, ease: [0.23, 1, 0.32, 1] } }}
      aria-label={`Back to ${label}`}
      title="Back · long-press for your feed"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (longPressed.current) return;
        cue("navigate", { direction: "back" });
        buzz(5);
        popPage();
      }}
      className="press glass group relative flex h-11 shrink-0 items-center overflow-hidden rounded-full text-strong select-none active:bg-inset"
      style={{ paddingLeft: 10, paddingRight: collapsed ? 10 : 14 }}
    >
      <ChevronLeft
        size={22}
        strokeWidth={2.2}
        aria-hidden="true"
        className="-ml-px shrink-0 transition-transform duration-150 ease-out group-active:-translate-x-0.5"
      />
      <motion.span
        initial={false}
        animate={{ width: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        className="block max-w-[9.5rem] truncate font-sans text-[15px] font-semibold tracking-[-0.01em] whitespace-nowrap"
        aria-hidden="true"
      >
        <span className="pl-0.5">{label}</span>
      </motion.span>
    </motion.button>
  );
}
