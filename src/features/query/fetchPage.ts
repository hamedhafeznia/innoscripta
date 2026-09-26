import type { Article, SourceId } from '../../core/article';
import type { Filters } from '../../core/filters';
import { SourceError } from '../../core/http';
import { mergePage, type SourceResult } from '../../core/merge';
import type { NewsSource, SearchParams } from '../../core/source';
import { SOURCES } from '../../sources/registry';
import type { FollowedAuthor } from '../preferences/store';
import type { Cursor, ResultPage, SourceCursor, SourceNotice } from './types';

/**
 * How many extra fan-outs a page may trigger when client-side filtering empties it.
 * Each one costs a request per live source, so this is a budget decision as much as a
 * UX one: NewsAPI's free plan allows 100 requests a day in total.
 */
const MAX_EXTRA_ROUNDS = 2;

/**
 * The fewest articles a page should show before the reader has to press Load more.
 *
 * The ragged-tail cut can legitimately emit very little: the shallowest source's reach
 * sets the floor, and a source filtered client-side (NYT by category) may have reached
 * back only a few hours while contributing a single match. The buffer holds the rest, so
 * nothing is lost — but a page of one article reads as a broken filter. Below this many,
 * the fan-out goes another round and the pages are shown together. Bounded by
 * `MAX_EXTRA_ROUNDS`, so the request budget stays capped; if that is not enough, the page
 * is topped up from the buffer (see the end of `fetchPage`).
 */
const MIN_PAGE_SIZE = 6;

/** `YYYY-MM-DD` arithmetic in UTC, which is the timezone the three APIs read dates in. */
function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/**
 * A range spanning more than one day is walked a day at a time.
 *
 * Both bounds are required: without them there is no newest day to start from or no
 * oldest day to stop at. A single-day range needs no walking — ordinary paging already
 * burrows into exactly the day that was asked for.
 *
 * The reason is arithmetic. A busy day carries a couple of hundred articles per source,
 * so at ten per source per page a ten-day range needs hundreds of Load mores before it
 * reaches its second day. Walking shows the top of every day in the range instead, which
 * is what asking for a range means.
 */
function walksByDay(filters: Filters): boolean {
  return Boolean(filters.from && filters.to && filters.from !== filters.to);
}

/**
 * A new day is a new question, so every source starts at its first page again. Without
 * this the walk would ask each source for page 2 of a day it has never read.
 */
function freshPages(cursor: Cursor): Cursor['perSource'] {
  const perSource = {} as Cursor['perSource'];
  for (const [id, entry] of Object.entries(cursor.perSource)) {
    perSource[id as SourceId] = { nextPage: 1, exhausted: false, oldestSeen: entry.oldestSeen };
  }
  return perSource;
}

/** The one-day window to ask for, and the filters narrowed to it. */
function dayWindow(filters: Filters, cursor: Cursor): { day: string; filters: Filters } | null {
  if (!walksByDay(filters)) return null;

  const day = cursor.day ?? filters.to!;
  return { day, filters: { ...filters, from: day, to: day } };
}

export function initialCursor(): Cursor {
  const perSource = {} as Record<SourceId, SourceCursor>;
  for (const source of SOURCES) {
    perSource[source.id] = { nextPage: 1, exhausted: false, oldestSeen: null };
  }
  return { perSource, buffer: [] };
}

/**
 * Followed authors are not part of `Filters`: they are a property of the user, not a
 * predicate on the URL, so they arrive alongside it rather than inside it.
 */
export interface PageRequest {
  filters: Filters;
  /** OR-ed with each other, AND-ed with the filters. Empty means "any author". */
  authors: FollowedAuthor[];
  cursor: Cursor;
  signal?: AbortSignal;
}

/**
 * Where a source's author filtering happens *this round*.
 *
 * A source that can filter server-side only does so when every followed author carries
 * an identifier it understands. Send it a partial list and it returns only those
 * authors' articles, silently losing the rest — and follows are OR-ed together, so losing
 * one is a wrong answer, not a narrower one. One name-only follow therefore moves the whole
 * set to the client side, where names are all that is needed.
 */
function authorStrategy(
  source: NewsSource,
  authors: FollowedAuthor[],
): 'server' | 'client' | 'none' {
  if (!authors.length) return 'none';
  if (source.capabilities.author === false) return 'none';
  if (source.capabilities.author === 'server' && authors.every((author) => author.ref)) {
    return 'server';
  }
  return 'client';
}

