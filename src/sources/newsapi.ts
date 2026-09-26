import { z } from 'zod';
import type { Article, Category } from '../core/article';
import { isCategory, normalizeUrl } from '../core/article';
import { buildUrl, fetchJson } from '../core/http';
import { PAGE_SIZE, type NewsSource, type SearchParams, type SourcePage } from '../core/source';
import { asHttpUrl, httpUrl, keepValid, optionalText, requiredText, timestamp } from '../core/validate';

/** `/everything` caps the free plan at 100 results, i.e. 10 pages of 10. */
const MAX_PAGES = 10;

/**
 * The categories NewsAPI can express, which are also the ones it labels articles with:
 * its taxonomy and ours agree, so one set serves both directions. Local to this adapter
 * on purpose.
 *
 * NewsAPI has no politics category; its closest equivalent is `general`, which is too
 * broad to pass off as a politics filter, so politics is simply absent here and the
 * source excludes itself from a politics-only search.
 */
const NEWSAPI_CATEGORIES: ReadonlySet<string> = new Set([
  'business',
  'technology',
  'sports',
  'science',
  'health',
  'entertainment',
  'general',
]);

/** What an article cannot do without; everything else degrades to absent. */
const newsApiArticle = z.object({
  url: httpUrl,
  title: requiredText,
  publishedAt: timestamp,
  source: z.object({ name: optionalText }).nullish().catch(undefined),
  author: optionalText,
  description: optionalText,
  urlToImage: optionalText,
});

type NewsApiArticle = z.output<typeof newsApiArticle>;

/** The envelope only: items are validated one by one so a bad one is dropped, not fatal. */
const newsApiResponse = z.object({ articles: z.array(z.unknown()).optional() });

/** Bylines arrive in every shape; strip the lead-in and collapse separators. */
function normalizeByline(author: string | null | undefined): string | null {
  if (!author) return null;

  const names = author
    .replace(/^by\s+/i, '')
    .split(/\s*,\s*|\s+and\s+/i)
    .map((name) => name.trim())
    .filter(Boolean);

  return names.length ? names.join(', ') : null;
}

/**
 * `sourceCategory` is only knowable on `/top-headlines`, where we asked for a category.
 * `/everything` responses carry no category field at all, which is also why category
 * filtering for NewsAPI cannot be done client-side.
 */
export function toArticle(article: NewsApiArticle, nativeCategory?: string): Article {
  return {
    id: `newsapi:${article.url}`,
    title: article.title,
    url: article.url,
    normalizedUrl: normalizeUrl(article.url),
    publishedAt: article.publishedAt,
    source: 'newsapi',
    publisher: article.source?.name ?? null,
    author: normalizeByline(article.author),
    // NewsAPI's author is display-only: a free-text string with no identifier behind it.
    authorRef: null,
    description: article.description ?? null,
    imageUrl: asHttpUrl(article.urlToImage),
    sourceCategory: nativeCategory ?? null,
    category: nativeCategory && isCategory(nativeCategory) ? nativeCategory : 'general',
  };
}

/** The categories this adapter can actually express, `general` excluded as meaningless. */
function requestedCategories(params: SearchParams): Category[] {
  return (params.categories ?? []).filter((category) => category !== 'general');
}

/**
 * Which NewsAPI category this request rides on, or `undefined` for `/everything`.
 *
 * With neither a keyword nor a category there is nothing for `/everything` to search and
 * it answers 400 — which is exactly the bare `/search` landing view, so the reader's very
 * first screen used to be a failure notice. `/top-headlines` with the `general` category
 * is the honest answer to "no question asked": the current front page.
 */
function endpointCategory(params: SearchParams): string | undefined {
  const categories = requestedCategories(params);
  if (categories.length) return NEWSAPI_CATEGORIES.has(categories[0]!) ? categories[0] : undefined;
  if (!params.query && !params.from && !params.to) return 'general';
  return undefined;
}

export const newsapiSource: NewsSource<'newsapi'> = {
  id: 'newsapi',
  label: 'NewsAPI',
  // Author is display-only: NewsAPI cannot filter by it, so the query layer does it
  // after the fetch. Category is server-side, but only via /top-headlines.
  capabilities: { category: 'server', author: 'client' },

  // Every reason is a sentence fragment: the notice already prints the source name in
  // bold ahead of it, so a message that names NewsAPI again reads "NewsAPI NewsAPI ...".
  unserviceable(params: SearchParams): string | null {
    const categories = requestedCategories(params);

    // `/everything` is the only endpoint with dates, and it refuses to run without a
    // keyword: "the scope of your search is too broad". A date range on its own is
    // therefore a question this source cannot be asked.
    if (!categories.length) {
      if ((params.from || params.to) && !params.query) {
        return 'needs a keyword to search a date range, so it was left out.';
      }
      return null;
    }

    // A category needs /top-headlines; dates only exist on /everything. Neither does both.
    if (params.from || params.to) {
      return 'cannot combine a category with a date range, so it was left out.';
    }

    // One request carries one category. Two would double a 100-requests-a-day budget.
    if (categories.length > 1) {
      return 'can only filter one category at a time, so it was left out.';
    }

    if (!NEWSAPI_CATEGORIES.has(categories[0]!)) {
      return `has no ${categories[0]} category, so it was left out.`;
    }

    return null;
  },

  notice(params: SearchParams): string | null {
    if (!endpointCategory(params)) return null;
    // /top-headlines has no sortBy and no date parameters: it is the current front page.
    return 'is showing recent headlines only.';
  },

  async search(params: SearchParams, signal?: AbortSignal): Promise<SourcePage> {
    const nativeCategory = endpointCategory(params);

    const url = nativeCategory
      ? buildUrl('/api/newsapi/top-headlines', {
          q: params.query,
          category: nativeCategory,
          pageSize: PAGE_SIZE,
          page: params.page,
        })
      : buildUrl('/api/newsapi/everything', {
          q: params.query,
          from: params.from,
          to: params.to,
          sortBy: 'publishedAt',
          language: 'en',
          pageSize: PAGE_SIZE,
          page: params.page,
        });

    const body = await fetchJson('newsapi', url, newsApiResponse, signal);
    const articles = body.articles ?? [];

    return {
      articles: keepValid(newsApiArticle, articles).map((article) => toArticle(article, nativeCategory)),
      // Judged on what came back, not on what survived validation.
      exhausted: params.page >= MAX_PAGES || articles.length < PAGE_SIZE,
    };
  },
};
