import Anthropic from "@anthropic-ai/sdk";
import { spawn, spawnSync } from "node:child_process";
import { mockChat, mockTopic } from "./mock.js";

export type Turn = { role: "user" | "assistant"; content: string };

export interface StreamRequest {
  kind: "topic" | "chat";
  system: string;
  messages: Turn[];
  /** Used by the mock provider to produce something sensible. */
  hint: { query?: string; highlight?: string; topicTitle?: string };
  signal?: AbortSignal;
}

export interface Provider {
  name: "anthropic" | "claude-cli" | "mock";
  label: string;
  stream(req: StreamRequest): AsyncIterable<string>;
}

export const MODEL = process.env.BIRDIE_MODEL ?? "claude-sonnet-5-5";
/** A writer that sends nothing for this long is stopped. */
const IDLE_MS = 60_000;

/* ------------------------------------------------------------------ */
/* 1. Claude API via the official SDK                                  */
/* ------------------------------------------------------------------ */

function anthropicProvider(): Provider {
  const client = new Anthropic();
  return {
    name: "anthropic",
    label: `Claude API (${MODEL})`,
    async *stream(req) {
      const stream = client.beta.messages.stream(
        {
          model: MODEL,
          max_tokens: 4000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          // Short, low-latency reading content: keep effort low.
          output_config: { effort: "low" },
          system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
          messages: req.messages,
        },
        { signal: req.signal },
      );
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") {
        throw new Error("Birdie couldn't write about that one. Try a different subject.");
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* 2. Claude Code CLI (uses the laptop's existing Claude login)        */
/* ------------------------------------------------------------------ */

function cliAvailable(): boolean {
  if (process.env.BIRDIE_PROVIDER && process.env.BIRDIE_PROVIDER !== "claude-cli") return false;
  try {
    const r = spawnSync("claude", ["--version"], { encoding: "utf8", timeout: 8000 });
    return r.status === 0;
  } catch {
    return false;
  }
}

function transcript(messages: Turn[]): string {
  if (messages.length === 1) return messages[0].content;
  return (
    messages
      .map((m) => `${m.role === "user" ? "Reader" : "Birdie"}: ${m.content}`)
      .join("\n\n") + "\n\nReply as Birdie to the reader's last message."
  );
}

function claudeCliProvider(): Provider {
  const cliModel = process.env.BIRDIE_CLI_MODEL ?? "sonnet";
  return {
    name: "claude-cli",
    label: `Claude Code login (${cliModel})`,
    async *stream(req) {
      const args = [
        "-p",
        "--model", cliModel,
        "--effort", process.env.BIRDIE_CLI_EFFORT ?? "low",
        "--output-format", "stream-json",
        "--include-partial-messages",
        "--verbose",
        "--tools", "",
        "--no-session-persistence",
        "--strict-mcp-config",
        "--system-prompt", req.system,
      ];
      if (req.signal?.aborted) return;
      const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
      let spawnError: Error | null = null;
      // Resolve on either 'close' or 'error' so a missing binary or broken pipe never hangs or crashes.
      const exited = new Promise<number | null>((resolve) => {
        child.once("close", resolve);
        child.once("error", (e) => {
          spawnError = e;
          resolve(null);
        });
      });
      child.stdin.on("error", () => {});
      const kill = () => child.kill("SIGTERM");
      req.signal?.addEventListener("abort", kill, { once: true });
      child.stdin.end(transcript(req.messages));

      let stderr = "";
      child.stderr.on("data", (d) => (stderr += d.toString()));

      // Kill a writer that goes silent (e.g. waiting on a login prompt).
      let idle: NodeJS.Timeout = setTimeout(kill, IDLE_MS);
      const touch = () => {
        clearTimeout(idle);
        idle = setTimeout(kill, IDLE_MS);
      };

      let buffer = "";
      let sawText = false;
      let resultText = "";
      let resultError: string | null = null;
      try {
        for await (const chunk of child.stdout) {
          touch();
          buffer += chunk.toString();
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            let evt: any;
            try {
              evt = JSON.parse(line);
            } catch {
              continue;
            }
            if (evt.type === "stream_event") {
              const e = evt.event;
              if (e?.type === "content_block_delta" && e.delta?.type === "text_delta") {
                sawText = true;
                yield e.delta.text as string;
              }
            } else if (evt.type === "result") {
              if (evt.is_error) resultError = String(evt.result ?? "Claude Code returned an error");
              else resultText = String(evt.result ?? "");
            }
          }
        }
      } finally {
        clearTimeout(idle);
        req.signal?.removeEventListener("abort", kill);
        if (child.exitCode === null) kill();
      }
      const code = await exited;
      if (req.signal?.aborted) return;
      if (spawnError) throw new Error(`Couldn't start Claude Code: ${(spawnError as Error).message}`);
      if (!sawText && resultText) yield resultText;
      if (resultError) throw new Error(resultError);
      if (code !== 0 && !sawText && !resultText) {
        throw new Error(`Claude Code exited with ${code ?? "a signal"}: ${stderr.slice(0, 300) || "no output"}`);
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* 3. Mock (no credentials): plausible, clearly-labelled demo output   */
/* ------------------------------------------------------------------ */

function mockProvider(): Provider {
  return {
    name: "mock",
    label: "Demo mode (no Claude connection)",
    async *stream(req) {
      const text = req.kind === "topic" ? mockTopic(req.hint.query ?? "this") : mockChat(req.hint);
      // Stream in small word groups so the UI behaves like the real thing.
      const parts = text.match(/\S+\s*/g) ?? [text];
      for (let i = 0; i < parts.length; i += 3) {
        if (req.signal?.aborted) return;
        await new Promise((r) => setTimeout(r, 28));
        yield parts.slice(i, i + 3).join("");
      }
    },
  };
}

export function selectProvider(): Provider {
  const forced = process.env.BIRDIE_PROVIDER;
  if (forced === "mock") return mockProvider();
  if (forced === "anthropic" || (!forced && (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN))) {
    return anthropicProvider();
  }
  if (cliAvailable()) return claudeCliProvider();
  return mockProvider();
}

export { mockProvider };
