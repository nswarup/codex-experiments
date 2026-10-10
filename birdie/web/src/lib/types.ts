export const CATEGORIES = [
  "Music", "Language", "Math", "Art", "Food", "Animals", "Clothing",
  "Space", "Inventions", "Mind", "Places", "Games", "Nature", "History",
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
  sessions: number;
}

export interface Saved {
  id: string;
  at: number;
}
