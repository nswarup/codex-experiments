import { describe, expect, it } from "vitest";
import {
  applyAsk, applyEngagement, applyTap, createProfile, drift, markSeen, pickNext, pickNudges,
  scoreTopic, seededRng, NEUTRAL, WILDCARD_RATE, FEED_WILDCARD_RATE,
  type RankedPick,
} from "../src/lib/ranking";
import type { Category, Topic } from "../src/lib/types";
import { CORPUS } from "../src/content";

const picks: Category[] = ["Music", "Math", "Food"];

describe("profile", () => {
  it("starts picked categories at 1.0, others at 0.2, tags neutral", () => {
    const p = createProfile(picks);
    expect(p.cat.Music).toBe(1);
    expect(p.cat.Space).toBe(0.2);
    expect(scoreTopic(p, { category: "Music", tags: ["x"] })).toBeCloseTo(0.6 * 1 + 0.4 * NEUTRAL);
  });

  it("engagement is continuous and only adds the difference on re-entry", () => {
    const t = { category: "Music" as const, tags: ["acoustics"] };
    const p0 = createProfile(picks);
    const skim = applyEngagement(p0, t, 0.1);
    expect(skim.cat.Music).toBeCloseTo(1 - 0.04);
    const full = applyEngagement(p0, t, 1);
    expect(full.cat.Music).toBeCloseTo(1.14);
    const linger = applyEngagement(p0, t, 5);
    expect(linger.cat.Music).toBeCloseTo(1.24); // capped at 1.5x
    const twoStep = applyEngagement(applyEngagement(p0, t, 0.5), t, 1, 0.5);
    expect(twoStep.cat.Music).toBeCloseTo(full.cat.Music);
    expect(twoStep.tag.acoustics).toBeCloseTo(full.tag.acoustics);
  });

  it("taps and asks boost category and niches, clamped to 2", () => {
    const t = { category: "Space" as const, tags: ["light"] };
    let p = applyTap(createProfile(picks), t);
    expect(p.cat.Space).toBeCloseTo(0.35);
    expect(p.tag.light).toBeCloseTo(0.6);
    p = applyAsk(p, t);
    expect(p.cat.Space).toBeCloseTo(0.55);
    for (let i = 0; i < 40; i++) p = applyAsk(p, t);
    expect(p.cat.Space).toBe(2);
  });

  it("drifts 3% toward neutral per session", () => {
    const p = drift(createProfile(picks));
    expect(p.cat.Music).toBeCloseTo(1 + (0.5 - 1) * 0.03);
    expect(p.sessions).toBe(1);
  });
});

describe("pickNext", () => {
  it("favours picked interests but keeps ~20% wildcards", () => {
    const rng = seededRng(42);
    const p = createProfile(picks);
    let picked = 0;
    let wild = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) {
      const r = pickNext(p, CORPUS, rng)!;
      if (r.reason === "wildcard") wild++;
      if (picks.includes(r.topic.category)) picked++;
    }
    expect(wild / N).toBeGreaterThan(WILDCARD_RATE - 0.02);
    expect(wild / N).toBeLessThan(WILDCARD_RATE + 0.02);
    expect(picked / N).toBeGreaterThan(0.75);
  });

  it("feed rule (no back-to-back wildcards) still lands near 20% overall", () => {
    const rng = seededRng(11);
    const p = createProfile(picks);
    let prevWild = true; // the feed opens on a match
    let wild = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const r: RankedPick = pickNext(p, CORPUS, rng, new Set(), { allowWildcard: !prevWild, wildcardRate: FEED_WILDCARD_RATE })!;
      prevWild = r.reason === "wildcard";
      if (prevWild) wild++;
    }
    expect(wild / N).toBeGreaterThan(0.18);
    expect(wild / N).toBeLessThan(0.22);
  });

  it("can be told not to serve a wildcard", () => {
    const rng = seededRng(9);
    const p = createProfile(picks);
    for (let i = 0; i < 500; i++) {
      const r = pickNext(p, CORPUS, rng, new Set(), { allowWildcard: false })!;
      expect(r.reason).toBe("match");
    }
  });

  it("never repeats the last 20 seen", () => {
    const rng = seededRng(7);
    let p = createProfile(picks);
    const ids: string[] = [];
    for (let i = 0; i < 60; i++) {
      const r = pickNext(p, CORPUS, rng)!;
      expect(ids.slice(-20)).not.toContain(r.topic.id);
      ids.push(r.topic.id);
      p = markSeen(p, r.topic.id);
    }
  });

  it("resurfaces old topics when the whole library is seen", () => {
    const pool = CORPUS.slice(0, 5) as Topic[];
    let p = createProfile(picks);
    for (const t of pool) p = markSeen(p, t.id);
    const r = pickNext(p, pool, seededRng(1));
    expect(r).not.toBeNull();
  });

  it("learning moves the feed: lots of Space reading makes Space common", () => {
    const rng = seededRng(3);
    let p = createProfile(picks);
    const space = CORPUS.filter((t) => t.category === "Space");
    for (let i = 0; i < 12; i++) for (const t of space) p = applyEngagement(p, t, 1.4);
    let count = 0;
    for (let i = 0; i < 2000; i++) if (pickNext(p, CORPUS, rng)!.topic.category === "Space") count++;
    expect(count / 2000).toBeGreaterThan(0.4);
  });
});

describe("pickNudges", () => {
  it("returns 2 close topics and a wildcard from another category", () => {
    const p = createProfile(picks);
    const current = CORPUS.find((t) => t.id === "shepard-tone")!;
    const { close, wildcard } = pickNudges(p, current, CORPUS);
    expect(close).toHaveLength(2);
    expect(close.map((t) => t.id)).not.toContain(current.id);
    expect(wildcard).not.toBeNull();
    expect(wildcard!.category).not.toBe(current.category);
    expect(close.map((t) => t.category)).not.toContain(wildcard!.category);
  });
});

describe("novelty", () => {
  it("prefers unread topics over ones read long ago", () => {
    const p = createProfile(["Music"] as Category[]);
    const music = CORPUS.filter((t) => t.category === "Music");
    // Read every Music topic but one, long enough ago to fall outside the recent window.
    const unread = music[music.length - 1];
    const old = music.slice(0, -1).map((t, i) => ({ id: t.id, at: i }));
    const filler = CORPUS.filter((t) => t.category !== "Music").slice(0, 25).map((t, i) => ({ id: t.id, at: 1000 + i }));
    const profile = { ...p, seen: [...filler, ...old] };
    const rng = seededRng(5);
    let hits = 0;
    for (let i = 0; i < 400; i++) {
      const r = pickNext(profile, music, rng, new Set(), { allowWildcard: false });
      if (r?.topic.id === unread.id) hits++;
    }
    // Uniform would be about 1/5 of the top five; novelty should clearly beat that.
    expect(hits / 400).toBeGreaterThan(0.3);
  });
});
