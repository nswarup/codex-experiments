/** Typographer's quotes for reading text: ' → ’ / ‘ and " → “ / ”. */
export function smart(s: string): string {
  if (!s || (!s.includes("'") && !s.includes('"'))) return s;
  return (
    s
      // Apostrophes inside or at the end of words: don't, dogs', '90s
      .replace(/(\w)'(\w)/g, "$1’$2")
      .replace(/(\w)'(?=\s|$|[.,;:!?)\]])/g, "$1’")
      .replace(/'(\d0s)\b/g, "’$1")
      // Remaining single quotes: opening after start/space/bracket, else closing
      .replace(/(^|[\s([{“—-])'/g, "$1‘")
      .replace(/'/g, "’")
      // Double quotes
      .replace(/(^|[\s([{‘—-])"/g, "$1“")
      .replace(/"/g, "”")
  );
}

/** Apply `smart` to every reading field of a topic-shaped object. */
export function smartTopic<T extends { title: string; hook: string; peek: string; lede: string; bullets: { opening: string; text: string }[] }>(t: T): T {
  return {
    ...t,
    title: smart(t.title),
    hook: smart(t.hook),
    peek: smart(t.peek),
    lede: smart(t.lede),
    bullets: t.bullets.map((b) => ({ ...b, opening: smart(b.opening), text: smart(b.text) })),
  };
}
