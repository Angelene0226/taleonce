# TaleOnce

A complete fiction site designed for Cloudflare Pages. The public library contains one finished English work in each of five categories.

## Product structure

- Home page: five primary categories (Romance, Werewolf, Vampire, Contemporary, Fantasy)
- Cards: cover + title + short description
- Click a card to read immediately
- Reader: menu/contents drawer, title, tags, word count, estimated reading time, font size and dark mode
- End of story: 5-star rating + simple comments
- Ratings/comments are stored in Cloudflare D1 through Pages Functions

## Add or edit stories

Stories are individual JSON files under `public/stories/`; `public/stories/index.json` contains the lightweight metadata used on the home page. The reader loads only the selected story's full text.

Each story has:

- `slug`
- `category`
- `title`
- `excerpt`
- `cover`
- `tags`
- `wordCount` (calculated from the prose by `tools/add_story.py`)
- `sections` with section titles and paragraphs

Illustrated PNG covers are stored in `public/assets/covers/`. The site overlays each title in HTML so cover text stays crisp and editable.

Each story has one primary category. Use tags for cross-genre themes such as romance in a werewolf story. Romance is for relationship-led stories without a stronger supernatural setting; Werewolf and Vampire are setting-specific; Contemporary is present-day fiction without a supernatural premise; Fantasy covers other magical settings.

## Current library

| Category | Story | English words |
| --- | --- | ---: |
| Romance | *Too Late to Love Me* (author's full manuscript) | 30,519 |
| Werewolf | *The Winter Boundary* | 5,022 |
| Vampire | *The Last Name on the Register* | 5,014 |
| Contemporary | *The Apartment Above the Laundromat* | 5,003 |
| Fantasy | *The Map of Unmade Roads* | 5,005 |

English and Chinese lengths do not convert exactly. The four new stories are complete, each with its own ending and a reading volume intended to approximate a Chinese 8,000–12,000-character short work.

## Review the layout locally

Open `preview/index.html` in a browser to inspect the home page, then click any cover to see its reader page. The preview uses the site's styles and covers but includes only the opening paragraphs. It sits outside `public/`, so Cloudflare will not publish it. Regenerate it after design changes with `python3 tools/build_preview.py`.

## Deploy to Cloudflare Pages

1. Create a GitHub repository named `taleonce`.
2. Push this whole folder to the repository.
3. Cloudflare dashboard → Workers & Pages → Create application → Pages → Connect to Git.
4. Choose the `taleonce` repository.
5. Production branch: `main`.
6. In the current Git repository layout, set **Root directory** to `taleonce`, **Build command** to `exit 0`, and **Build output directory** to `public`. This also places `functions/` beside `public/` for Pages Functions.
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
├── too-late-to-love-me.json
├── the-winter-boundary.json
├── the-last-name-on-the-register.json
├── the-apartment-above-the-laundromat.json
└── the-map-of-unmade-roads.json
```

Open `/admin/` to create a story JSON file in the browser.

After downloading the JSON file:

```bash
cd taleonce
python3 tools/add_story.py ~/Downloads/your-story.json
python3 tools/validate_site.py
git add .
git commit -m "Add story"
git push
```

Cloudflare Pages will redeploy automatically after the push.
