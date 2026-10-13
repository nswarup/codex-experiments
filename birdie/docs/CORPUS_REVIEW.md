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

## Decided and applied (13 October 2026)
- **Retitled:**
  - squirrels-plant-forests → "Squirrels plant forests with the nuts they don't come back for"
  - raspberry-galaxy-centre → "The galaxy's centre and the raspberry molecule"
  - world-cup-1930-two-balls → "The 1930 World Cup final's two-ball story"
  - speech-information-rate → "Fast or slow, languages carry about the same information"
- **nicolas-bourbaki:** the empty-set bullet is trimmed to the symbol's origin.
- **ducks-one-eye-open:** the Radiolab-only "Turning around" bullet is replaced with the 1999 study's looming-stimulus finding (Rattenborg, Lima and Amlaner, Nature).
- **haskell-free-library:** added a bullet on the 2025 end of free US-side access and the Canadian-side entrance that opened in spring 2026.

## Still checked from memory only
- **Whole articles:** bananas-are-berries, paisley-pattern, flat-earth-myth and chinese-room. All four are well-established subjects.
- **Single details:** about 60, such as an exact count or a minor date. Each group report lists them under "STILL UNVERIFIED" or "Could not verify".
