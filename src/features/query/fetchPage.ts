import type { Article, SourceId } from '../../core/article';
import type { Filters } from '../../core/filters';
import { SourceError } from '../../core/http';
import { mergePage, type SourceResult } from '../../core/merge';
import type { NewsSource, SearchParams } from '../../core/source';
import { SOURCES } from '../../sources/registry';
import type { Cursor, ResultPage, SourceCursor, SourceNotice } from './types';

/**
 * How many extra fan-outs a page may trigger when client-side filtering empties it.
 * Each one costs a request per live source, so this is a budget decision as much as a
 * UX one: NewsAPI's free plan allows 100 requests a day in total.
 */
const MAX_EXTRA_ROUNDS = 2;

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
  authors: string[];
  cursor: Cursor;
  signal?: AbortSignal;
}

function toSearchParams(filters: Filters, authors: string[], page: number): SearchParams {
  return {
    query: filters.query || undefined,
    from: filters.from,
    to: filters.to,
    categories: filters.categories,
    authors,
    page,
  };
}

/** Case- and punctuation-insensitive, so "Muktita Suhartono" matches "By M. Suhartono". */
function authorMatches(article: Article, authors: readonly string[]): boolean {
  if (!authors.length) return true;
  if (!article.author) return false;

  const haystack = article.author.toLowerCase();
  return authors.some((author) => haystack.includes(author.toLowerCase()));
}

function categoryMatches(article: Article, categories: readonly string[]): boolean {
  if (!categories.length) return true;
  return categories.includes(article.category);
}

/** Which sources run at all: selected, serviceable, and not yet exhausted. */
function selectSources(filters: Filters, authors: string[], cursor: Cursor) {
  const selected = filters.sources.length
    ? SOURCES.filter((source) => filters.sources.includes(source.id))
    : SOURCES;

  const live: NewsSource[] = [];
  const notices: SourceNotice[] = [];

  for (const source of selected) {
    const reason = source.unserviceable(toSearchParams(filters, authors, 1));
    if (reason) {
      notices.push(notice(source, 'excluded', reason));
      continue;
    }

    const caveat = source.notice(toSearchParams(filters, authors, 1));
    if (caveat) notices.push(notice(source, 'caveat', caveat));

    if (cursor.perSource[source.id]?.exhausted) continue;

    live.push(source);
  }

  return { live, notices };
}

function notice(
  source: NewsSource,
  kind: SourceNotice['kind'],
  message: string,
): SourceNotice {
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
  authors: string[],
  cursor: Cursor,
  sources: readonly NewsSource[],
  signal?: AbortSignal,
): Promise<{ results: SourceResult[]; notices: SourceNotice[] }> {
  const settled = await Promise.allSettled(
    sources.map((source) =>
      source.search(
        toSearchParams(filters, authors, cursor.perSource[source.id]!.nextPage),
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
        reason instanceof SourceError ? reason.message : 'Could not be loaded just now.';
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
        (source.capabilities.author !== 'client' || authorMatches(article, authors)),
    );

    let oldestFetched: string | undefined;
    for (const article of fetched) {
      if (!oldestFetched || article.publishedAt < oldestFetched) oldestFetched = article.publishedAt;
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
  let articles: Article[] = [];
  let roundNotices: SourceNotice[] = [];
  let rounds = 0;
  let exhaustedEverything = live.length === 0;

  while (rounds <= MAX_EXTRA_ROUNDS) {
    const stillLive = live.filter((source) => !current.perSource[source.id]!.exhausted);

    if (!stillLive.length) {
      // Nothing left to ask: flush whatever the buffer still holds.
      const flushed = mergePage({ buffer: current.buffer, results: [] });
      articles = flushed.articles;
      current = { ...current, buffer: flushed.buffer };
      exhaustedEverything = true;
      break;
    }

    const round = await fetchRound(filters, authors, current, stillLive, signal);
    roundNotices = round.notices;

    const merged = mergePage({ buffer: current.buffer, results: round.results });
    current = advance(current, round.results, merged.buffer);
    articles = merged.articles;

    if (articles.length) break;
    rounds += 1;
  }

  const done =
    exhaustedEverything ||
    (live.every((source) => current.perSource[source.id]!.exhausted) && !current.buffer.length);

  return {
    articles,
    cursor: current,
    notices: [...staticNotices, ...roundNotices],
    done,
    outOfMatches: !articles.length && !done,
  };
}
