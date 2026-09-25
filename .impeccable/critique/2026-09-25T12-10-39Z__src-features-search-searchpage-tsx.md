---
target: /search
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:/Users/hamedhafeznia/.superset/worktrees/ecc694df-dfa6-4abc-9d72-1e1bc3e9196c/internal-wish/src/features/search/SearchPage.tsx"
target_fingerprint: "sha256:4b66a6c7d4d4c85d12c89f3541526584de19eea5a833ab334dbd80c20d230373"
target_path: /Users/hamedhafeznia/.superset/worktrees/ecc694df-dfa6-4abc-9d72-1e1bc3e9196c/internal-wish/src/features/search/SearchPage.tsx
timestamp: 2026-09-25T12-10-39Z
slug: src-features-search-searchpage-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence)

Mode: Operate. Target: `src/features/search/SearchPage.tsx` (`/search`).
Inspected live across desktop (1280) and 375px emulation, in light and dark, over 10 states.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | "15 articles" is a page count rendered as a total; nothing says which providers answered. |
| 2 | Match System / Real World | 2 | "Rejected the API key", "Responded with an error (400)", "Providers" — engineering vocabulary on a reader's screen. |
| 3 | User Control and Freedom | 2 | No retry after a provider fails; no per-filter removal; notice dismissal irreversible. |
| 4 | Consistency and Standards | 3 | Card category Badge is a pixel-cousin of the interactive filter chip but inert. |
| 5 | Error Prevention | 1 | The front door greets every first-time visitor with a red UNAVAILABLE banner. |
| 6 | Recognition Rather Than Recall | 2 | At 375px the whole filter state, keyword included, collapses to "Filters (1)". |
| 7 | Flexibility and Efficiency | 2 | No date presets, no sort, month-by-month calendar stepping. |
| 8 | Aesthetic and Minimalist Design | 2 | Empty 16:9 voids dominate the default view; every Guardian card prints "The Guardian" twice. |
| 9 | Error Recovery | 1 | Worst area: the all-down state asserted a falsehood and offered a useless action. |
| 10 | Help and Documentation | 2 | Nothing explains provider vs publisher, or why a card says "Football" when the filter says "Sports". |
| **Total** | | **19/40** | **Below average — structurally sound, communicatively weak** |

## Design Specificity Verdict

**Category-interchangeable.** Strip the three provider names and this is a default shadcn
search screen: h1 + bordered grey filter card + alert stack + 3-up card grid. `--brand`
is literally Tailwind blue-700. One radius everywhere, system font stack, no typographic
voice, no density decision.

Product character exists in exactly two places: the three-kind notice taxonomy, and the
`unserviceable` reason strings that name a real mechanism. The damning detail: the
product's stated distinguishing mechanism — telling the reader the truth about what it
cannot reconcile — was expressed as a grey dismissible bar in the lowest-attention band
on the page, in a machine voice. The one thing that should carry the brand was designed
most cheaply.

**Deterministic scan**: `impeccable detect` over 40 files returned **0 findings** (exit 0).
Validated rather than trusted: a synthetic TSX probe correctly produced `gradient-text` at
the right file and line, so TSX is genuinely parsed and the clean result is real. No hits
in vendored `src/components/ui/`, so no false positives to separate.

**Browser overlay** (4 views, injection succeeded): one rule fired —
`skipped-heading: <h1> "Search" followed by <h3>` — on **every view that returned results**.
The two "clean" views were clean only because they rendered zero cards.

## What's Working

1. **The three-kind notice taxonomy is genuinely well-modelled** — excluded / caveat / error
   with distinct icons and `role="alert"` reserved for real failures while caveats get a
   polite `role="status"`. Most products ship one grey "some results may be missing" string.
2. **The mobile Sheet reuses the exact same FilterBar**, mounted only while open, so controls
   are never duplicated in the accessibility tree — the usual bug class in responsive filters
   is avoided entirely.
3. **Load more over infinite scroll, and the line that closes the list**: "That is everything
   these sources have for this search." A scarce resource spent only on an explicit human
   decision — a constraint turned into a design principle rather than hidden.

## Priority Issues

### [P0] The all-sources-down state told the reader a falsehood — FIXED
Rendered "No more matches in the pages we checked. Load more to keep looking." with Load
more enabled, above three identical stacked failure bars. Nothing had been checked, and
loading more would fail identically while spending a metered budget.
**Fix applied**: `unreachable` is now derived in the query layer; the page shows one
consolidated notice, an honest explanation and a **Try again** button, and suppresses Load
more. The fan-out also no longer burns its retry budget re-attempting a total failure.

