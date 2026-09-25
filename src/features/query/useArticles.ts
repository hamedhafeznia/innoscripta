import { useInfiniteQuery } from '@tanstack/react-query';
import type { Filters } from '../../core/filters';
import type { FollowedAuthor } from '../preferences/store';
import { fetchPage, initialCursor } from './fetchPage';
import type { Cursor, ResultPage } from './types';

/**
 * The one engine behind both routes. `/search` passes filters parsed from the URL,
 * `/feed` passes the same shape derived from stored preferences.
 *
 * The cursor is the page param, which is why it never has to be URL-serializable.
 */
export function useArticles(filters: Filters, authors: FollowedAuthor[]) {
  const query = useInfiniteQuery<ResultPage, Error, ResultPage[], unknown[], Cursor>({
    queryKey: ['articles', filters, [...authors].map((a) => a.name).sort()],
    initialPageParam: initialCursor(),
    queryFn: ({ pageParam, signal }) => fetchPage({ filters, authors, cursor: pageParam, signal }),
    getNextPageParam: (lastPage) => (lastPage.done ? undefined : lastPage.cursor),
    select: (data) => data.pages,
  });

  const pages = query.data ?? [];
  const lastPage = pages.at(-1);

  return {
    ...query,
    articles: pages.flatMap((page) => page.articles),
    /** Deduplicated across pages: the same source can fail on every page. */
    notices: [...new Map(pages.flatMap((page) => page.notices).map((n) => [n.id, n])).values()],
    /** Client-side filtering ran out of road before it found anything more. */
    outOfMatches: lastPage?.outOfMatches ?? false,
    /** Nothing answered, so there is nothing to page through and nothing to report empty. */
    unreachable: lastPage?.unreachable ?? false,
  };
}
