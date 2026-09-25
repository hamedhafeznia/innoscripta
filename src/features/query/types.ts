import type { Article, SourceId } from '../../core/article';

/**
 * Not URL-serializable, by design: it carries whole articles. It lives in the React
 * Query cache only, which is why a reload returns to page 1. The alternative — refetching
 * the truncated tail on every reload — is unaffordable against NewsAPI's 100/day budget.
 */
export interface Cursor {
  perSource: Record<SourceId, SourceCursor>;
  /**
   * The day currently being read, `YYYY-MM-DD`, when the filters name a range spanning
   * more than one day. Paging then walks the range a day at a time instead of burrowing
   * into its newest day — see `dayWindow` in fetchPage.
   */
  day?: string;
  /** Fetched but not yet emitted: below the cut. Carried, never refetched. */
  buffer: Article[];
}

export interface SourceCursor {
  nextPage: number;
  exhausted: boolean;
  /** How far back this source has reached, for debugging and for the exhaustion notice. */
  oldestSeen: string | null;
}

export type NoticeKind =
  /** The source cannot serve these filters and was left out of the fan-out. */
  | 'excluded'
  /** The source is answering, but a narrower question than was asked. */
  | 'caveat'
  /** The source failed: rate limit, bad key, network. */
  | 'error';

export interface SourceNotice {
  /** Stable across pages so a dismissal sticks while the user loads more. */
  id: string;
  sourceId: SourceId;
  sourceLabel: string;
  kind: NoticeKind;
  message: string;
}

export interface ResultPage {
  articles: Article[];
  cursor: Cursor;
  notices: SourceNotice[];
  /** True when every selected source is exhausted and the buffer is empty. */
  done: boolean;
  /**
   * Set when a page came back empty only because client-side filtering removed
   * everything, and the auto-fetch budget ran out before anything matched.
   */
  outOfMatches: boolean;
  /** The day this page covers, when the range is being walked a day at a time. */
  day?: string;
  /** The next day Load more will fetch, so the control can say where it goes. */
  nextDay?: string;
  /**
   * Every source we actually asked this round failed. Distinct from "nothing matched":
   * nothing was searched at all, so telling the reader there are no more matches — or
   * offering to load more of them — would be a lie.
   */
  unreachable: boolean;
}
