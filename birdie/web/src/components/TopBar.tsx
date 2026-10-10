import { useEffect, useState } from "react";
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
        "sticky top-0 z-20 bg-bg/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md transition-[transform,border-color] duration-300 ease-[var(--ease-out)]",
        scrolled ? "border-b border-line" : "border-b border-transparent",
      )}
      style={{ transform: hidden ? "translateY(-100%)" : "translateY(0)" }}
    >
      <div className="flex h-14 items-center justify-between pr-2 pl-2">
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
          {!back && (
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
    </header>
  );
}
