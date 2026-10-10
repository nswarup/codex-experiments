import { describe, expect, it } from "vitest";
import { sanitize } from "../src/lib/store";

describe("saved state migration", () => {
  it("carries picks and scores from renamed categories", () => {
    const s = sanitize({
      onboarded: true,
      profile: { picked: ["Places", "Clothing", "Music", "Nope"], cat: { Places: 1.4, Clothing: 0.9, Music: 1.1 }, tag: {}, seen: [], sessions: 3 },
    });
    expect(s.profile?.picked).toEqual(["Travel", "Fashion", "Music"]);
    expect(s.profile?.cat.Travel).toBe(1.4);
    expect(s.profile?.cat.Fashion).toBe(0.9);
    // New categories start unpicked rather than missing.
    expect(typeof s.profile?.cat.Sports).toBe("number");
    expect(s.onboarded).toBe(true);
  });
});
