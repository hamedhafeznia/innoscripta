import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toSearchParams, type Filters } from '../../core/filters';
import { ArticleList, ArticleListSkeleton } from '../articles/ArticleList';
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

  const { articles, notices, outOfMatches, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useArticles(filters, authors);

  const hasPreferences = categories.length > 0 || sources.length > 0 || authors.length > 0;

  return (
    <section className="page">
      <div className="page-head">
        <h1 className="page-title">My feed</h1>
        {/* Hands the preference-derived filters to /search, pre-filled and editable. */}
        <Link className="button-quiet" to={{ pathname: '/search', search: toSearchParams(filters).toString() }}>
          Refine in search
        </Link>
      </div>

      <PreferencesPanel />

      {authors.length > 0 ? (
        <p className="result-count">
          Followed authors widen the feed. The Guardian filters them as you read; the
          New York Times and NewsAPI are filtered on this device after fetching.
        </p>
      ) : null}

      <SourceNotices notices={notices} />

      {!hasPreferences ? (
        <p className="state">
          Pick a category or a provider above, or follow an author from{' '}
          <Link to="/search">search</Link>, and your feed will build itself here.
        </p>
      ) : isPending ? (
        <>
          <p className="visually-hidden" role="status">
            Loading your feed
          </p>
          <ArticleListSkeleton />
        </>
      ) : isError ? (
        <p className="state state-error" role="alert">
          Nothing could be loaded: {error.message}
        </p>
      ) : articles.length === 0 ? (
        <p className="state">
          {outOfMatches
            ? 'No more matches from the authors you follow in the pages we checked.'
            : 'Nothing matched your preferences yet. Try adding a category or another provider.'}
        </p>
      ) : (
        <>
          <p className="result-count" role="status">
            {articles.length} article{articles.length === 1 ? '' : 's'}
          </p>
          <ArticleList articles={articles} />
        </>
      )}

      {hasPreferences && hasNextPage ? (
        <button
          type="button"
          className="button"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </section>
  );
}
