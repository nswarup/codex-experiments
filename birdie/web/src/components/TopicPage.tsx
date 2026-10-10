import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { RotateCw } from "lucide-react";
import { useApp } from "@/lib/store";
import { readyTopic, retryTopic, useJob } from "@/lib/generate";
import { COVERING, popToFeed, useUi } from "@/lib/ui";
import { useEngagement } from "@/hooks/useEngagement";
import { cue } from "@/lib/feedback";
import { TopicArticle, viewOf, type ArticleView } from "./TopicArticle";
import { Nudges } from "./Nudges";
import { TopBar } from "./TopBar";
import { BirdMark, Button } from "./ui";

/** A topic pushed on top of the feed: from a nudge, a peek, search, chat or the library. */
export function TopicPage({ id }: { id: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLElement>(null);
  // Re-render when a generated topic is saved.
  useApp((s) => s.generated[id]);
  const job = useJob(id);
  const topic = readyTopic(id);
  const depth = useUi((s) => s.stack.length);
  const active = useUi(
    (s) => s.stack[s.stack.length - 1]?.kind === "topic" && (s.stack[s.stack.length - 1] as { id: string }).id === id && !(s.overlay && COVERING.includes(s.overlay.kind)),
  );
  useEngagement(ref, topic, scroller, active);

  const wasWriting = useRef(false);
  useEffect(() => {
    if (job?.status === "writing") wasWriting.current = true;
    if (job?.status === "done" && wasWriting.current) {
      wasWriting.current = false;
      cue("ready", { emphasis: "subtle" });
    }
  }, [job?.status]);

  let view: ArticleView | null = topic ? viewOf(topic) : null;
  if (!view && job) {
    const p = job.partial;
    view = {
      id,
      title: p.title ?? job.query,
      category: p.category,
      hook: p.hook,
      lede: p.lede,
      bullets: p.bullets,
      writing: job.status === "writing",
      caret: job.status === "writing" ? (p.writing === "hook" || p.writing === "lede" || p.writing === "bullet" ? p.writing : undefined) : undefined,
    };
  }

  return (
    <div ref={scroller} className="no-scrollbar absolute inset-0 overflow-y-auto overscroll-contain bg-bg">
      <TopBar scroller={scroller} back title={view?.title} />
      <main className="pb-[calc(env(safe-area-inset-bottom,0px)+56px)]">
        {job?.demo && (
          <div className="mx-auto mt-4 max-w-[34em] px-6">
            <p className="rounded-xl border border-dashed border-dot px-4 py-3 font-mono text-[12.5px] leading-relaxed text-muted">
              Demo mode: Birdie's writer isn't connected, so new topics are placeholders. See the README to connect Claude.
            </p>
          </div>
        )}
        {view && <TopicArticle ref={ref} view={view} reason="opened" />}
        {job?.status === "writing" && !view?.lede && <WritingStatus />}
        {job?.status === "error" && !topic && (
          <div className="mx-auto mt-8 max-w-[34em] px-6" role="alert">
            <p className="font-serif text-[17px] text-text">{job.error}</p>
            <Button variant="secondary" className="mt-4" onClick={() => retryTopic(id)}>
              <RotateCw size={16} strokeWidth={1.8} /> Try again
            </Button>
          </div>
        )}
        {topic && <Nudges topic={topic} />}
        {topic && depth > 2 && (
          <div className="mx-auto mt-8 max-w-[34em] px-6">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 text-muted"
              onClick={() => {
                cue("navigate", { direction: "back" });
                popToFeed();
              }}
            >
              Back to your feed
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

/** Honest waiting state: what's happening, and how long it usually takes. */
function WritingStatus() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSecs((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="mx-auto mt-7 flex max-w-[34em] items-center gap-3 px-6" role="status">
      <motion.span
        className="text-dot"
        animate={{ transform: ["translateY(0px) rotate(0deg)", "translateY(-3px) rotate(-4deg)", "translateY(0px) rotate(0deg)"] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      >
        <BirdMark size={26} />
      </motion.span>
      <p className="font-mono text-[13px] leading-relaxed text-muted">
        Birdie is writing this one for you…
        {secs >= 6 && <span className="block opacity-80">New topics usually take 10–20 seconds.</span>}
      </p>
    </div>
  );
}
