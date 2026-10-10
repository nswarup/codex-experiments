/**
 * Parsers for the line-based formats the server streams.
 * Both are tolerant of partial input so the UI can render while text arrives.
 */
import { CATEGORIES, type Bullet, type Category, type Topic } from "./types";
import { CORPUS_BY_ID, matchCorpus } from "@/content";

export interface PartialTopic {
  category?: Category;
  title?: string;
  hook?: string;
  peek?: string;
  lede?: string;
  bullets: Bullet[];
  tags: string[];
  done: boolean;
  /** Which field is still being written, for the caret. */
  writing?: "hook" | "peek" | "lede" | "bullet";
}

const FIELD = /^(CATEGORY|TITLE|HOOK|PEEK|LEDE|BULLET|TAGS|END)\s*:?\s*(.*)$/;

export function parseTopicStream(text: string): PartialTopic {
  const out: PartialTopic = { bullets: [], tags: [], done: false };
  const lines = text.replace(/\r/g, "").split("\n");
  const lastIndex = lines.length - 1;
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const m = FIELD.exec(line);
    if (!m) {
      // Continuation of a wrapped field: append to the last text field.
      if (out.bullets.length && out.writing === "bullet") {
        const b = out.bullets[out.bullets.length - 1];
        b.text = `${b.text} ${line}`.trim();
      } else if (out.writing === "lede") out.lede = `${out.lede ?? ""} ${line}`.trim();
      return;
    }
    const [, key, value] = m;
    const isLast = i === lastIndex;
    switch (key) {
      case "CATEGORY": {
        const c = CATEGORIES.find((x) => x.toLowerCase() === value.trim().toLowerCase());
        if (c) out.category = c;
        break;
      }
      case "TITLE":
        out.title = value.trim();
        break;
      case "HOOK":
        out.hook = value.trim();
        out.writing = isLast ? "hook" : undefined;
        break;
      case "PEEK":
        out.peek = value.trim();
        out.writing = isLast ? "peek" : undefined;
        break;
      case "LEDE":
        out.lede = value.trim();
        out.writing = "lede";
        break;
      case "BULLET": {
        const [opening, ...rest] = value.split("::");
        let body = rest.join("::").trim();
        let linkId: string | null = null;
        const link = /\[\[([a-z0-9-]+)\]\]\s*$/.exec(body);
        if (link) {
          body = body.slice(0, link.index).trim();
          if (CORPUS_BY_ID[link[1]]) linkId = link[1];
        }
        const op = (opening ?? "").trim().replace(/[:.]$/, "");
        if (!op) break;
        if (!linkId) linkId = matchCorpus(op)?.id ?? null;
        out.bullets.push({ opening: op, linkId, text: body });
        out.writing = "bullet";
        break;
      }
      case "TAGS":
        out.tags = value
          .split(",")
          .map((s) => s.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""))
          .filter(Boolean)
          .slice(0, 5);
        out.writing = undefined;
        break;
      case "END":
        out.done = true;
        out.writing = undefined;
        break;
    }
  });
  return out;
}

/** Turn a finished partial into a Topic. Related ids are filled in by the caller. */
export function toTopic(p: PartialTopic, id: string, query: string): Topic | null {
  if (!p.title || !p.lede || p.bullets.length < 2) return null;
  return {
    id,
    title: p.title,
    category: p.category ?? "Inventions",
    hook: p.hook ?? "",
    peek: p.peek ?? p.lede.split(/(?<=\.)\s/).slice(0, 2).join(" "),
    lede: p.lede,
    bullets: p.bullets.filter((b) => b.text),
    tags: p.tags.length ? p.tags : ["history-of-things"],
    related: [],
    generated: true,
    query,
  };
}

export interface ParsedChat {
  body: string;
  readNext?: { title: string; hook: string };
}

export function parseChat(text: string): ParsedChat {
  const idx = text.lastIndexOf("READ NEXT:");
  if (idx < 0) {
    // Hide a READ NEXT line that is still arriving.
    const partial = /\n\s*R(E(A(D( (N(E(X(T)?)?)?)?)?)?)?)?$/.exec(text);
    return { body: (partial ? text.slice(0, partial.index) : text).trim() };
  }
  const body = text.slice(0, idx).trim();
  const rest = text.slice(idx + "READ NEXT:".length).trim();
  const [title, hook] = rest.split("::").map((s) => s.trim());
  return { body, readNext: title ? { title, hook: hook ?? "" } : undefined };
}

export function slug(s: string): string {
  return (
    "g-" +
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60)
  );
}
