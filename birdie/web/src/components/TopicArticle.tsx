import { notify } from "@/components/Notify";
import { forwardRef } from "react";
import { IS_ARTIFACT } from "@/lib/api";
import { CORPUS_BY_ID } from "@/content";
import { HelpCircle, Share, MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";
import { SaveIcon } from "./SaveIcon";
import { savedFeedback } from "@/lib/saveFeedback";
import type { Bullet, Category, Topic } from "@/lib/types";
import { getTopic, toggleSaved, toggleVote, useApp } from "@/lib/store";
import { openOverlay } from "@/lib/ui";
import { requestTopic } from "@/lib/generate";
import { cue, buzz } from "@/lib/feedback";
import { cn } from "@/lib/cn";

export interface ArticleView {
  id: string;
  title: string;
  category?: Category;
  hook?: string;
  lede?: string;
  bullets: Bullet[];
  /** Still streaming in. */
  writing?: boolean;
  /** Which field the caret is on. */
  caret?: "hook" | "lede" | "bullet";
}

export function viewOf(t: Topic): ArticleView {
  // A library topic whose body is still loading shows its title and hook with the usual skeleton.
  if (t.stub) return { id: t.id, title: t.title, category: t.category, hook: t.hook, lede: undefined, bullets: [], writing: true };
  return { id: t.id, title: t.title, category: t.category, hook: t.hook, lede: t.lede, bullets: t.bullets };
}

export function HookLine({ category, hook, caret, className }: { category?: Category; hook?: string; caret?: boolean; className?: string }) {
  const style = useApp((s) => s.prefs.lab.hook);
  return (
    <p
      className={cn(
        "text-muted",
        style === "mono" ? "font-mono text-[0.78em] leading-[1.6] tracking-[-0.01em]" : "font-serif text-[1.02em] leading-[1.45] italic",
        "text-pretty",
        className,
      )}
    >
      {category && (
        <span className="font-mono text-[0.86em] font-medium tracking-[0.1em] not-italic">{category.toUpperCase()}</span>
      )}
      {category && hook ? " · " : null}
      <span className={cn(caret && "caret")}>{hook}</span>
    </p>
  );
}

function openPeek(b: Bullet, fromTopic: ArticleView) {
  cue("open", { emphasis: "subtle" });
  buzz(6);
  let jobId: string | undefined;
  if (!b.linkId) jobId = requestTopic(b.opening, fromTopic.title, fromTopic.category).id;
  openOverlay({ kind: "peek", opening: b.opening, linkId: b.linkId, fromTopicId: fromTopic.id, jobId });
}

export const TopicArticle = forwardRef<HTMLElement, { view: ArticleView; reason?: "match" | "wildcard" | "opened"; tourAnchor?: boolean; actions?: boolean }>(
  function TopicArticle({ view, reason, tourAnchor = false, actions = true }, ref) {
    const saved = useApp((s) => s.saved.some((x) => x.id === view.id));
    const vote = useApp((s) => s.profile?.votes?.[view.id] ?? 0);
    const castVote = (v: 1 | -1) => {
      const t = getTopic(view.id);
      if (!t) return;
      const next = toggleVote(t, v);
      cue("toggle", { direction: next ? "forward" : "back", emphasis: "subtle" });
      buzz(next ? [6, 30, 6] : 6);
      if (next === -1) notify("Got it. Fewer like this.", { duration: 2200 });
    };
    return (
      <article
        ref={ref}
        data-article={view.id}
        data-article-title={view.title}
        className="article mx-auto max-w-[34em] px-6 pt-8"
        aria-busy={view.writing || undefined}
        // While writing, hold about a screen of space so whatever sits below doesn't move as lines arrive.
        style={view.writing ? { minHeight: "calc(100dvh - 120px)" } : undefined}
      >
        <h1 className="font-serif text-[1.9em] leading-[1.15] font-medium tracking-[-0.005em] text-strong text-balance">{view.title}</h1>
        {view.hook || (view.writing && view.category) ? (
          <HookLine category={view.category} hook={view.hook} caret={view.caret === "hook"} className="mt-3.5" />
        ) : view.writing ? (
          // Hold the hook's place so the page doesn't jump when it arrives.
          <SkeletonLines lines={1} className="mt-4 w-2/3" />
        ) : null}
        {view.lede ? (
          <p data-tour={tourAnchor ? "lede" : undefined} className={cn("mt-6 text-pretty", view.caret === "lede" && "caret")}>
            {view.lede}
          </p>
        ) : view.writing ? (
          <SkeletonLines lines={4} className="mt-6" />
        ) : null}

        {view.bullets.length > 0 && (
          <ul className="mt-7 flex flex-col gap-5" role="list">
            {view.bullets.map((b, i) => {
              const last = i === view.bullets.length - 1;
              // The tour points at a bullet that leads to a real library topic.
              const anchor = tourAnchor && i === Math.max(0, view.bullets.findIndex((x) => x.linkId));
              return (
                <li key={i} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
                  <span className={cn("text-pretty", last && view.caret === "bullet" && "caret")}>
                    {/* An <a> (not a <button>) so a long opening wraps like the text around it. */}
                    <a
                      // No href: a long-press should select text, not offer "copy link".
                      tabIndex={0}
                      role="button"
                      className="opening"
                      data-tour={anchor ? "opening" : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        openPeek(b, view);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          openPeek(b, view);
                        }
                      }}
                      aria-haspopup="dialog"
                    >
                      {b.opening}
                    </a>
                    {b.text ? `: ${b.text}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {/* Only before the first bullet: after that the caret shows progress, and a skeleton
            pushed down line by line would make the whole page jump. */}
        {view.writing && view.lede && view.caret !== "lede" && !view.bullets.length && <SkeletonLines lines={3} className="mt-6 pl-[18px]" />}

        {actions && !view.writing && (
          // The reader's verdict: a strong ranking signal. Tap the same thumb again to take it back.
          <div className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[14px] text-muted">
            <span className="mr-1">Worth knowing?</span>
            <button
              type="button"
              aria-label="More like this"
              aria-pressed={vote === 1}
              onClick={() => castVote(1)}
              className={cn(
                "press flex h-11 items-center gap-1.5 rounded-full border px-3.5 transition-colors duration-150",
                vote === 1 ? "border-accent bg-accent text-accent-fg" : "border-chip",
              )}
            >
              <ThumbsUp size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Yes</span>
            </button>
            <button
              type="button"
              aria-label="Fewer like this"
              aria-pressed={vote === -1}
              onClick={() => castVote(-1)}
              className={cn(
                "press flex h-11 items-center gap-1.5 rounded-full border px-3.5 transition-colors duration-150",
                vote === -1 ? "border-accent bg-accent text-accent-fg" : "border-chip",
              )}
            >
              <ThumbsDown size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Not for me</span>
            </button>
          </div>
        )}
        {actions && !view.writing && (
          <div className="mt-3 -mr-3 -ml-3 flex flex-wrap items-center gap-x-1 text-muted">
            <ActionButton
              label={saved ? "Saved" : "Save"}
              // The button is the feedback: the bookmark fills and the label reads "Saved". Tap again to undo.
              onClick={() => savedFeedback(toggleSaved(view.id))}
              pressed={saved}
            >
              <SaveIcon saved={saved} />
            </ActionButton>
            <ActionButton
              label="Ask"
              onClick={() => {
                cue("open", { emphasis: "subtle" });
                buzz(6);
                openOverlay({ kind: "chat", topicId: view.id });
              }}
            >
              <MessageSquare size={18} strokeWidth={1.7} />
            </ActionButton>
            <ActionButton label="Share" onClick={() => share(view)}>
              <Share size={18} strokeWidth={1.7} />
            </ActionButton>
            {/* Icon-only, so the row stays on one line; the label is still read out. */}
            <button
              type="button"
              aria-label="Why this?"
              title="Why this?"
              onClick={() => {
                cue("open", { emphasis: "subtle" });
                openOverlay({ kind: "why", topicId: view.id, reason });
              }}
              className="press ml-auto flex h-11 w-11 items-center justify-center rounded-full active:bg-inset"
            >
              <HelpCircle size={18} strokeWidth={1.7} />
            </button>
          </div>
        )}
      </article>
    );
  },
);

function ActionButton({
  label,
  onClick,
  children,
  pressed,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className="press flex h-11 items-center gap-2 rounded-full px-3 font-serif text-[15px] whitespace-nowrap active:bg-inset"
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

async function share(view: ArticleView) {
  const text = `${view.title}: ${view.hook ?? ""}`.trim();
  // Built-in topics get a link that opens straight to them (the demo artifact's frame has no shareable URL).
  const url = !IS_ARTIFACT && CORPUS_BY_ID[view.id] ? `${location.origin}${location.pathname}#${view.id}` : undefined;
  cue("tap");
  if (navigator.share) {
    try {
      await navigator.share({ title: view.title, text, url });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // the reader cancelled
      // Refused (e.g. inside an embedded frame): fall through to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : `${text}\n\n${view.lede ?? ""}`);
    cue("success", { emphasis: "subtle" });
    notify(url ? "Link copied" : "Copied", { duration: 2000 });
  } catch {
    notify("Couldn't share from here");
  }
}

export function SkeletonLines({ lines, className }: { lines: number; className?: string }) {
  const widths = ["96%", "100%", "88%", "92%", "70%", "84%"];
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-[0.62em]", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="shimmer h-[0.8em] rounded-full" style={{ width: widths[i % widths.length] }} />
      ))}
    </div>
  );
}
