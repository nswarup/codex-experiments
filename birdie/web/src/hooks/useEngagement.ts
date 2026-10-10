import { useEffect, useRef } from "react";
import type { Topic } from "@/lib/types";
import { expectedSeconds } from "@/content";
import { recordEngagement, recordSeen } from "@/lib/store";

/** Engagement already applied this session, per topic, so re-reads only add the difference. */
const applied = new Map<string, number>();
/** Seconds read this session, per topic (shared, but only one instance is ever active). */
const readSeconds = new Map<string, number>();

/**
 * Track continuous reading time for an article element.
 *
 * Time counts while the article crosses the middle band of the viewport (30%-70%,
 * i.e. it is what you're reading), the page is the one on top (`active`), and the tab
 * is visible. When the reader moves on (article leaves the band, page covered, tab
 * hidden, unmount), engagement = time / expected time is applied to the profile.
 */
export function useEngagement(
  ref: React.RefObject<HTMLElement | null>,
  topic: Topic | undefined,
  root: React.RefObject<HTMLElement | null> | undefined,
  active: boolean,
) {
  const inBand = useRef(false);
  const activeRef = useRef(active);
  const api = useRef<{ start: () => void; stop: () => void; commit: () => void } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !topic) return;
    const expected = expectedSeconds(topic);
    let startedAt: number | null = null;
    let seenMarked = false;

    const flushTime = () => {
      if (startedAt != null) {
        const now = performance.now();
        readSeconds.set(topic.id, (readSeconds.get(topic.id) ?? 0) + (now - startedAt) / 1000);
        startedAt = now;
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
    const counting = () => inBand.current && activeRef.current && document.visibilityState === "visible";
    const start = () => {
      if (startedAt == null && counting()) startedAt = performance.now();
    };
    const stop = () => {
      flushTime();
      startedAt = null;
    };
    api.current = { start, stop, commit };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !inBand.current) {
            inBand.current = true;
            start();
          } else if (!entry.isIntersecting && inBand.current) {
            inBand.current = false;
            stop();
            commit();
          }
        }
      },
      { root: root?.current ?? null, rootMargin: "-30% 0px -30% 0px", threshold: 0 },
    );
    io.observe(el);

    const tick = window.setInterval(() => {
      if (startedAt == null) return;
      flushTime();
      if (!seenMarked && (readSeconds.get(topic.id) ?? 0) > 3) {
        seenMarked = true;
        recordSeen(topic.id);
      }
    }, 1000);

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        stop();
        commit();
      } else start();
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
      inBand.current = false;
      api.current = null;
    };
  }, [ref, topic, root]);

  // Pause while the page is covered by another page or a full-screen sheet.
  useEffect(() => {
    activeRef.current = active;
    const a = api.current;
    if (!a) return;
    if (active) a.start();
    else {
      a.stop();
      a.commit();
    }
  }, [active]);
}
