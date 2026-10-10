import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useApp } from "@/lib/store";
import { readyTopic } from "@/lib/generate";
import { pushTopic } from "@/lib/ui";
import { cue } from "@/lib/feedback";
import { IconButton, Segmented, Sheet, BirdMark } from "./ui";

const NONE: never[] = [];

function timeAgo(at: number) {
  const s = Math.max(1, Math.round((Date.now() - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function LibrarySheet({ open, tab, onClose }: { open: boolean; tab?: "saved" | "history"; onClose: () => void }) {
  const saved = useApp((s) => s.saved);
  const seen = useApp((s) => s.profile?.seen ?? NONE);
  useApp((s) => s.generated);
  const [view, setView] = useState<"saved" | "history">(tab ?? "saved");

  useEffect(() => {
    if (open) setView(tab ?? (saved.length ? "saved" : "history"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  const rows = (view === "saved" ? saved : seen)
    .map((r) => ({ at: r.at, topic: readyTopic(r.id) }))
    .filter((r): r is { at: number; topic: NonNullable<ReturnType<typeof readyTopic>> } => !!r.topic)
    .slice(0, 100);

  return (
    <Sheet open={open} onClose={onClose} title="Library" tall>
      <div className="flex items-center justify-between pr-3 pl-6">
        <h2 className="font-serif text-[17px] font-semibold text-strong">Your library</h2>
        <IconButton label="Close" onClick={onClose} className="text-muted">
          <X size={19} strokeWidth={1.8} />
        </IconButton>
      </div>
      <div className="px-6 pt-1 pb-3">
        <Segmented
          label="Library section"
          value={view}
          onChange={(v) => {
            cue("select", { emphasis: "subtle" });
            setView(v);
          }}
          options={[
            { value: "saved", label: `Saved${saved.length ? ` · ${saved.length}` : ""}` },
            { value: "history", label: "History" },
          ]}
        />
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)]" data-vaul-no-drag>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 pt-16 text-center text-muted">
            <BirdMark size={40} className="text-dot" />
            <p className="mt-4 font-serif text-[17px] text-text">
              {view === "saved" ? "Nothing saved yet." : "Nothing read yet."}
            </p>
            <p className="mt-1.5 max-w-[24em] font-serif text-[15px]">
              {view === "saved"
                ? "Tap Save under any topic, or Save for later in a preview, and it lands here."
                : "Topics you spend a few seconds with show up here."}
            </p>
          </div>
        ) : (
          <ul role="list">
            {rows.map(({ topic, at }) => (
              <li key={topic.id + at}>
                <button
                  type="button"
                  onClick={() => {
                    cue("navigate");
                    pushTopic(topic.id);
                  }}
                  className="press flex w-full flex-col gap-0.5 border-b border-line py-3.5 text-left"
                >
                  <span className="font-serif text-[17px] leading-snug font-semibold text-strong">{topic.title}</span>
                  <span className="truncate font-mono text-[12.5px] text-muted">
                    <span className="font-medium tracking-[0.08em] text-text">{topic.category.toUpperCase()}</span> · {timeAgo(at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
