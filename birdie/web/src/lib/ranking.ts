/**
 * Birdie's ranking, exactly as specced:
 *  - Interests = categories, niches = tags. Each has a score 0-2.
 *  - Picked categories start at 1.0, others at 0.2. Tags start neutral (0.5).
 *  - Reading time is continuous: engagement = time on topic / expected time (cap 1.5);
 *    category += 0.2 * (e - 0.3), tags += 0.15 * (e - 0.3).
 *  - Taps into a topic: +0.15 / +0.10. Asking Birdie about it: +0.20 / +0.15.
 *  - Scores clamp to 0-2 and drift 3% toward neutral each session.
 *  - Next topic: drop the last 20 seen, score = 0.6 * category + 0.4 * mean(tag),
 *    then 80%: weighted pick from the top 5; 20%: wildcard from an unpicked category.
 *    (The feed opens on a match and never shows two wildcards in a row.)
 *  - Closing nudges: 2 close (most shared tags, tie-break by score) + 1 wildcard
 *    (best-scoring topic from a different category).
 *
 * Everything here is pure so it can be unit-tested with a seeded RNG.
 */
import type { Category, Profile, Topic } from "./types";
import { CATEGORIES } from "./types";

export const NEUTRAL = 0.5;
export const PICKED_START = 1.0;
export const UNPICKED_START = 0.2;
export const RECENT_WINDOW = 20;
export const TOP_K = 5;
export const WILDCARD_RATE = 0.2;
/**
 * The feed never shows two wildcards in a row. To keep the long-run share at 20%,
 * each eligible pick uses r where r / (1 + r) = 0.2, i.e. r = 0.25.
 */
export const FEED_WILDCARD_RATE = WILDCARD_RATE / (1 - WILDCARD_RATE);
export const DRIFT = 0.03;
export const ENGAGEMENT_CAP = 1.5;
export const ENGAGEMENT_ZERO = 0.3;

export type Rng = () => number;

/** Small, fast, seedable PRNG (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (n: number, lo = 0, hi = 2) => Math.min(hi, Math.max(lo, n));

export function createProfile(picked: Category[]): Profile {
  const cat: Record<string, number> = {};
  for (const c of CATEGORIES) cat[c] = picked.includes(c) ? PICKED_START : UNPICKED_START;
  return { picked: [...picked], cat, tag: {}, seen: [], sessions: 0 };
}

/** Change which categories are picked, keeping learned tag scores. */
export function repick(profile: Profile, picked: Category[]): Profile {
  const cat = { ...profile.cat };
  for (const c of CATEGORIES) {
    const was = profile.picked.includes(c);
    const now = picked.includes(c);
    if (now && !was) cat[c] = Math.max(cat[c] ?? 0, PICKED_START);
    if (!now && was) cat[c] = Math.min(cat[c] ?? 0, UNPICKED_START);
  }
  return { ...profile, picked: [...picked], cat };
}

export const catScore = (p: Profile, c: string) => p.cat[c] ?? UNPICKED_START;
export const tagScore = (p: Profile, t: string) => p.tag[t] ?? NEUTRAL;

export function scoreTopic(p: Profile, t: Pick<Topic, "category" | "tags">): number {
  const tags = t.tags.length ? t.tags.reduce((s, x) => s + tagScore(p, x), 0) / t.tags.length : NEUTRAL;
  return 0.6 * catScore(p, t.category) + 0.4 * tags;
}

/** Explain a score in plain words for the "Why am I seeing this?" sheet. */
export function explain(p: Profile, t: Pick<Topic, "category" | "tags">) {
  const cat = catScore(p, t.category);
  const tags = t.tags.map((x) => ({ tag: x, score: tagScore(p, x) })).sort((a, b) => b.score - a.score);
  return { score: scoreTopic(p, t), cat, picked: p.picked.includes(t.category as Category), tags };
}

export function recentIds(p: Profile, n = RECENT_WINDOW): Set<string> {
  return new Set(p.seen.slice(0, n).map((s) => s.id));
}

function weightedPick<T>(items: { item: T; w: number }[], rng: Rng): T {
  const total = items.reduce((s, x) => s + Math.max(0.0001, x.w), 0);
  let r = rng() * total;
  for (const x of items) {
    r -= Math.max(0.0001, x.w);
    if (r <= 0) return x.item;
  }
  return items[items.length - 1].item;
}

/** How much a previously read topic counts against an unread one of equal score. */
export const REREAD_WEIGHT = 0.35;

export interface RankedPick {
  topic: Topic;
  reason: "match" | "wildcard";
}

/**
 * Choose the next feed topic. `exclude` adds ids already in the current feed.
 * When everything has been seen recently, the oldest-seen topics come back.
 */
