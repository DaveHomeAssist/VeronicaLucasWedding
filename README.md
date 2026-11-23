# VeronicaLucasWedding

Static wedding site for `veronicaandlucas.com`. The celebration was October 24, 2026. RSVP and the shenanigans guest book are closed.

## What GitHub Pages publishes

Pages builds this repository with Jekyll. `_config.yml` lists what stays out of that build. The guest-facing files are:

- `index.html` — the site. Structure, copy, CSS, and JS are inline.
- `rsvp.html`, `registry.html`, `travel.html`, `404.html` — redirects into the page.
- `CNAME`, `images/`, and `fonts/` — domain, photos, and the self-hosted typefaces.
- `styles.css` — an earlier split stylesheet. `index.html` does not use it.

These stay in the repository and are not part of the Pages build:

- `README.md`, `AGENTS.md`, and `Context-Wedding-Site.md`
- `docs/` — the guest-list schema and the old operations notes
- `worker/` — the Cloudflare Worker that used to write form posts to Notion. The site does not call it. Worker logs record an HTTP status code only, never a Notion response body (those bodies can echo names, email, and notes). This repository does not delete Notion rows. If any were created before the forms closed, remove them in Notion when they should not be kept.
- `tests/`
- `older/`, `index-v1-backup.html`, `index-v2.html`, `index copy.html`, and `wedding_brand_reference_html.html` — retired snapshots. They are not the live page.

## Local preview

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Tests

CI (`.github/workflows/ci.yml`) runs these on every push and pull request to `main`. Locally, with plain Node and no dependencies:

```bash
node tests/site-check.mjs
node tests/audit-check.mjs
node --test worker/test/index.test.js
```
