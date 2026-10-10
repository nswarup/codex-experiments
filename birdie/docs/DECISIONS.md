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
8. **Content length and relevance.** After your note about the crows piece, relevance now beats length:
   - Every bullet must add a new fact about the topic itself.
   - Comparisons and "see also" tie-ins moved out of the bullets and into the "Next, maybe…" cards.
   - Articles run 150–280 words with 3–5 bullets, one to two phone screens.
   - The old rule that forced two links into other library topics is gone; links appear only when a bullet genuinely names a part of the subject.
   - The same rules apply to the live writer.
   - If you'd rather keep a consistent two-screen length, raise the floor in `docs/CONTENT_GUIDE.md` and the writer prompt in `shared/prompts.ts`.

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

- **Verification pass** (a third, independent review of the finished build):
  - Keyboard: sheets now take focus, keep Tab inside, and hand focus back on close. Search does the same.
  - Toasts clear the top bar on phones.
  - Disabled buttons look disabled.
  - A failed chat reply gets a dashed note and "Try again".
  - Every remaining target is at least 44px.
  - The "Why this?" meters hide until Birdie has actually learned something.
  - Streaming articles hold their space, so the page doesn't jump.
  - Mono text uses two sizes only: 11.5px and 13px.
  - The Design lab is labelled "for review" and disappears from builds made with `VITE_LAB=off`.

Kept as-is despite review suggestions, because they were your explicit calls in the mockup rounds: the mono hook (serif is in the Design lab), the dashed wildcard border, and dark as the first-run theme.

## Back button

- **At the top of a page:** Back is a glass pill that says where it goes: "‹ Feed", or the topic you came from ("‹ The Shepard tone").
- **As you scroll:** the pill folds into a chevron circle and the page title fades in beside it.
- **Feel:** the chevron is bolder and optically centred, and it nudges left when pressed.
- **Long press:** jumps straight to your feed with a haptic tap, like iOS's back-button history.
- **Solid material:** it's a clean text back link.

The mono category label that used to sit beside Back is gone.

## Saving without the popup

The "Saved for later" toast on every save is gone. The button is now the feedback, as in Instagram, Threads or Apple Books:
- **The button:** the bookmark fills with a short spring pop, the label reads "Saved", and a haptic tick lands. Tapping again undoes it, so no Undo toast is needed.
- **First save only:** a small "Saved to your Library · View" pill, shown once.
- **Library dot:** a dot appears on the Library icon after a save and clears when you open the Library.
- **All other toasts** (removed from saved, interests updated, searches cleared, link copied) use the same compact pill: it hugs its text and sits near the bottom, out of the reading line. Sans type, one text action, glass or solid to match the material setting.

## Opened topics keep going

A topic you open from a bullet's Read, a "Next, maybe…" card, search or chat is now a feed of its own. Under its "Next, maybe…", ranked topics keep coming as you scroll, exactly like the main feed. Your taste profile already counts the tap, so the follow-ups lean toward what you just showed interest in.
- **No repeats:** the continuation skips topics already in your main feed.
- **One-at-a-time:** it follows the Design lab setting.
- **Reading time:** counted only while that page is on top.
- **"Back to your feed":** the link under opened topics is gone, since the page no longer ends. Back and the edge swipe still return you.

## Liquid glass

Glass follows Apple's rule: it belongs to the controls that float above content, never to the content. The reading page stays Kindle-plain.

- **Top bar:** search, library and Aa sit in one floating glass capsule, and Back is a glass circle. The solid band behind the bar is gone; text softly blurs and fades as it scrolls under the bar (the "scroll edge").
- **Sheets:** frosted glass. Partial-height sheets (Peek, Settings, Why this?) float inset from the screen edges with fully rounded corners; tall ones (Chat, Library, Edit interests) stay docked. Sheet glass is opaque enough to read on and has no sheen over text.
- **Ask Birdie pill, toasts, search:** the pill and toasts are heavy glass in the theme's own ink. Search frosts the page behind it instead of replacing it, and its field is a glass capsule.
- **Small touches:** the disabled Continue on onboarding and the one-at-a-time "Next topic" button.
- **Kept solid on purpose:** article text, cards, the tour tooltip (it needs maximum contrast) and the primary filled buttons.
- **Safe defaults:** glass turns itself off when the system asks for reduced transparency or the browser can't blur. **Aa → Design lab → Controls material** switches between Liquid glass (default) and Solid so you can compare.

## Onboarding redesign

Your note: reading should stay Kindle-like, but onboarding should feel more modern. The pills were too padded, and the pick animation and the self-rewriting button were distracting.

- **Type:** the serif headline bridges to the reading experience. Everything you touch (pills, helper line, button) is now in the phone's own sans, SF Pro on iPhone.
- **Pills:** 36px tall and compact (15px text), with an invisible area that keeps 44px touch targets. Filled means picked. There's no icon, and the width never changes, so rows never reflow.
- **Motion:** the screen fades in once. A pick is a 120ms colour change and nothing else, with no staggered entrance and no label animation.
- **Button:** always reads "Continue" ("Save" in Edit interests) and simply becomes available at 3 picks. Screen readers hear the count, for example "1 selected. Pick 2 more.".
- **Copy:** the helper copy moved from beside the button to under the headline, in two short lines: "Pick at least 3." / "Birdie mixes in a few surprises too." This changes your round-2 mockup call, which put the helper line next to the button. With the count gone from the button, it's the one place that explains the rule.

## Content notes from the fact-check passes

The writing agents and two independent fact-check passes flagged a few items you may want to verify against sources before anything ships publicly:

- **Larry the cat**: written as "by 2024, six prime ministers"; current status not checked.
- **Sagrada Família**: completion timeline is hedged ("aimed to finish the main towers around 2026").
- **Voyager Golden Record**: says the probes are "leaving the solar system"; by some definitions they're still inside it.
- **Slinky / Gimbels 1945**: "400 sold in about 90 minutes" is widely reported but unverified here.
- **Kamoʻoalewa**: describes Tianwen-2 only as launched in 2025 to bring back a sample.
- Every folklore-style origin story (croissant, Caesar salad, Earl of Sandwich, QWERTY jamming, microwave chocolate bar, tulip mania) is labelled as legend or disputed in the text.

### Relevance rewrite (October 2026)

- **Four editors re-cut all 100 topics** against the relevance-first rules: about 210 off-topic bullets cut and about 60 on-topic ones added.
- **Two fact-checkers then reviewed every new or reworded sentence.** Fixes:
  - Sagrada Família: the central tower was completed in 2026, so it is no longer "aiming for 2026".
  - Pale Blue Dot: Mars was lost to light scattered inside the camera, not to faintness.
  - The Ptolemies took the title of king around 305 BC.
  - Bubble wrap's non-popping version links its cells in columns.
  - The dogs' exhaled-air direction is stated more cautiously.
  - The perfect-pitch link to tonal languages is reworded to match Deutsch's claim.
  - An unsourced therapy claim in semantic satiation is replaced.
- **Checked without a live web search** (a few are still worth a look before anything ships): Fan Hui's exact words on move 37, and how long the crows kept scolding (stated as "more than a decade").
- **No bullet links to another library topic any more.** Every opening now writes its own short article on demand, so in demo mode (no Claude connection) tapping an opening shows a placeholder. "Next, maybe…" still offers three library topics under every article.

## Not built (v1 / v2)

Accounts and sync, images, analytics (v1); news-driven topics (v2).
