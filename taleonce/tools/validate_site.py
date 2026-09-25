#!/usr/bin/env python3
"""Check the public story catalog before deploying."""
from __future__ import annotations

import json
from pathlib import Path
from struct import unpack

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
STORIES = PUBLIC / "stories"
CATEGORIES = {"Romance", "Werewolf", "Vampire", "Contemporary", "Fantasy"}
FIELDS = ("slug", "category", "title", "excerpt", "cover", "tags", "wordCount")


def main() -> None:
    entries = json.loads((STORIES / "index.json").read_text(encoding="utf-8"))
    assert isinstance(entries, list), "Story index must be a list"
    seen = set()
    categories = set()
    for entry in entries:
        slug = entry["slug"]
        assert slug not in seen, f"Duplicate slug: {slug}"
        seen.add(slug)
        story = json.loads((STORIES / f"{slug}.json").read_text(encoding="utf-8"))
        assert all(entry[field] == story[field] for field in FIELDS), f"Stale index entry: {slug}"
        assert story["category"] in CATEGORIES, f"Unknown category: {slug}"
        assert not story.get("sample"), f"Sample remains in catalog: {slug}"
        cover = PUBLIC / story["cover"].lstrip("/")
        assert cover.is_file(), f"Missing cover: {slug}"
        with cover.open("rb") as image:
            header = image.read(24)
        assert header[:8] == b"\x89PNG\r\n\x1a\n", f"Invalid PNG cover: {slug}"
        width, height = unpack(">II", header[16:24])
        assert height > width, f"Cover is not portrait: {slug}"
        sections = story.get("sections")
        assert isinstance(sections, list) and sections, f"Missing sections: {slug}"
        assert all(s.get("title") and s.get("paragraphs") for s in sections), f"Empty section: {slug}"
        count = len(" ".join(p for s in sections for p in s["paragraphs"]).split())
        assert count == story["wordCount"], f"Incorrect word count: {slug}"
        categories.add(story["category"])
    assert categories == CATEGORIES, f"Missing categories: {sorted(CATEGORIES - categories)}"
    extra_files = {path.stem for path in STORIES.glob("*.json")} - seen - {"index"}
    assert not extra_files, f"Unlisted story files: {sorted(extra_files)}"
    print(f"Validated {len(entries)} complete stories across {len(categories)} categories.")


if __name__ == "__main__":
    main()
