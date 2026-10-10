import { Bookmark, BookmarkCheck, X } from "lucide-react";
import { toast } from "sonner";
import { getTopic, recordTap, toggleSaved, useApp } from "@/lib/store";
import { readyTopic, useJob } from "@/lib/generate";
import { pushTopic, type Overlay } from "@/lib/ui";
import { cue, buzz } from "@/lib/feedback";
import { Button, IconButton, Kicker, Sheet } from "./ui";
import { SkeletonLines } from "./TopicArticle";

/** Preview of a tapped bullet opening: a short teaser, then Read or Save for later. */
export function PeekSheet({
  open,
  data,
  onClose,
}: {
  open: boolean;
  data: Extract<Overlay, { kind: "peek" }>;
  onClose: () => void;
}) {
  const targetId = data.linkId ?? data.jobId ?? "";
  const job = useJob(data.linkId ? null : data.jobId ?? null);
  useApp((s) => s.generated[targetId]);
  const topic = data.linkId ? getTopic(data.linkId) : readyTopic(targetId);
  const saved = useApp((s) => s.saved.some((x) => x.id === targetId));

  const category = topic?.category ?? job?.partial.category;
  const teaser = topic?.peek ?? job?.partial.peek;
  const writingTeaser = !teaser && job?.status === "writing";
  const failed = !topic && job?.status === "error";

  const read = () => {
    if (!targetId) return;
    if (topic) recordTap(topic);
    cue("navigate");
    buzz(6);
    pushTopic(targetId, data.fromTopicId);
  };

  const save = () => {
    const on = toggleSaved(targetId);
    cue("toggle", { direction: on ? "forward" : "back" });
    buzz(on ? [6, 30, 6] : 6);
    if (on) toast("Saved for later", { duration: 2200 });
  };

  return (
    <Sheet open={open} onClose={onClose} title={data.opening} describedBy="peek-teaser">
      <div className="px-6 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+28px)]">
        <div className="flex h-11 items-center justify-between">
          <Kicker>{category ?? " "}</Kicker>
          <IconButton label="Close" onClick={onClose} className="-mr-3 text-muted">
            <X size={19} strokeWidth={1.8} />
          </IconButton>
        </div>
        <h2 className="font-serif text-[28px] leading-[1.2] font-medium text-strong text-balance">
          {topic?.title ?? data.opening}
        </h2>
        <div id="peek-teaser" className="mt-3.5 min-h-[5.2em] font-serif text-[17px] leading-[1.6] text-text">
          {teaser ? (
            <p className={job?.status === "writing" && job.partial.writing === "peek" ? "caret" : undefined}>{teaser}</p>
          ) : writingTeaser ? (
            <SkeletonLines lines={3} className="pt-1.5" />
          ) : failed ? (
            <p className="text-muted">{job?.error}</p>
          ) : null}
        </div>
        <div className="mt-6 flex gap-2.5">
          <Button size="lg" className="flex-1" onClick={read} disabled={failed}>
            Read
          </Button>
          <Button size="lg" variant="secondary" onClick={save} aria-pressed={saved} className="px-5 font-normal">
            {saved ? <BookmarkCheck size={18} strokeWidth={1.7} /> : <Bookmark size={18} strokeWidth={1.7} />}
            {saved ? "Saved" : "Save for later"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
