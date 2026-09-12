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
