import { useEffect, useRef } from "react";
import type { Topic } from "@/lib/types";
import { expectedSeconds } from "@/content";
import { recordEngagement, recordSeen } from "@/lib/store";

/** Engagement already applied this session, per topic, so re-reads only add the difference. */
const applied = new Map<string, number>();
/** Seconds read this session, per topic. */
const readSeconds = new Map<string, number>();

export function sessionEngagement(id: string) {
  return applied.get(id) ?? 0;
}

/**
 * Track continuous reading time for an article element.
 * Time counts while the article fills at least 40% of the viewport and the tab is visible.
 * When the reader moves on (article leaves view, page hidden, unmount), the engagement
 * (time / expected time) is applied to the profile.
 */
export function useEngagement(ref: React.RefObject<HTMLElement | null>, topic: Topic | undefined, root?: React.RefObject<HTMLElement | null>) {
  const visible = useRef(false);
  const startedAt = useRef<number | null>(null);
  const seenMarked = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !topic) return;
    const expected = expectedSeconds(topic);

    const flushTime = () => {
      if (startedAt.current != null) {
        const s = (performance.now() - startedAt.current) / 1000;
        readSeconds.set(topic.id, (readSeconds.get(topic.id) ?? 0) + s);
        startedAt.current = performance.now();
      }
    };

    const commit = () => {
      flushTime();
      const secs = readSeconds.get(topic.id) ?? 0;
      if (secs < 1.5) return;
      const e = secs / expected;
      const prev = applied.get(topic.id) ?? 0;
      if (Math.abs(e - prev) < 0.02) return;
      recordEngagement(topic, e, prev);
      applied.set(topic.id, e);
    };

    const start = () => {
      if (startedAt.current == null && document.visibilityState === "visible") startedAt.current = performance.now();
    };
    const stop = () => {
      flushTime();
      startedAt.current = null;
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const vh = entry.rootBounds?.height || window.innerHeight;
          const fill = entry.intersectionRect.height / vh;
          const now = entry.isIntersecting && fill >= 0.4;
          if (now && !visible.current) {
            visible.current = true;
            start();
          } else if (!now && visible.current) {
            visible.current = false;
            stop();
            commit();
          }
        }
      },
      { root: root?.current ?? null, threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] },
    );
    io.observe(el);

    const tick = window.setInterval(() => {
      if (!visible.current) return;
      flushTime();
      if (!seenMarked.current && (readSeconds.get(topic.id) ?? 0) > 3) {
        seenMarked.current = true;
        recordSeen(topic.id);
      }
    }, 1000);

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        stop();
        commit();
      } else if (visible.current) start();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", commit);

    return () => {
      io.disconnect();
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", commit);
      stop();
      commit();
      visible.current = false;
    };
  }, [ref, topic, root]);
}
