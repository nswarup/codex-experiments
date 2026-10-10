/** Client for the Birdie server's streaming endpoints (server-sent events over fetch). */

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onMeta?: (meta: { provider?: string; notice?: string }) => void;
}

export class StreamError extends Error {}

/** A short, human sentence for a failed request; never raw JSON or status codes. */
async function friendlyError(res: Response): Promise<string> {
  let msg = "";
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { error?: unknown };
      if (typeof j.error === "string") msg = j.error;
    } catch {
      if (text.length < 160 && !/[<{]/.test(text)) msg = text;
    }
  } catch {
    /* no body */
  }
  if (res.status === 429) return "Birdie needs a short breather. Try again in a minute.";
  if (res.status >= 500) return "Birdie's writer is having a moment. Try again shortly.";
  return msg || "Something went wrong. Try again.";
}

async function stream(path: string, body: unknown, h: StreamHandlers, signal?: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new StreamError(
      typeof navigator !== "undefined" && navigator.onLine === false
        ? "You're offline. The built-in topics still work, and Birdie will try again when you're back."
        : "Birdie can't reach its writer right now. The built-in topics still work.",
    );
  }
  if (!res.ok || !res.body) {
    throw new StreamError(await friendlyError(res));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      let msg: { t?: string; error?: string; done?: boolean; provider?: string; notice?: string };
      try {
        msg = JSON.parse(data);
      } catch {
        continue;
      }
      if (msg.t) h.onDelta(msg.t);
      else if (msg.error) throw new StreamError(msg.error);
      else if (msg.done) finished = true;
      else if (msg.provider || msg.notice) h.onMeta?.(msg);
    }
  }
  // A dropped connection looks like a normal end of stream; don't treat it as success.
  if (!finished) throw new StreamError("The connection dropped before Birdie finished. Try again?");
}

/** True in the build published as a Claude artifact (no Birdie server; Claude via `sample`). */
export const IS_ARTIFACT = import.meta.env.VITE_TARGET === "artifact";

export async function streamTopic(
  query: string,
  context: string | undefined,
  h: StreamHandlers,
  signal?: AbortSignal,
  category?: string,
) {
  if (IS_ARTIFACT) return (await import("./sampleTransport")).sampleTopic(query, context, h, signal, category);
  return stream("/api/topic", { query, context, category }, h, signal);
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function streamChat(
  body: { topicTitle?: string; topicText?: string; highlight?: string; messages: ChatTurn[] },
  h: StreamHandlers,
  signal?: AbortSignal,
) {
  if (IS_ARTIFACT) return (await import("./sampleTransport")).sampleChat(body, h, signal);
  return stream("/api/chat", body, h, signal);
}

export async function health(): Promise<{ provider: string; label: string } | null> {
  try {
    const r = await fetch("/api/health");
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
