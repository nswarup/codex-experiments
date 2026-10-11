#!/usr/bin/env python3
"""Regenerate docs/TOPICS.md from the corpus.

Usage: python3 scripts/topics_md.py
Lists every topic by category, in the order the interest picker shows them.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "web" / "src" / "content"


def categories():
    src = (ROOT / "web" / "src" / "lib" / "types.ts").read_text()
    body = re.search(r"CATEGORIES\s*=\s*\[(.*?)\]", src, re.S).group(1)
    return re.findall(r'"([^"]+)"', body)


def main():
    manifest = json.loads((CONTENT / "manifest.json").read_text())
    cats = categories()
    by_cat = {c: [] for c in cats}
    for m in manifest:
        t = json.loads((CONTENT / "topics" / f"{m['id']}.json").read_text())
        by_cat[t["category"]].append(t)
    lines = [
        "# Birdie topic library",
        "",
        f"{len(manifest)} topics in {len(cats)} categories, written to `docs/CONTENT_GUIDE.md` and fact-checked in a second pass. "
        "Categories are listed in the order the interest picker shows them. Each line is the title and the hook shown under it in the app.",
        "",
        "Regenerate with `python3 scripts/topics_md.py`.",
    ]
    for c in cats:
        lines += ["", f"## {c} ({len(by_cat[c])})", ""]
        lines += [f"- **{t['title']}**: {t['hook']}" for t in by_cat[c]]
    (ROOT / "docs" / "TOPICS.md").write_text("\n".join(lines) + "\n")
    print(f"wrote docs/TOPICS.md: {len(manifest)} topics")


if __name__ == "__main__":
    main()
