import { describe, expect, it } from "vitest";
import { parseChat, parseTopicStream, slug, toTopic } from "../src/lib/parse";

const FULL = `CATEGORY: Travel
TITLE: Massachusetts
HOOK: A state name that began as directions to a hill.
PEEK: The name comes from the Massachusett people. It points at a hill.
LEDE: Massachusetts is a mouthful, and it was never meant for English mouths.
BULLET: Great Blue Hill :: The hill is usually said to be Great Blue Hill.
BULLET: The Shepard tone :: Not really related, but in the library. [[shepard-tone]]
BULLET: Tulip mania :: Matches by title even without a link marker.
TAGS: names, Etymology, maps
END`;

describe("parseTopicStream", () => {
  it("parses a complete article", () => {
    const p = parseTopicStream(FULL);
    expect(p.done).toBe(true);
    expect(p.category).toBe("Travel");
    expect(p.title).toBe("Massachusetts");
    expect(p.bullets).toHaveLength(3);
    expect(p.bullets[1].linkId).toBe("shepard-tone");
    expect(p.bullets[1].text).not.toContain("[[");
    expect(p.bullets[2].linkId).toBe("tulip-mania");
    expect(p.tags).toEqual(["names", "etymology", "maps"]);
  });

  it("is safe on every prefix of the stream", () => {
    for (let i = 0; i < FULL.length; i += 7) {
      const p = parseTopicStream(FULL.slice(0, i));
      expect(p.bullets.every((b) => typeof b.opening === "string")).toBe(true);
    }
  });

  it("marks which field is still being written", () => {
    expect(parseTopicStream("TITLE: X\nHOOK: half a ho").writing).toBe("hook");
    expect(parseTopicStream("TITLE: X\nLEDE: some text").writing).toBe("lede");
  });

  it("rejects unknown categories and joins wrapped lede lines", () => {
    const p = parseTopicStream("CATEGORY: Gardening\nTITLE: X\nLEDE: first line\nsecond line\nBULLET: A :: b");
    expect(p.category).toBeUndefined();
    expect(p.lede).toBe("first line second line");
  });

  it("builds a topic only when enough is present", () => {
    expect(toTopic(parseTopicStream("TITLE: X"), "g-x", "x")).toBeNull();
    const t = toTopic(parseTopicStream(FULL), slug("Massachusetts"), "Massachusetts")!;
    expect(t.id).toMatch(/^g-massachusetts-[a-z0-9]+$/);
    expect(t.generated).toBe(true);
  });

  it("gives distinct ids to non-Latin and long queries", () => {
    expect(slug("東京")).not.toBe(slug("кошки"));
    expect(slug("a".repeat(70) + "x")).not.toBe(slug("a".repeat(70) + "y"));
  });

  it("does not finish a topic that never reached END", () => {
    expect(toTopic(parseTopicStream(FULL.replace("\nEND", "")), "g-x", "x")).toBeNull();
  });

  it("joins wrapped hooks, strips link markup before punctuation, waits on partial keys", () => {
    const p = parseTopicStream("TITLE: X\nHOOK: one\ntwo.\nBULLET: A :: text [[tulip-mania]].\nBUL");
    expect(p.hook).toBe("one two.");
    expect(p.bullets[0]).toMatchObject({ linkId: "tulip-mania", text: "text." });
  });
});

describe("parseChat", () => {
  it("splits the READ NEXT line off the body", () => {
    const c = parseChat("Answer here.\n\nREAD NEXT: Tulip mania :: When one bulb cost a house.");
    expect(c.body).toBe("Answer here.");
    expect(c.readNext).toEqual({ title: "Tulip mania", hook: "When one bulb cost a house." });
  });

  it("hides a READ NEXT line that is still arriving", () => {
    expect(parseChat("Answer here.\nREAD NE").body).toBe("Answer here.");
  });
});

import { smart } from "../src/lib/typography";
describe("smart quotes", () => {
  it("curls apostrophes and quotes", () => {
    expect(smart(`Benford's law isn't "magic", it's the '90s' favourite`)).toBe("Benford’s law isn’t “magic”, it’s the ’90s’ favourite");
    expect(smart("dogs' noses")).toBe("dogs’ noses");
    expect(smart(`He said 'hi'.`)).toBe("He said ‘hi’.");
  });
});

describe("slug whitespace", () => {
  it("treats extra spaces as the same query", () => {
    expect(slug("dogs  smell")).toBe(slug("dogs smell"));
    expect(slug(" Dogs smell ")).toBe(slug("dogs smell"));
  });
});
