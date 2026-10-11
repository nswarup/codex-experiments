#!/usr/bin/env python3
"""Deeper, report-style checks on the Birdie corpus (beyond validate_corpus.py).

Usage: python3 scripts/audit_corpus.py [--json FILE]
Writes docs/AUDIT.md. Nothing here fails the build: these are findings for a person
(or a reviewing agent) to look at. validate_corpus.py stays the pass/fail gate.
"""
import collections
import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_corpus import CONTENT, ROOT, TOPICS, WORD_RE, STOP  # noqa: E402


def load():
    manifest = json.loads((CONTENT / "manifest.json").read_text())
    return [json.loads((TOPICS / f"{m['id']}.json").read_text()) for m in manifest]


def fields(t):
    """(name, text) for every reader-visible field."""
    out = [("hook", t["hook"]), ("peek", t["peek"]), ("lede", t["lede"])]
    out += [(f"bullet {i}", b["opening"] + ": " + b["text"]) for i, b in enumerate(t["bullets"])]
    return out


def body(t):
    return " ".join(x for _, x in fields(t))


# ---------------------------------------------------------------- 1 duplicates

def tokens(s):
    return [w for w in (x.lower().strip("'’") for x in WORD_RE.findall(s)) if len(w) > 2 and w not in STOP]


def tfidf(docs):
    df = collections.Counter(w for d in docs.values() for w in set(d))
    n = len(docs)
    vecs = {}
    for k, d in docs.items():
        tf = collections.Counter(d)
        v = {w: (c / len(d)) * math.log(n / df[w]) for w, c in tf.items()} if d else {}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1
        vecs[k] = {w: x / norm for w, x in v.items()}
    return vecs


def near_duplicates(ts, threshold=0.35):
    docs = {t["id"]: tokens(t["title"] + " " + t["hook"] + " " + t["lede"]) for t in ts}
    vecs = tfidf(docs)
    ids = list(vecs)
    out = []
    for i, a in enumerate(ids):
        va = vecs[a]
        for b in ids[i + 1:]:
            vb = vecs[b]
            small, big = (va, vb) if len(va) < len(vb) else (vb, va)
            s = sum(x * big.get(w, 0) for w, x in small.items())
            if s >= threshold:
                out.append((round(s, 2), a, b))
    return sorted(out, reverse=True)


def same_hooks(ts):
    seen = collections.defaultdict(list)
    for t in ts:
        seen[" ".join(tokens(t["hook"]))].append(t["id"])
    return [v for v in seen.values() if len(v) > 1]


# ------------------------------------------------------- 2 internal consistency

YEAR = re.compile(r"\b(1[0-9]{3}|20[0-9]{2})s?\b")


def year_drift(t):
    """Years in the hook or peek that the lede and bullets don't back up.

    "1960s" is backed by any 196x year, "1700s" by any 17xx year; an exact year needs an exact match."""
    rest = " ".join(x for k, x in fields(t) if k not in ("hook", "peek"))
    rest_years = {int(m.group(1)) for m in YEAR.finditer(rest)}
    out = []
    for k in ("hook", "peek"):
        for m in YEAR.finditer(t[k]):
            y, plural = int(m.group(1)), m.group(0).endswith("s")
            if plural:
                span = 100 if y % 100 == 0 else 10
                ok = any(y <= r < y + span for r in rest_years)
            else:
                ok = y in rest_years
            if not ok:
                out.append(f"{k} says {m.group(0)}, the body does not")
    return out


# --------------------------------------------------------------- 3 conversions

NUM = r"(minus\s+|−|-)?(\d[\d,]*(?:\.\d+)?)"
PAIRS = [
    # (regex a, regex b, function a->b, label)
    (NUM + r"\s*°?\s*(?:degrees\s+)?F(?:ahrenheit)?\b", NUM + r"\s*°?\s*(?:degrees\s+)?C(?:elsius)?\b", lambda f: (f - 32) * 5 / 9, "°F→°C"),
    (NUM + r"\s*°?\s*(?:degrees\s+)?C(?:elsius)?\b", NUM + r"\s*°?\s*(?:degrees\s+)?F(?:ahrenheit)?\b", lambda c: c * 9 / 5 + 32, "°C→°F"),
    (NUM + r"\s*(?:km|kilometres?|kilometers?)\b", NUM + r"\s*(?:miles?)\b", lambda k: k * 0.621371, "km→mi"),
    (NUM + r"\s*(?:miles?)\b", NUM + r"\s*(?:km|kilometres?|kilometers?)\b", lambda m: m * 1.609344, "mi→km"),
    (NUM + r"\s*(?:m|metres?|meters?)\b", NUM + r"\s*(?:ft|feet|foot)\b", lambda m: m * 3.28084, "m→ft"),
    (NUM + r"\s*(?:ft|feet|foot)\b", NUM + r"\s*(?:m|metres?|meters?)\b", lambda f: f * 0.3048, "ft→m"),
    (NUM + r"\s*(?:kg|kilograms?)\b", NUM + r"\s*(?:lb|lbs|pounds?)\b", lambda k: k * 2.20462, "kg→lb"),
    (NUM + r"\s*(?:lb|lbs|pounds?)\b", NUM + r"\s*(?:kg|kilograms?)\b", lambda p: p * 0.453592, "lb→kg"),
    (NUM + r"\s*(?:cm|centimetres?)\b", NUM + r"\s*(?:in|inches|inch)\b", lambda c: c / 2.54, "cm→in"),
    (NUM + r"\s*(?:in|inches|inch)\b", NUM + r"\s*(?:cm|centimetres?)\b", lambda i: i * 2.54, "in→cm"),
]


