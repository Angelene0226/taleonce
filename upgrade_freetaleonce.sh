#!/usr/bin/env bash
set -euo pipefail

echo "=== FreeTaleOnce upgrade ==="

# Detect current repo layout.
if [ -d "taleonce/public" ]; then
  ROOT="taleonce"
elif [ -d "public" ]; then
  ROOT="."
else
  echo "Error: cannot find public/ or taleonce/public/."
  echo "Run this script from the root of the cloned GitHub repository."
  exit 1
fi

PUBLIC="$ROOT/public"
DATA_JS="$PUBLIC/data/stories.js"
STORIES_DIR="$PUBLIC/stories"
ADMIN_DIR="$PUBLIC/admin"
TOOLS_DIR="$ROOT/tools"

mkdir -p "$STORIES_DIR" "$ADMIN_DIR" "$TOOLS_DIR"

echo "[1/6] Converting existing stories.js into individual JSON files..."

if [ -f "$DATA_JS" ]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is required once to convert the existing stories.js."
    echo "Install Node.js, then run this script again."
    exit 1
  fi

  ROOT_ABS="$(cd "$ROOT" && pwd)"
  ROOT_ABS="$ROOT_ABS" node <<'NODE'
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = process.env.ROOT_ABS;
const src = path.join(root, "public", "data", "stories.js");
const out = path.join(root, "public", "stories");

fs.mkdirSync(out, { recursive: true });

