import type { Article, Category, SourceId } from './article';

/**
 * One unified page size across every source. NYT's Article Search returns a fixed 10
 * results with no page-size parameter, so 10 is the floor the other two must meet.
 * Three sources x 10 = 30 articles per fan-out.
 */
export const PAGE_SIZE = 10;

/** Canonical, source-agnostic query. Adapters translate it into their own params. */
export interface SearchParams {
  /** Free-text keyword. */
  query?: string;
  /** Inclusive date bounds, `YYYY-MM-DD`. Adapters reformat as each API demands. */
  from?: string;
  to?: string;
  /** AND-ed with the keyword. Empty means "any category". */
  categories?: Category[];
  /**
   * OR-ed with each other, and AND-ed with everything else: followed authors narrow the
   * result set to their own articles.
   * Guardian and NYT filter these server-side; NewsAPI cannot, so its adapter
   * declares `author: 'client'` and the query layer filters after the fact.
   */
  authors?: string[];
  /** 1-indexed, canonical. Adapters convert to their own paging (NYT is 0-indexed). */
  page: number;
}

export interface SourcePage {
  articles: Article[];
  /** True when the source cannot return anything further for these params. */
  exhausted: boolean;
}

/**
 * What a source can do that differs between sources, and so has to be asked rather than
 * assumed. The query layer reads this instead of special-casing source ids, which is what
 * keeps "add a source = one adapter file + one registry line" true: a new adapter declares
 * its own limits and the UI adapts without being edited.
 *
 * Only facets someone reads are listed. Keyword and date-range search are supported by
 * every source, and a limit on them (NewsAPI's, say) is expressed through `unserviceable`
 * instead, which can say which *combination* cannot be served.
 */
export interface Capabilities {
  /**
   * Where category filtering happens. `'client'` means the source cannot filter by
   * category itself and the query layer drops non-matching articles after the fetch.
   */
  category: 'server' | 'client' | false;
  /**
   * Where author filtering happens. `false` means the source cannot filter by author
   * at all and the UI must say so.
   */
  author: 'server' | 'client' | false;
}

export interface NewsSource {
  id: SourceId;
  /** Human-readable provider name, for filter chips and per-source notices. */
  label: string;
  capabilities: Capabilities;
  /**
   * Why this source cannot serve these params at all, or `null` when it can.
   * A non-null reason excludes the source from the fan-out and is shown verbatim
   * in the per-source notice slot — so it is written as user-facing copy.
   *
   * Example: NewsAPI needs `/top-headlines` for a category and `/everything` for
   * dates, and neither endpoint does both.
   */
  unserviceable(params: SearchParams): string | null;
  /**
   * A caveat about results this source *will* return — a narrowed endpoint, a
   * truncated window. Shown in the same notice slot as `unserviceable`.
   */
  notice(params: SearchParams): string | null;
  search(params: SearchParams, signal?: AbortSignal): Promise<SourcePage>;
}
