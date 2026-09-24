# innoscripta — news aggregator

A React + TypeScript SPA that aggregates **The Guardian**, **NYT Article Search**
and **NewsAPI.org** into one searchable, filterable, personalisable feed.
Frontend only, containerised.

> Status: phase 2 of 7 (core model + merge). The routes still render placeholders;
> the adapters, query layer and UI land in the following phases.

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

## Cut from scope

Deliberately not built, to keep the 3-day scope honest: auth/accounts, server-side
preference persistence, i18n, infinite scroll (an explicit **Load More** instead),
article detail pages (none of these APIs reliably return full body text, so cards
link out), SSR, E2E/Playwright, a11y beyond keyboard + labels, PWA/offline.

## Tech

Vite · React · TypeScript · React Query · Zustand + localStorage · Vitest + RTL + MSW ·
Docker multi-stage → nginx.