def num(sign, digits):
    v = float(digits.replace(",", ""))
    return -v if sign else v


def conversions(t):
    """A value followed within a few words by its conversion, e.g. '-48 °F (-44 °C)'."""
    out = []
    for _, text in fields(t):
        for ra, rb, f, label in PAIRS:
            for m in re.finditer(ra + r"[^.;]{0,25}?" + rb, text):
                a, b = num(m.group(1), m.group(2)), num(m.group(3), m.group(4))
                want = f(a)
                tol = max(abs(want) * 0.06, 1.5 if "°" in label else 0.05 * abs(want) + 0.5)
                # A temperature change converts without the 32 offset ("a 103 °F (57 °C) jump").
                delta = a * 5 / 9 if label == "°F→°C" else a * 9 / 5 if label == "°C→°F" else None
                if abs(want - b) > tol and (delta is None or abs(delta - b) > max(abs(delta) * 0.06, 1.5)):
                    out.append(f"{label}: '{m.group(0).strip()}' (expected about {want:.0f})")
    return out


# ------------------------------------------------------------- 4 time-sensitive

STALE = re.compile(r"\b(still (?:the|holds|stands|unbeaten|unbroken|the only)|to this day|currently|as of|so far|holds? the (?:world )?record|world record|remains? the (?:largest|oldest|only|biggest|tallest|fastest|longest)|the (?:largest|oldest|biggest|tallest|fastest|longest|smallest) (?:known|living|surviving|ever|in the world|on earth))\b", re.I)


def time_sensitive(t):
    hits = []
    for k, text in fields(t):
        for m in STALE.finditer(text):
            start = max(0, m.start() - 40)
            hits.append(f"{k}: …{text[start:m.end() + 40].strip()}…")
        for y in YEAR.findall(text):
            if int(y) >= 2023:
                hits.append(f"{k}: mentions {y}")
    return hits


# ---------------------------------------------------------------- 5 sensitivity

SENSITIVE = ["died", "dies", "dying", "dead", "death", "deaths", "killed", "kill", "killing", "war", "wars", "bomb", "bombs",
             "bombing", "murder", "injury", "injured", "wounded", "hospital", "cancer", "tumour", "tumor", "surgery",
             "suicide", "execution", "executed", "massacre", "battle", "weapon", "weapons", "poison", "poisoned",
             "vomit", "sick", "illness", "virus", "bacteria", "germ", "germs", "nazi", "slave", "slavery", "prison", "crime"]


def sensitive(t):
    blob = body(t).lower()
    return sorted({w for w in SENSITIVE if re.search(r"\b" + w + r"\b", blob)})


# ------------------------------------------------------------- 6 graph and tags

def graph(ts):
    by_id = {t["id"]: t for t in ts}
    incoming = collections.Counter(r for t in ts for r in t["related"])
    orphans = [t["id"] for t in ts if incoming[t["id"]] == 0]
    unrelated = []
    for t in ts:
        for r in t["related"]:
            o = by_id[r]
            if o["category"] != t["category"] and not (set(o["tags"]) & set(t["tags"])):
                unrelated.append((t["id"], r))
    one_way = sum(1 for t in ts for r in t["related"] if t["id"] not in by_id[r]["related"])
    return orphans, unrelated, one_way


def tag_report(ts):
    count = collections.Counter(g for t in ts for g in t["tags"])
    singletons = sorted(g for g, c in count.items() if c == 1)
    norm = collections.defaultdict(set)
    for g in count:
        k = g.replace("-", "")
        k = re.sub(r"(ies)$", "y", k)
        k = re.sub(r"(es|s)$", "", k)
        norm[k].add(g)
    variants = sorted(sorted(v) for v in norm.values() if len(v) > 1)
    return count, singletons, variants


# ---------------------------------------------------------------------- 7 style

AMERICAN = {"color": "colour", "colors": "colours", "colored": "coloured", "center": "centre", "centers": "centres",
            "favorite": "favourite", "realize": "realise", "realized": "realised", "gray": "grey", "meter": "metre",
            "meters": "metres", "theater": "theatre", "organize": "organise", "organized": "organised",
            "honor": "honour", "behavior": "behaviour", "neighbor": "neighbour", "flavor": "flavour",
            "harbor": "harbour", "labor": "labour", "humor": "humour", "catalog": "catalogue", "traveled": "travelled",
            "jewelry": "jewellery", "aluminum": "aluminium", "analyze": "analyse", "recognize": "recognise"}
