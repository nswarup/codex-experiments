import { Hono, type Context } from "hono";
import { serve } from "@hono/node-server";
import { streamSSE } from "hono/streaming";
import { selectProvider, mockProvider, type Provider, type Turn } from "./providers.js";
import { TOPIC_SYSTEM, CHAT_SYSTEM, topicUserPrompt, chatContextBlock } from "./prompts.js";

let provider: Provider = selectProvider();
let providerError: string | null = null;
console.log(`[birdie] writer: ${provider.label}`);

export const app = new Hono();

app.get("/api/health", (c) =>
  c.json({ ok: true, provider: provider.name, label: provider.label, lastError: providerError }),
);

function clean(s: unknown, max: number): string {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}

async function pipe(
  c: Context,
  build: (p: Provider, signal: AbortSignal) => AsyncIterable<string>,
) {
  return streamSSE(c, async (stream) => {
    const abort = new AbortController();
    stream.onAbort(() => abort.abort());
    const run = async (p: Provider) => {
      for await (const delta of build(p, abort.signal)) {
        if (abort.signal.aborted) return;
        await stream.writeSSE({ data: JSON.stringify({ t: delta }) });
      }
    };
    try {
      await stream.writeSSE({ data: JSON.stringify({ provider: provider.name }) });
      await run(provider);
      providerError = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[birdie] writer error:", message);
      providerError = message;
      // If the real writer can't start at all (e.g. CLI not logged in), fall back to demo mode
      // for this request so the UI never dead-ends.
      if (provider.name === "claude-cli" && /exited|not logged|login|auth/i.test(message)) {
        await stream.writeSSE({ data: JSON.stringify({ provider: "mock", notice: message }) });
        await run(mockProvider());
      } else {
        await stream.writeSSE({ data: JSON.stringify({ error: message }) });
      }
    }
    await stream.writeSSE({ data: JSON.stringify({ done: true }) });
  });
}

app.post("/api/topic", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const query = clean(body.query, 120);
  const context = clean(body.context, 200);
  if (!query) return c.json({ error: "query is required" }, 400);
  return pipe(c, (p, signal) =>
    p.stream({
      signal,
      kind: "topic",
      system: TOPIC_SYSTEM,
      messages: [{ role: "user", content: topicUserPrompt(query, context || undefined) }],
      hint: { query },
    }),
  );
});

app.post("/api/chat", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const topicTitle = clean(body.topicTitle, 200);
  const topicText = clean(body.topicText, 4000);
  const highlight = clean(body.highlight, 800);
  const raw: unknown[] = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const turns: Turn[] = raw
    .map((m: any) => ({ role: m?.role === "assistant" ? "assistant" : "user", content: clean(m?.content, 2000) }) as Turn)
    .filter((m) => m.content);
  if (!turns.length || turns[turns.length - 1].role !== "user") {
    return c.json({ error: "messages must end with a user turn" }, 400);
  }
  // Put the article context in front of the first user turn so the system prompt stays cacheable.
  const ctx = chatContextBlock({ topicTitle, topicText, highlight });
  if (ctx) turns[0] = { role: "user", content: `${ctx}\n\n${turns[0].content}` };
  return pipe(c, (p, signal) =>
    p.stream({ signal, kind: "chat", system: CHAT_SYSTEM, messages: turns, hint: { highlight, topicTitle } }),
  );
});

export function setProviderForTests(p: Provider) {
  provider = p;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 8787);
  serve({ fetch: app.fetch, port }, () => console.log(`[birdie] api on http://localhost:${port}`));
}
