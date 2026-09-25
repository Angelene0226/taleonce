#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
ROOT = HERE.parent.parent
PUBLIC = ROOT / "public"
STORIES = PUBLIC / "stories"
INDEX = STORIES / "index.json"

def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 tools/add_story.py /path/to/story.json")

    source = Path(sys.argv[1]).expanduser().resolve()
    if not source.exists():
        raise SystemExit(f"File not found: {source}")

    story = json.loads(source.read_text(encoding="utf-8"))
    required = ["slug", "category", "title", "excerpt", "cover", "tags", "sections"]
    missing = [key for key in required if key not in story]
    if missing:
        raise SystemExit("Missing fields: " + ", ".join(missing))
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", story["slug"]):
        raise SystemExit("Slug must use lowercase letters, digits, and hyphens")

    allowed_categories = {"Romance", "Werewolf", "Vampire", "Contemporary", "Fantasy"}
    if story["category"] not in allowed_categories:
        raise SystemExit(
            f"Unsupported category: {story['category']}. "
            f"Use one of: {', '.join(sorted(allowed_categories))}"
        )

    if not isinstance(story["sections"], list) or not all(
        isinstance(section, dict)
        and isinstance(section.get("title"), str)
        and isinstance(section.get("paragraphs"), list)
        and all(isinstance(paragraph, str) for paragraph in section["paragraphs"])
        for section in story["sections"]
    ):
        raise SystemExit("Sections must have titles and paragraph lists")
    actual_words = len(" ".join(
        paragraph for section in story["sections"]
        for paragraph in section["paragraphs"]
    ).split())
    if not actual_words:
        raise SystemExit("Story must contain prose paragraphs")
    story["wordCount"] = actual_words

    filename = f"{story['slug']}.json"
    destination = STORIES / filename
    STORIES.mkdir(parents=True, exist_ok=True)

    destination.write_text(
        json.dumps(story, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    entries = []
    if INDEX.exists():
        entries = json.loads(INDEX.read_text(encoding="utf-8"))

    fields = ("slug", "category", "title", "excerpt", "cover", "tags", "wordCount")
    metadata = {field: story[field] for field in fields}
    entries = [entry for entry in entries if entry["slug"] != story["slug"]]
    entries.append(metadata)

    INDEX.write_text(
        json.dumps(entries, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Added: {destination.relative_to(ROOT)}")
    print(f"Updated: {INDEX.relative_to(ROOT)}")
    print()
    print("Next:")
    print("  git add .")
    print(f'  git commit -m "Add story: {story["title"]}"')
    print("  git push")

if __name__ == "__main__":
    main()
