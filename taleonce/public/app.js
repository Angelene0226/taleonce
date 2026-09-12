(() => {
  const stories = window.TALEONCE_STORIES || [];
  const categories = ["Romance", "Werewolf", "Vampire", "Urban", "Fantasy"];

  const slugify = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const storyHref = (story) => `/story.html?story=${encodeURIComponent(story.slug)}`;
  const escapeHTML = (value = "") => value.replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));

  function initHome() {
    const library = document.querySelector("#library");
    if (!library) return;
    categories.forEach(category => {
      const items = stories.filter(story => story.category === category);
      if (!items.length) return;
      const section = document.createElement("section");
      section.className = "category-section";
      section.id = slugify(category);
      section.innerHTML = `
        <div class="category-heading"><h2>${escapeHTML(category)}</h2></div>
        <div class="story-grid">
          ${items.map(story => `
            <article class="story-card">
              <a class="cover-link" href="${storyHref(story)}" aria-label="Read ${escapeHTML(story.title)}">
                <img class="story-cover" src="${story.cover}" alt="Cover of ${escapeHTML(story.title)}" loading="lazy" />
              </a>
              <h3><a href="${storyHref(story)}">${escapeHTML(story.title)}</a></h3>
              <p>${escapeHTML(story.excerpt)}</p>
            </article>
          `).join("")}
        </div>`;
      library.appendChild(section);
    });
    document.querySelector("#year").textContent = new Date().getFullYear();
  }

  function currentStory() {
    const params = new URLSearchParams(location.search);
    const slug = params.get("story") || stories[0]?.slug;
    return stories.find(item => item.slug === slug);
  }

  function initReader() {
    const article = document.querySelector("#storyArticle");
    if (!article) return;
    const story = currentStory();
    if (!story) {
      article.innerHTML = `<p>Story not found. <a href="/">Return home</a>.</p>`;
      return;
    }

    document.title = `${story.title} — TaleOnce`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = story.excerpt;
    const readMinutes = Math.max(1, Math.round(story.wordCount / 230));

    article.innerHTML = `
      <header class="story-head">
        <h1>${escapeHTML(story.title)}</h1>
        <div class="story-tags">${story.tags.map(tag => `<span class="story-tag">${escapeHTML(tag)}</span>`).join("")}</div>
        <div class="story-meta">${story.wordCount.toLocaleString()} words · ${readMinutes} min read</div>
      </header>
      <div class="story-body">
        ${story.sections.map((section, index) => `
          ${index ? '<hr class="story-divider" />' : ''}
          <section id="section-${index + 1}">
            <h2>${escapeHTML(section.title)}</h2>
            ${section.paragraphs.map(p => `<p>${escapeHTML(p)}</p>`).join("")}
          </section>
        `).join("")}
      </div>`;

    const toc = document.querySelector("#toc");
    toc.innerHTML = story.sections.map((section, index) => `<a href="#section-${index + 1}">${escapeHTML(section.title)}</a>`).join("");

    const categoryBack = document.querySelector("#backCategory");
    categoryBack.textContent = `← Back to ${story.category}`;
    categoryBack.href = `/#${slugify(story.category)}`;

    initDrawer();
    initReaderPrefs();
    initRating(story.slug);
    initComments(story.slug);
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
    drawer.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", e => { if (e.key === "Escape") setOpen(false); });
  }

  function initReaderPrefs() {
    const body = document.body;
    const themeButton = document.querySelector("#themeButton");
    const fontButton = document.querySelector("#fontButton");
    const savedTheme = localStorage.getItem("taleonce-theme");
    if (savedTheme === "dark") body.classList.add("dark");
    if (themeButton) {
      themeButton.textContent = body.classList.contains("dark") ? "☀" : "☾";
      themeButton.addEventListener("click", () => {
        body.classList.toggle("dark");
        const dark = body.classList.contains("dark");
        localStorage.setItem("taleonce-theme", dark ? "dark" : "light");
        themeButton.textContent = dark ? "☀" : "☾";
      });
    }

    const sizes = [18, 20, 22, 24];
    let size = Number(localStorage.getItem("taleonce-font-size")) || 20;
    document.documentElement.style.setProperty("--story-font-size", `${size}px`);
    if (fontButton) fontButton.addEventListener("click", () => {
      const index = sizes.indexOf(size);
      size = sizes[(index + 1) % sizes.length];
      localStorage.setItem("taleonce-font-size", String(size));
      document.documentElement.style.setProperty("--story-font-size", `${size}px`);
    });
  }

  function getVisitorId() {
    let id = localStorage.getItem("taleonce-visitor-id");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).slice(0, 64);
      localStorage.setItem("taleonce-visitor-id", id);
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
      stars.querySelectorAll("button").forEach((button, index) => button.classList.toggle("active", index < selected));
    };
    for (let i = 1; i <= 5; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "star";
      button.textContent = "★";
      button.setAttribute("aria-label", `${i} star${i > 1 ? "s" : ""}`);
      button.addEventListener("mouseenter", () => { selected = i; render(); });
      button.addEventListener("click", async () => {
        selected = i; render(); message.textContent = "Saving…";
        try {
          const response = await fetch("/api/rating", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ story: storySlug, rating: i, visitorId: getVisitorId() }) });
          if (!response.ok) throw new Error("Rating service unavailable");
          const data = await response.json();
          summary.textContent = data.count ? `${Number(data.average).toFixed(1)} · ${data.count} rating${data.count === 1 ? "" : "s"}` : "No ratings yet";
          message.textContent = "Thanks for rating!";
        } catch {
          message.textContent = "Ratings will be available after the Cloudflare database is connected.";
        }
      });
      stars.appendChild(button);
    }
    stars.addEventListener("mouseleave", render);
    try {
      const response = await fetch(`/api/rating?story=${encodeURIComponent(storySlug)}`);
      if (response.ok) {
        const data = await response.json();
        summary.textContent = data.count ? `${Number(data.average).toFixed(1)} · ${data.count} rating${data.count === 1 ? "" : "s"}` : "No ratings yet";
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
      comments.forEach(item => {
        const node = document.createElement("div");
        node.className = "comment";
        const head = document.createElement("div");
        head.className = "comment-head";
        const person = document.createElement("div"); person.className = "comment-name"; person.textContent = item.name;
        const time = document.createElement("time"); time.className = "comment-time"; time.textContent = new Date(item.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
        const body = document.createElement("div"); body.className = "comment-body"; body.textContent = item.comment;
        head.append(person, time); node.append(head, body); list.appendChild(node);
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
      if (honeypot.value) return;
      message.textContent = "Posting…";
      try {
        const response = await fetch("/api/comments", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ story: storySlug, name: name.value.trim(), comment: text.value.trim() }) });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Could not post comment");
        }
        text.value = "";
        message.textContent = "Comment posted.";
        await load();
      } catch (error) {
        message.textContent = error.message || "Comments will be available after the Cloudflare database is connected.";
      }
    });
  }

  initHome();
  initReader();
})();
