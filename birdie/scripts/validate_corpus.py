#!/usr/bin/env python3
"""Validate Birdie topic JSON files against docs/CONTENT_GUIDE.md.

Usage: python3 scripts/validate_corpus.py [id ...]
With no ids, validates every topic in the manifest that has a file.
Exits non-zero if any errors are found.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "web" / "src" / "content"
TOPICS = CONTENT / "topics"

BANNED_WORDS = [
    # disgust / grim
    "parasite", "maggot", "worm", "vomit", "pus", "mucus", "slime", "feces", "faeces",
    "excrement", "rotting", "rot", "corpse", "gore", "bloody", "blood", "disease",
    "plague", "infection", "cockroach", "lice", "flea", "murder", "torture", "insect",
    "bug", "bugs", "sewage", "urine", "poop", "diarrhea",
    # AI tells
    "fascinating", "delve", "intriguing", "testament", "tapestry", "it's worth noting",
]
WORD_RE = re.compile(r"[A-Za-z0-9'’]+")


def words(s: str) -> int:
    return len(WORD_RE.findall(s))


def main(argv):
    manifest = json.loads((CONTENT / "manifest.json").read_text())
    by_id = {m["id"]: m for m in manifest}
    ids = argv or [m["id"] for m in manifest if (TOPICS / f"{m['id']}.json").exists()]
    errors, warnings = [], []
    for tid in ids:
        path = TOPICS / f"{tid}.json"
        def err(msg):
            errors.append(f"{tid}: {msg}")
        def warn(msg):
            warnings.append(f"{tid}: {msg}")
        if not path.exists():
            err("file missing")
            continue
        try:
            t = json.loads(path.read_text())
        except json.JSONDecodeError as e:
            err(f"invalid JSON: {e}")
            continue
        m = by_id.get(tid)
        if not m:
            err("id not in manifest")
            continue
        for k in ("id", "title", "category"):
            if t.get(k) != m[k]:
                err(f"{k} must be {m[k]!r}, got {t.get(k)!r}")
        for k in ("hook", "peek", "lede", "bullets", "tags", "related"):
            if k not in t:
                err(f"missing {k}")
        if errors and errors[-1].startswith(f"{tid}: missing"):
            continue
        hook = t["hook"]
        if not (40 <= len(hook) <= 100):
            warn(f"hook length {len(hook)} (target 45-90)")
        if not hook.rstrip().endswith((".", "?")):
            err("hook should end with a full stop")
        if m["category"].lower() in hook.lower().split(" ")[0:1]:
            warn("hook seems to start with the category")
        pw = words(t["peek"])
        if not (25 <= pw <= 65):
            warn(f"peek {pw} words (target 30-55)")
        lw = words(t["lede"])
        if not (32 <= lw <= 80):
            warn(f"lede {lw} words (target 40-70)")
        bullets = t["bullets"]
        if not (4 <= len(bullets) <= 6):
            err(f"{len(bullets)} bullets (need 4-6)")
        links = 0
        total = lw
        for i, b in enumerate(bullets):
            op = b.get("opening", "")
            n = len(op.split())
            if not (1 <= n <= 6):
                warn(f"bullet {i} opening has {n} words")
            if op.endswith((":", ".")):
                err(f"bullet {i} opening should not end with punctuation")
            lid = b.get("linkId")
            if lid is not None:
                if lid not in by_id:
                    err(f"bullet {i} linkId {lid!r} not in manifest")
                elif lid == tid:
                    err(f"bullet {i} links to itself")
                else:
                    links += 1
            tw = words(b.get("text", ""))
            total += tw
            if not (12 <= tw <= 70):
                warn(f"bullet {i} text {tw} words")
        if links < 2:
            err(f"only {links} in-corpus links (need >= 2)")
        if not (200 <= total <= 340):
            warn(f"body {total} words (target 220-320)")
        tags = t["tags"]
        if not (3 <= len(tags) <= 5) or any(not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", x) for x in tags):
            err(f"tags invalid: {tags}")
        rel = t["related"]
        if not (4 <= len(rel) <= 6):
            err(f"{len(rel)} related (need 4-6)")
        for r in rel:
            if r not in by_id:
                err(f"related {r!r} not in manifest")
            if r == tid:
                err("related includes itself")
        blob = " ".join([hook, t["peek"], t["lede"]] + [b.get("opening", "") + " " + b.get("text", "") for b in bullets]).lower()
        for w in BANNED_WORDS:
            if re.search(r"\b" + re.escape(w) + r"\b", blob):
                warn(f"contains flagged word {w!r}")
        if "—" in blob:
            warn("contains an em dash")
        if "!" in blob:
            warn("contains an exclamation mark")
    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    print(f"checked {len(ids)} topics: {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
