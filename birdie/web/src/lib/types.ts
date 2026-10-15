export const CATEGORIES = [
  "Tech", "Science", "Space", "Math", "Mind", "Inventions", "Games", "History", "Books", "Language",
  "Music", "Film", "Sports", "Food", "Travel", "Nature", "Animals", "Art", "Health", "Fashion",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Bullet {
  opening: string;
  linkId: string | null;
  text: string;
}

export interface Topic {
  id: string;
  title: string;
  category: Category;
  hook: string;
  peek: string;
  lede: string;
  bullets: Bullet[];
  tags: string[];
  related: string[];
  /** Set on topics Birdie wrote on demand (search, unlinked openings, chat). */
  generated?: boolean;
  /** Search text or opening that produced a generated topic. */
  query?: string;
  /** Library topic whose lede and bullets have not loaded yet (they arrive via loadBody). */
  stub?: boolean;
  /** Body word count, known before the body loads (library topics). */
  words?: number;
  /**
   * How surprising the core fact is to a well-read reader: 1 = famous (the birthday paradox),
   * 5 = almost nobody knows it. Widely known topics are shown less, most of all to new readers.
   */
  surprise?: number;
}

export type Theme = "dark" | "sepia" | "light";

export interface Prefs {
  theme: Theme;
  /** 0-4, index into FONT_SIZES */
  size: number;
  /** 0-2, index into LINE_HEIGHTS */
  spacing: number;
  sound: boolean;
  haptics: boolean;
  /** Design-lab variants so the client can compare options in the real app. */
  lab: {
    nudges: "cards" | "list";
    hook: "mono" | "serif";
    wildcardLabel: boolean;
    transition: "slide" | "fade";
    feed: "endless" | "one";
    /** Liquid glass on the floating control layer, or plain solid surfaces. */
    glass: boolean;
  };
}

export interface Profile {
  /** Categories chosen during onboarding. */
  picked: Category[];
  /** Interest score per category, 0-2. */
  cat: Record<string, number>;
  /** Niche score per tag, 0-2 (missing = neutral 0.5). */
  tag: Record<string, number>;
  /** Most recent first. */
  seen: { id: string; at: number }[];
  /** Thumbs at the end of an article: 1 = up, -1 = down. Absent = no vote. */
  votes?: Record<string, 1 | -1>;
  sessions: number;
}

export interface Saved {
  id: string;
  at: number;
}