### [P0] The default landing page was a red error banner and three empty grey boxes — FIXED
Half the audience "arrives with nothing in particular", and their first screen was
UNAVAILABLE NewsAPI (400) above three 16:9 voids, because NewsAPI `/everything` rejects a
keyword-less query and image-less results still reserved a full placeholder.
**Fix applied**: a keyword-less search routes NewsAPI to `/top-headlines?category=general`
(the honest answer to "no question asked"), HTTP status codes never reach the reader, and
a card with no image starts at its text instead of a void.

### [P1] Notice copy says the same thing three times, in an engineer's voice — PARTLY FIXED
"LEFT OUT · NewsAPI · NewsAPI cannot combine a category with a date range, so it was left
out." — twelve words carrying four words of information, naming a constraint without
offering the escape.
**Fix applied**: identical notices across sources collapse into one line; the kind label is
gone; messages read as sentence fragments continuing the source name.
**Still open**: no inline escape action (`[Search without dates]`).
Suggested command: `/impeccable clarify`

### [P1] Every card prints its publisher twice — OPEN
Ten of ten cards read "The Guardian" in the meta row and "via The Guardian" in the footer.
The provider/publisher distinction the product is built to preserve is invisible exactly
where it is redundant, and absent where it would teach. Render `via {provider}` only when
it differs from the publisher, and it becomes signal instead of furniture.
Suggested command: `/impeccable distill`

### [P2] At 375px the reader cannot see what they searched for — OPEN
The keyword collapses behind "Filters (1)". Roughly 1.5 cards fit per screen. Non-broken,
but not comfortable. Keep the keyword input always visible; put only dates and chips behind
the sheet; show active filters as removable chips.
Suggested command: `/impeccable adapt`

### [P2] Keyboard users traverse 19 tab stops to reach the news — PARTLY FIXED
"Skip to content" targets the top of the *filter panel*, skipping four stops and landing the
reader back at the start of the other fifteen. Heading structure was h1 → h3 with no h2.
**Fix applied**: card titles are now h2, closing the detector's only finding.
**Still open**: a "Skip to results" link and a heading on the results region.
Suggested command: `/impeccable audit`

## Persona Red Flags

**The commuter skimmer**: every card shows the same date string — the time is dropped, so in
a list sorted newest-first every item reads "Sep 25, 2026" and the ordering signal is
literally invisible. The 211px photo is the largest element and carries no scanning value.

**The keyboard / magnifier reader**: 19 tab stops before the first headline; checked chips
use the same blue as the focus ring, so at magnification "focused" and "checked" are hard to
tell apart; `Follow Alexandra Topping Political correspondent` is a 39-character button label.

**The trust-checking reader**: cannot tell from "Rejected the API key" whether the product or
the news source is broken; after dismissing a notice there is no persistent trace that a
source is missing, so a later glance sees a complete-looking list that isn't.

**The topic-and-writer follower (PRODUCT.md primary)**: an eight-name byline yields "Follow
Andrew Ross Sorkin" and silently discards the other seven; Guardian bylines arrive with job
titles attached; "Guardian staff" is offered as a followable person.

**The engineering reviewer (explicitly NOT the audience)**: red flag in the opposite
direction — the surface currently serves them better than the reader. "Providers", "via
NewsAPI", HTTP codes and "the pages we checked" read as competence to an engineer and as
noise to a reader.

## Minor Observations

- `countActiveFilters` counts the keyword as a filter, so searching "climate" shows "Filters (1)".
- The bottom sheet's only dismissal control is the × at its top corner, furthest from the thumb.
- The skeleton omits the meta row and footer the real card has, so content shifts on arrival.
- `article.description` is unbounded, so card heights vary by ~120px within a row.
- Dark mode is correctly tokenised, but `--surface` against `--bg` gives the filter panel
  very little separation; panel and page read as one flat field.
- Contrast passes everywhere measured: 6.13:1, 5.72:1, 6.28:1. No horizontal overflow at 375px.
- `prefers-reduced-motion` is honoured globally — rare, and right.

## Questions to Consider

1. What if the filters weren't on the page at all until asked for? At 375px you already made
   that call and the result is calmer. What justifies 14 controls permanently above the news?
2. What if the notice slot were the most beautiful thing in the product instead of the greyest?
   What would "2 of 3 sources answered" look like as a confident permanent status line rather
   than a dismissible apology?
3. Is "Search" the right frame for a page half the audience arrives at with nothing to search
   for? What if the default were "Latest across your sources", and searching were something
   you do *to* it?
4. In a list sorted strictly newest-first, why is the time invisible? Relative time would make
   the merge you worked hardest on the one thing the reader can actually see.
5. Should a reader ever be able to dismiss the only explanation for why their page is short?
