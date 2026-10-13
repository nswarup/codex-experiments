import { useEffect, useSyncExternalStore } from "react";
import INDEX from "virtual:corpus-index";
import type { Category, Topic } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { smart, smartTopic } from "@/lib/typography";

/*
 * The library is split in two. The index (title, hook, peek, tags, related, word count) ships
 * with the app, because ranking, nudges, search and peeks need every topic at once. Each
 * article's lede and bullets load the first time it is shown, from its own small file.
 */

export const CORPUS: Topic[] = INDEX.map((t) => ({
  ...t,
  category: t.category as Category,
  title: smart(t.title),
  hook: smart(t.hook),
  peek: smart(t.peek),
  lede: "",
  bullets: [],
  stub: true,
})).sort((a, b) => a.id.localeCompare(b.id));
export const CORPUS_BY_ID: Record<string, Topic> = Object.fromEntries(CORPUS.map((t) => [t.id, t]));

const loaders = import.meta.glob<Topic>("./topics/*.json", { import: "default" });
const bodies = new Map<string, Topic>();
const pending = new Map<string, Promise<Topic | undefined>>();
const listeners = new Set<() => void>();

/** The full library topic if its body has loaded. */
export function loadedBody(id: string): Topic | undefined {
  return bodies.get(id);
}

/** Load a library topic's body (once; later calls share the same request). */
export function loadBody(id: string): Promise<Topic | undefined> {
  const have = bodies.get(id);
  if (have) return Promise.resolve(have);
  const inflight = pending.get(id);
  if (inflight) return inflight;
  const load = loaders[`./topics/${id}.json`];
  if (!load) return Promise.resolve(undefined);
  const p = load()
    .then((raw) => {
      const t: Topic = { ...smartTopic(raw), words: CORPUS_BY_ID[id]?.words, surprise: CORPUS_BY_ID[id]?.surprise };
      bodies.set(id, t);
      listeners.forEach((l) => l());
      return t;
    })
    .catch(() => undefined)
    .finally(() => pending.delete(id));
  pending.set(id, p);
  return p;
}

/**
 * The topic to render: library topics come back full once their body arrives (loading it on
 * first use); generated topics are already whole.
 */
export function useFullTopic<T extends Topic | undefined>(t: T): T {
  const full = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (t?.stub ? bodies.get(t.id) : undefined),
    () => undefined,
  );
  useEffect(() => {
    if (t?.stub && !bodies.has(t.id)) void loadBody(t.id);
  }, [t]);
  return (full ?? t) as T;
}

export const CATEGORY_LIST: Category[] = [...CATEGORIES];

/** Short descriptors shown on the interest chips' accessible labels. */
export const CATEGORY_BLURB: Record<Category, string> = {
  Tech: "Computers, the internet and the machines we live with",
  Science: "Experiments, discoveries and how we know things",
  Space: "Moons, planets and the long view",
  Math: "Puzzles and patterns that bend intuition",
  Mind: "Perception, memory and quirks of thought",
  Inventions: "Everyday things and their happy accidents",
  Games: "Play, puzzles and the people behind them",
  History: "Small moments with long tails",
  Books: "Stories, writers and the lives of books",
  Language: "Words, letters and how we talk",
  Music: "Sounds, songs and the tricks of the ear",
  Film: "Movies, TV and how they get made",
  Sports: "Games, records and the rules behind them",
  Food: "Where dishes and flavors come from",
  Travel: "Strange towns, borders and buildings",
  Nature: "Clouds, dunes, forests and rain",
  Animals: "Cats, dogs, crows and other minds",
  Art: "Color, paint, type and design",
  Health: "Sleep, bodies and everyday wellbeing",
  Fashion: "The stories in what we wear",
};

const WORD = /[A-Za-z0-9'’]+/g;

export function wordCount(t: Pick<Topic, "lede" | "bullets" | "words">): number {
  if (typeof t.words === "number") return t.words;
  return (t.lede.match(WORD)?.length ?? 0) + t.bullets.reduce((n, b) => n + (b.text.match(WORD)?.length ?? 0), 0);
}

/** Expected reading time in seconds (230 wpm, plus a beat for the title and bullets). */
export function expectedSeconds(t: Pick<Topic, "lede" | "bullets" | "words">): number {
  return Math.max(30, Math.round((wordCount(t) / 230) * 60) + 6);
}

/** Normalise a title or opening for fuzzy matching against the corpus. */
export function normTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['‘’"“”″′]/g, "")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TITLE_INDEX = new Map(CORPUS.map((t) => [normTitle(t.title), t.id]));

/** Find a corpus topic matching a free-text title, if any. */
export function matchCorpus(query: string): Topic | undefined {
  const n = normTitle(query);
  if (!n) return undefined;
  const exact = TITLE_INDEX.get(n);
  if (exact) return CORPUS_BY_ID[exact];
  // Close match: every query word appears in the title and the title is short.
  const words = n.split(" ").filter((w) => w.length > 2);
  if (!words.length) return undefined;
  let best: Topic | undefined;
  let bestScore = 0;
  for (const t of CORPUS) {
    const tn = normTitle(t.title);
    const tw = new Set(tn.split(" "));
    const hits = words.filter((w) => tw.has(w)).length;
    const score = hits / Math.max(words.length, tw.size);
    if (hits === words.length && score > bestScore && score >= 0.6) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}