const code = fs.readFileSync(src, "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const stories = sandbox.window.TALEONCE_STORIES || [];
if (!stories.length) {
  throw new Error("No stories found in stories.js");
}

const files = [];
for (const story of stories) {
  const file = `${story.slug}.json`;
  files.push(file);
  fs.writeFileSync(
    path.join(out, file),
    JSON.stringify(story, null, 2) + "\n",
    "utf8"
  );
}

fs.writeFileSync(
  path.join(out, "index.json"),
  JSON.stringify(files, null, 2) + "\n",
  "utf8"
);

console.log(`Converted ${stories.length} stories.`);
NODE
else
  echo "stories.js already missing; keeping existing JSON stories."
fi

echo "[2/6] Rewriting frontend to load /stories/*.json ..."

cat > "$PUBLIC/app.js" <<'EOF'
(() => {
  const categories = ["Romance", "Werewolf", "Vampire", "Urban", "Fantasy"];
  let stories = [];

  const slugify = (value) =>
    String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const storyHref = (story) =>
    `/story.html?story=${encodeURIComponent(story.slug)}`;

  const escapeHTML = (value = "") =>
    String(value).replace(/[&<>'"]/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[ch]));

  async function loadStories() {
    const indexResponse = await fetch("/stories/index.json", { cache: "no-cache" });
    if (!indexResponse.ok) throw new Error("Could not load story index.");

    const files = await indexResponse.json();
    stories = await Promise.all(
      files.map(async (file) => {
        const response = await fetch(`/stories/${encodeURIComponent(file)}`, { cache: "no-cache" });
        if (!response.ok) throw new Error(`Could not load ${file}`);
        return response.json();
      })
    );
  }

  function initHome() {
    const library = document.querySelector("#library");
    if (!library) return;

    categories.forEach((category) => {
      const items = stories.filter((story) => story.category === category);
      if (!items.length) return;

      const section = document.createElement("section");
      section.className = "category-section";
      section.id = slugify(category);
      section.innerHTML = `
        <div class="category-heading"><h2>${escapeHTML(category)}</h2></div>
        <div class="story-grid">
          ${items.map((story) => `
            <article class="story-card">
              <a class="cover-link" href="${storyHref(story)}" aria-label="Read ${escapeHTML(story.title)}">
                <img class="story-cover" src="${escapeHTML(story.cover)}" alt="Cover of ${escapeHTML(story.title)}" loading="lazy" />
              </a>
              <h3><a href="${storyHref(story)}">${escapeHTML(story.title)}</a></h3>
              <p>${escapeHTML(story.excerpt)}</p>
            </article>
          `).join("")}
        </div>`;
      library.appendChild(section);
    });

    const year = document.querySelector("#year");
    if (year) year.textContent = new Date().getFullYear();
  }

  function currentStory() {
    const params = new URLSearchParams(location.search);
    const slug = params.get("story") || stories[0]?.slug;
    return stories.find((item) => item.slug === slug);
  }

  function initReader() {
    const article = document.querySelector("#storyArticle");
    if (!article) return;

    const story = currentStory();
    if (!story) {
      article.innerHTML = `<p>Story not found. <a href="/">Return home</a>.</p>`;
      return;
    }

    document.title = `${story.title} — FreeTaleOnce`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = story.excerpt;

    const wordCount = Number(story.wordCount) || countStoryWords(story);
    const readMinutes = Math.max(1, Math.round(wordCount / 230));

    article.innerHTML = `
      <header class="story-head">
        <h1>${escapeHTML(story.title)}</h1>
        <div class="story-tags">
          ${(story.tags || []).map((tag) => `<span class="story-tag">${escapeHTML(tag)}</span>`).join("")}
        </div>
        <div class="story-meta">${wordCount.toLocaleString()} words · ${readMinutes} min read</div>
      </header>
      <div class="story-body">
        ${(story.sections || []).map((section, index) => `
          ${index ? '<hr class="story-divider" />' : ""}
          <section id="section-${index + 1}">
            <h2>${escapeHTML(section.title)}</h2>
            ${(section.paragraphs || []).map((p) => `<p>${escapeHTML(p)}</p>`).join("")}
          </section>
        `).join("")}
      </div>`;

    const toc = document.querySelector("#toc");
    if (toc) {
      toc.innerHTML = (story.sections || []).map(
        (section, index) => `<a href="#section-${index + 1}">${escapeHTML(section.title)}</a>`
      ).join("");
    }

    const categoryBack = document.querySelector("#backCategory");
    if (categoryBack) {
      categoryBack.textContent = `← Back to ${story.category}`;
      categoryBack.href = `/#${slugify(story.category)}`;
    }

    initDrawer();
    initReaderPrefs();
    initRating(story.slug);
    initComments(story.slug);
  }

  function countStoryWords(story) {
    return (story.sections || [])
      .flatMap((section) => section.paragraphs || [])
      .join(" ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  function initDrawer() {
    const drawer = document.querySelector("#drawer");
    const backdrop = document.querySelector("#drawerBackdrop");
    const menu = document.querySelector("#menuButton");
    const close = document.querySelector("#drawerClose");
    if (!drawer || !backdrop || !menu || !close) return;

    const setOpen = (open) => {
      drawer.classList.toggle("open", open);
      drawer.setAttribute("aria-hidden", String(!open));
      menu.setAttribute("aria-expanded", String(open));
      backdrop.hidden = !open;
      document.body.style.overflow = open ? "hidden" : "";
    };

    menu.addEventListener("click", () => setOpen(true));
    close.addEventListener("click", () => setOpen(false));
    backdrop.addEventListener("click", () => setOpen(false));
    drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  }

  function initReaderPrefs() {
    const body = document.body;
    const themeButton = document.querySelector("#themeButton");
    const fontButton = document.querySelector("#fontButton");
    const savedTheme = localStorage.getItem("freetaleonce-theme");

    if (savedTheme === "dark") body.classList.add("dark");

    if (themeButton) {
      themeButton.textContent = body.classList.contains("dark") ? "☀" : "☾";
      themeButton.addEventListener("click", () => {
        body.classList.toggle("dark");
        const dark = body.classList.contains("dark");
        localStorage.setItem("freetaleonce-theme", dark ? "dark" : "light");
        themeButton.textContent = dark ? "☀" : "☾";
      });
    }

    const sizes = [18, 20, 22, 24];
    let size = Number(localStorage.getItem("freetaleonce-font-size")) || 20;
    document.documentElement.style.setProperty("--story-font-size", `${size}px`);

    if (fontButton) {
      fontButton.addEventListener("click", () => {
        const index = sizes.indexOf(size);
        size = sizes[(index + 1) % sizes.length];
        localStorage.setItem("freetaleonce-font-size", String(size));
        document.documentElement.style.setProperty("--story-font-size", `${size}px`);
      });
    }
  }

  function getVisitorId() {
    let id = localStorage.getItem("freetaleonce-visitor-id");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).slice(0, 64);
      localStorage.setItem("freetaleonce-visitor-id", id);
    }
    return id;
  }

  async function initRating(storySlug) {
    const stars = document.querySelector("#stars");
    const summary = document.querySelector("#ratingSummary");
    const message = document.querySelector("#ratingMessage");
    if (!stars) return;

    let selected = 0;
    const render = () => {
      stars.querySelectorAll("button").forEach((button, index) => {
        button.classList.toggle("active", index < selected);
      });
    };

    for (let i = 1; i <= 5; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "star";
      button.textContent = "★";
      button.setAttribute("aria-label", `${i} star${i > 1 ? "s" : ""}`);

      button.addEventListener("mouseenter", () => {
        selected = i;
        render();
      });

      button.addEventListener("click", async () => {
        selected = i;
        render();
        if (message) message.textContent = "Saving…";

        try {
          const response = await fetch("/api/rating", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              story: storySlug,
              rating: i,
              visitorId: getVisitorId()
            })
          });

          if (!response.ok) throw new Error("Rating service unavailable");
          const data = await response.json();

          if (summary) {
            summary.textContent = data.count
              ? `${Number(data.average).toFixed(1)} · ${data.count} rating${data.count === 1 ? "" : "s"}`
              : "No ratings yet";
          }
          if (message) message.textContent = "Thanks for rating!";
        } catch {
          if (message) {
            message.textContent = "Ratings will be available after the Cloudflare database is connected.";
          }
        }
      });

      stars.appendChild(button);
    }

    stars.addEventListener("mouseleave", render);

    try {
      const response = await fetch(`/api/rating?story=${encodeURIComponent(storySlug)}`);
      if (response.ok) {
        const data = await response.json();
        if (summary) {
          summary.textContent = data.count
            ? `${Number(data.average).toFixed(1)} · ${data.count} rating${data.count === 1 ? "" : "s"}`
            : "No ratings yet";
        }
      }
    } catch {}
  }

  async function initComments(storySlug) {
    const list = document.querySelector("#commentsList");
    const form = document.querySelector("#commentForm");
    const name = document.querySelector("#commentName");
    const text = document.querySelector("#commentText");
    const honeypot = document.querySelector("#websiteField");
    const message = document.querySelector("#commentMessage");
    if (!list || !form) return;

    const renderComments = (comments) => {
      list.innerHTML = "";

      if (!comments.length) {
        const empty = document.createElement("div");
        empty.className = "empty-comments";
        empty.textContent = "No comments yet. Be the first to leave one.";
        list.appendChild(empty);
        return;
      }

      comments.forEach((item) => {
        const node = document.createElement("div");
        node.className = "comment";

        const head = document.createElement("div");
        head.className = "comment-head";

        const person = document.createElement("div");
        person.className = "comment-name";
        person.textContent = item.name;

        const time = document.createElement("time");
        time.className = "comment-time";
        time.textContent = new Date(item.created_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric"
        });

        const body = document.createElement("div");
        body.className = "comment-body";
        body.textContent = item.comment;

        head.append(person, time);
        node.append(head, body);
        list.appendChild(node);
      });
    };

    async function load() {
      try {
        const response = await fetch(`/api/comments?story=${encodeURIComponent(storySlug)}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        renderComments(data.comments || []);
      } catch {
        renderComments([]);
      }
    }

    await load();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (honeypot?.value) return;
      if (message) message.textContent = "Posting…";

      try {
        const response = await fetch("/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            story: storySlug,
            name: name.value.trim(),
            comment: text.value.trim()
          })
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Could not post comment");
        }

        text.value = "";
        if (message) message.textContent = "Comment posted.";
        await load();
      } catch (error) {
        if (message) {
          message.textContent =
            error.message || "Comments will be available after the Cloudflare database is connected.";
        }
      }
    });
  }

  async function boot() {
    try {
      await loadStories();
      initHome();
      initReader();
    } catch (error) {
      console.error(error);
      const library = document.querySelector("#library");
      if (library) library.innerHTML = "<p>Stories could not be loaded.</p>";
      const article = document.querySelector("#storyArticle");
      if (article) article.innerHTML = "<p>Story could not be loaded.</p>";
    }
  }

  boot();
})();
EOF

echo "[3/6] Renaming visible brand to FreeTaleOnce ..."

python3 - "$PUBLIC/index.html" "$PUBLIC/story.html" "$PUBLIC/app.js" <<'PY'
from pathlib import Path
import sys

for name in sys.argv[1:]:
    p = Path(name)
    text = p.read_text(encoding="utf-8")
    text = text.replace("TaleOnce", "FreeTaleOnce")
    p.write_text(text, encoding="utf-8")
PY

# Remove old data script includes, because app.js now loads JSON directly.
python3 - "$PUBLIC/index.html" "$PUBLIC/story.html" <<'PY'
from pathlib import Path
import sys, re

for name in sys.argv[1:]:
    p = Path(name)
    text = p.read_text(encoding="utf-8")
    text = re.sub(r'\s*<script src="/data/stories\.js"></script>', '', text)
    p.write_text(text, encoding="utf-8")
PY

# Rename visible branding inside sample SVG covers.
find "$PUBLIC/assets/covers" -type f -name '*.svg' -print0 2>/dev/null | \
  xargs -0 sed -i.bak 's/TALEONCE/FREETALEONCE/g' 2>/dev/null || true
find "$PUBLIC/assets/covers" -type f -name '*.bak' -delete 2>/dev/null || true

echo "[4/6] Creating /admin story editor ..."

cat > "$ADMIN_DIR/index.html" <<'EOF'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Story Editor — FreeTaleOnce</title>
  <link rel="stylesheet" href="/admin/admin.css" />
</head>
<body>
  <main class="admin-shell">
    <header>
      <a href="/" class="brand">FreeTaleOnce</a>
      <h1>Story Editor</h1>
      <p>Create a story JSON file without editing code by hand.</p>
    </header>

    <form id="storyForm">
      <div class="grid">
        <label>
          <span>Title</span>
          <input id="title" required placeholder="The Contract Wife" />
        </label>

        <label>
          <span>Category</span>
          <select id="category">
            <option>Romance</option>
            <option>Werewolf</option>
            <option>Vampire</option>
            <option>Urban</option>
            <option>Fantasy</option>
          </select>
        </label>
      </div>

      <label>
        <span>Excerpt</span>
        <textarea id="excerpt" rows="3" required placeholder="A short homepage description..."></textarea>
      </label>

      <div class="grid">
        <label>
          <span>Tags</span>
          <input id="tags" placeholder="Romance, Slow Burn, Contract Marriage" />
        </label>

        <label>
          <span>Cover path</span>
          <input id="cover" value="/assets/covers/" required />
        </label>
      </div>

      <section class="sections">
        <div class="section-heading">
          <h2>Story sections</h2>
          <button id="addSection" type="button" class="secondary">+ Add section</button>
        </div>
        <div id="sections"></div>
      </section>

      <div class="actions">
        <button type="submit">Create story JSON</button>
        <span id="status"></span>
      </div>
    </form>

    <aside class="help">
      <strong>After downloading:</strong>
      <code>python3 taleonce/tools/add_story.py ~/Downloads/your-story.json</code>
      <span>If your repo no longer has the outer taleonce/ folder, use <code>python3 tools/add_story.py ...</code>.</span>
    </aside>
  </main>

  <template id="sectionTemplate">
    <div class="story-section">
      <div class="section-top">
        <input class="section-title" required placeholder="Section title" />
        <button type="button" class="remove secondary">Remove</button>
      </div>
      <textarea class="section-body" rows="8" required placeholder="Paste the section here.

Separate paragraphs with a blank line."></textarea>
    </div>
  </template>

  <script src="/admin/admin.js"></script>
</body>
</html>
EOF

cat > "$ADMIN_DIR/admin.css" <<'EOF'
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #1b1b1b;
  background: #f7f6f2;
}
* { box-sizing: border-box; }
body { margin: 0; }
.admin-shell {
  width: min(920px, calc(100% - 32px));
  margin: 48px auto 96px;
}
.brand {
  color: inherit;
  text-decoration: none;
  font-weight: 750;
  letter-spacing: -.02em;
}
h1 { font-size: clamp(32px, 5vw, 52px); margin: 18px 0 8px; }
header p { color: #666; margin-bottom: 36px; }
form, .help {
  background: #fff;
  border: 1px solid #e2e0da;
  border-radius: 18px;
  padding: 24px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
label { display: block; margin-bottom: 18px; }
label span { display: block; font-size: 14px; font-weight: 650; margin-bottom: 7px; }
input, textarea, select {
  width: 100%;
  border: 1px solid #ccc9c0;
  border-radius: 10px;
  padding: 12px 13px;
  font: inherit;
  background: #fff;
}
textarea { resize: vertical; line-height: 1.55; }
.sections { margin-top: 12px; }
.section-heading, .section-top, .actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.story-section {
  padding: 18px;
  margin: 14px 0;
  border: 1px solid #e2e0da;
  border-radius: 14px;
  background: #faf9f6;
}
.section-title { margin-bottom: 12px; }
button {
  appearance: none;
  border: 0;
  border-radius: 10px;
  padding: 11px 16px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  background: #171717;
  color: white;
}
button.secondary {
  background: #eeeae1;
  color: #292929;
}
.actions { justify-content: flex-start; margin-top: 24px; }
#status { color: #666; font-size: 14px; }
.help {
  margin-top: 18px;
  display: grid;
  gap: 10px;
  color: #555;
}
code {
  background: #efede7;
  padding: 3px 6px;
  border-radius: 6px;
  overflow-wrap: anywhere;
}
@media (max-width: 680px) {
  .grid { grid-template-columns: 1fr; gap: 0; }
  .section-top { align-items: stretch; flex-direction: column; }
}
EOF

cat > "$ADMIN_DIR/admin.js" <<'EOF'
(() => {
  const form = document.querySelector("#storyForm");
  const sections = document.querySelector("#sections");
  const template = document.querySelector("#sectionTemplate");
  const addSectionButton = document.querySelector("#addSection");
  const status = document.querySelector("#status");

  const slugify = (value) =>
    value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  function addSection(title = "", body = "") {
    const fragment = template.content.cloneNode(true);
    const node = fragment.querySelector(".story-section");
    fragment.querySelector(".section-title").value = title;
    fragment.querySelector(".section-body").value = body;
    fragment.querySelector(".remove").addEventListener("click", () => node.remove());
    sections.appendChild(fragment);
  }

  function splitParagraphs(value) {
    return value
      .trim()
      .split(/\n\s*\n/)
      .map((item) => item.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);
  }

  function countWords(storySections) {
    return storySections
      .flatMap((section) => section.paragraphs)
      .join(" ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  addSectionButton.addEventListener("click", () => addSection());
  addSection("Part One", "");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = document.querySelector("#title").value.trim();
    const slug = slugify(title);

    const storySections = [...document.querySelectorAll(".story-section")].map((node) => ({
      title: node.querySelector(".section-title").value.trim(),
      paragraphs: splitParagraphs(node.querySelector(".section-body").value)
    })).filter((section) => section.title && section.paragraphs.length);

    if (!slug || !storySections.length) {
      status.textContent = "Add a title and at least one section.";
      return;
    }

    const story = {
      slug,
      category: document.querySelector("#category").value,
      title,
      excerpt: document.querySelector("#excerpt").value.trim(),
      cover: document.querySelector("#cover").value.trim(),
      tags: document.querySelector("#tags").value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      wordCount: countWords(storySections),
      sections: storySections
    };

    const blob = new Blob([JSON.stringify(story, null, 2) + "\n"], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    status.textContent = `Downloaded ${slug}.json`;
  });
})();
EOF

echo "[5/6] Creating local add_story.py helper ..."

cat > "$TOOLS_DIR/add_story.py" <<'EOF'
#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
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

    allowed_categories = {"Romance", "Werewolf", "Vampire", "Urban", "Fantasy"}
    if story["category"] not in allowed_categories:
        raise SystemExit(
            f"Unsupported category: {story['category']}. "
            f"Use one of: {', '.join(sorted(allowed_categories))}"
        )

    filename = f"{story['slug']}.json"
    destination = STORIES / filename
    STORIES.mkdir(parents=True, exist_ok=True)

    destination.write_text(
        json.dumps(story, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    files = []
    if INDEX.exists():
        files = json.loads(INDEX.read_text(encoding="utf-8"))

    if filename not in files:
        files.append(filename)

    INDEX.write_text(
        json.dumps(files, indent=2, ensure_ascii=False) + "\n",
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
EOF

chmod +x "$TOOLS_DIR/add_story.py"

echo "[6/6] Removing legacy stories.js and updating README note ..."

rm -f "$DATA_JS"

cat >> "$ROOT/README.md" <<'EOF'

## Story management

Stories now live as individual JSON files:

```text
public/stories/
├── index.json
├── the-contract-wife.json
├── ...
```

Open `/admin/` to create a story JSON file in the browser.

After downloading the JSON file:

```bash
python3 tools/add_story.py ~/Downloads/your-story.json
git add .
git commit -m "Add story"
git push
```

Cloudflare Pages will redeploy automatically after the push.
EOF

echo
echo "Done."
echo
echo "Changed:"
echo "  - TaleOnce -> FreeTaleOnce"
echo "  - stories.js -> public/stories/*.json"
echo "  - added /admin/"
echo "  - added tools/add_story.py"
echo
echo "Review changes with:"
echo "  git status"
echo "  git diff --stat"
echo
echo "Then publish with:"
echo '  git add .'
echo '  git commit -m "Rename to FreeTaleOnce and add story admin"'
echo '  git push'
