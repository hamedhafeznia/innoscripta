import type { Article, SourceId } from './article';

/** One source's contribution to a single fan-out round. */
export type SourceResult =
  | {
      sourceId: SourceId;
      status: 'ok';
      /** What this source contributes to the page, after any client-side filtering. */
      articles: Article[];
      exhausted: boolean;
      /**
       * How far back the source actually reached this round, before client-side
       * filtering removed anything. The cut depends on a source's *reach*, not on what
       * survived the filter: a page filtered down to nothing still reached back to some
       * date, and articles older than that date must wait. Defaults to the oldest of
       * `articles` when the source filtered nothing out.
       */
      oldestFetched?: string;
    }
  /** Threw, rate-limited, or was excluded as unserviceable. Contributes nothing. */
  | { sourceId: SourceId; status: 'failed' };

export interface MergeInput {
  /** Articles carried from previous rounds. Never emitted without re-passing the cut. */
  buffer: Article[];
  /** This round's results, in registry order, which is also the collision tie-break. */
  results: readonly SourceResult[];
}

export interface MergeResult {
  /** Safe to render: above this floor the ordering is complete from every live source. */
  articles: Article[];
  /** Carried to the next round. Never refetched: the 100/day budget cannot afford it. */
  buffer: Article[];
}

/** How many optional fields an article actually has. Richer copy wins a collision. */
function richness(article: Article): number {
  return [article.imageUrl, article.author, article.description].filter(Boolean).length;
}

/**
 * Merges one fan-out round into a renderable page plus a carried buffer.
 *
 * Pure: it reads only its input and mutates nothing, which is what makes the
 * ragged-tail behaviour testable without any network or cache in the way.
 *
 * 1. input = carried buffer + newly fetched pages (the buffer is never emitted directly)
 * 2. dedupe by normalised URL, across sources and across pages
 * 3. sort by publishedAt, newest first
 * 4. cut at the most recent of the live sources' oldest items
 * 5. remainder -> buffer
 */
export function mergePage({ buffer, results }: MergeInput): MergeResult {
  const fetched = results.flatMap((result) => (result.status === 'ok' ? result.articles : []));

  // Buffer first: a carried article and its refetched twin are the same story, and the
  // carried one is the copy the previous round already reasoned about.
  const deduped = dedupe([...buffer, ...fetched]);

  const sorted = deduped.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const cutPoint = findCutPoint(results);
  if (cutPoint === null) {
    // Nothing is still live, so no source can supply anything further: emit the lot.
    return { articles: sorted, buffer: [] };
  }

  return {
    articles: sorted.filter((article) => article.publishedAt >= cutPoint),
    buffer: sorted.filter((article) => article.publishedAt < cutPoint),
  };
}

/**
 * The oldest item of the *most shallow* live source. Below it, another live source
 * could still return an article that belongs higher up, so the ordering is incomplete.
 *
 * Exhausted and failed sources are excluded: neither can contribute anything further,
 * so neither should hold back articles the live sources have already delivered.
 * `null` means no source is still live.
 *
 * A live source that returned nothing this round also contributes no timestamp;
 * adapters mark that case `exhausted`, which is the same thing by a different name.
 *
 * The oldest item is found by scanning, not by taking the last element: every source
 * does return its page newest-first today, but the cut is the one piece of ordering
 * logic that must not quietly depend on an upstream promise we do not control.
 */
function findCutPoint(results: readonly SourceResult[]): string | null {
  let cutPoint: string | null = null;

  for (const result of results) {
    if (result.status !== 'ok' || result.exhausted) continue;

    let oldest: string | null = result.oldestFetched ?? null;
    if (oldest === null) {
      for (const article of result.articles) {
        if (oldest === null || article.publishedAt < oldest) oldest = article.publishedAt;
      }
    }
    if (oldest === null) continue;

    if (cutPoint === null || oldest > cutPoint) cutPoint = oldest;
  }

  return cutPoint;
}

/**
 * Keeps one copy per normalised URL: the more populated one, and on a tie the one that
 * came first, which, given the input order, means registry order. `Promise.allSettled`
 * preserves input order anyway; stating the rule keeps the merge visibly deterministic.
 */
function dedupe(articles: readonly Article[]): Article[] {
  const byUrl = new Map<string, Article>();

  for (const article of articles) {
    const existing = byUrl.get(article.normalizedUrl);
    if (!existing || richness(article) > richness(existing)) {
      byUrl.set(article.normalizedUrl, article);
    }
  }

  return [...byUrl.values()];
}
