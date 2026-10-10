import { smooth } from "@/lib/motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowDown } from "lucide-react";
import { cue, buzz } from "@/lib/feedback";
import type { Topic } from "@/lib/types";
import { allTopics, getState, getTopic, useApp } from "@/lib/store";
import { FEED_WILDCARD_RATE, pickNext } from "@/lib/ranking";
import { useEngagement } from "@/hooks/useEngagement";
import { COVERING, getUi, openOverlay, pushTopic, useUi } from "@/lib/ui";
import { TopicArticle, viewOf } from "./TopicArticle";
import { Nudges } from "./Nudges";
import { TopBar } from "./TopBar";
import { BirdMark } from "./ui";

interface FeedItem {
  key: string;
  topic: Topic;
  reason: "match" | "wildcard";
}

let keySeq = 0;
/** The feed survives remounts within a session (e.g. after editing interests). */
let sessionFeed: FeedItem[] | null = null;

function nextItem(exclude: Set<string>, prev?: FeedItem): FeedItem | null {
  const profile = getState().profile;
  if (!profile) return null;
  // Generated topics join the pool once written, so search and taps shape the feed too.
  // Open on something you picked, and never serve two wildcards back to back.
  const allowWildcard = !!prev && prev.reason !== "wildcard";
  const pick = pickNext(profile, allTopics(), Math.random, exclude, { allowWildcard, wildcardRate: FEED_WILDCARD_RATE });
  return pick ? { key: `f${++keySeq}`, topic: pick.topic, reason: pick.reason } : null;
}

/**
 * Pick up exactly where the reader was after a reload or the phone dropping the tab
 * (same tab only: opening Birdie fresh still starts on a new ranked topic).
 */
const RESUME_KEY = "birdie.resume.v1";
interface Resume {
  feed: { id: string; reason: FeedItem["reason"] }[];
  scroll: number;
  pages: string[];
  at: number;
}
function readResume(): Resume | null {
  try {
    const r = JSON.parse(sessionStorage.getItem(RESUME_KEY) || "null") as Resume | null;
    return r && Date.now() - r.at < 6 * 3600_000 ? r : null;
  } catch {
    return null;
  }
}
let resume = typeof window === "undefined" ? null : readResume();

function initialFeed(): FeedItem[] {
  if (sessionFeed) return sessionFeed;
  if (resume) {
    const restored = resume.feed
      .map((f) => ({ topic: getTopic(f.id), reason: f.reason }))
      .filter((f): f is { topic: Topic; reason: FeedItem["reason"] } => !!f.topic)
      .map((f) => ({ key: `f${++keySeq}`, ...f }));
    if (restored.length) return restored;
    resume = null;
  }
  const first = nextItem(new Set());
  const items: FeedItem[] = [];
  if (first) items.push(first);
  const second = nextItem(new Set(items.map((i) => i.topic.id)), items[0]);
  if (second) items.push(second);
  return items;
}

export function resetFeed() {
  sessionFeed = null;
}

