import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Clock, Search as SearchIcon, X } from "lucide-react";
import { addRecentSearch, clearRecentSearches, useApp } from "@/lib/store";
import { requestTopic } from "@/lib/generate";
import { pushTopic } from "@/lib/ui";
import { cue, buzz } from "@/lib/feedback";
import { IconButton } from "./ui";

const IDEAS = ["dogs’ sense of smell", "Massachusetts", "why the sky is blue", "the first emoji", "origami"];

/** Search = "write me a Birdie about exactly these words". No results list. */
export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const recents = useApp((s) => s.recentSearches);
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    const t = window.setTimeout(() => input.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const go = (text: string) => {
    const v = text.trim();
    if (!v) return;
    addRecentSearch(v);
    cue("tap");
    buzz(6);
    const { id } = requestTopic(v);
    input.current?.blur();
    pushTopic(id);
  };

  const suggestions = recents.length ? recents : IDEAS;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          className="fixed inset-0 z-50 bg-bg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        >
          <motion.div
            className="mx-auto max-w-[640px]"
            initial={{ transform: "translateY(10px)" }}
            animate={{ transform: "translateY(0px)" }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          >
            <form
              className="flex items-center gap-2 border-b border-line px-4 pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-3"
              onSubmit={(e) => {
                e.preventDefault();
                go(q);
              }}
              role="search"
            >
              <div className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-chip bg-card pr-1.5 pl-4">
                <SearchIcon size={19} strokeWidth={1.6} className="shrink-0 text-muted" aria-hidden="true" />
                <label htmlFor="search-input" className="sr-only">
                  Read about anything
                </label>
                <input
                  id="search-input"
                  ref={input}
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Read about anything"
                  enterKeyHint="search"
                  autoComplete="off"
                  autoCapitalize="none"
                  maxLength={120}
                  className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-strong outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
                />
                <AnimatePresence>
                  {q.trim() && (
                    <motion.button
                      type="submit"
                      aria-label="Read about this"
                      initial={{ opacity: 0, transform: "scale(0.9)" }}
                      animate={{ opacity: 1, transform: "scale(1)" }}
                      exit={{ opacity: 0, transform: "scale(0.9)" }}
                      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                      className="press flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-fg"
                    >
                      <ArrowRight size={18} strokeWidth={2} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              <button type="button" onClick={onClose} className="press h-11 px-2 font-serif text-[16px] text-text">
                Cancel
              </button>
            </form>

            <section className="px-6 pt-6" aria-label={recents.length ? "Recent searches" : "Ideas"}>
              <div className="mb-1.5 flex items-center justify-between">
                <h2 className="font-mono text-[11.5px] font-medium tracking-[0.1em] text-muted uppercase">
                  {recents.length ? "Recent" : "Try"}
                </h2>
                {recents.length > 0 && (
                  <IconButton label="Clear recent searches" onClick={() => clearRecentSearches()} className="-mr-3 text-muted">
                    <X size={16} strokeWidth={1.8} />
                  </IconButton>
                )}
              </div>
              <ul role="list">
                {suggestions.map((s, i) => (
                  <motion.li
                    key={s}
                    initial={{ opacity: 0, transform: "translateY(6px)" }}
                    animate={{ opacity: 1, transform: "translateY(0px)" }}
                    transition={{ duration: 0.25, delay: 0.04 + i * 0.03, ease: [0.23, 1, 0.32, 1] }}
                  >
                    <button
                      type="button"
                      onClick={() => go(s)}
                      className="press flex h-[52px] w-full items-center gap-3.5 border-b border-line text-left font-serif text-[17px] text-text"
                    >
                      {recents.length ? (
                        <Clock size={17} strokeWidth={1.6} className="shrink-0 text-dot" aria-hidden="true" />
                      ) : (
                        <SearchIcon size={17} strokeWidth={1.6} className="shrink-0 text-dot" aria-hidden="true" />
                      )}
                      <span className="truncate">{s}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
              <p className="mt-6 font-serif text-[15px] leading-relaxed text-muted">
                Birdie writes a short piece on exactly what you type.
              </p>
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
