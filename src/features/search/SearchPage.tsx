import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseFilters, toSearchParams, type Filters } from '../../core/filters';
import { Button } from '@/components/ui/button';
import { ArticleList, ArticleListSkeleton } from '../articles/ArticleList';
import { SourceNotices } from '../articles/SourceNotices';
import { useArticles } from '../query/useArticles';
import { countActiveFilters, FilterPanel } from './FilterPanel';
import { useDebouncedValue } from './useDebouncedValue';

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // The URL is the single source of truth for filters, and it is untrusted input:
  // parseFilters drops anything malformed rather than throwing.
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  // The keyword is the one filter that is not written straight through: it lags the
  // input by the debounce so typing does not fan out a request per keystroke.
  const [keyword, setKeyword] = useState(filters.query);
  const debouncedKeyword = useDebouncedValue(keyword);

  const apply = (next: Filters, options?: { replace?: boolean }) =>
    setSearchParams(toSearchParams(next), { replace: options?.replace ?? false });

  useEffect(() => {
    if (debouncedKeyword === filters.query) return;
    // `replace` so a sentence typed into the box leaves one history entry, not twelve.
    apply({ ...filters, query: debouncedKeyword }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filters is read, not tracked
  }, [debouncedKeyword]);

  // A back/forward navigation changes the URL under us; the input follows it.
  useEffect(() => setKeyword(filters.query), [filters.query]);

  const { articles, notices, outOfMatches, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useArticles(filters, []);

  return (
    <section className="flex flex-col items-start gap-4">
      <h1 className="m-0 text-2xl font-semibold">Search</h1>

      <FilterPanel
        activeCount={countActiveFilters(filters)}
        filters={filters}
        keyword={keyword}
        onKeywordChange={setKeyword}
        onChange={(next) => apply({ ...next, query: keyword })}
      />

      <SourceNotices notices={notices} />

      {isPending ? (
        <>
          <p className="sr-only" role="status">
            Loading articles
          </p>
          <ArticleListSkeleton />
        </>
      ) : isError ? (
        <p className="m-0 w-full rounded-lg border border-destructive p-6 text-center text-destructive" role="alert">
          Nothing could be loaded: {error.message}
        </p>
      ) : articles.length === 0 ? (
        <p className="m-0 w-full rounded-lg border border-dashed bg-surface p-6 text-center text-muted-foreground">
          {outOfMatches
            ? 'No more matches in the pages we checked. Load more to keep looking.'
            : 'No articles matched these filters. Try widening the date range or clearing a category.'}
        </p>
      ) : (
        <>
          <p className="m-0 text-sm text-muted-foreground" role="status">
            {articles.length} article{articles.length === 1 ? '' : 's'}
          </p>
          <ArticleList articles={articles} />
        </>
      )}

      {/* Explicit Load More rather than infinite scroll: paging costs real requests. */}
      {hasNextPage ? (
        <Button
          type="button"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      ) : articles.length > 0 ? (
        <p className="m-0 w-full rounded-lg border border-dashed bg-surface p-6 text-center text-muted-foreground">That is everything these sources have for this search.</p>
      ) : null}
    </section>
  );
}
