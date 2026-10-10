/** Client for the Birdie server's streaming endpoints (server-sent events over fetch). */

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onMeta?: (meta: { provider?: string; notice?: string }) => void;
}

export class StreamError extends Error {}

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
    throw new StreamError("Birdie can't reach its server. Is it running?");
  }
  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => "");
    throw new StreamError(msg || `Server error ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
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
      else if (msg.provider || msg.notice) h.onMeta?.(msg);
    }
  }
}

export function streamTopic(query: string, context: string | undefined, h: StreamHandlers, signal?: AbortSignal) {
  return stream("/api/topic", { query, context }, h, signal);
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export function streamChat(
  body: { topicTitle?: string; topicText?: string; highlight?: string; messages: ChatTurn[] },
  h: StreamHandlers,
  signal?: AbortSignal,
) {
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
