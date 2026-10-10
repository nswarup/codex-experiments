import { describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.BIRDIE_PROVIDER = "mock";
process.env.BIRDIE_STATIC = "off";
const { app } = await import("../src/index");

async function sse(res: Response) {
  const text = await res.text();
  return text
    .split("\n\n")
    .map((f) => f.replace(/^data:\s?/m, "").trim())
    .filter(Boolean)
    .map((d) => JSON.parse(d));
}

describe("api", () => {
  it("reports health and provider", async () => {
    const res = await app.request("/api/health");
    expect(await res.json()).toMatchObject({ ok: true, provider: "mock" });
  });

  it("streams a topic in the line format", async () => {
    const res = await app.request("/api/topic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "Massachusetts" }),
    });
    const events = await sse(res);
    const text = events.map((e) => e.t ?? "").join("");
    expect(text).toContain("TITLE: Massachusetts");
    expect(text.trim().endsWith("END")).toBe(true);
    expect(events.at(-1)).toEqual({ done: true });
  });

  it("validates input", async () => {
    const bad = await app.request("/api/topic", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    expect(bad.status).toBe(400);
    const badChat = await app.request("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "assistant", content: "hi" }] }),
    });
    expect(badChat.status).toBe(400);
  });

  it("streams a chat reply with a READ NEXT line", async () => {
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicTitle: "Tulip mania", highlight: "a bulb", messages: [{ role: "user", content: "Why?" }] }),
    });
    const text = (await sse(res)).map((e) => e.t ?? "").join("");
    expect(text).toContain("READ NEXT:");
  });
});
