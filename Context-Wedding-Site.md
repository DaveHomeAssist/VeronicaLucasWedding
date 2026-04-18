# Wedding Site Context

Last updated: 2026-04-06
Repo path: `/Users/daverobertson/Desktop/Code/99-VeronicaLucasWedding`
Live site: `https://veronicaandlucas.com/`
GitHub repo: `https://github.com/DaveHomeAssist/VeronicaLucasWedding`
Primary branch: `main`
Current deployed commit when this file was written: `d0d77b1` (`Launch-readiness overhaul with Notion backend integration`)

## What This Project Is

This is an ongoing wedding website project for Veronica and Lucas.

Timeline context:
- The project is meant to keep evolving until the wedding in October 2026.
- The domain is `veronicaandlucas.com`.
- The current site is a static GitHub Pages site.

User preference context:
- The user did **not** want a full redesign.
- The correct direction is: preserve the original layout and tone, then polish it.
- The visual target is: tasteful, classy, expensive-looking, editorial, and restrained.
- If pulling ideas from alternate drafts, merge selectively. Do not bulldoze the original.

## Current Live / Deploy State

GitHub Pages:
- Source: `main:/`
- Custom domain: `veronicaandlucas.com`
- HTTPS: enforced
- Build status at time of writing: built

Verified live behavior on 2026-04-06:
- `https://veronicaandlucas.com/` returns `200`
- `www.veronicaandlucas.com` should route through GitHub Pages and resolve to the apex domain setup

Current DNS at time of writing:
- Apex `A` records:
  - `185.199.108.153`
  - `185.199.109.153`
  - `185.199.110.153`
  - `185.199.111.153`
- `www` CNAME:
  - `davehomeassist.github.io.`

GitHub Pages notes:
- `CNAME` exists in repo root and contains `veronicaandlucas.com`
- Pages is configured on the repository, not an org site

## Repo Structure

Current top-level files/folders:
- `index.html`
- `images/`
- `CNAME`
- `README.md`
- `styles.css`
- `script.js`
- `older/`

Important reality:
- The live site currently comes from **one self-contained `index.html`** with inline CSS and inline JS.
- `styles.css` and `script.js` are legacy leftovers from an earlier structure and are not the source of truth for the current deployed page.
- `README.md` is stale because it still describes the external `styles.css` / `script.js` setup.

Git status note when this file was created:
- `older/` is untracked
- That was intentional; it stayed local and was not pushed

## Source-Of-Truth / Historical Context

This project had multiple competing versions during the session:

1. The user pointed to `/Users/daverobertson/Desktop/index.html` as the original design source.
2. There was also an alternate draft at `older/2index.html`.
3. A mistaken rewrite happened earlier and upset the user because it changed too much.

Important lesson for future sessions:
- Do not assume permission to rebuild the site from scratch.
- The safe move is to preserve the original composition and only improve polish, interactions, spacing, and fidelity.

The key confusion was the photo gallery:
- `/Users/daverobertson/Desktop/index.html` did not contain the gallery section
- `older/2index.html` did contain the gallery/lightbox
- The user insisted the album had been part of their working setup
- The resolution was to keep the original site layout but merge the gallery back in from the alternate draft

## Current Design Direction

What is currently implemented:
- Original layout preserved
- Luxe/editorial polish layered on top
- Full-bleed photographic hero
- Transparent hero nav that turns into a glassy light nav on scroll
- Elegant typography using:
  - `Playfair Display`
  - `Cormorant Garamond`
  - `Libre Franklin`
- Warm cream / gold / dark palette
- Richer card surfaces with subtle shadows and linework
- Gallery restored without turning the site into a different design language
- `2x2` desktop shenanigans card layout

Design intent to preserve:
- Elegant, not trendy
- Expensive, not flashy
- Romantic, not cute
- Subtle motion, not hyperactive motion

What not to do:
- Don’t convert this into a startup landing page
- Don’t replace the typography with generic defaults
- Don’t over-animate
- Don’t add random sections that break the current rhythm

## What Is In `index.html` Right Now

Major sections:
- Fixed nav
- Hero
- Story
- Photo gallery
- Wedding details
- Shenanigans
- RSVP
- Footer

Current nav sections:
- `Our Story`
- `Photos`
- `Details`
- `Shenanigans`
- `RSVP`

Hero:
- Uses a background image
- Has countdown
- Has localized time hint
- Has scroll hint
- Nav starts transparent over hero and becomes light/glass on scroll

Gallery:
- Restored into the main site
- Uses the 5 photos in `/images`
- Has lightbox
- Keyboard support exists for open/close/navigation
- On mobile it collapses to a smaller grid cleanly

Details:
- Still placeholder content for venue, address, hotel, and registry
- Has add-to-calendar button

Shenanigans:
- Desktop layout is a 2x2 grid
- Mobile becomes single-column
- Cards open inline forms
- Form state is stored locally

RSVP:
- Form is present
- Submission is currently local-only
- Confirmation state is local-only
- No production backend is wired yet

## Current Image Assets

Available in `/images`:
- `00011-Veronica.jpg`
- `00014-Veronica.jpg`
- `00020-Veronica.jpg`
- `00025-Veronica.jpg`
- `00034-Veronica.jpg`

How they are currently used:
- Hero uses `00014-Veronica.jpg`
- Gallery uses all five images
- OG image is currently `images/00014-Veronica.jpg`

## Interactions Currently Implemented

