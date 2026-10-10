import { smooth } from "@/lib/motion";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, RotateCw, Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { streamChat, StreamError, type ChatTurn } from "@/lib/api";
import { parseChat } from "@/lib/parse";
import { getTopic, recordAsk } from "@/lib/store";
import { readyTopic, requestTopic } from "@/lib/generate";
import { matchCorpus } from "@/content";
import { pushTopic, type Overlay } from "@/lib/ui";
import { cue, buzz } from "@/lib/feedback";
import { IconButton, Sheet, SheetHeader } from "./ui";
import { cn } from "@/lib/cn";

const STARTERS = ["Explain it simpler", "Why?", "Tell me more"];
/** Asked from the action row, with no passage picked: questions about the whole piece. */
const TOPIC_STARTERS = ["Sum it up", "Why does it matter?", "Tell me more"];

type Msg = ChatTurn & { error?: boolean };

/** Conversations survive closing the sheet by accident, for this visit. */
const threads = new Map<string, Msg[]>();
const threadKey = (d: { topicId: string; highlight?: string }) => `${d.topicId}|${d.highlight ?? ""}`;

export function ChatSheet({
  open,
  data,
  onClose,
}: {
  open: boolean;
  data: Extract<Overlay, { kind: "chat" }>;
  onClose: () => void;
}) {
  const topic = getTopic(data.topicId) ?? readyTopic(data.topicId);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  // A new highlight or topic starts a fresh conversation; reopening the same one picks it back up.
  useEffect(() => {
    ctrl.current?.abort();
    const prev = (threads.get(threadKey(data)) ?? []).filter((m) => m.content.trim() || m.error);
    setMessages(prev);
    setDraft("");
    setStreaming(false);
    asked.current = prev.length > 0;
  }, [data]);

  useEffect(() => {
    if (messages.length) threads.set(threadKey(data), messages);
  }, [messages, data]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: smooth() });
  }, [messages]);

  useEffect(() => () => ctrl.current?.abort(), []);

  async function send(text: string, base: Msg[] = messages) {
    const q = text.trim();
    if (!q || streaming) return;
    if (!asked.current && topic) {
      asked.current = true;
      recordAsk(topic);
    }
    cue("tap");
    buzz(5);
    const history: Msg[] = [...base.filter((m) => !m.error && m.content.trim()), { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setStreaming(true);
    const c = new AbortController();
    ctrl.current = c;
    let acc = "";
    try {
      await streamChat(
        {
          topicTitle: topic?.title,
          topicText: topic ? [topic.lede, ...topic.bullets.map((b) => `${b.opening}: ${b.text}`)].join("\n") : undefined,
          highlight: data.highlight,
          messages: history.map(({ role, content }) => ({ role, content })),
        },
        {
          onDelta: (d) => {
            if (ctrl.current !== c) return; // a newer conversation took over
            acc += d;
            setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: acc }]);
          },
        },
        c.signal,
      );
      if (ctrl.current === c) cue("ready", { emphasis: "subtle" });
    } catch (e) {
      if ((e as Error).name === "AbortError" || ctrl.current !== c) return;
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: "assistant", content: e instanceof StreamError ? e.message : "Birdie lost the thread. Try again?", error: true },
      ]);
      cue("error", { emphasis: "subtle" });
    } finally {
      if (ctrl.current === c) setStreaming(false);
    }
  }

  // After a failed reply: ask the same question again, without retyping it.
  const retry = () => {
    const at = messages.map((m) => m.role).lastIndexOf("user");
    if (at < 0) return;
    send(messages[at].content, messages.slice(0, at));
  };

  const stop = () => {
    ctrl.current?.abort();
    setStreaming(false);
    cue("close", { emphasis: "subtle" });
  };

  const openReadNext = (title: string) => {
    const match = matchCorpus(title);
    const id = match ? match.id : requestTopic(title, topic?.title).id;
    cue("navigate");
    pushTopic(id, data.topicId);
  };

  const empty = messages.length === 0;

  return (
    <Sheet open={open} onClose={onClose} title="Ask Birdie" tall>
      <SheetHeader title="Ask Birdie" onClose={onClose} />

      <div ref={list} className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-6 pb-4" data-vaul-no-drag>
        {(data.highlight || topic) && (
          <figure className="mt-1 rounded-xl bg-inset px-4 py-3">
            <p className="font-serif text-[14px] text-muted">
              From <span className="italic">{topic?.title ?? "this topic"}</span>
            </p>
            {data.highlight && (
              <blockquote className="mt-1.5 font-serif text-[16px] leading-[1.5] text-text italic">“{data.highlight.replace(/^["“”'‘’\s]+|["“”'‘’\s]+$/g, "")}”</blockquote>
            )}
          </figure>
        )}

        {!messages.length && (
          <p className="mt-6 font-serif text-[15px] leading-relaxed text-muted">
            {data.highlight ? "Ask anything about this passage." : "Ask anything about this piece."} Birdie answers in a few short paragraphs.
          </p>
        )}
        <div className="mt-5 flex flex-col gap-4">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <motion.div
                key={i}
                initial={{ opacity: 0, transform: "translateY(6px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                className="max-w-[82%] self-end rounded-[18px] rounded-br-[5px] bg-accent px-4 py-2.5 font-serif text-[16px] leading-[1.5] text-accent-fg"
              >
                {m.content}
              </motion.div>
            ) : (
              <AssistantMessage
                key={i}
                text={m.content}
                error={m.error}
                onRetry={m.error && i === messages.length - 1 && !streaming ? retry : undefined}
                live={streaming && i === messages.length - 1}
                onReadNext={openReadNext}
              />
            ),
          )}
        </div>
      </div>

      <div className="border-t border-line px-6 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+14px)]">
        <AnimatePresence initial={false}>
          {empty && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="overflow-hidden"
            >
              <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 pb-3">
                {(data.highlight ? STARTERS : TOPIC_STARTERS).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="press h-11 shrink-0 rounded-full border border-chip px-4 font-serif text-[14.5px] whitespace-nowrap text-text"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <label htmlFor="ask-input" className="sr-only">
            Ask a question
          </label>
          <input
            id="ask-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={empty ? "Ask anything about this…" : "Ask a follow-up…"}
            enterKeyHint="send"
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-full border border-sheet-line bg-bg px-5 text-[16px] text-strong outline-none placeholder:text-muted focus:border-chip"
          />
          {streaming ? (
            <IconButton label="Stop" onClick={stop} className="h-12 w-12 bg-inset">
              <Square size={15} strokeWidth={2} fill="currentColor" />
            </IconButton>
          ) : (
            <button
              type="submit"
              aria-label="Send"
              disabled={!draft.trim()}
              className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg disabled:border disabled:border-chip disabled:bg-inset disabled:text-muted"
            >
              <ArrowUp size={20} strokeWidth={2} />
            </button>
          )}
        </form>
      </div>
    </Sheet>
  );
}

function AssistantMessage({
  text,
  live,
  error,
  onRetry,
  onReadNext,
}: {
  text: string;
  live: boolean;
  error?: boolean;
  onRetry?: () => void;
  onReadNext: (title: string) => void;
}) {
  const parsed = parseChat(text);
  const paragraphs = parsed.body.split(/\n{2,}/).filter(Boolean);
  if (!text && live) return <TypingDots />;
  return (
    <div
      role={error ? "alert" : undefined}
      className={cn(
        "flex flex-col gap-2.5 font-serif text-[16.5px] leading-[1.6]",
        error ? "rounded-xl border border-dashed border-dot px-4 py-3 text-[15.5px] text-muted" : "text-text",
      )}
    >
      {paragraphs.map((p, i) => (
        <p key={i} className={cn(live && !parsed.readNext && i === paragraphs.length - 1 && "caret")}>
          {p}
        </p>
      ))}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="press -ml-1 flex h-11 items-center gap-2 self-start rounded-full px-1 font-serif text-[15px] font-semibold text-strong"
        >
          <RotateCw size={15} strokeWidth={1.9} aria-hidden="true" /> Try again
        </button>
      )}
      {parsed.readNext && (
        <motion.button
          type="button"
          initial={{ opacity: 0, transform: "translateY(6px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          onClick={() => onReadNext(parsed.readNext!.title)}
          className="press card-hover mt-1.5 flex items-center gap-3 rounded-xl border border-sheet-line bg-inset px-3.5 py-3 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-mono text-[11.5px] font-medium tracking-[0.1em] text-muted">READ NEXT</span>
            <span className="font-serif text-[17px] leading-snug font-semibold text-strong">{parsed.readNext.title}</span>
            {parsed.readNext.hook && <span className="font-mono text-[13px] leading-[1.45] text-muted">{parsed.readNext.hook}</span>}
          </span>
          <ArrowRight size={19} strokeWidth={1.7} className="shrink-0 text-text" />
        </motion.button>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex h-7 items-center gap-1.5" role="status" aria-label="Birdie is writing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
