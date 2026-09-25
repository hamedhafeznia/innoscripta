# innoscripta — news aggregator

A React + TypeScript SPA that aggregates **The Guardian**, **NYT Article Search**
and **NewsAPI.org** into one searchable, filterable, personalisable feed.
Frontend only, containerised.

> Status: phase 5 of 7 (feed). Both routes are live; polish and review remain.

## Run it

```bash
cp .env.example .env    # add your three API keys
docker compose up --build
```

Then open <http://localhost:8080>.

**The image builds without any keys.** They are runtime environment variables:
nginx reads them when the container starts and injects them into upstream
requests. Rebuilding is never needed to change a key, and no key is ever present
in the JavaScript bundle.

### Local development

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
npm test
npm run build
```

Vite's `server.proxy` mirrors the exact same `/api/*` paths that nginx serves, and
the keys are read from `.env` **without** a `VITE_` prefix — the prefix is precisely
what would inline them into the bundle. As a result the application code is
byte-identical in dev and in Docker; it never knows which one it is running under.

## Why there is an nginx proxy

Two reasons, both non-optional:

1. **Keys must never reach the browser bundle.** The browser only ever calls
   same-origin `/api/guardian/*`, `/api/nyt/*`, `/api/newsapi/*`; nginx adds the key
   server-side via the nginx image's built-in `/etc/nginx/templates` + `envsubst`.
2. **NewsAPI's free plan is CORS-restricted to `localhost`** and its terms forbid
   staging/production use, so browser-direct calls break on any reviewer machine
   that is not serving from localhost.

This is still a frontend-only project: nginx already serves the bundle. There is no
app server, no backend code and no second container.

Responses are cached by nginx for 5 minutes (NewsAPI) and 2 minutes (Guardian, NYT).
**Only `200` responses are cached**, so a rate-limit error is never served from cache.
NewsAPI is 24h-delayed anyway, so its cache costs zero freshness — and it buys real
headroom against a free-plan budget of **100 requests/day**.

## Filters live in the URL

`/search` keeps every filter in the query string — `?q=&from=&to=&cat=a,b&src=x,y` —
so a search is shareable and survives the back button. One zod schema parses it, and it
**treats the URL as untrusted input**: unknown categories, unknown providers, malformed
dates and unknown parameters are dropped, never thrown on. A mangled URL renders an
unfiltered page rather than a blank screen.

`src` selects **providers** — which of the three APIs we ask — not publishers. A card
shows the publisher where the source gives us one ("The Irish Times") and the provider
it came through underneath ("via NewsAPI").

Typing is debounced by 350 ms before it reaches the URL or the network. At three
sources a keystroke would otherwise cost three requests.

Paging is an explicit **Load More**, not infinite scroll, for the same reason.
Because the cursor carries whole articles it is not URL-serializable and lives in the
React Query cache only, so **a reload returns to page 1**. Carrying it in the URL would
mean refetching the truncated tail on every reload, which the 100/day budget cannot pay
for.

## Two routes, one engine

`/search` parses filters out of the URL. `/feed` takes **no URL parameters at all**: it
reads stored preferences, derives the same `Filters` object, and hands it to the same
hook. A **Refine in search** button opens `/search` pre-filled with those filters.

The split between the two is about what the thing *is*:

- **Categories and providers are predicates on a query.** They narrow a result set, they
  are AND-ed together, and they belong in a URL you can share. They live in `/search`'s
  query string, and `/feed` keeps its own copy as a preference.
- **Followed authors are a property of the reader.** They are OR-ed with each other and
  additive — each one widens the feed — and they are meaningless in someone else's
  browser. They live in Zustand, persisted to `localStorage`, and never in the URL.

A **Follow** button sits on every card. Where that filter then runs depends on what the
source can do, and the feed says so on the page:

- The Guardian can filter server-side, by the contributor tag (`profile/<slug>`) the
  adapter keeps on each article. It only does so when *every* followed author has such a
  tag — a partial list would return those authors' articles and silently lose the rest,
  and since follows are additive, that is a wrong answer rather than a narrower one. One
  name-only follow moves the whole set to client-side matching.
- NYT and NewsAPI publish a byline string and no author identifier, so they are always
  matched on this device after fetching.

Client-side matching never silently empties a page: the query layer refetches up to
twice more before reporting that there are no further matches.

## Merging three sources into one list

The three APIs page independently and reach back to different dates, so a naive
concatenation puts an incomplete tail at the bottom of the list: the next page of a
shallower source can hold an article that belonged higher up.

`src/core/merge.ts` is one pure function. It dedupes the carried buffer plus the newly
fetched pages by normalised URL, sorts by publication date, and then **cuts the list at
the most recent of the live sources' oldest items**. Above that floor the ordering is
complete from every source; everything below it is carried on the cursor and emitted
once a later page lowers the floor. Exhausted and failed sources are excluded from the
floor — neither can contribute anything further, so neither should hold articles back.

Carried articles are never refetched: NewsAPI's free plan allows 100 requests a day in
total, which a refetch-on-scroll design would burn through in minutes.

Adding a source is **one new adapter file and one registry line**. No UI and no
query-layer change: each adapter declares its own capabilities and its own
unserviceable filter combinations, and the rest of the app reads that descriptor
rather than checking source ids.

## Known API limitations

Each adapter declares what it can and cannot do, and the UI shows the reason in a
per-source notice rather than silently returning a short list.

- **NewsAPI needs `/top-headlines` for a category and `/everything` for dates**, and
  neither endpoint does both. A search combining the two excludes NewsAPI and says so.
  It also has no politics category, and one request carries one category. A category
  search returns *recent headlines only*: `/top-headlines` has no sort or date options.
- **NewsAPI cannot filter by author at all**, so that filtering happens client-side.
- **NYT's `fq` parameter returns zero hits** for every query we could construct,
  including the examples in NYT's own documentation (`hits: 0, docs: null`). Sending one
  would silently drop NYT out of any category- or author-filtered search, so the adapter
  does not send it and filters those two facets client-side instead.
- **NewsAPI's free plan allows 100 requests a day in total** and its articles are
  delayed 24 hours with a one-month lookback.

## Cut from scope

Deliberately not built, to keep the 3-day scope honest: auth/accounts, server-side
preference persistence, i18n, infinite scroll (an explicit **Load More** instead),
article detail pages (none of these APIs reliably return full body text, so cards
link out), SSR, E2E/Playwright, a11y beyond keyboard + labels, PWA/offline.

## Tech

Vite · React · TypeScript · React Query · Zustand + localStorage · Vitest + RTL + MSW ·
Docker multi-stage → nginx.
