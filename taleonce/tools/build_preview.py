#!/usr/bin/env python3
"""Build local, content-light HTML previews from the public catalog."""
from __future__ import annotations

import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
PREVIEW = ROOT / "preview"
CATEGORIES = [
    ("Romance", "Love and relationships drive the central conflict."),
    ("Werewolf", "Shifters, packs, and bonds shape the story."),
    ("Vampire", "Immortality, hunger, and night-bound worlds."),
    ("Contemporary", "Present-day life without a supernatural premise."),
    ("Fantasy", "Magic and invented worlds beyond shifter or vampire fiction."),
]


def e(value: object) -> str:
    return html.escape(str(value), quote=True)


def shell(title: str, body_class: str, body: str) -> str:
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>{e(title)} — Design Preview</title><link rel="stylesheet" href="../public/styles.css"/><link rel="stylesheet" href="preview.css"/></head><body class="{body_class}"><div class="preview-banner"><strong>Local design preview</strong><span>Only a few opening paragraphs are shown. Resize the window to check mobile layout.</span><a href="index.html">Home preview</a></div>{body}</body></html>'''


def home(entries: list[dict]) -> str:
    nav = "".join(f'<a href="#{e(name.lower())}">{e(name)}</a>' for name, _ in CATEGORIES)
    sections = []
    for number, (category, description) in enumerate(CATEGORIES, 1):
        cards = []
        for story in entries:
            if story["category"] != category:
                continue
            link = f'story-{story["slug"]}.html'
            cover = f'../public{story["cover"]}'
            cards.append(f'''<article class="story-card"><a class="cover-link" href="{e(link)}" aria-label="Read {e(story['title'])}"><img class="story-cover" src="{e(cover)}" alt="Cover of {e(story['title'])}"/><span class="cover-imprint">FreeTaleOnce Original</span><span class="cover-title">{e(story['title'])}</span></a><div class="story-card-copy"><div class="card-kicker">{e(category)} <span aria-hidden="true">/</span> Complete story</div><h3><a href="{e(link)}">{e(story['title'])}</a></h3><p>{e(story['excerpt'])}</p><div class="card-meta">{story['wordCount']:,} words <span aria-hidden="true">·</span> {(story['wordCount'] + 229)//230} min read</div><a class="card-read" href="{e(link)}">Read the story <span aria-hidden="true">→</span></a></div></article>''')
        sections.append(f'''<section class="category-section" id="{e(category.lower())}"><div class="category-heading"><span class="category-number">0{number}</span><h2>{e(category)}</h2></div><p class="category-description">{e(description)}</p><div class="story-grid">{''.join(cards)}</div></section>''')
    body = f'''<header class="home-header"><a class="brand" href="index.html">FreeTaleOnce</a><nav class="home-nav" aria-label="Story categories">{nav}</nav></header><main><section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><p class="eyebrow">FreeTaleOnce <span aria-hidden="true">/</span> Original fiction</p><h1 id="hero-title">Stories that<br/><em>stay with you.</em></h1><div class="hero-bottom"><p>Five complete stories. Five different worlds. Find the one that stays on your mind after the final page.</p><a class="hero-link" href="#library">Explore the collection <span aria-hidden="true">↘</span></a></div></div><div class="hero-side" aria-label="Collection details"><div class="hero-side-top"><span>The Collection</span><span>No. 01 / 05</span></div><div class="hero-monogram" aria-hidden="true">T<span>O</span></div><div class="hero-side-bottom"><span>Read freely</span><span>Remember longer</span></div></div></section><div id="library" class="library">{''.join(sections)}</div></main><footer class="site-footer">© FreeTaleOnce</footer>'''
    return shell("FreeTaleOnce Home", "home-page", body)


def reader(story: dict) -> str:
    sections = story["sections"]
    tags = "".join(f'<span class="story-tag">{e(tag)}</span>' for tag in story["tags"])
    toc = "".join(f'<a href="#section-{i}">{e(section["title"])}</a>' for i, section in enumerate(sections, 1))
    browse = "".join(f'<a href="index.html#{e(category.lower())}">{e(category)}</a>' for category, _ in CATEGORIES)
    first = sections[0]
    paragraphs = "".join(f'<p>{e(p)}</p>' for p in first["paragraphs"][:5])
    cover = f'../public{story["cover"]}'
    body = f'''<div id="drawerBackdrop" class="drawer-backdrop" hidden></div><aside id="drawer" class="drawer" aria-hidden="true"><div class="drawer-head"><a class="brand brand-small" href="index.html">FreeTaleOnce</a><button id="drawerClose" class="icon-button" aria-label="Close menu">×</button></div><div class="drawer-block"><div class="drawer-title">Contents</div><nav class="toc">{toc}</nav></div><div class="drawer-block"><div class="drawer-title">Browse</div><nav class="browse-links">{browse}</nav></div></aside><header class="reader-toolbar"><button id="menuButton" class="icon-button menu-button" aria-label="Open contents" aria-expanded="false">☰</button><a class="brand brand-small" href="index.html">FreeTaleOnce</a><div class="reader-actions"><button id="fontButton" class="text-button" aria-label="Change font size">Aa</button><button id="themeButton" class="icon-button" aria-label="Toggle dark mode">☾</button></div></header><main class="reader-shell"><article class="story-article"><header class="story-head"><img class="story-head-cover" src="{e(cover)}" alt="Cover of {e(story['title'])}"/><div class="story-head-copy"><div class="story-head-kicker">{e(story['category'])} <span aria-hidden="true">/</span> FreeTaleOnce Original</div><h1>{e(story['title'])}</h1><p class="story-deck">{e(story['excerpt'])}</p><div class="story-tags">{tags}</div><div class="story-meta">{story['wordCount']:,} words · {(story['wordCount'] + 229)//230} min read</div></div></header><div class="story-body"><section id="section-1"><h2>{e(first['title'])}</h2>{paragraphs}</section><p class="preview-omission">The rest of the story is omitted from this design preview.</p></div></article><section class="engagement" aria-label="Story rating and comments"><div class="rating-panel"><h2>How would you rate this story?</h2><div class="stars" aria-hidden="true">★★★★★</div><div class="rating-summary">No ratings yet</div></div><div class="comments-panel"><h2>Comments</h2><div class="empty-comments">No comments yet. Be the first to leave one.</div><div class="preview-comment-box">Name<br/><span>Write a comment...</span></div></div><a class="category-back" href="index.html#{e(story['category'].lower())}">← Back to {e(story['category'])}</a></section></main><script src="preview.js"></script>'''
    return shell(story["title"], "reader-page", body)


def main() -> None:
    PREVIEW.mkdir(exist_ok=True)
    entries = json.loads((PUBLIC / "stories/index.json").read_text(encoding="utf-8"))
    (PREVIEW / "index.html").write_text(home(entries), encoding="utf-8")
    for entry in entries:
        story = json.loads((PUBLIC / "stories" / f"{entry['slug']}.json").read_text(encoding="utf-8"))
        (PREVIEW / f"story-{entry['slug']}.html").write_text(reader(story), encoding="utf-8")
    print(f"Built local preview for {len(entries)} stories in {PREVIEW}")


if __name__ == "__main__":
    main()
