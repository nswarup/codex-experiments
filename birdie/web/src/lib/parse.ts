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
  /** The text field the most recent key line opened, for wrapped continuations. */
  let last: "hook" | "peek" | "lede" | "bullet" | undefined;
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const m = FIELD.exec(line);
    if (!m) {
      // A field key still arriving on the last line ("BUL"): wait for the rest.
      if (i === lastIndex && /^[A-Z]{1,8}$/.test(line)) return;
      // Continuation of a wrapped field: append to the field it belongs to.
      if (last === "bullet" && out.bullets.length) {
        const b = out.bullets[out.bullets.length - 1];
        b.text = `${b.text} ${line}`.trim();
      } else if (last === "lede") out.lede = `${out.lede ?? ""} ${line}`.trim();
      else if (last === "hook") out.hook = `${out.hook ?? ""} ${line}`.trim();
      else if (last === "peek") out.peek = `${out.peek ?? ""} ${line}`.trim();
      return;
    }
    const [, key, value] = m;
    const isLast = i === lastIndex;
    last = key === "HOOK" ? "hook" : key === "PEEK" ? "peek" : key === "LEDE" ? "lede" : key === "BULLET" ? "bullet" : undefined;
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
        // Expect "opening :: text"; tolerate a single colon if the model slips.
        let [opening, ...rest] = value.split("::");
        if (!rest.length && value.includes(":")) [opening, ...rest] = value.split(":");
        let body = rest.join(":").trim();
        let linkId: string | null = null;
        const link = /\s*\[\[([a-z0-9-]+)\]\]\s*([.,;]?)\s*$/.exec(body);
        if (link) {
          body = (body.slice(0, link.index).trim() + link[2]).trim();
          if (CORPUS_BY_ID[link[1]]) linkId = link[1];
        }
        body = body.replace(/\[\[[a-z0-9-]+\]\]/g, "").trim();
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
  const bullets = p.bullets.filter((b) => b.text);
  if (!p.done || !p.title || !p.lede || bullets.length < 2) return null;
  return {
    id,
    title: p.title,
    category: p.category ?? "Inventions",
    hook: p.hook ?? "",
    peek: p.peek ?? p.lede.split(/(?<=\.)\s/).slice(0, 2).join(" "),
    lede: p.lede,
    bullets,
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

/** Stable id for a generated topic: readable slug plus a short hash of the full query. */
export function slug(s: string): string {
  const q = s.trim().toLowerCase();
  const readable = q
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  let h = 2166136261;
  for (let i = 0; i < q.length; i++) h = Math.imul(h ^ q.charCodeAt(i), 16777619);
  return `g-${readable ? readable + "-" : ""}${(h >>> 0).toString(36)}`;
}
