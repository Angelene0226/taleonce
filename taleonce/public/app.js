(() => {
  const categories = [
    { name: "Romance", description: "Love and relationships drive the central conflict." },
    { name: "Werewolf", description: "Shifters, packs, and bonds shape the story." },
    { name: "Vampire", description: "Immortality, hunger, and night-bound worlds." },
    { name: "Contemporary", description: "Present-day life without a supernatural premise." },
    { name: "Fantasy", description: "Magic and invented worlds beyond shifter or vampire fiction." }
  ];
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

    stories = await indexResponse.json();
    if (!Array.isArray(stories)) throw new Error("Invalid story index.");
  }

  function initHome() {
    const library = document.querySelector("#library");
    if (!library) return;
    library.replaceChildren();

    categories.forEach(({ name: category, description }, categoryIndex) => {
      const items = stories.filter((story) => story.category === category);
      if (!items.length) return;

      const section = document.createElement("section");
      section.className = "category-section";
      section.id = slugify(category);
      section.innerHTML = `
        <div class="category-heading"><span class="category-number">0${categoryIndex + 1}</span><h2>${escapeHTML(category)}</h2></div>
        <p class="category-description">${escapeHTML(description)}</p>
        <div class="story-grid">
          ${items.map((story) => `
            <article class="story-card">
              <a class="cover-link" href="${storyHref(story)}" aria-label="Read ${escapeHTML(story.title)}">
                <img class="story-cover" src="${escapeHTML(story.cover)}" alt="Cover of ${escapeHTML(story.title)}" loading="lazy" />
                <span class="cover-imprint">FreeTaleOnce Original</span>
                <span class="cover-title">${escapeHTML(story.title)}</span>
              </a>
              <div class="story-card-copy">
                <div class="card-kicker">${escapeHTML(category)} <span aria-hidden="true">/</span> Complete story</div>
                <h3><a href="${storyHref(story)}">${escapeHTML(story.title)}</a></h3>
                <p>${escapeHTML(story.excerpt)}</p>
                <div class="card-meta">${Number(story.wordCount).toLocaleString()} words <span aria-hidden="true">·</span> ${Math.ceil(story.wordCount / 230)} min read</div>
                <a class="card-read" href="${storyHref(story)}">Read the story <span aria-hidden="true">→</span></a>
              </div>
            </article>
          `).join("")}
        </div>`;
      library.appendChild(section);
    });

    const year = document.querySelector("#year");
    if (year) year.textContent = new Date().getFullYear();
  }

  async function currentStory() {
    const params = new URLSearchParams(location.search);
    const slug = params.get("story");
    if (!slug || !stories.some((item) => item.slug === slug)) return null;
    const response = await fetch(`/stories/${encodeURIComponent(slug)}.json`);
    if (!response.ok) throw new Error("Could not load story.");
    return response.json();
  }

  async function initReader() {
    const article = document.querySelector("#storyArticle");
    if (!article) return;

    const story = await currentStory();
    if (!story) {
      article.innerHTML = `<p>Story not found. <a href="/">Return home</a>.</p>`;
      return;
    }

    document.title = `${story.title} — FreeTaleOnce`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = story.excerpt;

    const wordCount = countStoryWords(story);
    const readMinutes = Math.max(1, Math.ceil(wordCount / 230));

    article.innerHTML = `
      <header class="story-head">
        <img class="story-head-cover" src="${escapeHTML(story.cover)}" alt="Cover of ${escapeHTML(story.title)}" />
        <div class="story-head-copy">
          <div class="story-head-kicker">${escapeHTML(story.category)} <span aria-hidden="true">/</span> FreeTaleOnce Original</div>
          <h1>${escapeHTML(story.title)}</h1>
          <p class="story-deck">${escapeHTML(story.excerpt)}</p>
          <div class="story-tags">
            ${(story.tags || []).map((tag) => `<span class="story-tag">${escapeHTML(tag)}</span>`).join("")}
          </div>
          <div class="story-meta">${wordCount.toLocaleString()} words · ${readMinutes} min read</div>
        </div>
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
        list.replaceChildren();
        const unavailable = document.createElement("div");
        unavailable.className = "empty-comments";
        unavailable.textContent = "Comments are unavailable right now.";
        list.appendChild(unavailable);
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
      await initReader();
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
