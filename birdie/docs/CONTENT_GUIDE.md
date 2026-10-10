# Birdie content guide

Birdie is a phone reading app: one short, true, surprising topic at a time, read in about two minutes. This guide is the contract for every topic in `web/src/content/topics/`.

## What makes a Birdie topic

- **One concrete, nameable thing**: an object, effect, word, event, place, animal or person's single idea. Not a survey ("the history of jazz").
- **The "wait, really?" test**: the reader should come away with one surprising core fact they would repeat to a friend.
- **Warm by default**: cats, hobbies, culture, music, language, clothing, math, art, food, history. A lean, not a filter.
- **Never evoke visceral disgust**: no insects, parasites, microbes, slime, bodily fluids, disease, injury, gore, decay, death- or violence-centred stories, true crime. If a topic brushes one of these (e.g. honey found in a tomb), keep it to a neutral half-clause.
- **Avoid hot-button politics and religion debates.**
- **True and checkable**: only well-established facts. When something is folklore or disputed, say so plainly ("the story goes", "historians doubt"). Never invent quotes, numbers or dates. Prefer round, defensible numbers ("about 2,000") over false precision.

## Voice

- Plain, warm, specific. Short sentences. Concrete nouns and numbers.
- Write like a smart friend telling you something good, not a textbook and not a hype account.
- No filler or AI tells: avoid "fascinating", "delve", "intriguing", "testament", "tapestry", "it's worth noting", "in conclusion", rhetorical "Imagine…" openers, exclamation marks, emoji.
- Avoid em dashes; use commas, colons or full stops.
- No second-person commands except where natural ("Play it on a loop and…").

## Schema

Each topic is one file `<id>.json`:

```json
{
  "id": "shepard-tone",
  "title": "The Shepard tone",
  "category": "Music",
  "hook": "A sound that rises forever and never gets any higher.",
  "peek": "Two to three sentences, 30–55 words, that tease the topic for a preview sheet. Must stand alone.",
  "lede": "One paragraph, 40–70 words, that sets up the surprising core fact.",
  "bullets": [
    { "opening": "Auditory illusions", "linkId": "mcgurk-effect", "text": "One to three sentences, 25–55 words." },
    { "opening": "Penrose stairs", "linkId": null, "text": "..." }
  ],
  "tags": ["acoustics", "illusions", "perception"],
  "related": ["mcgurk-effect", "amen-break", "theremin", "tetris-effect"]
}
```

Field rules:

- `id`, `title`, `category`: copy exactly from `web/src/content/manifest.json`.
- `hook`: one line, 45–90 characters, sentence case, ends with a full stop. Do **not** include the category (the app prefixes it).
- `peek`: shown when someone taps a bullet opening that points here. It must make sense without the article.
- `lede`: 40–70 words.
- `bullets`: **4–6** items. Each `opening` is a 2–5 word noun phrase that is itself a good topic title (the app shows it dotted-underlined, tappable). `text` continues the sentence after a colon, starting with a capital letter.
  - **At least 2 bullets** must have `linkId` set to another topic id from the manifest (any category). The opening should name or clearly evoke that topic; it does not have to repeat its title word for word.
  - Other bullets use `linkId: null`; the app generates those topics on demand, so their openings must be real, specific, searchable subjects (e.g. "Penrose stairs", "Hans Zimmer's Dunkirk score"), never vague ("Another thing").
  - Do not link a topic to itself.
- Total of `lede` + all bullet `text`: **220–320 words**.
- `tags`: 3–5 lowercase kebab-case niche tags. Reuse common ones where they fit so topics connect across categories. Suggested shared tags: `illusions`, `perception`, `acoustics`, `accidents`, `inventors`, `names`, `etymology`, `probability`, `infinity`, `patterns`, `color`, `design`, `cats`, `animal-minds`, `communication`, `fashion`, `history-of-things`, `myths-busted`, `time`, `calendars`, `maps`, `borders`, `architecture`, `weather`, `light`, `space-exploration`, `scale`, `games`, `ai`, `food-history`, `taste`, `memory`, `language-change`, `music-tech`, `records`.
- `related`: 4–6 ids from the manifest, the topics a curious reader would want next. Mix same-category and cross-category.