Nav:
- Mobile hamburger toggle
- `aria-expanded` support
- Click outside closes mobile nav
- `Escape` closes mobile nav
- Body scroll locks when mobile nav is open
- Active section highlighting
- Scroll-based visual state for nav

Hero:
- Countdown
- Localized time hint for non-venue time zones
- Welcome-back message for return visitors
- Clickable and keyboard-usable scroll hint

Gallery / Lightbox:
- Click to open
- `Escape` closes
- Arrow key support for previous/next
- Focus returns to the triggering gallery item after close
- Body scroll locks while lightbox is open

Shenanigans:
- Cards open/close
- Keyboard open/close support
- Inline submission state
- Stored locally

RSVP:
- Field validation
- Conditional `+1` fields
- Local persistence
- Edit submitted RSVP

## Storage Model

Client-side storage key:
- `vl_wedding`

Stored in `localStorage`:
- visit count
- first/last visit
- guest name
- guest email
- RSVP state
- shenanigans submission state
- last scroll section

Important implication:
- RSVP and shenanigans are not saved to a server right now
- Any “submission” is local/browser-specific only
- This is fine for prototype/demo behavior, but not for production guest response collection

## Known Placeholders / Incomplete Areas

These still need real data:

Story:
- `[insert your origin story — or a hilariously embellished version]`
- `[X] years`

Details:
- `[Venue Name]`
- `[Address]`
- `[Hotel Name]`
- `[Date]`
- registry link still placeholder

Time / timezone:
- Wedding date is currently set as `2026-10-24T16:00:00-05:00`
- Comments indicate this is an example Central Time setup
- `venueTZ` is still hardcoded as `Central Time`
- If the venue timezone changes, update the countdown/local time logic accordingly

Backend:
- RSVP `POST` is still TODO
- Shenanigans `POST` is still TODO

## Most Important Product / UX Constraints

Future sessions should follow these rules:

1. Keep the original structure unless the user explicitly asks for a redesign.
2. Treat visual changes as polish, not replacement.
3. The user wants refinement, not invention for its own sake.
4. If borrowing from `older/2index.html`, only keep the parts that fit the main design.
5. Always verify desktop and mobile after layout changes.
6. Keep the site feeling premium and calm.

## Files To Treat Carefully

`index.html`
- This is the actual live page source
- All meaningful current work is here

`older/2index.html`
- Local alternate draft
- Contains some useful ideas and previous implementations
- Was the source for the restored gallery/lightbox
- Is untracked and currently not deployed

`README.md`
- Outdated
- Describes an older file structure where `styles.css` and `script.js` drive the site

`styles.css` / `script.js`
- Legacy files
- Not the current deployed source of truth
- Do not assume edits here will affect the live site unless the HTML is restructured to use them again

## Recent Git History

Recent commits:
- `0fce71d` `Polish original wedding site design`
- `314bd94` `Restore custom domain config`
- `d85e7f0` `Restore original site layout`
- `1bca075` `Delete CNAME`
- `ca79237` `Initial wedding site`

Interpretation:
- `d85e7f0` was the “go back toward original” correction
- `314bd94` restored the Pages custom domain config
- `0fce71d` is the current polished version that merges gallery + interaction fixes + tasteful visual upgrades

## Deployment / Operational Notes

Git remote:
- `origin -> https://github.com/DaveHomeAssist/VeronicaLucasWedding.git`

Preview locally:

```bash
cd /Users/daverobertson/Desktop/Code/99-VeronicaLucasWedding
python3 -m http.server 4173
```

Then open:

```bash
http://127.0.0.1:4173/
```

Useful verification commands:

```bash
gh api repos/DaveHomeAssist/VeronicaLucasWedding/pages
gh api repos/DaveHomeAssist/VeronicaLucasWedding/pages/builds
curl -I https://veronicaandlucas.com
dig +short veronicaandlucas.com A
dig +short www.veronicaandlucas.com CNAME
```

## Verification Already Done

The current polished version was verified for:
- desktop layout stability
- mobile layout stability
- no horizontal overflow in tested sizes
- mobile nav open/close and scroll locking
- gallery lightbox open/close
- keyboard close/navigation for lightbox
- RSVP validation behavior

One incidental issue encountered during local testing:
- `favicon.ico` 404 appeared before a data-URL favicon was added
- This is now handled in `index.html`

## Recommended Next Work

Highest-value next tasks:

1. Replace all placeholder story/details copy with real wedding content.
2. Add real venue, hotel block, travel, parking, and registry info.
3. Wire RSVP to a real backend or lightweight form handler.
4. Wire shenanigans to a real inbox/form/backend if the feature should stay.
5. Update `README.md` so it matches the real implementation.
6. Decide whether to keep the single-file architecture or refactor back into split HTML/CSS/JS files later.

## If A Future Session Needs To Make Changes

Recommended approach:
- Start from `index.html`
- Preserve the existing composition
- Make small, high-confidence edits
- Re-test on desktop and mobile
- Push only tracked files unless the user explicitly wants `older/` added

If adding new sections:
- Keep the section rhythm and divider cadence
- Match the existing type scale and spacing
- Avoid generic component-library styling

If changing visuals:
- Use restraint
- Favor typography, spacing, materials, and image treatment over “effects”

## Plain-English Summary

This project is now in a good state visually and operationally:
- the site is live
- HTTPS works
- the custom domain works
- the original design direction has been restored
- the gallery is back
- the interactions work

The main unfinished work is content and backend wiring, not layout.
