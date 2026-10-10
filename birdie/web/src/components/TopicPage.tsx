import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { useApp } from "@/lib/store";
import { readyTopic, retryTopic, useJob } from "@/lib/generate";
import { COVERING, popToFeed, useUi } from "@/lib/ui";
import { useEngagement } from "@/hooks/useEngagement";
import { cue } from "@/lib/feedback";
import { IS_ARTIFACT } from "@/lib/api";
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
      // The writer's title arrives in a moment; until then, the query, capitalised like a title.
      title: p.title ?? job.query.charAt(0).toUpperCase() + job.query.slice(1),
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
      <TopBar scroller={scroller} back title={view?.title} kicker={view?.category ?? (job ? "Birdie" : undefined)} />
      <main className="pb-[calc(env(safe-area-inset-bottom,0px)+56px)]">
        {view && <TopicArticle ref={ref} view={view} reason="opened" actions={!!topic} />}
        {job?.status === "writing" && !view?.lede && <WritingStatus />}
        {job?.status === "error" && !topic && (
          <div className="mx-auto mt-8 max-w-[34em] px-6" role="alert">
            <p className="font-serif text-[17px] text-text">{job.error}</p>
            <Button variant="secondary" className="mt-4" onClick={() => retryTopic(id)}>
              <RotateCw size={16} strokeWidth={1.8} /> Try again
            </Button>
          </div>
        )}
        {job?.demo && (
          <div className="mx-auto mt-8 max-w-[34em] px-6">
            <p className="rounded-xl border border-dashed border-dot px-4 py-3 font-serif text-[14.5px] leading-relaxed text-muted">
              {IS_ARTIFACT
                ? "Demo mode: Birdie couldn't use Claude here, so new topics are placeholders. The 100 built-in topics all work."
                : "Demo mode: new topics are placeholders until Birdie's writer is connected. Set ANTHROPIC_API_KEY or log in to Claude Code, then restart Birdie."}
            </p>
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
      <span className="writing-pulse text-dot" aria-hidden="true">
        <BirdMark size={26} />
      </span>
      <p className="font-serif text-[15px] leading-relaxed text-muted">
        Birdie is writing this one for you…
        {secs >= 6 && <span className="block opacity-80">New topics usually take under a minute.</span>}
      </p>
    </div>
  );
}
