import type { Category, Topic } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { smartTopic } from "@/lib/typography";

const modules = import.meta.glob<Topic>("./topics/*.json", { eager: true, import: "default" });

export const CORPUS: Topic[] = Object.values(modules)
  .map((t) => smartTopic(t))
  .sort((a, b) => a.id.localeCompare(b.id));
export const CORPUS_BY_ID: Record<string, Topic> = Object.fromEntries(CORPUS.map((t) => [t.id, t]));

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

export function wordCount(t: Pick<Topic, "lede" | "bullets">): number {
  return (t.lede.match(WORD)?.length ?? 0) + t.bullets.reduce((n, b) => n + (b.text.match(WORD)?.length ?? 0), 0);
}

/** Expected reading time in seconds (230 wpm, plus a beat for the title and bullets). */
export function expectedSeconds(t: Pick<Topic, "lede" | "bullets">): number {
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