export function pickNext(
  p: Profile,
  pool: Topic[],
  rng: Rng,
  exclude: Set<string> = new Set(),
  opts: { allowWildcard?: boolean; wildcardRate?: number } = {},
): RankedPick | null {
  const recent = recentIds(p);
  let candidates = pool.filter((t) => !recent.has(t.id) && !exclude.has(t.id));
  if (!candidates.length) {
    // Library exhausted: resurface the least recently seen, never the current feed.
    const order = new Map(p.seen.map((s, i) => [s.id, i]));
    candidates = pool
      .filter((t) => !exclude.has(t.id))
      .sort((a, b) => (order.get(b.id) ?? 1e9) - (order.get(a.id) ?? 1e9))
      .slice(0, Math.max(TOP_K * 2, 1));
  }
  if (!candidates.length) return null;

  const wildRoll = rng();
  if (opts.allowWildcard !== false && wildRoll < (opts.wildcardRate ?? WILDCARD_RATE)) {
    const unpicked = candidates.filter((t) => !p.picked.includes(t.category));
    const wildPool = unpicked.length
      ? unpicked
      : // Picked everything: the wildcard comes from the least-loved categories.
        [...candidates].sort((a, b) => catScore(p, a.category) - catScore(p, b.category)).slice(0, TOP_K * 2);
    if (wildPool.length) {
      // Within the wildcard, still lean toward niches the reader likes.
      const ranked = wildPool.map((t) => ({ item: t, w: 0.2 + scoreTopic(p, t) })).sort((a, b) => b.w - a.w);
      return { topic: weightedPick(ranked.slice(0, TOP_K * 2), rng), reason: "wildcard" };
    }
  }

  // Unread topics win over ones read a while ago, so re-reads only come once the library runs dry.
  const everSeen = new Set(p.seen.map((x) => x.id));
  const novelty = (t: Topic) => (everSeen.has(t.id) ? REREAD_WEIGHT : 1);
  const ranked = candidates
    .map((t) => ({ item: t, w: scoreTopic(p, t) * novelty(t) }))
    // Stable, deterministic tie-break so seeded tests are reproducible.
    .sort((a, b) => b.w - a.w || a.item.id.localeCompare(b.item.id));
  return { topic: weightedPick(ranked.slice(0, TOP_K), rng), reason: "match" };
}

/** Two close topics and one wildcard to close an article. */
export function pickNudges(
  p: Profile,
  current: Pick<Topic, "id" | "category" | "tags" | "related">,
  pool: Topic[],
  exclude: Set<string> = new Set(),
): { close: Topic[]; wildcard: Topic | null } {
  const recent = recentIds(p, 8);
  const usable = pool.filter((t) => t.id !== current.id && !exclude.has(t.id));
  const fresh = usable.filter((t) => !recent.has(t.id));
  const base = fresh.length >= 3 ? fresh : usable;
  const tagSet = new Set(current.tags);
  const related = new Set(current.related);
  const closeness = (t: Topic) =>
    t.tags.filter((x) => tagSet.has(x)).length + (related.has(t.id) ? 1.5 : 0) + (t.category === current.category ? 0.5 : 0);

  const close = [...base]
    .sort((a, b) => closeness(b) - closeness(a) || scoreTopic(p, b) - scoreTopic(p, a) || a.id.localeCompare(b.id))
    .slice(0, 2);
  const taken = new Set(close.map((t) => t.id));
  const closeCats = new Set([current.category, ...close.map((t) => t.category)]);
  const wildcard =
    [...base]
      .filter((t) => !taken.has(t.id) && !closeCats.has(t.category))
      .sort((a, b) => scoreTopic(p, b) - scoreTopic(p, a) || a.id.localeCompare(b.id))[0] ??
    [...base].filter((t) => !taken.has(t.id) && t.category !== current.category)[0] ??
    null;
  return { close, wildcard };
}

/* --------------------------- learning ------------------------------ */

const engagementValue = (e: number) => Math.min(ENGAGEMENT_CAP, Math.max(0, e)) - ENGAGEMENT_ZERO;

function bump(p: Profile, t: Pick<Topic, "category" | "tags">, dCat: number, dTag: number): Profile {
  const cat = { ...p.cat, [t.category]: clamp(catScore(p, t.category) + dCat) };
  const tag = { ...p.tag };
  for (const x of t.tags) tag[x] = clamp(tagScore(p, x) + dTag);
  return { ...p, cat, tag };
}

/**
 * Apply reading time. `prevE` is the engagement already applied for this topic in this
 * session, so re-entering an article only adds the difference (no double counting).
 */
export function applyEngagement(
  p: Profile,
  t: Pick<Topic, "category" | "tags">,
  engagement: number,
  prevE = 0,
): Profile {
  const delta = prevE > 0 ? engagementValue(engagement) - engagementValue(prevE) : engagementValue(engagement);
  if (Math.abs(delta) < 1e-6) return p;
  return bump(p, t, 0.2 * delta, 0.15 * delta);
}

export function applyTap(p: Profile, t: Pick<Topic, "category" | "tags">): Profile {
  return bump(p, t, 0.15, 0.1);
}

export function applyAsk(p: Profile, t: Pick<Topic, "category" | "tags">): Profile {
  return bump(p, t, 0.2, 0.15);
}

/** Once per session: every score drifts 3% of the way back to neutral. */
export function drift(p: Profile): Profile {
  const towards = (v: number) => v + (NEUTRAL - v) * DRIFT;
  const cat: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.cat)) cat[k] = towards(v);
  const tag: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.tag)) tag[k] = towards(v);
  return { ...p, cat, tag, sessions: p.sessions + 1 };
}

export function markSeen(p: Profile, id: string, at = Date.now()): Profile {
  const seen = [{ id, at }, ...p.seen.filter((s) => s.id !== id)].slice(0, 400);
  return { ...p, seen };
}
