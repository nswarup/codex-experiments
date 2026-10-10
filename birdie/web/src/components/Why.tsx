import { X } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "@/lib/store";
import { readyTopic } from "@/lib/generate";
import { explain, catScore } from "@/lib/ranking";
import { CATEGORY_LIST } from "@/content";
import type { Overlay } from "@/lib/ui";
import { IconButton, Sheet } from "./ui";
import { cn } from "@/lib/cn";

function Meter({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  const pct = Math.round((Math.min(2, Math.max(0, value)) / 2) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className={cn("w-[7.5em] shrink-0 truncate font-mono text-[12.5px]", highlight ? "font-medium text-strong" : "text-muted")}>
        {label}
      </span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-inset" aria-hidden="true">
        <motion.span
          className={cn("absolute inset-0 origin-left rounded-full", highlight ? "bg-strong" : "bg-dot")}
          initial={{ transform: "scaleX(0.02)" }}
          animate={{ transform: `scaleX(${Math.max(0.02, pct / 100)})` }}
          transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        />
      </span>
      <span className="sr-only">{pct}%</span>
    </div>
  );
}

/** Transparent ranking: why this topic showed up, and what Birdie has learned. */
export function WhySheet({
  open,
  data,
  onClose,
}: {
  open: boolean;
  data: Extract<Overlay, { kind: "why" }>;
  onClose: () => void;
}) {
  const profile = useApp((s) => s.profile);
  const topic = readyTopic(data.topicId);
  if (!profile || !topic) return null;
  const ex = explain(profile, topic);
  const sentence =
    data.reason === "wildcard"
      ? `A wildcard from ${topic.category}. About one in five topics comes from outside your picks, so Birdie can find interests you didn't know you had.`
      : data.reason === "opened"
        ? `You opened this one yourself. Birdie counts that as a strong signal for ${topic.category} and the niches below.`
        : ex.picked
          ? `You picked ${topic.category}, and its niches match what you've been reading.`
          : `Your reading has pulled ${topic.category} up the list, even though you didn't pick it at the start.`;
  const cats = [...CATEGORY_LIST].sort((a, b) => catScore(profile, b) - catScore(profile, a));

  return (
    <Sheet open={open} onClose={onClose} title="Why this topic">
      <div className="no-scrollbar overflow-y-auto px-6 pt-1 pb-[calc(env(safe-area-inset-bottom,0px)+28px)]" data-vaul-no-drag>
        <div className="flex h-11 items-center justify-between">
          <h2 className="font-serif text-[17px] font-semibold text-strong">Why this topic?</h2>
          <IconButton label="Close" onClick={onClose} className="-mr-3 text-muted">
            <X size={19} strokeWidth={1.8} />
          </IconButton>
        </div>
        <p className="mt-1 font-serif text-[17px] leading-[1.55] text-text">{sentence}</p>

        <h3 className="mt-6 font-mono text-[11.5px] font-medium tracking-[0.1em] text-muted uppercase">This topic's niches</h3>
        <div className="mt-3 flex flex-col gap-2.5">
          {ex.tags.map((t) => (
            <Meter key={t.tag} label={t.tag.replace(/-/g, " ")} value={t.score} />
          ))}
        </div>

        <h3 className="mt-7 font-mono text-[11.5px] font-medium tracking-[0.1em] text-muted uppercase">Your interests right now</h3>
        <div className="mt-3 flex flex-col gap-2.5">
          {cats.map((c) => (
            <Meter key={c} label={c} value={catScore(profile, c)} highlight={c === topic.category} />
          ))}
        </div>
        <p className="mt-6 font-mono text-[12px] leading-relaxed text-muted">
          Birdie learns quietly from how long you read, what you tap and what you ask about. Nothing leaves this device.
        </p>
      </div>
    </Sheet>
  );
}
