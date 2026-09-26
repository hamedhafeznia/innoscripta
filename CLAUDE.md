# innoscripta: news aggregator (frontend take-home)

React + TypeScript SPA that aggregates articles from three news APIs into one
searchable, filterable, personalizable feed. Frontend only. Containerized.

**Deadline: 3 days.** See "Build order": if behind at end of day 2, cut
`/feed` to saved filters with no author-follow. Do not cut error/empty states.

---

## Stack

Vite · React · TypeScript · React Query (fetching/cache) · Zustand + localStorage
(preferences) · **Tailwind CSS v4 + shadcn/ui** (styling) · Vitest + RTL + MSW (tests) ·
Docker multi-stage → nginx.

## Sources

The Guardian Content API · NYT Article Search v2 · NewsAPI.org.

### Hard constraints (verified, do not re-litigate)

| | Guardian | NYT | NewsAPI.org |
|---|---|---|---|
| Rate limit (free) | 1/sec, 500/day | ~5–10/min, 500–4000/day | **100/day total** |
| Page size | max 50 | **fixed 10**, no param | max 100 |
| Result cap | ~few thousand | **1000 (100 pages)**, `page` 0-indexed | **100** |
| Dates | `from-date`/`to-date` `YYYY-MM-DD` | `begin_date`/`end_date` `YYYYMMDD` | `from`/`to` ISO, `/everything` only |
| Category | `section` / `tag` | `fq=section_name:` / `news_desk:` | `category`, **`/top-headlines` only** |
| Author filter | ✅ `tag=profile/<slug>` | ✅ `fq=byline.original:(...)` | ❌ display-only |
| Image | needs `show-fields=thumbnail` | `multimedia`, **relative URLs** → prefix `https://static01.nyt.com/` | `urlToImage` default |
| Key | query param only | query param only | query param or `X-Api-Key` |