function toSearchParams(
  filters: Filters,
  authors: FollowedAuthor[],
  source: NewsSource | null,
  page: number,
): SearchParams {
  const serverSide = source && authorStrategy(source, authors) === 'server';

  return {
    query: filters.query || undefined,
    from: filters.from,
    to: filters.to,
    categories: filters.categories,
    // Server-side sources want their own identifiers; nobody else is sent authors at all.
    authors: serverSide ? authors.map((author) => author.ref!) : [],
    page,
  };
}

/** Case- and punctuation-insensitive, so "Muktita Suhartono" matches "By M. Suhartono". */
function authorMatches(article: Article, authors: readonly FollowedAuthor[]): boolean {
  if (!authors.length) return true;
  if (!article.author) return false;

  const haystack = article.author.toLowerCase();
  return authors.some((author) => haystack.includes(author.name.toLowerCase()));
}

function categoryMatches(article: Article, categories: readonly string[]): boolean {
  if (!categories.length) return true;
  return categories.includes(article.category);
}

/** Which sources run at all: selected, serviceable, and not yet exhausted. */
function selectSources(filters: Filters, authors: FollowedAuthor[], cursor: Cursor) {
  const selected = filters.sources.length
    ? SOURCES.filter((source) => filters.sources.includes(source.id))
    : SOURCES;

  const live: NewsSource[] = [];
  const notices: SourceNotice[] = [];

  for (const source of selected) {
    const reason = source.unserviceable(toSearchParams(filters, authors, source, 1));
    if (reason) {
      notices.push(notice(source, 'excluded', reason));
      continue;
    }

    const caveat = source.notice(toSearchParams(filters, authors, source, 1));
    if (caveat) notices.push(notice(source, 'caveat', caveat));

    if (cursor.perSource[source.id]?.exhausted) continue;

    live.push(source);
  }

  return { live, notices };
}

function notice(source: NewsSource, kind: SourceNotice['kind'], message: string): SourceNotice {
  return {
    id: `${source.id}:${kind}:${message}`,
    sourceId: source.id,
    sourceLabel: source.label,
    kind,
    message,
  };
}

/**
 * One fan-out round: every live source in parallel, then the pure merge.
 *
 * `Promise.allSettled`, not `all`: one source failing must never fail the page. A
 * reviewer will kill a key to see what happens, and what should happen is that the
 * other two render and a notice says which one dropped out.
 */
async function fetchRound(
  filters: Filters,
  authors: FollowedAuthor[],
  cursor: Cursor,
  sources: readonly NewsSource[],
  signal?: AbortSignal,
): Promise<{ results: SourceResult[]; notices: SourceNotice[] }> {
  const settled = await Promise.allSettled(
    sources.map((source) =>
      source.search(
        toSearchParams(filters, authors, source, cursor.perSource[source.id]!.nextPage),
        signal,
      ),
    ),
  );

  const results: SourceResult[] = [];
  const notices: SourceNotice[] = [];

  settled.forEach((outcome, index) => {
    const source = sources[index]!;

    if (outcome.status === 'rejected') {
      const reason: unknown = outcome.reason;
      const message =
        reason instanceof SourceError ? reason.message : 'could not be loaded just now.';
      notices.push(notice(source, 'error', message));
      results.push({ sourceId: source.id, status: 'failed' });
      return;
    }

    const fetched = outcome.value.articles;
    // Filter client-side only where the source said it cannot filter server-side.
    const filtered = fetched.filter(
      (article) =>
        (source.capabilities.category !== 'client' ||
          categoryMatches(article, filters.categories)) &&
        (authorStrategy(source, authors) !== 'client' || authorMatches(article, authors)),
    );

    let oldestFetched: string | undefined;
    for (const article of fetched) {
      if (!oldestFetched || article.publishedAt < oldestFetched)
        oldestFetched = article.publishedAt;
    }

    results.push({
      sourceId: source.id,
      status: 'ok',
      articles: filtered,
      exhausted: outcome.value.exhausted,
      oldestFetched,
    });
  });

  return { results, notices };
}

function advance(cursor: Cursor, results: readonly SourceResult[], buffer: Article[]): Cursor {
  const perSource = { ...cursor.perSource };

  for (const result of results) {
    const previous = perSource[result.sourceId]!;

    if (result.status === 'failed') {
      // A failure is not exhaustion: keep the page number so a retry re-asks for it.
      continue;
    }

    perSource[result.sourceId] = {
      nextPage: previous.nextPage + 1,
      exhausted: result.exhausted,
      oldestSeen: result.oldestFetched ?? previous.oldestSeen,
    };
  }

  return { perSource, buffer };
}

/**
 * Fetches one page of merged results, retrying the fan-out up to `MAX_EXTRA_ROUNDS`
 * times when client-side filtering — and only client-side filtering — emptied it.
 * A page must never come back empty while live sources still have pages left.
 */
