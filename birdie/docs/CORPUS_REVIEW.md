# Corpus review, October 2026

The library has 1,000 articles. They went through three checks:

1. **Automated audit.** `python3 scripts/audit_corpus.py` writes the findings to `docs/AUDIT.md`. It looks for:
   - near-duplicates
   - years in the hook or peek that the body doesn't back up
   - wrong unit conversions
   - time-sensitive claims and sensitive words
   - the related-link graph, tags and style
2. **Second fact-check.** Every article got an independent, sceptical review against web sources. Reviewers worked in 40 mixed groups of 25.
3. **Gap-fill.** Articles a reviewer could only check from memory (the shared search budget ran out in the first 12 groups) were web-checked in a separate pass.

`scripts/validate_corpus.py` still reports 0 errors and 0 warnings on all 1,000.

## Results

| Pass | Articles | Fixed | For a person |
|---|---|---|---|
| Second check | 1,000 | about 200 | 12 |
| Gap-fill (web sources for memory-only checks) | about 160 | about 30 | 1 |

Typical corrections:
- **Wrong dates:** the Lacoste bet was in 1923, the barcode patent was sold in 1952, the IKEA reissue was in 2013.
- **Stale facts as of October 2026:** Larry the cat has now served under seven prime ministers; Aldrin's felt-tip pen sold in July 2026; Mechanical Turk has closed; Tristan da Cunha has about 220 people.
- **Myths stated as fact:** the Slinky is not Pennsylvania's state toy; Mozart did not write "Twinkle"; the 1930 World Cup ball swap is disputed.
- **Arithmetic and units:** Napoleon's height, the Chinook temperature swing (spread over two days), the Asch figures.
- **A hook or peek promising more than the body supports:** this came up across many articles.

Each group's report, with a source URL for every fix, is in the session scratchpad under `recheck/gNN-report.md`. That folder isn't in the repo.

## Already resolved from reviewer flags
- **monowi-nebraska:** Elsie Eiler is still the sole resident, so the tense no longer implies she has left.
- **gadsby-no-e:** a few E slips are known, so the hook says "almost entirely".
- **shot-clock-24:** credits the Syracuse Nationals, not one owner.
- **rhapsody-in-blue-glissando:** the hook now says "is said to".
- **chupa-chups-dali:** the unsourced superlative was replaced.
- **biblioburro:** written in the past tense, because no source shows the trips still running in 2026.
- **dart-dimorphos:** the Hera line won't go stale when the probe arrives.

## For you to decide
These are judgment calls the reviewers left alone. Nothing in them is plainly false.

| Article | Issue | Suggested change |
|---|---|---|
| squirrels-plant-forests | The title "…by forgetting" contradicts the first bullet: squirrels mostly remember. | Retitle "Squirrels plant forests with the nuts they don't come back for". |
| raspberry-galaxy-centre | The title states "tastes of raspberries" as fact, but the last bullet calls it a stretch. | Retitle "The galaxy's centre and the raspberry molecule". |
| world-cup-1930-two-balls | The half-time ball swap is disputed, but the title asserts it. | Retitle "The 1930 World Cup final's two-ball story". |
| speech-information-rate | The title says "Every language…", but the study covered 17 languages. | Retitle "Fast or slow, languages carry about the same information". |
| nicolas-bourbaki | The last bullet drifts away from its opening. | Trim the bullet to its first two sentences. |
| ducks-one-eye-open | The "Turning around" bullet traces to a Radiolab retelling, not the 1999 paper. It is already softened. | Keep as is, or drop the bullet. |
| haskell-free-library | Not false, but US border access rules changed in 2025 and a Canadian-side entrance opened in June 2026. | Add one bullet on the 2025–26 changes. |

## Still checked from memory only
- **Whole articles:** bananas-are-berries, paisley-pattern, flat-earth-myth and chinese-room. All four are well-established subjects.
- **Single details:** about 60, such as an exact count or a minor date. Each group report lists them under "STILL UNVERIFIED" or "Could not verify".
