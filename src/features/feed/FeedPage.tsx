import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toSearchParams, type Filters } from '../../core/filters';
import { Button } from '@/components/ui/button';
import { ArticleList, ArticleListSkeleton } from '../articles/ArticleList';
import { ResultsPlaceholder } from '../articles/ResultsPlaceholder';
import { SourceNotices } from '../articles/SourceNotices';
import { PreferencesPanel } from '../preferences/PreferencesPanel';
import { usePreferences } from '../preferences/store';
import { useArticles } from '../query/useArticles';

export function FeedPage() {
  const categories = usePreferences((state) => state.categories);
  const sources = usePreferences((state) => state.sources);
  const authors = usePreferences((state) => state.authors);

  // The same Filters shape /search parses out of the URL, derived from preferences
  // instead. One engine, two routes: the hook cannot tell which page called it.
  const filters: Filters = useMemo(
    () => ({ query: '', categories, sources }),
    [categories, sources],
  );

  const { articles, notices, outOfMatches, unreachable, isPending, isError, error, refetch, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useArticles(filters, authors);

  const hasPreferences = categories.length > 0 || sources.length > 0 || authors.length > 0;

  return (
    <section className="flex w-full flex-col items-start gap-6">
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 font-serif text-[2rem] leading-none font-medium tracking-[-0.02em]">My feed</h1>
        {/* Hands the preference-derived filters to /search, pre-filled and editable. */}
        <Button asChild variant="outline" size="sm">
          <Link to={{ pathname: '/search', search: toSearchParams(filters).toString() }}>
            Refine in search
          </Link>
        </Button>
      </div>

      <PreferencesPanel />

      {authors.length > 0 ? (
        <p className="m-0 max-w-prose text-sm text-muted-foreground">
          Followed authors widen the feed. The Guardian filters them as you read; the
          New York Times and NewsAPI are filtered on this device after fetching.
        </p>
      ) : null}

      <SourceNotices notices={notices} />

      {!hasPreferences ? (
        <p className="m-0 w-full rounded-lg border border-dashed bg-surface p-6 text-center text-muted-foreground">
          Pick a category or a provider above, or follow an author from{' '}
          <Link className="text-primary underline-offset-4 hover:underline" to="/search">
            search
          </Link>, and your feed will build itself here.
        </p>
      ) : isPending ? (
        <>
          <p className="sr-only" role="status">
            Loading your feed
          </p>
          <ArticleListSkeleton />
        </>
      ) : isError ? (
        <p className="m-0 w-full rounded-lg border border-destructive/40 bg-destructive/5 p-8 text-center text-destructive" role="alert">
          Nothing could be loaded: {error.message}
        </p>
      ) : articles.length === 0 ? (
        <ResultsPlaceholder
          unreachable={unreachable}
          outOfMatches={outOfMatches}
          emptyMessage="Nothing matched your preferences yet. Try adding a category or another provider."
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      ) : (
        <>
          <p className="m-0 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase tabular-nums" role="status">
            {articles.length} article{articles.length === 1 ? '' : 's'}
          </p>
          <ArticleList articles={articles} />
        </>
      )}

      {hasPreferences && hasNextPage && !unreachable ? (
        <Button
          type="button"
          variant="outline"
          // Quiet: on a page of photographs and serif headlines a filled accent button is
          // the loudest thing on screen, and it is not the most important one.
          className="mx-auto h-11 min-w-56 font-medium"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </section>
  );
}
