import { Hono, type Context } from "hono";
import { serve } from "@hono/node-server";
import { streamSSE } from "hono/streaming";
import { selectProvider, mockProvider, type Provider, type Turn } from "./providers.js";
import { TOPIC_SYSTEM, CHAT_SYSTEM, topicUserPrompt, chatContextBlock } from "../../shared/prompts.js";
import { cacheGet, cachePut } from "./cache.js";

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
    let wrote = false;
    const run = async (p: Provider) => {
      for await (const delta of build(p, abort.signal)) {
        if (abort.signal.aborted) return;
        wrote = true;
        await stream.writeSSE({ data: JSON.stringify({ t: delta }) });
      }
    };
    try {
      await stream.writeSSE({ data: JSON.stringify({ provider: provider.name }) });
      await run(provider);
      if (abort.signal.aborted) return;
      providerError = null;
    } catch (err) {
      if (abort.signal.aborted) return; // the reader left; nothing to report
      const message = err instanceof Error ? err.message : String(err);
      console.error("[birdie] writer error:", message);
      providerError = message;
      // If the local Claude Code login can't start at all, fall back to demo mode for this
      // request so the UI never dead-ends. Never mix demo text into a real partial answer.
      if (provider.name === "claude-cli" && !wrote) {
        await stream.writeSSE({ data: JSON.stringify({ provider: "mock", notice: message }) });
        await run(mockProvider());
      } else {
        await stream.writeSSE({ data: JSON.stringify({ error: wrote ? "Birdie lost the thread partway. Try again?" : message }) });
        return;
      }
    }
    await stream.writeSSE({ data: JSON.stringify({ done: true }) });
  });
}

/* Minimal per-IP rate limit: plenty for one reader, a wall for anything automated. */
const hits = new Map<string, number[]>();
const LIMIT = Number(process.env.BIRDIE_RATE_LIMIT ?? 40); // requests per minute
app.use("/api/*", async (c, next) => {
  if (c.req.method !== "POST") return next();
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= LIMIT) return c.json({ error: "Slow down a little and try again in a minute." }, 429);
  recent.push(now);
  hits.set(ip, recent);
  return next();
});

app.post("/api/topic", async (c) => {
  const body = (await c.req.json().catch(() => null)) ?? {};
  const query = clean(body.query, 120);
  const context = clean(body.context, 200);
  const category = clean(body.category, 20);
  if (!query) return c.json({ error: "query is required" }, 400);
  const cached = cacheGet(query);
  return pipe(c, (p, signal) =>
    cached
      ? replay(cached, signal)
      : record(
          p.stream({
            signal,
            kind: "topic",
            system: TOPIC_SYSTEM,
            messages: [{ role: "user", content: topicUserPrompt(query, context || undefined) }],
            hint: { query, category },
          }),
          (text) => p.name !== "mock" && cachePut(query, text),
        ),
  );
});

app.post("/api/chat", async (c) => {
  const body = (await c.req.json().catch(() => null)) ?? {};
  const topicTitle = clean(body.topicTitle, 200);
  const topicText = clean(body.topicText, 4000);
  const highlight = clean(body.highlight, 800);
  const raw: unknown[] = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const turns: Turn[] = raw
    .map((m: any) => ({ role: m?.role === "assistant" ? "assistant" : "user", content: clean(m?.content, 2000) }) as Turn)
    .filter((m) => m.content);
  // After trimming, the history must start with the reader (so context attaches to them).
  while (turns.length && turns[0].role !== "user") turns.shift();
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

/** Replay a finished article quickly, in small chunks, so the UI still streams. */
async function* replay(text: string, signal: AbortSignal) {
  const parts = text.match(/[\s\S]{1,48}/g) ?? [];
  for (const part of parts) {
    if (signal.aborted) return;
    await new Promise((r) => setTimeout(r, 8));
    yield part;
  }
}

/** Pass a stream through and hand the full text to `done` once it completes. */
async function* record(src: AsyncIterable<string>, done: (text: string) => void) {
  let text = "";
  for await (const d of src) {
    text += d;
    yield d;
  }
  if (/\nEND\s*$/.test(text)) done(text);
}

export function setProviderForTests(p: Provider) {
  provider = p;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 8787);
  // Local only by default: the Vite dev server proxies /api, so phones on your Wi-Fi still work,
  // but your Claude credentials aren't exposed directly to the network.
  const hostname = process.env.BIRDIE_HOST ?? "127.0.0.1";
  serve({ fetch: app.fetch, port, hostname }, () => console.log(`[birdie] api on http://${hostname}:${port}`));
}
