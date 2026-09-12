const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const story = (url.searchParams.get("story") || "").slice(0, 100);
  if (!story) return json({ error: "Missing story" }, 400);
  if (!context.env.DB) return json({ error: "Database not configured" }, 503);

  const row = await context.env.DB.prepare(
    "SELECT AVG(rating) AS average, COUNT(*) AS count FROM ratings WHERE story_id = ?"
  ).bind(story).first();

  return json({ average: Number(row?.average || 0), count: Number(row?.count || 0) });
}

export async function onRequestPost(context) {
  if (!context.env.DB) return json({ error: "Database not configured" }, 503);
  let body;
  try { body = await context.request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const story = String(body.story || "").slice(0, 100);
  const visitorId = String(body.visitorId || "").slice(0, 80);
  const rating = Number(body.rating);
  if (!story || !visitorId || !Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: "Invalid rating" }, 400);

  await context.env.DB.prepare(`
    INSERT INTO ratings (story_id, visitor_id, rating, created_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(story_id, visitor_id)
    DO UPDATE SET rating = excluded.rating, created_at = datetime('now')
  `).bind(story, visitorId, rating).run();

  const row = await context.env.DB.prepare(
    "SELECT AVG(rating) AS average, COUNT(*) AS count FROM ratings WHERE story_id = ?"
  ).bind(story).first();
  return json({ average: Number(row?.average || 0), count: Number(row?.count || 0) });
}
