# Wedding Ops — Notion System Specification

> **Project:** Veronica & Lucas Wedding — October 24, 2026
> **Site:** [veronicaandlucas.com](https://veronicaandlucas.com)
> **Repo:** `DaveHomeAssist/VeronicaLucasWedding`
> **Last updated:** 2026-04-06

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Shared Taxonomy](#2-shared-taxonomy)
3. [Database Schemas](#3-database-schemas)
4. [Relations Map](#4-relations-map)
5. [Views Reference](#5-views-reference)
6. [Row Templates](#6-row-templates)
7. [Formulas & Rollups](#7-formulas--rollups)
8. [Hub Page Layout](#8-hub-page-layout)
9. [Pages (Non-Database)](#9-pages-non-database)
10. [Lifecycle Guide](#10-lifecycle-guide)
11. [Milestone Task Seeds](#11-milestone-task-seeds)
12. [Build Order](#12-build-order)
13. [Maintenance & Conventions](#13-maintenance--conventions)

---

## 1. System Overview

### Purpose

A single Notion workspace that manages the full wedding lifecycle — from early planning through day-of execution — alongside the live wedding website at veronicaandlucas.com.

### Architecture

```
Guest browser → veronicaandlucas.com (GitHub Pages)
                    ↓ POST /rsvp or /shenanigans
              Cloudflare Worker (wedding-api)
                    ↓ authenticated
              Notion API → RSVP Responses / Shenanigans databases
```

### System map

```
                        ┌──────────────┐
                        │  👥 Guest    │
                        │    List      │  ← the spine
                        └──┬───┬───┬───┘
                           │   │   │
              ┌────────────┘   │   └────────────┐
              ▼                ▼                 ▼
     ┌────────────┐   ┌──────────────┐   ┌────────────┐
     │ 📬 RSVP    │   │ 🪑 Seating  │   │ 🎉 Shenan- │
     │ Responses  │   │    Chart     │   │  igans     │
     │ (existing) │   │              │   │ (existing) │
     └────────────┘   └──────────────┘   └─────┬──────┘
                                               │
                                               ▼ song requests feed
     ┌────────────┐   ┌──────────────┐   ┌────────────┐
     │ 🏢 Vendors │──▶│ 💰 Budget   │   │ 🎵 Music   │
     └────────────┘   └──────────────┘   └────────────┘

     ┌────────────┐   ┌──────────────┐
     │ ✅ Tasks   │   │ 📋 Day-of   │  ← page, not db
     └────────────┘   └──────────────┘
```

### Design principles

1. **One vocabulary** — Select options defined once, used identically across databases.
2. **Guest List is the spine** — Every person-related database relates back to it.
3. **Budget and Vendors are joined** — Every dollar traces to a vendor or category.
4. **Phase-aware** — Databases activate in stages. Irrelevant ones stay collapsed.
5. **Dashboard-first** — Hub page shows live rollup metrics at a glance.
6. **Templateable** — Row templates for common entries. Whole system is duplicable.

### Components

| Component | Type | Status |
|-----------|------|--------|
| 👥 Guest List | database | NEW |
| 📬 RSVP Responses | database | EXISTING — add 1 relation |
| 🎉 Shenanigans | database | EXISTING — no changes |
| 🏢 Vendors | database | NEW |
| 💰 Budget | database | NEW |
| 🪑 Seating Chart | database | NEW |
| 🎵 Music | database | NEW |
| ✅ Tasks | database | NEW |
| 📋 Day-of Timeline | page | NEW |
| 📸 Shot List | page | NEW |
| 💒 Hub / Dashboard | page | EXISTING — restructure |

---

## 2. Shared Taxonomy

These select values are canonical. Use these exact strings wherever they appear.

### Category

Used in: Vendors, Budget, Tasks

**Vendor-applicable** (used in all three):
```
Venue · Catering · Photography · Videography · DJ & Music ·
Florist · Officiant · Rentals · Hair & Makeup · Cake & Dessert ·
Transportation · Stationery · Other
```

**Budget/Tasks only** (not in Vendors):
```
Attire · Rings · Legal & License · Favors ·
Tips & Gratuity · Decor · Honeymoon · Website
```

### Side

Used in: Guest List

```
Bride · Groom · Mutual
```

### Circle

Used in: Guest List

```
Immediate Family · Extended Family · Bridal Party ·
Close Friend · Friend · Colleague · Neighbor · Plus One
```

### Owner

Used in: Tasks

```
Veronica · Lucas · Both · Planner · Dave · Other
```

### Milestone

Used in: Tasks

```
12+ Months · 9–12 Months · 6–9 Months · 3–6 Months ·
1–3 Months · 2–4 Weeks · Week Of · Day Of
```

---

## 3. Database Schemas

### 👥 Guest List

The master record for every person. All other person-facing databases point here.

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| Name | title | yes | "First Last" format |
| Email | email | no | |
| Phone | phone | no | |
| Mailing Address | text | no | Full address for paper invites |
| Side | select | yes | `Bride` · `Groom` · `Mutual` |
| Circle | select | yes | See shared taxonomy |
| Invite Status | select | yes | `Not Yet` → `Save the Date Sent` → `Invited` → `Reminder Sent` |
| RSVP Status | select | yes | `Awaiting` → `Accepted` → `Declined` |
| Plus One Granted | checkbox | — | Whether this guest gets a +1 |
| Plus One Name | text | no | If known |
| Dietary | text | no | Free text — allergies, preferences |
| Meal Choice | select | no | `TBD` + options added when menu finalizes |
| Table | relation | no | → Seating Chart. Assigned 2–4 weeks out |
| Hotel Needed | checkbox | — | Flags out-of-town guests |
| Gift Received | checkbox | — | For thank-you tracking |
| Thank You Sent | checkbox | — | |
| RSVP Response | relation | no | → RSVP Responses. Links digital submission |
| Notes | text | no | |
| *Has Dietary Need* | *formula* | — | `if(length(prop("Dietary")) > 0, true, false)` |
| *RSVPd on Site* | *rollup* | — | Count of RSVP Response relation (0 or 1) |

### 📬 RSVP Responses (existing + 1 addition)

Existing schema unchanged. Add:

| Property | Type | Notes |
|----------|------|-------|
| Guest Record | relation | → Guest List. Links digital response to master record |

### 🎉 Shenanigans (existing, no changes)

| Property | Type | Notes |
|----------|------|-------|
| Author | title | Free text from guest |
| Type | select | `Toast Roast` · `Photo Ops` · `Song Requests` · `Advice & Bets` |
| Content | text | |
| Extra | text | Song title, photo link, etc. |
| Submitted At | created_time | Auto |

### 🏢 Vendors

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| Vendor Name | title | yes | Business name |
| Category | select | yes | Shared taxonomy (vendor subset) |
| Contact Name | text | no | Your person there |
| Phone | phone | no | |
| Email | email | no | |
| Website | url | no | |
| Status | select | yes | `Researching` → `Contacted` → `Meeting Set` → `Proposal In` → `Booked` → `Deposit Paid` → `Paid in Full` |
| Total Cost | number ($) | no | Contract total |
| Deposit | number ($) | no | |
| Deposit Due | date | no | |
| Balance Due | date | no | |
| Contract | url | no | Link to PDF in Drive/Dropbox |
| Budget Lines | relation | — | → Budget (reverse). Shows mapped budget items |
| Rating | select | no | `★` · `★★` · `★★★` — post-event |
| Notes | text | no | |
| *Balance Remaining* | *formula* | — | `prop("Total Cost") - prop("Deposit")` |
| *Days Until Deposit* | *formula* | — | `if(empty(prop("Deposit Due")), 0, dateBetween(prop("Deposit Due"), now(), "days"))` |
| *Overdue* | *formula* | — | See §7 |

### 💰 Budget

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| Line Item | title | yes | Specific: "Catering: dinner service" |
| Category | select | yes | Shared taxonomy (full set) |
| Estimated | number ($) | yes | |
| Actual | number ($) | no | Fill as costs finalize |
| Paid By | select | no | `Couple` · `Bride's Family` · `Groom's Family` · `Split` |
| Payment Status | select | yes | `Not Started` → `Deposit Paid` → `Paid in Full` |
| Due Date | date | no | |
| Vendor | relation | no | → Vendors |
| Notes | text | no | |
| *Over/Under* | *formula* | — | `prop("Actual") - prop("Estimated")` |
| *% of Estimated* | *formula* | — | See §7 |

### 🪑 Seating Chart

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| Table | title | yes | "Table 1", "Head Table", "Kids Table" |
| Capacity | number | yes | Chairs at this table |
| Location | text | no | "Near dance floor", "Garden side" |
| Guests | relation | — | → Guest List (multi). Assign guests here |
| Notes | text | no | |
| *Seated* | *rollup* | — | Count of Guests relation |
| *Spots Left* | *formula* | — | `prop("Capacity") - prop("Seated")` |
| *Full* | *formula* | — | `prop("Spots Left") <= 0` |
| *Guest Names* | *rollup* | — | Show Name from Guests, comma-separated |
| *Dietary Flags* | *rollup* | — | Show Dietary from Guests (non-empty) |

### 🎵 Music

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| Song | title | yes | |
| Artist | text | yes | |
| Category | select | yes | `First Dance` · `Parent Dance (Bride)` · `Parent Dance (Groom)` · `Processional` · `Recessional` · `Must Play` · `Do Not Play` · `Guest Request` · `Ceremony` · `Cocktail Hour` · `Dinner` |
| Requested By | text | no | Guest name, "Couple", or "DJ" |
| Priority | select | no | `Essential` · `Nice to Have` · `Maybe` |
| Source | select | no | `Couple` · `Guest (site)` · `DJ Suggestion` |
| Approved | checkbox | — | Couple reviewed and approved |
| Notes | text | no | "Play during cake cutting" |

### ✅ Tasks

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| Task | title | yes | Action-oriented: "Book photographer" |
| Category | select | yes | Shared taxonomy (full set) |
| Status | select | yes | `Not Started` → `In Progress` → `Done` → `Blocked` |
| Due | date | no | |
| Owner | select | no | Shared taxonomy |
| Priority | select | yes | `Must Do` · `Should Do` · `Nice to Have` |
| Milestone | select | yes | Shared taxonomy |
| Depends On | relation | no | → Tasks (self-relation) |
| Notes | text | no | |
| *Overdue* | *formula* | — | See §7 |
| *Days Left* | *formula* | — | See §7 |

---

## 4. Relations Map

| From | Property | → To | Cardinality | Notes |
|------|----------|------|-------------|-------|
| Guest List | RSVP Response | RSVP Responses | 1 → 0..1 | Links site submission to master record |
| Guest List | Table | Seating Chart | many → 1 | Many guests per table |
| RSVP Responses | Guest Record | Guest List | 1 → 0..1 | Reverse of above |
| Vendors | Budget Lines | Budget | 1 → many | One vendor, multiple cost lines |
| Budget | Vendor | Vendors | many → 1 | Reverse of above |
| Seating Chart | Guests | Guest List | 1 → many | Reverse of Guest List → Table |
| Tasks | Depends On | Tasks | many → many | Self-relation for dependencies |

**Not related (by design):**
- Shenanigans → Guest List: Author is free text from the site form. Fuzzy-matching names to guest records isn't worth the complexity. Song requests are manually promoted to the Music database.
- Music → Shenanigans: One-way manual promotion, not a live relation.

---

## 5. Views Reference

### 👥 Guest List

| View Name | Type | Filter | Sort | Group By | Key Columns |
|-----------|------|--------|------|----------|-------------|
| All Guests | table | — | Name A→Z | — | Name, Side, Circle, Invite Status, RSVP Status, Dietary, Table |
| By Side | board | — | — | Side | Name, Circle, RSVP Status |
| Awaiting RSVP | table | RSVP Status = `Awaiting` AND Invite Status = `Invited` | Name A→Z | — | Name, Email, Phone, Side, Notes |
| Dietary Needs | table | Has Dietary Need = true | Name A→Z | — | Name, Dietary, Meal Choice, Table |
| Needs Hotel | table | Hotel Needed = true | Side, Name | — | Name, Side, Email, Notes |
| Gift Tracking | table | RSVP Status = `Accepted` | Name A→Z | — | Name, Gift Received, Thank You Sent |
| Headcount | board | RSVP Status ≠ empty | — | RSVP Status | Name, Plus One Granted, Plus One Name |

### 📬 RSVP Responses

| View Name | Type | Filter | Sort | Key Columns |
|-----------|------|--------|------|-------------|
| Default view | table | — | Submitted At desc | (existing) |
| Unlinked | table | Guest Record is empty | Submitted At desc | Guest Name, Email, Attending, Guest Record |

### 🏢 Vendors

| View Name | Type | Filter | Sort | Group By | Key Columns |
|-----------|------|--------|------|----------|-------------|
| All Vendors | table | — | Category A→Z | — | Name, Category, Contact, Status, Total Cost |
| By Category | board | — | — | Category | Name, Status, Total Cost |
| Pipeline | board | Status ≠ `Paid in Full` | — | Status | Name, Category, Total Cost |
| Overdue Payments | table | Overdue = true | Deposit Due asc | — | Name, Category, Deposit, Deposit Due |
| Booked | table | Status ∈ {Booked, Deposit Paid, Paid in Full} | Category | — | Name, Category, Total Cost, Balance Due |

### 💰 Budget

| View Name | Type | Filter | Sort | Group By | Key Columns |
|-----------|------|--------|------|----------|-------------|
| All Items | table | — | Line Item A→Z | Category | Line Item, Estimated, Actual, Over/Under, Vendor |
| By Who Pays | board | — | — | Paid By | Line Item, Category, Estimated, Actual |
| Unpaid | table | Payment Status ≠ `Paid in Full` | Due Date asc | — | Line Item, Estimated, Due Date, Vendor |
| Over Budget | table | Over/Under > 0 | Over/Under desc | — | Line Item, Category, Estimated, Actual, Over/Under |

### 🪑 Seating Chart

| View Name | Type | Filter | Sort | Key Columns |
|-----------|------|--------|------|-------------|
| All Tables | table | — | Table name | Table, Capacity, Seated, Spots Left, Guest Names |
| Open Spots | table | Full = false | Spots Left desc | Table, Capacity, Spots Left, Location |
| Dietary by Table | table | — | Table name | Table, Guest Names, Dietary Flags |

### 🎵 Music

| View Name | Type | Filter | Sort | Group By | Key Columns |
|-----------|------|--------|------|----------|-------------|
| Full List | table | — | Song A→Z | Category | Song, Artist, Category, Priority, Approved |
| For DJ — Play | table | Category ≠ `Do Not Play` AND Approved = true | Priority | Category | Song, Artist, Category, Priority, Notes |
| Do Not Play | table | Category = `Do Not Play` | Song A→Z | — | Song, Artist, Notes |
| Guest Requests | table | Source = `Guest (site)` | Song A→Z | — | Song, Artist, Requested By, Approved |
| Needs Review | table | Approved = false AND Category ≠ `Do Not Play` | Song A→Z | — | Song, Artist, Source, Requested By |

### ✅ Tasks

| View Name | Type | Filter | Sort | Group By | Key Columns |
|-----------|------|--------|------|----------|-------------|
| Board | board | Status ≠ `Done` | Priority | Status | Task, Category, Due, Owner |
| Calendar | calendar | — | — (by Due) | — | Task, Status, Owner |
| By Milestone | board | Status ≠ `Done` | Due asc | Milestone | Task, Category, Due, Owner |
| Overdue | table | Overdue = true | Due asc | — | Task, Category, Due, Owner, Days Left |
| Veronica's | table | Owner = `Veronica` AND Status ≠ `Done` | Due asc | — | Task, Category, Due, Priority |
| Lucas's | table | Owner = `Lucas` AND Status ≠ `Done` | Due asc | — | Task, Category, Due, Priority |
| Done | table | Status = `Done` | — | Milestone | Task, Category, Owner |

---

## 6. Row Templates

### 👥 Guest List

| Template Name | Pre-fills |
|---------------|-----------|
| Bride's Family | Side: `Bride`, Circle: `Immediate Family` |
| Groom's Family | Side: `Groom`, Circle: `Immediate Family` |
| Extended — Bride | Side: `Bride`, Circle: `Extended Family` |
| Extended — Groom | Side: `Groom`, Circle: `Extended Family` |
| Bride's Friend | Side: `Bride`, Circle: `Friend` |
| Groom's Friend | Side: `Groom`, Circle: `Friend` |
| Mutual Friend | Side: `Mutual`, Circle: `Friend` |
| Bridal Party | Circle: `Bridal Party` |
| Colleague | Circle: `Colleague` |
| Plus One | Circle: `Plus One`, Invite Status: `Not Yet` |

### 🏢 Vendors

| Template Name | Pre-fills |
|---------------|-----------|
| Venue | Category: `Venue` |
| Caterer | Category: `Catering` |
| Photographer | Category: `Photography` |
| Videographer | Category: `Videography` |
| DJ / Band | Category: `DJ & Music` |
| Florist | Category: `Florist` |
| Officiant | Category: `Officiant` |
| Hair & Makeup | Category: `Hair & Makeup` |
| Cake / Dessert | Category: `Cake & Dessert` |
| Rentals | Category: `Rentals` |
| Transportation | Category: `Transportation` |
| Stationery | Category: `Stationery` |

### 💰 Budget

| Template Name | Pre-fills |
|---------------|-----------|
| Venue Cost | Category: `Venue` |
| Catering Cost | Category: `Catering` |
| Photo/Video | Category: `Photography` |
| Attire — Bride | Category: `Attire`, Paid By: `Bride's Family` |
| Attire — Groom | Category: `Attire`, Paid By: `Groom's Family` |
| Flowers | Category: `Florist` |
| Tip | Category: `Tips & Gratuity` |
| Decor Item | Category: `Decor` |

### 🎵 Music

| Template Name | Pre-fills |
|---------------|-----------|
| Must Play | Priority: `Essential`, Source: `Couple`, Approved: checked |
| Do Not Play | Category: `Do Not Play`, Priority: `Essential`, Source: `Couple`, Approved: checked |
| Guest Request | Source: `Guest (site)`, Approved: unchecked |
| DJ Suggestion | Source: `DJ Suggestion`, Approved: unchecked |
| Ceremony Song | Category: `Ceremony`, Source: `Couple` |

### ✅ Tasks

| Template Name | Pre-fills |
|---------------|-----------|
| Must Do | Priority: `Must Do`, Status: `Not Started` |
| Should Do | Priority: `Should Do`, Status: `Not Started` |
| Nice to Have | Priority: `Nice to Have`, Status: `Not Started` |

---

## 7. Formulas & Rollups

### Guest List

**Has Dietary Need** (formula):
```
if(length(prop("Dietary")) > 0, true, false)
```

**RSVPd on Site** (rollup):
- Relation: RSVP Response
- Property: (count)
- Calculate: Count all

### Vendors

**Balance Remaining** (formula):
```
prop("Total Cost") - prop("Deposit")
```

**Days Until Deposit** (formula):
```
if(
  empty(prop("Deposit Due")),
  0,
  dateBetween(prop("Deposit Due"), now(), "days")
)
```

**Overdue** (formula):
```
if(
  prop("Days Until Deposit") < 0
  and prop("Status") != "Deposit Paid"
  and prop("Status") != "Paid in Full",
  true,
  false
)
```

### Budget

**Over/Under** (formula):
```
prop("Actual") - prop("Estimated")
```

**% of Estimated** (formula):
```
if(
  prop("Estimated") > 0,
  round(prop("Actual") / prop("Estimated") * 100),
  0
)
```

### Seating Chart

**Seated** (rollup):
- Relation: Guests
- Property: (count)
- Calculate: Count all

**Spots Left** (formula):
```
prop("Capacity") - prop("Seated")
```

**Full** (formula):
```
prop("Spots Left") <= 0
```

**Guest Names** (rollup):
- Relation: Guests
- Property: Name
- Calculate: Show original

**Dietary Flags** (rollup):
- Relation: Guests
- Property: Dietary
- Calculate: Show original (non-empty entries surface per-table restrictions)

### Tasks

**Overdue** (formula):
```
if(
  prop("Status") != "Done"
  and not empty(prop("Due"))
  and prop("Due") < now(),
  true,
  false
)
```

**Days Left** (formula):
```
if(
  empty(prop("Due")),
  0,
  dateBetween(prop("Due"), now(), "days")
)
```

---

## 8. Hub Page Layout

The top-level page serves as the wedding dashboard.

### Structure

```
💒 Veronica & Lucas Wedding — October 24, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> 📊 DASHBOARD (callout block)
>
>  GUESTS           BUDGET              VENDORS        TASKS
>  Invited: --      Estimated: $--      Booked: -/-    Done: -/-
>  Accepted: --     Actual: $--         Deposits: -    Overdue: -
>  Declined: --     Delta: $--          Paid: -
>  Awaiting: --
>  Total w/+1s: --

---

## 📋 Active Phase: [current milestone]
→ Inline linked view: Tasks → By Milestone, filtered to current phase

---

## 👥 Guest List
→ Inline linked database, default: All Guests view

## 🏢 Vendors
→ Inline linked database, default: Pipeline view

## 💰 Budget
→ Inline linked database, default: All Items view

## 🪑 Seating Chart
→ Inline linked database, default: All Tables view
→ Collapsed until 1–3 months out

## 🎵 Music
→ Inline linked database, default: Full List view

## ✅ Tasks
→ Inline linked database, default: Board view

---

## 📋 Day-of Timeline → [page link]
## 📸 Shot List → [page link]

---

## 🌐 Website & Backend
→ Link to existing Site Backend page
→ Link to existing Wedding Info Needed page

## 📊 Direct Database Links
→ 📬 RSVP Responses
→ 🎉 Shenanigans
```

### Dashboard metrics (manual or formula-driven)

| Metric | Source |
|--------|--------|
| Invited | Guest List: count where Invite Status = `Invited` or `Reminder Sent` |
| Accepted | Guest List: count where RSVP Status = `Accepted` |
| Declined | Guest List: count where RSVP Status = `Declined` |
| Awaiting | Guest List: count where RSVP Status = `Awaiting` |
| Total w/ +1s | Accepted + count where Plus One Granted = true among accepted |
| Estimated | Budget: sum of Estimated |
| Actual | Budget: sum of Actual |
| Delta | Actual - Estimated |
| Booked | Vendors: count where Status ∈ {Booked, Deposit Paid, Paid in Full} / total |
| Done | Tasks: count where Status = `Done` / total |
| Overdue | Tasks: count where Overdue = true |

---

## 9. Pages (Non-Database)

### 📋 Day-of Timeline

A narrative page shared with vendors and the wedding party. Not a database — time blocks with details.

#### Template structure

```markdown
# Day-of Timeline — October 24, 2026

> **Emergency Contacts**
> Day-of coordinator: [name] — [cell]
> Venue contact: [name] — [cell]
> Photographer: [name] — [cell]
> DJ: [name] — [cell]
> Caterer: [name] — [cell]

---

## Morning — Setup & Prep

| Time | Event | Who | Location | Notes |
|------|-------|-----|----------|-------|
| 6:00 AM | Hair & makeup begins | Bride + bridesmaids | Bridal suite | |
| 10:00 AM | Florist arrives | Florist | Venue | Setup ceremony + reception |
| 11:00 AM | Photographer arrives | Photographer | Venue | Detail shots first |
| 12:00 PM | Getting-ready photos | Photographer + bridal party | Bridal suite | |

## Early Afternoon — Photos

| Time | Event | Who | Location | Notes |
|------|-------|-----|----------|-------|
| 1:00 PM | First look | Couple + photographer | [TBD] | |
| 1:30 PM | Wedding party photos | Full party + photographer | [TBD] | |
| 2:30 PM | Family photos | See shot list | [TBD] | |

## Pre-Ceremony

| Time | Event | Who | Location | Notes |
|------|-------|-----|----------|-------|
| 3:00 PM | DJ/band setup + sound check | DJ | Reception area | |
| 3:30 PM | Officiant arrives | Officiant | Ceremony area | Quick walkthrough |
| 3:45 PM | Ushers in position | Groomsmen | Entrance | Programs + seating guidance |

## Ceremony — 4:00 PM

| Time | Event | Notes |
|------|-------|-------|
| 4:00 PM | Guest arrival + seating | |
| 4:30 PM | Processional begins | [order TBD] |
| ~4:50 PM | Vows + ring exchange | |
| ~5:00 PM | First kiss + recessional | |

## Cocktail Hour — 5:00 PM

| Time | Event | Who | Notes |
|------|-------|-----|-------|
| 5:00 PM | Cocktail hour begins | Guests | Bar + passed apps |
| 5:00 PM | Couple photos | Couple + photographer | During cocktail hour |
| 5:45 PM | Room flip | Venue staff | Ceremony → reception |

## Reception — 6:30 PM

| Time | Event | Notes |
|------|-------|-------|
| 6:30 PM | Grand entrance | Announced by DJ |
| 6:35 PM | First dance | |
| 6:45 PM | Welcome toast | [who TBD] |
| 7:00 PM | Dinner service | |
| 7:45 PM | Toasts | MOH → Best Man → Parents |
| 8:15 PM | Parent dances | Bride/father → Groom/mother |
| 8:30 PM | Cake cutting | |
| 8:45 PM | Open dancing | |
| 10:30 PM | Bouquet toss | (if doing) |
| 10:45 PM | Last dance | |
| 11:00 PM | Send-off | Sparklers / exit |

## After — Breakdown

| Time | Event | Who |
|------|-------|-----|
| 11:00 PM | Guests depart | |
| 11:30 PM | Vendor breakdown | All vendors |
| 12:00 AM | Venue cleared | Venue staff confirms |
```

### 📸 Shot List

A checklist page for the photographer.

#### Template structure

```markdown
# Shot List — Veronica & Lucas

Share this with the photographer. Check off shots as they're captured.

---

## Detail Shots
- [ ] Rings (on surface, in box, on hand)
- [ ] Invitation suite
- [ ] Bride's shoes
- [ ] Groom's shoes / accessories
- [ ] Bouquet
- [ ] Boutonnière
- [ ] Dress hanging
- [ ] Venue exterior
- [ ] Ceremony arch / altar
- [ ] Table settings
- [ ] Place cards / menus
- [ ] Cake
- [ ] Guest book / Shenanigans station

## Getting Ready
- [ ] Bride getting into dress (with help from [who])
- [ ] Bride's reaction in mirror
- [ ] Bridesmaids seeing bride for first time
- [ ] Groom putting on jacket / cufflinks / tie
- [ ] Groomsmen together
- [ ] Parents' reactions

## First Look
- [ ] Groom waiting
- [ ] Bride approaching
- [ ] The reveal / turn
- [ ] Reaction
- [ ] Embrace
- [ ] Walking together

## Family Combos
- [ ] Bride + both parents
- [ ] Bride + mother
- [ ] Bride + father
- [ ] Groom + both parents
- [ ] Groom + mother
- [ ] Groom + father
- [ ] Bride + siblings
- [ ] Groom + siblings
- [ ] Both families together
- [ ] Grandparents (each side)
- [ ] Each set of parents alone
- [ ] Couple + bride's family
- [ ] Couple + groom's family

## Wedding Party
- [ ] Full wedding party
- [ ] Bridesmaids only (group)
- [ ] Bridesmaids (individual with bride)
- [ ] Groomsmen only (group)
- [ ] Groomsmen (individual with groom)
- [ ] Bride with groomsmen
- [ ] Groom with bridesmaids
- [ ] Fun / candid party shot

## Ceremony
- [ ] Wide shot of venue before guests
- [ ] Guests arriving / being seated
- [ ] Groom's reaction as bride enters
- [ ] Each processional entry
- [ ] Bride walking the aisle
- [ ] Officiant during ceremony
- [ ] Readings
- [ ] Ring exchange
- [ ] First kiss
- [ ] Recessional (couple)
- [ ] Guests cheering / reactions

## Reception
- [ ] Room before guests enter
- [ ] Grand entrance
- [ ] First dance (wide + close)
- [ ] Parent dances
- [ ] Toasts (speaker + couple's reaction)
- [ ] Cake cutting
- [ ] Bouquet toss (if doing)
- [ ] Dance floor candids
- [ ] Guest candids (table rounds)
- [ ] Band / DJ in action
- [ ] Send-off / exit

## Must-Capture Moments (couple-specific)
- [ ] [Add specific moments here]
- [ ] [Add specific moments here]
```

---

## 10. Lifecycle Guide

How the system activates over time. Each phase has different active databases and priorities.

### Phase 1: Foundation (12+ months out)

**Active databases:** Guest List, Vendors, Budget, Tasks
**Focus:** Build the guest list, research and book key vendors, set the budget

| Action | Database | What to do |
|--------|----------|------------|
| Add every potential guest | Guest List | Name, Side, Circle. Don't worry about addresses yet |
| Research vendors | Vendors | Add candidates, status = Researching |
| Set budget ceiling | Budget | Create line items per category with estimates |
| Seed milestone tasks | Tasks | Use milestone templates (§11) |

### Phase 2: Booking (9–12 months)

**Active databases:** Vendors, Budget, Tasks
**Focus:** Lock in vendors, pay deposits, finalize budget estimates

| Action | Database | What to do |
|--------|----------|------------|
| Book vendors | Vendors | Move status → Booked, fill in costs |
| Track deposits | Vendors + Budget | Record deposit amounts and due dates |
| Send save the dates | Guest List | Flip Invite Status → Save the Date Sent |

### Phase 3: Planning (6–9 months)

**Active databases:** All except Seating
**Focus:** Invitations, music curation, attire, honeymoon planning

| Action | Database | What to do |
|--------|----------|------------|
| Finalize guest list | Guest List | Cut list to venue capacity if needed (use Circle to prioritize) |
| Start music list | Music | Add ceremony songs, first dance, must-plays, do-not-plays |
| Order invitations | Tasks | Track with stationery vendor |
| Register for gifts | Tasks | Add registry URL to site |

### Phase 4: Invitations & RSVPs (3–6 months)

**Active databases:** Guest List, RSVP Responses, Tasks
**Focus:** Send invites, track responses, deploy the RSVP backend

| Action | Database | What to do |
|--------|----------|------------|
| Mail invitations | Guest List | Flip Invite Status → Invited |
| Deploy Cloudflare Worker | Tasks | RSVP form goes live on site |
| Match responses | RSVP Responses | Link each to Guest List record, update RSVP Status |
| Send reminders | Guest List | Use Awaiting RSVP view, flip to Reminder Sent |

### Phase 5: Final Prep (1–3 months)

**Active databases:** Seating, Music, Tasks
**Focus:** Seating chart, vendor confirmations, final counts

| Action | Database | What to do |
|--------|----------|------------|
| Build seating chart | Seating + Guest List | Create tables, assign guests via relation |
| Review guest requests | Shenanigans → Music | Promote song requests to Music db |
| Share DJ list | Music | Send "For DJ — Play" and "Do Not Play" views |
| Final headcount | Guest List | Headcount view → send to caterer |
| Final vendor confirms | Vendors | Call each, confirm arrival times |

### Phase 6: Week Of & Day Of

**Active pages:** Day-of Timeline, Shot List
**Active databases:** Tasks (Week Of / Day Of milestones)

| Action | Where | What to do |
|--------|-------|------------|
| Write day-of timeline | Day-of Timeline page | Fill in all vendor times, share link |
| Finalize shot list | Shot List page | Add couple-specific moments, share with photographer |
| Share dietary by table | Seating → Dietary by Table view | Send to caterer |
| Prepare vendor tips | Budget | Tips & Gratuity line items, envelopes |
| Enjoy the day | — | Everything is in Notion. Trust the system. |

### Phase 7: Post-Wedding

| Action | Database | What to do |
|--------|----------|------------|
| Track gifts | Guest List | Gift Received checkbox |
| Send thank-yous | Guest List | Thank You Sent checkbox, use Gift Tracking view |
| Rate vendors | Vendors | Fill in Rating stars |
| Close budget | Budget | Fill in all Actual costs, verify Payment Status |

---

## 11. Milestone Task Seeds

Pre-populated tasks for each wedding planning phase. Create these when building the Tasks database.

### 12+ Months

| Task | Category | Priority | Owner |
|------|----------|----------|-------|
| Set overall budget range | Other | Must Do | Both |
| Book venue | Venue | Must Do | Both |
| Start guest list draft | Other | Must Do | Both |
| Research photographers | Photography | Must Do | Both |
| Research caterers | Catering | Must Do | Both |
| Choose bridal party | Other | Must Do | Both |
| Research officiants | Officiant | Should Do | Both |
| Start wedding website | Website | Should Do | Dave |

### 9–12 Months

| Task | Category | Priority | Owner |
|------|----------|----------|-------|
| Book photographer | Photography | Must Do | Both |
| Book videographer | Videography | Should Do | Both |
| Book caterer | Catering | Must Do | Both |
| Book florist | Florist | Must Do | Both |
| Book DJ or band | DJ & Music | Must Do | Both |
| Shop for wedding dress | Attire | Must Do | Veronica |
| Send save the dates | Stationery | Must Do | Both |
| Book officiant | Officiant | Must Do | Both |

### 6–9 Months

| Task | Category | Priority | Owner |
|------|----------|----------|-------|
| Book hair & makeup | Hair & Makeup | Must Do | Veronica |
| Book transportation | Transportation | Should Do | Both |
| Order invitations | Stationery | Must Do | Both |
| Register for gifts | Other | Must Do | Both |
| Plan honeymoon | Honeymoon | Should Do | Both |
| Book hotel room block | Other | Must Do | Both |
| Finalize guest list | Other | Must Do | Both |
| First dress fitting | Attire | Must Do | Veronica |

### 3–6 Months

| Task | Category | Priority | Owner |
|------|----------|----------|-------|
| Send invitations | Stationery | Must Do | Both |
| Order wedding cake | Cake & Dessert | Must Do | Both |
| Rent suits / tuxes | Attire | Must Do | Lucas |
| Book rehearsal dinner venue | Venue | Must Do | Both |
| Plan ceremony readings | Other | Should Do | Both |
| Apply for marriage license | Legal & License | Must Do | Both |
| Deploy RSVP backend (Cloudflare Worker) | Website | Must Do | Dave |
| Add registry URL to website | Website | Must Do | Dave |

### 1–3 Months

| Task | Category | Priority | Owner |
|------|----------|----------|-------|
| Track RSVPs + send reminders | Other | Must Do | Both |
| Finalize seating chart | Other | Must Do | Both |
| Final dress fitting | Attire | Must Do | Veronica |
| Write vows | Other | Must Do | Both |
| Create day-of timeline | Other | Must Do | Both |
| Confirm all vendors (final details) | Other | Must Do | Both |
| Plan rehearsal dinner | Other | Must Do | Both |
| Finalize music list + share with DJ | DJ & Music | Must Do | Both |
| Order favors | Favors | Nice to Have | Both |

### 2–4 Weeks

| Task | Category | Priority | Owner |
|------|----------|----------|-------|
| Send final headcount to caterer | Catering | Must Do | Both |
| Confirm vendor arrival times | Other | Must Do | Both |
| Break in wedding shoes | Attire | Should Do | Veronica |
| Finalize shot list | Photography | Must Do | Both |
| Prepare vendor tips (envelopes) | Tips & Gratuity | Must Do | Both |
| Assign day-of point person | Other | Must Do | Both |
| Print programs / menus | Stationery | Should Do | Both |
| Prepare emergency kit | Other | Should Do | Veronica |

### Week Of

| Task | Category | Priority | Owner |
|------|----------|----------|-------|
| Final vendor confirmation calls | Other | Must Do | Both |
| Pack for honeymoon | Honeymoon | Must Do | Both |
| Assemble emergency kit | Other | Should Do | Veronica |
| Rehearsal + rehearsal dinner | Other | Must Do | Both |
| Delegate day-of responsibilities | Other | Must Do | Both |
| Pick up marriage license (if not done) | Legal & License | Must Do | Both |
| Charge all devices | Other | Should Do | Both |
| Relax | Other | Must Do | Both |

---

## 12. Build Order

Create the system in this sequence to avoid broken relations.

| Step | Action | Depends on |
|------|--------|------------|
| 1 | Create 👥 Guest List database (no relations yet) | — |
| 2 | Create 🏢 Vendors database (no relations yet) | — |
| 3 | Create 💰 Budget database + add Vendor relation | Step 2 |
| 4 | Add Budget Lines (reverse relation) to Vendors | Step 3 |
| 5 | Create 🪑 Seating Chart database | — |
| 6 | Add Table relation to Guest List → Seating | Steps 1, 5 |
| 7 | Add Guests (reverse relation) to Seating → Guest List | Step 6 |
| 8 | Add Guest Record relation to RSVP Responses → Guest List | Step 1 |
| 9 | Add RSVP Response relation to Guest List → RSVP Responses | Step 8 |
| 10 | Create 🎵 Music database | — |
| 11 | Create ✅ Tasks database (with self-relation Depends On) | — |
| 12 | Seed milestone tasks from templates (§11) | Step 11 |
| 13 | Add formulas to all databases (§7) | Steps 1–11 |
| 14 | Add rollups to Guest List + Seating (§7) | Steps 6–9, 13 |
| 15 | Create all views per database (§5) | Steps 1–14 |
| 16 | Create row templates per database (§6) | Steps 1–14 |
| 17 | Create 📋 Day-of Timeline page from template (§9) | — |
| 18 | Create 📸 Shot List page from template (§9) | — |
| 19 | Restructure hub page with dashboard layout (§8) | Steps 1–18 |
| 20 | Add inline linked database views to hub page | Step 19 |

**Estimated build time:** ~30–45 minutes following this sequence.

---

## 13. Maintenance & Conventions

### Naming conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Database names | Emoji + noun | 👥 Guest List |
| Property names | Title Case, no abbreviations | "Invite Status", not "inv_stat" |
| Select options | Title Case | "Bride's Family", not "brides family" |
| View names | Descriptive, short | "Awaiting RSVP", "Over Budget" |
| Task titles | Action-oriented imperative | "Book photographer", not "Photography" |
| Budget line items | "Category: detail" | "Catering: dinner service" |

### Weekly review checklist

- [ ] Check Tasks → Overdue view. Reassign or reschedule anything slipping.
- [ ] Check Vendors → Overdue Payments. Pay or renegotiate.
- [ ] Check RSVP Responses → Unlinked. Match new responses to Guest List.
- [ ] Update Budget actuals as invoices come in.
- [ ] Move completed tasks to Done.

### When to update this document

- When a new database or relation is added
- When shared taxonomy options change
- When formula logic changes
- When the hub page layout is restructured

---

## Appendix: Existing Infrastructure

These components already exist and are production-ready.

| Component | Location | Status |
|-----------|----------|--------|
| Wedding site | [veronicaandlucas.com](https://veronicaandlucas.com) | Live |
| GitHub repo | `DaveHomeAssist/VeronicaLucasWedding` | Active |
| RSVP Responses DB | Notion (existing) | Schema matches worker |
| Shenanigans DB | Notion (existing) | Schema matches worker |
| Cloudflare Worker code | `worker/src/index.js` | Ready, not deployed |
| Worker config | `worker/wrangler.toml` | Configured |
| Wedding Info Needed | Notion page | Updated 2026-04-06 |
| Site Backend page | Notion page | Updated 2026-04-06 |

### Worker deployment (quick reference)

```bash
cd worker
npx wrangler secret put NOTION_API_KEY   # paste Notion integration token
npx wrangler deploy                       # deploys to Cloudflare
# Copy the URL → update API_BASE in index.html line 1531
```