export async function fetchPage({
  filters,
  authors,
  cursor,
  signal,
}: PageRequest): Promise<ResultPage> {
  const { live, notices: staticNotices } = selectSources(filters, authors, cursor);

  let current = cursor;
  let window = dayWindow(filters, current);
  let articles: Article[] = [];
  let roundNotices: SourceNotice[] = [];
  let lastResults: readonly SourceResult[] = [];
  let rounds = 0;
  let exhaustedEverything = live.length === 0;
  // Set when a walked day got no answer from anyone: the cursor stays on it.
  let dayUnread = false;

  while (rounds <= MAX_EXTRA_ROUNDS) {
    const stillLive = live.filter((source) => !current.perSource[source.id]!.exhausted);

    if (!stillLive.length) {
      // Nothing left to ask: flush whatever the buffer still holds.
      const flushed = mergePage({ buffer: current.buffer, results: [] });
      articles = [...articles, ...flushed.articles];
      current = { ...current, buffer: flushed.buffer };
      exhaustedEverything = true;
      break;
    }

    const round = await fetchRound(window?.filters ?? filters, authors, current, stillLive, signal);
    roundNotices = round.notices;
    lastResults = round.results;

    // A day nobody answered for has not been read, so it must not be walked past: Load
    // more steps to the day *before*, which would skip this one for good. Stay on it, so
    // trying again asks for the same day, and stop rather than spend the budget on the
    // next day's identical failure.
    if (window && round.results.every((result) => result.status === 'failed')) {
      dayUnread = true;
      break;
    }

    // Walking a range emits the whole day it just read. `exhausted` is literally true
    // here — this day will not be asked for again — and with no live source left to
    // undercut it, the ragged-tail cut has nothing to hold back. Every article of the
    // next day is older than every article of this one, so the ordering stays sound.
    const results = window
      ? round.results.map((result) =>
          result.status === 'ok' ? { ...result, exhausted: true } : result,
        )
      : round.results;

    const merged = mergePage({ buffer: current.buffer, results });
    current = advance(current, results, merged.buffer);
    // Accumulate: an earlier round of this same page may already have emitted articles,
    // and they are no longer in the buffer. Every one of this round's articles is older
    // than the earlier rounds' (the cut guarantees it), but sorting keeps that visible.
    articles = [...articles, ...merged.articles].sort((a, b) =>
      b.publishedAt.localeCompare(a.publishedAt),
    );

    if (window) {
      // Whatever this day held has now been emitted; the cursor moves to the day before.
      current = { ...current, day: addDays(window.day, -1), perSource: freshPages(current) };
    }

    if (window ? articles.length : articles.length >= MIN_PAGE_SIZE) break;

    // An empty day is not a reason to stop walking: step to the next one and look there.
    if (window) {
      const next = dayWindow(filters, current);
      if (!next || next.day < filters.from!) break;
      window = next;
      rounds += 1;
      continue;
    }

    // The extra rounds exist to get past client-side filtering that emptied a page. If
    // every source failed there is nothing to filter and nothing to get past: retrying
    // the fan-out just spends the request budget on the same failure.
    if (round.results.every((result) => result.status === 'failed')) break;

    rounds += 1;
  }

  // Extra rounds are capped, and a shallow source can still hold the cut above everything
  // else it fetched. Rather than show a page of two, release the newest buffered articles.
  // The cost is a small ordering compromise: a not-yet-fetched article from the shallow
  // source may turn up on the next page, above these. Everything released was already
  // fetched, so nothing is refetched, and the buffer is newest-first, so the page stays
  // sorted.
  if (!window && articles.length < MIN_PAGE_SIZE && current.buffer.length) {
    const take = MIN_PAGE_SIZE - articles.length;
    articles = [...articles, ...current.buffer.slice(0, take)];
    current = { ...current, buffer: current.buffer.slice(take) };
  }

  const nextDay = window ? (dayUnread ? window.day : addDays(window.day, -1)) : undefined;
  const walkedPast = Boolean(window && !dayUnread && nextDay! < filters.from!);

  const done =
    walkedPast ||
    exhaustedEverything ||
    (live.every((source) => current.perSource[source.id]!.exhausted) && !current.buffer.length);

  const unreachable =
    lastResults.length > 0 && lastResults.every((result) => result.status === 'failed');

  return {
    articles,
    cursor: current,
    day: window?.day,
    nextDay: walkedPast ? undefined : nextDay,
    notices: [...staticNotices, ...roundNotices],
    done,
    // An empty page with nothing reachable is not an empty result set.
    outOfMatches: !articles.length && !done && !unreachable,
    unreachable,
  };
}
