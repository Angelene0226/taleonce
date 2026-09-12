# TaleOnce

A minimal short-fiction site designed for Cloudflare Pages.

## Product structure

- Home page: categories only (Romance, Werewolf, Vampire, Urban, Fantasy)
- Cards: cover + title + short description
- Click a card to read immediately
- Reader: menu/contents drawer, title, tags, word count, estimated reading time, font size and dark mode
- End of story: 5-star rating + simple comments
- Ratings/comments are stored in Cloudflare D1 through Pages Functions

## Add or edit stories

Edit `data/stories.js`.

Each story has:

- `slug`
- `category`
- `title`
- `excerpt`
- `cover`
- `tags`
- `wordCount`
- `sections` with section titles and paragraphs

Replace the SVG files in `assets/covers/` with your real covers when ready.

## Deploy to Cloudflare Pages

1. Create a GitHub repository named `taleonce`.
2. Push this whole folder to the repository.
3. Cloudflare dashboard → Workers & Pages → Create application → Pages → Connect to Git.
4. Choose the `taleonce` repository.
5. Production branch: `main`.
6. This project is plain static HTML. Set **Build command** to `exit 0` and **Build output directory** to `public`. Keep the repository root as the root directory.
7. Choose `taleonce` as the Pages project name if available. Cloudflare will give the project a `*.pages.dev` address; if the name is available, it will be `taleonce.pages.dev`.

## Enable ratings and comments with D1

Create a D1 database in Cloudflare (for example `taleonce-db`). Run the SQL in `schema.sql` against that database.

Then open your Pages project:

Settings → Bindings → Add → D1 database

- Variable name: `DB`
- Database: your `taleonce-db`

Redeploy after adding the binding.

The Functions in `functions/api/` will then serve `/api/rating` and `/api/comments`.

## Notes before public launch

The comment system is intentionally minimal. Before attracting meaningful traffic, consider adding Cloudflare Turnstile and a moderation flow. You can hide a comment manually by setting `approved = 0` in D1.

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
