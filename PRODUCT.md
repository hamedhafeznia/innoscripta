# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: a person who follows specific topics and writers across several publications.**
They currently get that by visiting three or four news sites in turn, and they want one
feed instead. They arrive either with something specific to look up (a keyword, a date
range, a subject) or with nothing in particular, wanting their own topics waiting for them.

No demographic, market or usage-frequency claim has been established. Future work must not
invent one.

**Secondary: an engineering reviewer evaluating this as a technical assessment.** Confirmed
as real but explicitly *not* the audience the design serves: they judge it by how
convincing and usable it is as a product. Design decisions are made for the reader, and the
engineering shows through behaviour rather than through exposed machinery.

## Product Purpose

Aggregate The Guardian, the New York Times and NewsAPI.org into a single searchable,
filterable, personalisable news feed, in the browser only.

Success is that a reader gets one coherent, correctly ordered list out of three sources
that disagree with each other, can narrow it by keyword, date, category and provider, and
can make a feed that is theirs and persists.

## Positioning

The three sources disagree about nearly everything operational: page size, how deep results
go, how dates are expressed, what a category is, whether an author can be filtered at all.
The distinguishing mechanism is that the product **reconciles those differences and then
tells the reader the truth about the ones it cannot reconcile** — which source was left out
of a search and why, which source answered a narrower question than was asked, which source
is being filtered after the fact. The easy version of this product silently shows a shorter
list. This one says what happened.

## Operating Context

- **Two ways in.** `/search` holds every filter in the URL, so a search is shareable and
  survives the back button. `/feed` takes no URL parameters at all and builds itself from
  stored preferences; a "Refine in search" control moves from one to the other.
- **Paging is explicit.** A "Load more" control, never infinite scroll, because each page
  costs real requests against metered APIs.
- **Reading happens elsewhere.** Every article links out to its publisher. None of the three
  APIs reliably returns full body text, so the product does not pretend to host articles.
- **Evaluation scene.** A reviewer clones the repository, copies `.env.example`, and runs
  one `docker compose up --build`. API keys are runtime environment variables injected by
  nginx; the image builds without them and no key reaches the browser bundle.
- **Metered usage.** NewsAPI's free plan allows 100 requests per day in total across the
  whole application, and its articles are delayed 24 hours with a one-month lookback. This
  is a hard shape on the product, not a detail: it is why typing is debounced, why window
  focus does not refetch, why paging is a deliberate button, and why the truncated tail of a
  merged page is carried in memory rather than refetched.

## Capabilities and Constraints

Confirmed functionality: keyword search; date range; category filter; provider filter;
merged and deduplicated results ordered newest-first; per-source notices; followed authors
that persist; loading, empty and error states; light, dark and follow-the-system themes.

**Terminology, which the interface must keep straight:** a **provider** is one of the three
APIs we query. A **publisher** is who actually wrote the article — "The Irish Times" arriving
through NewsAPI. The provider filter selects providers, never publishers.

Durable technical constraints:

- Frontend only. nginx serves the bundle and proxies the three APIs; there is no
  application server and no backend code.
- Unified page size is 10, because NYT's Article Search returns a fixed 10 and has no
  page-size parameter.
- A reload returns to page 1. The paging cursor carries whole articles so that a truncated
  tail is never refetched, which makes it non-serialisable into the URL.
- NewsAPI cannot combine a category with a date range (different endpoints), has no politics
  category, and cannot filter by author at all.
- NYT's `fq` parameter returns zero hits for every query, including the examples in NYT's
  own documentation, so category and author filtering for NYT happens client-side.
- No authentication, no server-side preference storage, no article detail pages, no SSR.

**Out of scope by decision, not oversight:** accounts, i18n, infinite scroll, PWA/offline,
end-to-end tests.

## Brand Commitments

The application is named **take-home news**, which says what it is: a take-home assignment for
innoscripta. The company's own name is not used as the product's brand.
There is no logo, palette, typeface or identity asset to match, and the real company's
actual identity must not be invented, approximated or imitated. The visual world is an
open decision.

## Evidence on Hand

- **Real captured API responses**, one per provider, saved as test fixtures:
  `src/test/fixtures/{guardian,nyt,newsapi}.search.json`. These are what the APIs actually
  returned, not hand-written samples, and the mapping tests are pinned to them.
- **Working API keys** in a local `.env` (untracked). All three providers verified reachable
  through both the dev proxy and the built container.
- **A verified container**: image builds without keys, SPA fallback works, all three proxy
  routes return 200 with keys injected server-side, and no key appears in the served bundle.
- **The requirements record** is `CLAUDE.md`. It is a synthesis of settled decisions written
  during the build, not a client document — no official brief or rubric from innoscripta
  exists in this repository.
- **No testimonials, customers, usage data, benchmarks or press exist.** Nothing of the kind
  may be fabricated for any surface.

## Product Principles

1. **Say what happened.** A narrower answer is never presented as a complete one. If a
   source was excluded, failed, or answered a different question, the reader is told which
   and why, in plain language.
2. **One source failing never fails the page.** Render what returned.
3. **Requests are scarce.** Anything that spends them is deliberate, visible and initiated
   by the reader.
4. **Filters are shareable; follows are personal.** A predicate on a query belongs in the
   URL. A property of the reader belongs on their device and never in a link.
5. **Adding a provider must not touch the interface.** Each source declares its own
   capabilities; the rest of the product reads that declaration instead of knowing names.

## Accessibility & Inclusion

Established requirement: full keyboard operation and correctly labelled controls — visible
focus on everything focusable, real form semantics, live regions for results and loading,
and `prefers-reduced-motion` honoured. Deliberately not claimed: a full WCAG conformance
target, screen-reader certification, or audits beyond keyboard and labels.
