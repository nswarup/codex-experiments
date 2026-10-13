import { afterAll, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.BIRDIE_PROVIDER = "mock";
process.env.BIRDIE_STATIC = "off";
process.env.BIRDIE_PASSWORD = "correct horse";
const { app } = await import("../src/index");

afterAll(() => {
  delete process.env.BIRDIE_PASSWORD;
});

const post = (path: string, body: unknown, cookie?: string) =>
  app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), "x-forwarded-for": "10.0.0.1" },
    body: JSON.stringify(body),
  });

describe("password gate", () => {
  it("sends pages to the sign-in page and refuses the API without a session", async () => {
    const page = await app.request("/");
    expect(page.status).toBe(302);
    expect(page.headers.get("location")).toBe("/login");
    const deep = await app.request("/some/page");
    expect(deep.headers.get("location")).toBe("/login?next=%2Fsome%2Fpage");
    const api = await post("/api/topic", { query: "Massachusetts" });
    expect(api.status).toBe(401);
    const health = await app.request("/api/health");
    expect(await health.json()).toEqual({ ok: true, auth: true });
  });

  it("serves the sign-in page itself", async () => {
    const res = await app.request("/login");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('type="password"');
  });

  it("accepts the password with or without a capital first letter, nothing looser", async () => {
    const { matchesPassword } = await import("../src/auth");
    const saved = process.env.BIRDIE_PASSWORD;
    process.env.BIRDIE_PASSWORD = "birdie";
    try {
      expect(matchesPassword("birdie")).toBe(true);
      expect(matchesPassword("Birdie")).toBe(true);
      expect(matchesPassword("BIRDIE")).toBe(false);
      expect(matchesPassword("bird")).toBe(false);
      expect(matchesPassword("")).toBe(false);
    } finally {
      process.env.BIRDIE_PASSWORD = saved;
    }
  });

  it("rejects a wrong password and accepts the right one with an HttpOnly session cookie", async () => {
    const bad = await post("/api/login", { password: "nope" });
    expect(bad.status).toBe(401);
    const good = await post("/api/login", { password: "correct horse" });
    expect(good.status).toBe(200);
    const setCookie = good.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/birdie_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    const cookie = setCookie.split(";")[0];
    const api = await post("/api/topic", { query: "Massachusetts" }, cookie);
    expect(api.status).toBe(200);
    const forged = await post("/api/topic", { query: "Massachusetts" }, "birdie_session=1700000000.forged");
    expect(forged.status).toBe(401);
  });

  it("slows down repeated guessing", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await app.request("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.99" },
        body: JSON.stringify({ password: `guess ${i}` }),
      });
      statuses.push(r.status);
    }
    expect(statuses.slice(-1)[0]).toBe(429);
  });
});
