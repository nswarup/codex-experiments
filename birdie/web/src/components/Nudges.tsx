import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import type { Topic } from "@/lib/types";
import { allTopics, recordTap, useApp } from "@/lib/store";
import { pickNudges } from "@/lib/ranking";
import { pushTopic } from "@/lib/ui";
import { cue, buzz } from "@/lib/feedback";
import { cn } from "@/lib/cn";

export function openTopic(t: Topic, from?: string) {
  recordTap(t);
  cue("navigate");
  buzz(6);
  pushTopic(t.id, from);
}

/** "Next, maybe…": two close topics plus one wildcard from another category. */
export function Nudges({ topic, exclude }: { topic: Topic; exclude?: string[] }) {
  const profile = useApp((s) => s.profile);
  const variant = useApp((s) => s.prefs.lab.nudges);
  const wildLabel = useApp((s) => s.prefs.lab.wildcardLabel);
  // Picked once per topic so cards don't reshuffle while you read.
  const { close, wildcard } = useMemo(
    () => (profile ? pickNudges(profile, topic, allTopics().filter((t) => !t.generated), new Set(exclude)) : { close: [], wildcard: null }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topic.id],
  );
  const items = [...close.map((t) => ({ t, wild: false })), ...(wildcard ? [{ t: wildcard, wild: true }] : [])];
  if (!items.length) return null;

  return (
    <section aria-label="Next, maybe" className="mx-auto mt-10 measure px-6">
      <h2 className="font-serif text-[19px] font-medium italic text-strong">Next, maybe…</h2>
      <div className={cn("mt-2.5 flex flex-col", variant === "cards" ? "gap-2" : "")}>
        {items.map(({ t, wild }) =>
          variant === "cards" ? (
            <button
              key={t.id}
              type="button"
              onClick={() => openTopic(t, topic.id)}
              className={cn(
                "press card-hover flex flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2.5 text-left",
                wild ? "border-dashed border-dot bg-transparent" : "border-line bg-card",
              )}
            >
              {wild && wildLabel && (
                <span className="font-mono text-[11.5px] tracking-[0.1em] text-muted uppercase">Something different</span>
              )}
              <span className="font-serif text-[17px] leading-snug font-semibold text-strong">{t.title}</span>
              <span className="line-clamp-2 font-mono text-[13px] leading-[1.45] text-muted">
                <span className="font-medium tracking-[0.08em] text-text">{t.category.toUpperCase()}</span> · {t.hook}
              </span>
            </button>
          ) : (
            <button
              key={t.id}
              type="button"
              onClick={() => openTopic(t, topic.id)}
              className="press flex items-center gap-3 border-b border-line py-3 text-left last:border-b-0"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-serif text-[17px] leading-snug font-semibold text-strong">
                  {t.title}
                  {wild && wildLabel && <span className="ml-2 font-mono text-[11.5px] font-normal text-muted uppercase">· wildcard</span>}
                </span>
                <span className="truncate font-mono text-[13px] text-muted">
                  <span className="font-medium tracking-[0.08em] text-text">{t.category.toUpperCase()}</span> · {t.hook}
                </span>
              </span>
              <ArrowRight size={18} strokeWidth={1.6} className={cn("shrink-0 text-muted", wild && "opacity-60")} />
            </button>
          ),
        )}
      </div>
    </section>
  );
}
