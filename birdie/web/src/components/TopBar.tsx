import { useEffect, useRef, useState } from "react";
import { Bookmark, ChevronLeft, Search } from "lucide-react";
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
}: {
  scroller: React.RefObject<HTMLElement | null>;
  back?: boolean;
  title?: string;
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
        // Reading progress through whichever article is under the reading line.
        const box = el.getBoundingClientRect();
        const line = box.top + box.height * 0.4;
        let progress = 0;
        for (const a of el.querySelectorAll<HTMLElement>("[data-article]")) {
          const r = a.getBoundingClientRect();
          if (r.bottom < box.top || r.top > box.bottom) continue;
          if (r.top <= line && r.bottom >= line) {
            progress = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height)));
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
        "sticky top-0 z-20 bg-bg pt-[env(safe-area-inset-top,0px)] transition-[transform,border-color] duration-200 ease-[var(--ease-out)]",
        scrolled ? "border-b border-line" : "border-b border-transparent",
      )}
      style={{ transform: hidden ? "translateY(-100%)" : "translateY(0)" }}
    >
      <div className="mx-auto flex h-14 max-w-[34em] items-center justify-between pr-2 pl-2" style={{ fontSize: "var(--read-size)" }}>
        <div className="flex min-w-0 items-center">
          {back ? (
            <>
              <IconButton
                label="Back"
                onClick={() => {
                  cue("navigate", { direction: "back" });
                  buzz(5);
                  popPage();
                }}
              >
                <ChevronLeft size={24} strokeWidth={1.7} />
              </IconButton>
              <span
                className={cn(
                  "min-w-0 truncate font-serif text-[15px] text-muted transition-opacity duration-200",
                  scrolled && title ? "opacity-100" : "opacity-0",
                )}
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
        <div className="flex shrink-0 items-center gap-0.5">
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
              <Bookmark size={20} strokeWidth={1.6} />
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
