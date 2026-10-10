# Decisions and open questions

What I decided while building v0 overnight, and the calls that are yours. Everything here is easy to change.

## Calls for you

1. **Hook font.** The mockup review settled on monospace with the category in front (`MUSIC · …`). The serif italic version is one tap away in **Aa → Design lab → Hook font** if you want to compare in the real app.
2. **"Next, maybe…" style.** Cards (default, as mocked) or a denser list. Toggle in the Design lab.
3. **Wildcard label.** The wildcard nudge is marked only by its dashed border. The Design lab can add a small "Something different" label.
4. **Endless feed or one at a time.** The default feed keeps going as you scroll. "One at a time" stops after each topic's nudges and asks before the next one, which may suit a calmer, more deliberate read. Design lab → Feed.
5. **Page transition.** iOS-style slide with edge-swipe back (default) or a quiet fade.
6. **Sounds on by default.** Interaction sounds (Cuelume, subtle emphasis) are on, and haptics too; both toggle in Aa. A reading app could reasonably default sounds off.
7. **Writer latency.** Through the Claude Code login, the first words of a new article take about 13 s and the article finishes in about 19 s. With an API key it's faster. If that's too slow for search, options are a faster model for search only, or pre-writing the openings people tap most.
8. **Content length.** Articles run 220–320 words (about two phone screens at 18px). The original brief said 350–450; that was more like three to four screens.

## Decisions I made

- **No welcome screen.** Per your mockup comments, the app opens on the interest picker; the "Something worth knowing" line now lives in the app's description and README.
- **Cold open never shows a wildcard**, and the feed never serves two wildcards in a row. To keep the long-run wildcard share at the specced 20%, each eligible pick uses 25% (r / (1 + r) = 0.2).
- **Search writes exactly what you typed**, except when it matches a library title, in which case it opens the built-in topic rather than writing a second version.
- **Tapping an unlinked opening starts writing its article in the background** as soon as the preview opens, so Read is faster. A preview you dismiss still finishes and is kept for later.
- **Reading time** only counts while the article crosses the middle of the screen, the page is on top, and the app is in the foreground.
- **Demo mode is labelled, not hidden.** With no Claude connection, new topics and chat replies are clearly marked placeholders; the 100 built-in topics are unaffected.
- **Local-only server.** The API binds to 127.0.0.1 and has a simple rate limit; phones reach it through the Vite dev server's proxy.
- **The artifact build** (phone demo) writes through the viewer's own Claude account via the artifact `sample` capability, with a Claude consent prompt on first use. It uses the balanced model tier for articles and the quick tier for chat.

## Design review pass

Two independent reviews: a visual and interaction review (about 120 screenshots across all three themes, iPhone SE and desktop), and an edge-case audit. What changed:

- **Recovery:** a corrupt or older save is cleaned on load instead of crashing. The error screen offers "Start fresh". A failed article no longer shows Save, Share or Why. A peek that failed offers Try again. Retries keep their original context. Anything that failed offline retries itself when the connection returns.
- **Error copy:** plain sentences only, never JSON or status codes. Offline, rate-limited and writer-down each get their own message.
- **Navigation:**
  - A double-tap on Back pops one page.
  - Opening a topic that's already further down the stack goes back to it instead of stacking a copy.
  - Edit interests and Library return to Settings when opened from Settings.
  - Focus moves to a new page's title and returns to whatever opened it.
  - A reload puts you back exactly where you were. Same tab only, so a fresh open still lands on a new ranked topic.
- **Feed:** unread topics are preferred over re-reads, and the feed never dead-ends after the library is exhausted. Learning decays per real session (a 30-minute break), not per reload. Written topics are capped at 150, never evicting saved or recent ones.
- **Look:**
  - Dark's segmented control no longer looks pressed in.
  - Sepia's muted text passes AA on every surface.
  - Cards separate from the page, and Light's buttons are warmer.
  - The header's library icon no longer looks like "bookmark this".
  - Every sheet shares one header, and the Settings header stays put while scrolling.
  - Peek's Read and Save buttons are the same width.
  - Chips are X-style: filled means picked, with no check icon, so labels stay centred.
  - Toast Undo is a proper 36px button, and theme changes cross-fade.
- **Small features:**
  - An Ask button on every article, so chat works without selecting text.
  - Undo on save from the peek, on clearing recent searches and on editing interests.
  - Conversations survive closing the sheet by accident.
  - Desktop shortcuts: `/` search, `Esc` back, `j` / `k` next and previous topic.
  - Share links open the topic directly.
  - Haptics only appear where the device can vibrate.

Kept as-is despite review suggestions, because they were your explicit calls in the mockup rounds: the mono hook (serif is in the Design lab), the dashed wildcard border, the "Pick at least 3 (n/3)" button copy, the helper line sitting by the button, and dark as the first-run theme.

## Content notes from the fact-check passes

The writing agents and two independent fact-check passes flagged a few items you may want to verify against sources before anything ships publicly:

- **Larry the cat**: written as "by 2024, six prime ministers"; current status not checked.
- **Sagrada Família**: completion timeline is hedged ("aimed to finish the main towers around 2026").
- **Voyager Golden Record**: says the probes are "leaving the solar system"; by some definitions they're still inside it.
- **Slinky / Gimbels 1945**: "400 sold in about 90 minutes" is widely reported but unverified here.
- **Kamoʻoalewa**: describes Tianwen-2 only as launched in 2025 to bring back a sample.
- Every folklore-style origin story (croissant, Caesar salad, Earl of Sandwich, QWERTY jamming, microwave chocolate bar, tulip mania) is labelled as legend or disputed in the text.

## Not built (v1 / v2)

Accounts and sync, images, analytics (v1); news-driven topics (v2).
