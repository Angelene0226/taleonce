const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const story = (url.searchParams.get("story") || "").slice(0, 100);
  if (!story) return json({ error: "Missing story" }, 400);
  if (!context.env.DB) return json({ error: "Database not configured" }, 503);

  const result = await context.env.DB.prepare(`
    SELECT id, name, comment, created_at
    FROM comments
    WHERE story_id = ? AND approved = 1
    ORDER BY id DESC
    LIMIT 100
  `).bind(story).all();
  return json({ comments: result.results || [] });
}

export async function onRequestPost(context) {
  if (!context.env.DB) return json({ error: "Database not configured" }, 503);
  let body;
  try { body = await context.request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const story = String(body.story || "").trim().slice(0, 100);
  const name = String(body.name || "").trim().slice(0, 40);
  const comment = String(body.comment || "").trim().slice(0, 600);
  if (!story || name.length < 1 || comment.length < 2) return json({ error: "Please enter a name and comment." }, 400);

  await context.env.DB.prepare(`
    INSERT INTO comments (story_id, name, comment, approved, created_at)
    VALUES (?, ?, ?, 1, datetime('now'))
  `).bind(story, name, comment).run();

  return json({ ok: true }, 201);
}