- **Unified page size is 10** (NYT's fixed floor). 3 sources × 10 = 30 per fan-out.
- **NewsAPI free plan is CORS-restricted to localhost** and its ToS forbids
  staging/production use. This is why we proxy (below), and it is not optional.
- NewsAPI articles are 24h-delayed with a 1-month lookback window.

---

## Architecture

### Adapters

`NewsSource` interface: `search(params) => Promise<{ articles, cursor }>` plus a
**capability descriptor** declaring which facets the source supports and which
filter combinations are unserviceable.

- Three implementations, one registry. **Adding a source = one new adapter file
  + one registry line, no UI or query-layer changes.** Say exactly this in the README.
- **Mapping tables live inside each adapter, never in a shared `categoryMap.ts`.**
  A central map looks DRY but breaks single-responsibility: a 4th source would
  force edits to a shared file.
- Mapping is **two-way**: canonical → source query params, and source → canonical.
- Adapters normalize author names (strip leading `"By "` etc.).
- Resist every other abstraction. No DI container, no factory-factories. KISS is
  on the brief too and is the one people fail.

### Category taxonomy

Canonical enum (~7: business, technology, sports, science, health, politics,
entertainment; unmapped → general) used for **filtering**. The source's native
value is preserved on `Article.sourceCategory` for **display**.

### NewsAPI endpoint routing

`/top-headlines` accepts `q` **together with** `category` (verified). Exclusions
are only `category`↔`sources` and `country`↔`sources`; we never send `sources`.

- category (with or without keyword) → `/top-headlines`
- keyword and/or dates, no category → `/everything`
- **category + dates → unserviceable**, source excluded with a reason string

`/everything` responses carry no category field, so client-side category
filtering for NewsAPI is *impossible*. Never mix unfiltered NewsAPI results into
a category-filtered list. Notice copy for keyword+category: **"NewsAPI: recent
headlines only"** (`/top-headlines` has no `sortBy` and no dates).

### Merge (one pure function, built test-first)

Fan out page N to all live sources in parallel, `Promise.allSettled`.

1. input = **carried buffer + newly fetched pages** (the buffer is never emitted directly)
2. **dedupe** by normalized URL, across sources and pages
3. **sort** by `publishedAt` desc
4. **cut** at the **most recent** of the live sources' last-item timestamps.
   Exhausted and failed sources are excluded from the cut-point.
   (Above that floor the ordering is complete from every live source; below it
   another source could still supply an article that belongs higher.)
5. remainder → buffer on the cursor

**URL normalization for dedupe:** lowercase host, strip `www.`, force `https`,
drop query string and fragment, strip trailing slash. Keep the original URL on
the `Article` for the outbound link; dedupe on the normalized copy only.
**Collision:** keep the article with more populated fields (image, author,
description); tie-break by registry order. (`allSettled` preserves input order
anyway: the explicit rule keeps the merge visibly deterministic.)

Tests required for: ragged-tail cut, dedupe across sources, dedupe across pages,
buffer carry, exhaustion, single-source failure.

### Date ranges walk day by day

A range spanning more than one day is read **one day at a time**: the cursor holds the day
being read, each fan-out asks every source for that single day, and Load more steps to the
day before rather than deeper into the current one.

This is arithmetic, not taste. A busy day carries ~200 articles *per source*, so at 10 per
source per page a ten-day range needs hundreds of Load mores to reach its second day.
The filter works but the range is unreachable, which reads as a broken filter.

- Both bounds are required; a single-day range pages into that day normally.
- A walked day is emitted whole: `exhausted` is literally true (the day is not asked for
  again), and every article of the next day is older than every article of this one, so
  the ragged-tail cut has nothing to protect.
- A new day resets every source to page 1.
- Cost: one request per source per day. A ten-day range is ~10% of NewsAPI's daily budget.

### Cursor

```ts
{ perSource: Record<SourceId, { nextPage; exhausted; oldestSeen }>, buffer: Article[] }
```

Truncated items are carried, never refetched: the 100/day budget can't afford it.
Consequences, both documented: the cursor is **not URL-serializable** (React Query
cache only), and **reload returns to page 1**.

### Failure handling

One source failing never fails the page. Render what returned; show a dismissible
per-source notice. Unserviceable-filter exclusions and NewsAPI `rateLimited`
errors use the same notice slot. A reviewer *will* kill a key to see what happens.

---

## Routes & state

- **`/search`**: filters in the URL: `?q=&from=&to=&cat=a,b&src=x,y`
- **`/feed`**: takes **no URL params**; reads preferences, derives the same
  filter object, hands it to the same hook. A **"Refine"** button opens `/search`
  pre-filled with the preference-derived filters.
- One engine, two routes. One shared **zod** URL-schema module both routes import.
  **Treat the URL as untrusted:** drop unknown/malformed values, never throw.

### Filters vs. follows

- `src` selects **providers** (which adapters run), not publishers. Cards display
  the publisher name where available (e.g. NewsAPI `source.name`). README says so.
- **sources + categories: AND.** Predicates on a query → live in the URL.
- **authors: OR among themselves, narrowing the feed**: a "Follow author" button on
  `/search` cards (not on `/feed`, which lists follows and lets you unfollow them), not another filter on the URL. Following a second author adds theirs to the
  first's, but the set as a whole is AND-ed with the chosen providers and categories: the
  feed shows followed authors' articles *within* them. Nothing chosen means only followed
  authors' articles. A property of the user → lives in Zustand/localStorage, not the URL.
  When that leaves nothing, the empty state says it is because of the followed authors.
- Author filtering is **server-side on Guardian and NYT, client-side on NewsAPI**,
  and the UI states which. A client-side author filter must never silently empty a
  page: auto-fetch the next page, **capped at 2–3 extra pages**, then show a clear
  "no more matches".

---

## Proxy & Docker

Keys must never reach the bundle, and NewsAPI's localhost-only CORS makes
browser-direct calls break on the reviewer's machine.

- Browser calls **same-origin `/api/guardian/*`, `/api/nyt/*`, `/api/newsapi/*`**.
- nginx `proxy_pass` injects keys server-side via the nginx image's built-in
  `/etc/nginx/templates` + `envsubst`.
- **Vite `server.proxy` mirrors the same `/api/*` paths in dev**, keys in `.env`
  **without** the `VITE_` prefix → app code is byte-identical in dev and Docker.
- Keys are **runtime** env vars, not build-time: the image builds with no keys at all.
- `docker compose` + `env_file` + `.env.example` → reviewer runs it with one command.
- nginx SPA fallback for client-side routing.
- `proxy_cache`: **5 min NewsAPI, 2 min Guardian/NYT. Cache 200 responses only**,
  so rate-limit errors are never served from cache. Default cache key is fine:
  the API key is added upstream only. (NewsAPI is 24h-delayed anyway; a 5-minute
  cache costs zero freshness.)

Still frontend-only: nginx already serves the bundle; no app server, no backend
code, no extra container.

### React Query

`staleTime: 5min`, **`refetchOnWindowFocus: false`** (comment the line: focus
refetch is the specific thing that silently drains 100 req/day), `retry: 1`.
Search input debounced **~350 ms**.

---

## Testing

MSW fixtures from **one real saved response per API** (captured early day 2, not
hand-written). Adapter mapping tests. The merge function tested pure and thoroughly.
Two or three RTL tests on flows that matter (search updates URL, preferences
persist and drive the feed). **Not 80% coverage**: a reviewer reads test *names*
to see if you know what's worth testing.

---

## Styling

Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config.js`; theme lives in CSS).

**The voice is a serif/sans split**, self-hosted via fontsource so the container needs no
network: **Newsreader** (variable, optical-size axis) for headlines, page titles, the
wordmark and bylines; **Inter** for controls and body. `--font-serif` / `--font-sans` are
tokens like any other. Dates and counts use `tabular-nums`.
shadcn/ui components are **vendored into `src/components/ui/`**; they are our source,
not a dependency, and may be edited.

- **The design tokens are the contract.** The `--bg / --surface / --text / --text-muted /
  --border / --brand / --radius` set defined in `src/styles.css` is authoritative; the
  shadcn variable names (`--background`, `--foreground`, `--muted-foreground`, `--primary`,
  `--card`, …) are mapped onto it. Change a colour in one place only.
- The brand colour is **`--brand`, not `--accent`**: shadcn uses `--accent` for a subtle
  hover background, and two meanings under one name is how a palette rots.
- Tokens are declared for both light and `.dark`, which makes phase 6's dark mode a
  toggle rather than a rewrite.
- **Add only the components actually used.** Button, Input, Badge, Card, Skeleton, Alert,
  Sheet, Popover, Calendar, Checkbox, Select. No component gets vendored "for later".
- **Tests must not assert on class names.** They assert roles, labels and text, so a
  restyle cannot break them. If a migration forces a test change, the test was
  testing the wrong thing; fix the test's premise, don't loosen the assertion.
- Semantics are not negotiable for styling's sake: a `<fieldset>`/`<legend>` group, a
  `role="status"`, an `aria-pressed` toggle and a visible focus ring all survive the
  migration or the migration is wrong.

## Structure

Feature folders: `features/search/`, `features/feed/`, `features/preferences/`,
`sources/` (adapters + registry), `core/` (Article type, merge, url schema),
`components/ui/` (vendored shadcn primitives), `lib/` (`cn` and friends).

---

## Scope

**In, explicitly:** loading skeletons, empty states, error states, polished mobile
layout, keyboard + labels a11y.

**Cut (say so in README):** auth/accounts, server-side preference persistence,
i18n, infinite scroll (explicit **Load More** instead), **article detail pages**
(link out: none of these APIs reliably return full body text), SSR,
E2E/Playwright, a11y beyond keyboard + labels, PWA/offline.

**Stretch, only if day 3 ends early:** dark mode (cheap once tokens exist).

---

## Build order (phases, finish, verify and commit each before the next)

1. **Scaffold + Docker**, Vite app; multi-stage Dockerfile + nginx (SPA fallback,\
   `/api/*` proxy_pass, templates/envsubst, proxy_cache 200 only); compose + `.env.example`;\
   Vite `server.proxy` mirroring the same paths. Docker must keep working after every phase.
2. **Core**: `Article` type, `NewsSource` interface + capability descriptor,\
   merge function test-first (ragged-tail cut, dedupe, exhaustion, buffer).
3. **Adapters**: capture one real response per API as MSW fixtures; three adapters with tests.
4. **Search**: query layer; `/search` with URL schema + filters; debounced search; Load More.
5. **Feed**: preferences, `/feed`, Follow author.
5.5. **Styling migration**: Tailwind v4 + shadcn/ui; map the existing tokens onto\
   shadcn's variables; migrate component by component, tests green after each; delete the\
   hand-written CSS at the end; Docker must still build.
6. **Polish**: skeletons / empty / error states; mobile pass; a11y pass; dark mode only if time remains.
7. **Review**: `/code-review`, `/make-interfaces-feel-better`, README final check.

Update the README incrementally as decisions land.\
If running behind: cut Follow author first. Never cut error/empty states.

---

## README must cover

Docker run instructions (one command) · that the image builds without keys ·
`.env.example` · `src` = provider, not publisher · adding a source = one adapter
file + one registry line · why the nginx proxy exists (keys + NewsAPI CORS) ·
NewsAPI category/date limitation · reload returns to page 1 · the cut list.
