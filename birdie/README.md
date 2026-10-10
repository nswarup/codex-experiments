# Birdie

**Something worth knowing.** Birdie is a phone-first reading app for spare minutes: one short, true, surprising topic at a time, about two screens long, with threads to pull on and a companion you can ask about anything you highlight.

This folder is a working prototype: a Vite + React PWA (`web/`) and a small Node server (`server/`) that streams writing from Claude.

## Run it

```sh
cd birdie
npm install
npm run dev
```

**Phone preview on desktop:** http://localhost:5173/viewer.html shows Birdie inside a phone frame (iPhone SE, 13, Pro Max or Pixel 8), scaled to fit your screen, with Reload, Restart onboarding and Open full screen. The published demo opens in the same viewer on desktop and goes full-screen on a phone.

Open http://localhost:5173 on your laptop, or on your phone at `http://<your-laptop-ip>:5173` (same Wi‑Fi). The server prints which writer it is using:

| Writer | When it's used | Notes |
| --- | --- | --- |
| **Claude API** | `ANTHROPIC_API_KEY` is set | Fastest. Uses `claude-sonnet-5-5` at low effort, streaming, with server-side refusal fallback. |
| **Your Claude Code login** | No key, but `claude` is installed and logged in | No key to provision: Birdie runs `claude -p` headlessly with your subscription. First words take ~10–15 s. |
| **Demo mode** | Neither of the above | Everything works with the 100 built-in topics; new articles and chat replies are clearly labelled placeholders. |

Force one with `BIRDIE_PROVIDER=anthropic|claude-cli|mock`. Other knobs: `BIRDIE_MODEL` (API model id), `BIRDIE_CLI_MODEL` (default `sonnet`), `BIRDIE_CLI_EFFORT` (default `low`), `PORT` (API, default 8787).

## What's in the prototype

- **Onboarding**: pick at least 3 interests (X-style chips), then a 3-step tour with spotlight coachmarks. Replay it from **Aa → Replay the tour**.
- **Cold open**: returning readers land straight on a ranked-random topic.
- **Topic unit**: title, a mono hook led by its category (`MUSIC · …`), a lede, and 3–5 bullets that each add a new fact about the subject; their dotted-underlined openings are themselves topics. Related subjects live in "Next, maybe…", not in the bullets.
- **Peek**: tap an opening for a short preview, then **Read** or **Save for later**. Openings outside the library are written on demand by Claude and cached.
- **Next, maybe…**: two close topics plus one dashed wildcard from another category. The feed keeps going below.
- **Ask Birdie**: highlight any text and tap the pill, or tap **Ask** under any article, to chat about it. Replies can end with a **Read next** card, and a conversation survives closing the sheet.
- **Search**: type anything and Birdie writes an article for exactly those words (library titles open the built-in topic).
- **Reading settings**: Light / Sepia / Dark (Kindle-like, warm), 5 text sizes, 3 line spacings, sounds and haptics.
- **Library**: Saved and History.
- **Why this?**: under every topic, shows why it was picked and what Birdie has learned (category and niche meters).
- **Design lab** (Aa → Design lab): flip between variants for your call: hook font (mono / serif), nudge style (cards / list), page transition (slide / fade), feed (endless / one at a time), wildcard label on/off.
- **Small comforts**: a reload puts you back where you were; Undo on saves, interest edits and cleared searches; failed articles retry themselves when you're back online; share links open the topic directly; desktop shortcuts (`/` search, `Esc` back, `j`/`k` next/previous topic).
- Native feel: page stack with iOS-style slide and **edge-swipe back**, Vaul bottom sheets (drag to dismiss), Sonner toasts with Undo, Cuelume interaction sounds, haptics, safe areas, reduced-motion support, installable PWA that works offline for the built-in library.

## How ranking works

All on-device (`web/src/lib/ranking.ts`, fully unit-tested):

- **Interests** are the 14 categories, **niches** are each topic's tags; each has a score from 0 to 2.
- Picked categories start at 1.0, others at 0.2; niches start neutral at 0.5.
- **Reading time is continuous**: engagement = time on topic ÷ expected read time (capped at 1.5). Category moves by `0.2 × (engagement − 0.3)`, niches by `0.15 × (engagement − 0.3)`. Skimming nudges down, reading fully nudges up.
- Tapping into a topic adds +0.15 / +0.10; asking Birdie about it adds +0.20 / +0.15.
- Every session, scores drift 3% back toward neutral so old tastes fade.
- **Next topic**: skip the last 20 seen; score = 60% category + 40% average niche. 80% of the time pick from the top 5 weighted by score; 20% of the time pick a **wildcard** from a category you didn't choose.
- **Nudges**: 2 closest by shared niches (tie-break by your score) + 1 wildcard from a different category.

## Content

`web/src/content/topics/*.json` holds 100 topics across 14 categories, written to `docs/CONTENT_GUIDE.md` (warm by default, no visceral disgust, folklore flagged as folklore) and fact-checked in a second pass. Validate with:

```sh
python3 scripts/validate_corpus.py
```

## Tests

```sh
npm test          # ranking, parsers, server API (vitest) + corpus validation
npm run e2e       # Playwright, phone viewport, demo writer
npm run typecheck
```

## Layout

```
birdie/
  web/                 Vite + React 19 + Tailwind v4 PWA
    src/content/       100 topics + manifest
    src/lib/           ranking, store, streaming client, parsers, generation jobs, sounds
    src/components/    screens and sheets
  server/              Hono server: /api/topic, /api/chat, /api/health
  e2e/                 Playwright specs
  scripts/             corpus validator
  docs/                content guide
```

## Not in v0

Accounts and sync, images, analytics (v1); news-driven topics (v2).
