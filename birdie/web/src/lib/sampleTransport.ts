/**
 * Writer for the artifact build: when Birdie runs as a published Claude artifact there is
 * no Birdie server, so topics and chat go through the artifact `sample` capability, on the
 * viewer's own Claude account. Same prompts and wire format as the server.
 */
import { TOPIC_SYSTEM, CHAT_SYSTEM, topicUserPrompt, chatContextBlock } from "../../../shared/prompts";
import { mockChat, mockTopic } from "../../../shared/mock";
import { StreamError, type ChatTurn, type StreamHandlers } from "./api";

interface SampleError {
  code: string;
  message: string;
  text?: string;
}
type SampleFn = ((
  input: string | { role: "user" | "assistant"; content: string }[],
  options?: {
    onText?: (u: { text: string; delta: string }) => void;
    signal?: AbortSignal;
    modelTier?: "default" | "complex" | "quick";
    cache?: boolean | { gcTime?: number };
  },
) => Promise<{ text: string; truncated: boolean }>) & { limits?: unknown };

let samplePromise: Promise<SampleFn | null> | null = null;
let unavailable = false;

export function getSample(): Promise<SampleFn | null> {
  if (unavailable) return Promise.resolve(null);
  const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!c?.use) return Promise.resolve(null);
  samplePromise ??= c.use("sample").then((s) => (s as SampleFn | null) ?? null).catch(() => null);
  return samplePromise;
}

function friendly(e: SampleError): string {
  switch (e.code) {
    case "not_granted":
    case "sampling_disabled":
    case "not_declared":
    case "capability_disabled":
      return "Birdie needs your OK to write with Claude. Showing demo text instead.";
    case "rate_limited":
      return "Claude is busy for you right now. Try again in a minute.";
    case "session_expired":
      return "Sign in to Claude again, then try once more.";
    case "refused":
      return "Birdie couldn't write about that one. Try a different subject.";
    case "prompt_too_large":
      return "That was too long for Birdie. Try something shorter.";
    default:
      return "Birdie lost the connection to Claude. Try again?";
  }
}

const ARTIFACT_HOWTO = "Reopen this page in the Claude app or claude.ai and allow Birdie to use Claude when it asks. New topics and chat replies will then be written for you.";

const PERMANENT = new Set(["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"]);

async function streamText(text: string, h: StreamHandlers, signal?: AbortSignal) {
  const parts = text.match(/\S+\s*/g) ?? [text];
  for (let i = 0; i < parts.length; i += 3) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await new Promise((r) => setTimeout(r, 24));
    h.onDelta(parts.slice(i, i + 3).join(""));
  }
}

async function run(
  input: string | ChatTurn[],
  tier: "default" | "quick",
  cache: boolean | { gcTime: number },
  h: StreamHandlers,
  fallback: () => string,
  signal?: AbortSignal,
) {
  const sample = await getSample();
  if (!sample) {
    h.onMeta?.({ provider: "mock" });
    await streamText(fallback(), h, signal);
    return;
  }
  h.onMeta?.({ provider: "sample" });
  try {
    await sample(input, { modelTier: tier, cache, signal, onText: ({ delta }) => h.onDelta(delta) });
  } catch (err) {
    const e = err as SampleError;
    if (e?.code === "cancelled") throw new DOMException("Aborted", "AbortError");
    if (PERMANENT.has(e?.code) && !e.text) {
      // The viewer said no (or Claude isn't available here): keep the app working in demo mode.
      unavailable = true;
      h.onMeta?.({ provider: "mock", notice: friendly(e) });
      await streamText(fallback(), h, signal);
      return;
    }
    throw new StreamError(friendly(e));
  }
}

export function sampleTopic(query: string, context: string | undefined, h: StreamHandlers, signal?: AbortSignal, category?: string) {
  const input = `${TOPIC_SYSTEM}\n\n---\n\n${topicUserPrompt(query, context)}`;
  // Same subject → same article for a day, without spending the viewer's usage again.
  return run(input, "default", { gcTime: 24 * 60 * 60 * 1000 }, h, () => mockTopic(query, ARTIFACT_HOWTO, category), signal);
}

export function sampleChat(
  body: { topicTitle?: string; topicText?: string; highlight?: string; messages: ChatTurn[] },
  h: StreamHandlers,
  signal?: AbortSignal,
) {
  const ctx = chatContextBlock(body);
  const history = body.messages.slice(-12);
  while (history.length && history[0].role !== "user") history.shift();
  const turns: ChatTurn[] = [{ role: "user", content: `${CHAT_SYSTEM}${ctx ? `\n\n${ctx}` : ""}` }, ...history];
  return run(turns, "quick", false, h, () => mockChat({ highlight: body.highlight, topicTitle: body.topicTitle }, ARTIFACT_HOWTO), signal);
}
