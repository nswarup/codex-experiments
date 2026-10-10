import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { Topic } from "@/lib/types";
import { allTopics, getState, useApp } from "@/lib/store";
import { pickNext } from "@/lib/ranking";
import { useEngagement } from "@/hooks/useEngagement";
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

function nextItem(exclude: Set<string>): FeedItem | null {
  const profile = getState().profile;
  if (!profile) return null;
  // Generated topics join the pool once written, so search and taps shape the feed too.
  const pick = pickNext(profile, allTopics(), Math.random, exclude);
  return pick ? { key: `f${++keySeq}`, topic: pick.topic, reason: pick.reason } : null;
}

function initialFeed(): FeedItem[] {
  if (sessionFeed) return sessionFeed;
  const first = nextItem(new Set());
  const items: FeedItem[] = [];
  if (first) items.push(first);
  const second = nextItem(new Set(items.map((i) => i.topic.id)));
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
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionFeed = items;
  }, [items]);

  const append = useCallback(() => {
    setItems((cur) => {
      const ids = new Set(cur.map((i) => i.topic.id));
      const n = nextItem(ids);
      return n ? [...cur, n] : cur;
    });
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    const root = scroller.current;
    if (!el || !root) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && append(), { root, rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [append, items.length]);

  // While the tour runs, keep the reader on the first topic.
  useEffect(() => {
    if (tour > 0) scroller.current?.scrollTo({ top: 0 });
  }, [tour]);

  return (
    <div
      ref={scroller}
      data-scroller="feed"
      className="no-scrollbar absolute inset-0 overflow-y-auto overscroll-contain"
      style={{ overflowY: tour > 0 ? "hidden" : "auto" }}
    >
      <TopBar scroller={scroller} />
      <main className="pb-[calc(env(safe-area-inset-bottom,0px)+48px)]">
        {items.map((item, i) => (
          <FeedEntry
            key={item.key}
            item={item}
            index={i}
            scroller={scroller}
            exclude={items.map((x) => x.topic.id)}
          />
        ))}
        <div ref={sentinel} aria-hidden="true" className="h-px" />
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
  useEngagement(ref, item.topic, scroller);
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
        initial={{ opacity: 0, transform: "translateY(10px)" }}
        animate={{ opacity: 1, transform: "translateY(0px)" }}
        transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      >
        {body}
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, transform: "translateY(16px)" }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, root: scroller, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
    >
      {body}
    </motion.div>
  );
}

function SectionBreak() {
  return (
    <div aria-hidden="true" className="mx-auto mt-14 mb-2 flex max-w-[34em] items-center gap-4 px-6 text-dot">
      <span className="h-px flex-1 bg-line" />
      <BirdMark size={22} />
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