HEDGES = re.compile(r"the story goes|is said to|reportedly|legend has it|according to legend|the usual story", re.I)
HOOK_TEMPLATES = [r"\bbegan as\b", r"\bisn't\b|\bis not\b|\bwasn't\b|\bwas not\b", r"\bthe first\b", r"\bnever\b"]


def style(t):
    out = []
    for k, text in fields(t) + [("title", t["title"])]:
        if "  " in text:
            out.append(f"{k}: double space")
        if re.search(r"\s[,.;:]", text):
            out.append(f"{k}: space before punctuation")
        if re.search(r"[A-Za-z][.!?][A-Z][a-z]", text):
            out.append(f"{k}: missing space after full stop")
        for m in re.finditer(r"\b[a-z]+\b", text):
            w = m.group(0)
            if w in AMERICAN:
                out.append(f"{k}: American spelling '{w}' (British '{AMERICAN[w]}')")
    for i, b in enumerate(t["bullets"]):
        if not b["text"].rstrip().endswith((".", "?", "”", '"', ")")):
            out.append(f"bullet {i}: text has no closing full stop")
    hedges = len(HEDGES.findall(body(t)))
    if hedges > 2:
        out.append(f"{hedges} hedges ('the story goes' etc.)")
    return out


# ----------------------------------------------------------------------- report

def main(argv):
    ts = load()
    by_id = {t["id"]: t for t in ts}
    per = collections.defaultdict(lambda: collections.defaultdict(list))  # id -> check -> notes

    dups = near_duplicates(ts)
    for s, a, b in dups:
        per[a]["near-duplicate"].append(f"{b} ({s})")
        per[b]["near-duplicate"].append(f"{a} ({s})")
    hooks = same_hooks(ts)
    for group in hooks:
        for i in group:
            per[i]["same hook"].append(", ".join(x for x in group if x != i))
    for t in ts:
        for k, fn in (("year drift", year_drift), ("conversion", conversions), ("time-sensitive", time_sensitive), ("style", style)):
            for note in fn(t):
                per[t["id"]][k].append(note)
        s = sensitive(t)
        if s:
            per[t["id"]]["sensitive words"].append(", ".join(s))
    orphans, unrelated, one_way = graph(ts)
    for i in orphans:
        per[i]["orphan"].append("no other topic lists it in related")
    for a, b in unrelated:
        per[a]["weak related"].append(f"{b} (different category, no shared tag)")
    tag_count, singletons, variants = tag_report(ts)

    checks = ["conversion", "year drift", "near-duplicate", "same hook", "style", "sensitive words", "time-sensitive",
              "weak related", "orphan"]
    lines = ["# Corpus audit", "",
             f"Generated by `python3 scripts/audit_corpus.py` over {len(ts)} topics. These are findings to review, not build errors; "
             "`scripts/validate_corpus.py` is the pass/fail gate.", "", "## Summary", "",
             "| Check | Topics flagged |", "|---|---|"]
    for c in checks:
        lines.append(f"| {c} | {sum(1 for i in per if per[i].get(c))} |")
    lines += [f"| one-way related links | {one_way} (allowed; listed for interest) |",
              f"| tags used once | {len(singletons)} of {len(tag_count)} |",
              f"| near-synonym tag groups | {len(variants)} |"]

    words = collections.defaultdict(list)
    for t in ts:
        words[t["category"]].append(len(WORD_RE.findall(t["lede"] + " " + " ".join(b["text"] for b in t["bullets"]))))
    lines += ["", "## Length by category", "", "| Category | Topics | Median words | Min | Max |", "|---|---|---|---|---|"]
    for c, ws in words.items():
        ws.sort()
        lines.append(f"| {c} | {len(ws)} | {ws[len(ws) // 2]} | {ws[0]} | {ws[-1]} |")

    for c in checks:
        flagged = [i for i in by_id if per[i].get(c)]
        if not flagged:
            continue
        lines += ["", f"## {c} ({len(flagged)})", ""]
        for i in flagged:
            for note in per[i][c]:
                lines.append(f"- `{i}`: {note}")
    if variants:
        lines += ["", "## Near-synonym tags", ""] + [f"- {', '.join(v)}" for v in variants]
    (ROOT / "docs" / "AUDIT.md").write_text("\n".join(lines) + "\n")

    if argv[:1] == ["--json"]:
        Path(argv[1]).write_text(json.dumps({i: dict(v) for i, v in per.items()}, indent=1, ensure_ascii=False))
    print("\n".join(lines[6:6 + len(checks) + 5]))
    print(f"wrote docs/AUDIT.md ({len(per)} topics with at least one finding)")


if __name__ == "__main__":
    main(sys.argv[1:])
