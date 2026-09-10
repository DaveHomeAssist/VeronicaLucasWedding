# VeronicaLucasWedding

Static wedding site for `veronicaandlucas.com`.

## Files

- `index.html`: the one deployed page. Structure, copy, CSS and JS are all inline; this is the only file GitHub Pages serves as the site.
- `worker/`: Cloudflare Worker (`wedding-api`) that receives `/rsvp` and `/shenanigans` POSTs and writes to Notion. See `docs/wedding-ops-system-spec.md` for the schema and deploy steps.
- `tests/`: static behavior checks for `index.html`.
- `images/`: photo assets used by the site
- `styles.css`: legacy stylesheet from an earlier split file layout; not referenced by `index.html`.
- `index-v2.html`, `index-v1-backup.html`, `index copy.html`, `older/2index.html`: older homepage snapshots (noindexed). Not canonical; they predate the RSVP fixes in `index.html`.

## RSVP go live

The RSVP and shenanigans forms only reach Notion once both are done:

1. `cd worker && npx wrangler secret put NOTION_API_KEY && npx wrangler deploy`
2. Set `const API_BASE = 'https://<worker url>'` in `index.html` and push. While it is empty the forms do not call the worker and offer an email fallback instead.

## Local preview

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Tests

CI (`.github/workflows/ci.yml`) runs both checks on every push and pull
request to `main`; run them locally with plain Node (no dependencies):

```bash
node tests/site-check.mjs             # inline script parses, ids resolve, RSVP stays wired
node --test worker/test/index.test.js # Cloudflare Worker unit tests (Notion mocked)
```
