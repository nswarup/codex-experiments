import { useEffect, useRef, useState } from "react";
import { ChevronLeft, LibraryBig, Search } from "lucide-react";
import { IconButton, Wordmark } from "./ui";
import { openOverlay, popPage } from "@/lib/ui";
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
  kicker,
}: {
  scroller: React.RefObject<HTMLElement | null>;
  back?: boolean;
  title?: string;
  /** Shown beside Back until the title scrolls away, so a lone chevron never floats. */
  kicker?: string;
}) {
  const [hidden, setHidden] = useState(false);
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
              <IconButton
                label="Back"
                className="glass relative"
                onClick={() => {
                  cue("navigate", { direction: "back" });
                  buzz(5);
                  popPage();
                }}
              >
                <ChevronLeft size={24} strokeWidth={1.7} />
              </IconButton>
              <span className="relative min-w-0 flex-1">
                {kicker && (
                  <span
                    aria-hidden={scrolled && !!title}
                    className={cn(
                      "absolute inset-y-0 left-0 flex items-center font-mono text-[11.5px] font-medium tracking-[0.1em] text-muted uppercase transition-opacity duration-200",
                      scrolled && title ? "opacity-0" : "opacity-100",
                    )}
                  >
                    {kicker}
                  </span>
                )}
                <span
                  className={cn(
                    "block truncate font-serif text-[15px] text-muted transition-opacity duration-200",
                    scrolled && title ? "opacity-100" : "opacity-0",
                  )}
                >
                  {title}
                </span>
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
              label="Saved and history"
              onClick={() => {
                cue("open", { emphasis: "subtle" });
                openOverlay({ kind: "library" });
              }}
            >
              <LibraryBig size={20} strokeWidth={1.6} />
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
