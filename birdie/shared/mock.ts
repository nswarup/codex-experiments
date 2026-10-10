/**
 * Demo-mode output used when no Claude connection is available.
 * It is honest about being a placeholder, but keeps the exact wire format
 * of the real thing so every screen can be exercised end to end.
 */

function titleCase(s: string) {
  const t = s.trim().replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const SERVER_HOWTO = "Set ANTHROPIC_API_KEY before starting the server, or run it on a machine where Claude Code is installed and logged in. Birdie picks whichever it finds.";

export function mockTopic(query: string, _howTo: string = SERVER_HOWTO, category = "Inventions"): string {
  const title = titleCase(query || "Something new");
  return [
    `CATEGORY: ${category}`,
    `TITLE: ${title}`,
    `HOOK: A short, true story about ${title} will appear here.`,
    `PEEK: A two-minute read about ${title}: one surprising core fact and a few threads to pull on. Birdie writes it fresh when its writer is connected.`,
    `LEDE: This page is a placeholder for ${title}. Once Birdie's writer is connected, it fills in with a short, true story: one surprising core fact, a few threads to pull on, and links into the rest of the library.`,
    "BULLET: The Post-it accident :: A real topic from the library, so you can see how a tapped opening leads somewhere. The weak glue that made sticky notes possible was a failed experiment first. [[post-it]]",
    "BULLET: The Shepard tone :: Another library topic: a sound that seems to rise forever without ever getting higher. Tap the underlined words to peek at it. [[shepard-tone]]",
    "BULLET: The rest of the library :: Saving, the feed, reading settings, highlights and the tour all work without a connection, across the 100 topics built into the app.",
    "TAGS: inventors, accidents, design",
    "END",
  ].join("\n");
}

export function mockChat(hint: { highlight?: string; topicTitle?: string }, howTo?: string): string {
  const about = hint.topicTitle ? `"${hint.topicTitle}"` : "this topic";
  const quote = hint.highlight ? ` You highlighted: "${hint.highlight.slice(0, 120)}${hint.highlight.length > 120 ? "…" : ""}".` : "";
  return `Birdie is in demo mode right now, so I can't answer questions about ${about} yet.${quote}

${howTo ?? "Connect Claude and I'll answer properly: set ANTHROPIC_API_KEY before starting the server, or run Birdie on a machine where Claude Code is installed and logged in."}

READ NEXT: The Shepard tone :: A sound that rises forever and never gets any higher.`;
}