export function Feed() {
  const scroller = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<FeedItem[]>(initialFeed);
  const tour = useApp((s) => s.tour);
  const mode = useApp((s) => s.prefs.lab.feed);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionFeed = items;
  }, [items]);

  // Restore the reading position once, then keep a snapshot for the next reload.
  const restoredOnce = useRef(false);
  useLayoutEffect(() => {
    if (restoredOnce.current || !resume || tour > 0) return;
    restoredOnce.current = true;
    if (scroller.current) scroller.current.scrollTop = resume.scroll;
    for (const id of resume.pages) if (getTopic(id)) pushTopic(id);
    resume = null; // one-shot: a later remount (e.g. new interests) starts fresh
  }, [tour]);
  useEffect(() => {
    const save = () => {
      if (!getState().onboarded) return; // "Start over" is reloading: nothing to resume
      try {
        const pages = getUi()
          .stack.filter((p): p is Extract<typeof p, { kind: "topic" }> => p.kind === "topic")
          .map((p) => p.id)
          .filter((id) => getTopic(id));
        const snap: Resume = {
          feed: (sessionFeed ?? []).slice(-30).map((i) => ({ id: i.topic.id, reason: i.reason })),
          scroll: scroller.current?.scrollTop ?? 0,
          pages,
          at: Date.now(),
        };
        sessionStorage.setItem(RESUME_KEY, JSON.stringify(snap));
      } catch {
        /* storage blocked: nothing to resume, which is fine */
      }
    };
    const onHide = () => document.visibilityState === "hidden" && save();
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  const append = useCallback(() => {
    setItems((cur) => {
      const ids = new Set(cur.map((i) => i.topic.id));
      // After the whole library, start again from the topics furthest up the feed.
      const n = nextItem(ids, cur[cur.length - 1]) ?? nextItem(new Set(cur.slice(-12).map((i) => i.topic.id)), cur[cur.length - 1]);
      return n ? [...cur, n] : cur;
    });
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    const root = scroller.current;
    if (!el || !root || mode === "one") return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && append(), { root, rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [append, items.length, mode]);

  // One-at-a-time mode: show topics up to `shown`, revealing the next on request.
  const [shown, setShown] = useState(1);
  const visible = mode === "one" ? items.slice(0, shown) : items;
  const nextTopic = () => {
    cue("navigate");
    buzz(6);
    if (shown >= items.length) append();
    setShown((n) => n + 1);
    window.setTimeout(() => {
      const arts = scroller.current?.querySelectorAll("[data-article]");
      arts?.[arts.length - 1]?.scrollIntoView({ behavior: smooth(), block: "start" });
    }, 60);
  };

  return (
    <div
      ref={scroller}
      data-scroller="feed"
      className="no-scrollbar absolute inset-0 overflow-y-auto overscroll-contain"
      style={{ overflowY: tour > 0 ? "hidden" : "auto" }}
    >
      <TopBar scroller={scroller} />
      <main className="pb-[calc(env(safe-area-inset-bottom,0px)+48px)]">
        {!visible.length && (
          // Only reachable if interests were lost somehow: one clear way forward.
          <div className="mx-auto mt-24 flex max-w-[34em] flex-col items-start gap-4 px-6">
            <BirdMark size={30} className="text-muted" />
            <p className="font-serif text-[19px] leading-snug text-strong">Pick a few interests and Birdie will find something worth reading.</p>
            <button
              type="button"
              onClick={() => openOverlay({ kind: "interests" })}
              className="press h-12 rounded-full bg-accent px-6 font-serif text-[16px] font-semibold text-accent-fg"
            >
              Choose interests
            </button>
          </div>
        )}
        {visible.map((item, i) => (
          <FeedEntry
            key={item.key}
            item={item}
            index={i}
            scroller={scroller}
            exclude={items.map((x) => x.topic.id)}
          />
        ))}
        {mode === "one" ? (
          <div className="mx-auto mt-10 max-w-[34em] px-6">
            <button
              type="button"
              onClick={nextTopic}
              className="press flex h-[54px] w-full items-center justify-center gap-2 rounded-full border border-chip font-serif text-[17px] font-semibold text-strong"
            >
              Next topic <ArrowDown size={18} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div ref={sentinel} aria-hidden="true" className="h-px" />
        )}
      </main>
    </div>
  );
}

function FeedEntry({
  item,
  index,
  scroller,
  exclude,
}: {
  item: FeedItem;
  index: number;
  scroller: React.RefObject<HTMLDivElement | null>;
  exclude: string[];
}) {
  const ref = useRef<HTMLElement>(null);
  const active = useUi((s) => s.stack.length === 1 && !(s.overlay && COVERING.includes(s.overlay.kind)));
  useEngagement(ref, item.topic, scroller, active);
  const body = (
    <>
      {index > 0 && <SectionBreak />}
      <TopicArticle ref={ref} view={viewOf(item.topic)} reason={item.reason} tourAnchor={index === 0} />
      <Nudges topic={item.topic} exclude={exclude} />
    </>
  );
  if (index === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, transform: "translateY(6px)" }}
        animate={{ opacity: 1, transform: "translateY(0px)" }}
        transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
      >
        {body}
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, transform: "translateY(10px)" }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, root: scroller, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
    >
      {body}
    </motion.div>
  );
}

function SectionBreak() {
  return (
    <div aria-hidden="true" className="mx-auto mt-16 mb-4 flex max-w-[34em] items-center gap-4 px-6 text-muted">
      <span className="h-px flex-1 bg-line" />
      <BirdMark size={26} />
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
