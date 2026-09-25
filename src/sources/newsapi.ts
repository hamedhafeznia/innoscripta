import type { Article, Category } from '../core/article';
import { normalizeUrl } from '../core/article';
import { buildUrl, fetchJson } from '../core/http';
import { PAGE_SIZE, type NewsSource, type SearchParams, type SourcePage } from '../core/source';

/** `/everything` caps the free plan at 100 results, i.e. 10 pages of 10. */
const MAX_PAGES = 10;

/**
 * Canonical category -> NewsAPI category. Local to this adapter on purpose.
 * NewsAPI has no politics category; its closest equivalent is `general`, which is too
 * broad to pass off as a politics filter, so politics is simply unmapped here and the
 * source excludes itself from a politics-only search.
 */
const NEWSAPI_CATEGORY: Partial<Record<Category, string>> = {
  business: 'business',
  technology: 'technology',
  sports: 'sports',
  science: 'science',
  health: 'health',
  entertainment: 'entertainment',
  general: 'general',
};

/** NewsAPI category -> canonical. A straight inverse here; the taxonomies agree. */
const CATEGORY_BY_NEWSAPI: Record<string, Category> = {
  business: 'business',
  technology: 'technology',
  sports: 'sports',
  science: 'science',
  health: 'health',
  entertainment: 'entertainment',
  general: 'general',
};

interface NewsApiArticle {
  source?: { id?: string | null; name?: string | null };
  author?: string | null;
  title: string;
  description?: string | null;
  url: string;
  urlToImage?: string | null;
  publishedAt: string;
}

interface NewsApiResponse {
  status: string;
  totalResults?: number;
  articles?: NewsApiArticle[];
}

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
    imageUrl: article.urlToImage ?? null,
    sourceCategory: nativeCategory ?? null,
    category: (nativeCategory && CATEGORY_BY_NEWSAPI[nativeCategory]) || 'general',
  };
}

/** The categories this adapter can actually express, `general` excluded as meaningless. */
function requestedCategories(params: SearchParams): Category[] {
  return (params.categories ?? []).filter((category) => category !== 'general');
}

export const newsapiSource: NewsSource = {
  id: 'newsapi',
  label: 'NewsAPI',
  // Author is display-only: NewsAPI cannot filter by it, so the query layer does it
  // after the fetch. Category is server-side, but only via /top-headlines.
  capabilities: { query: true, dateRange: true, category: 'server', author: 'client' },

  unserviceable(params: SearchParams): string | null {
    const categories = requestedCategories(params);
    if (!categories.length) return null;

    // A category needs /top-headlines; dates only exist on /everything. Neither does both.
    if (params.from || params.to) {
      return 'NewsAPI cannot combine a category with a date range, so it was left out.';
    }

    // One request carries one category. Two would double a 100-requests-a-day budget.
    if (categories.length > 1) {
      return 'NewsAPI can only filter one category at a time, so it was left out.';
    }

    if (!NEWSAPI_CATEGORY[categories[0]!]) {
      return `NewsAPI has no ${categories[0]} category, so it was left out.`;
    }

    return null;
  },

  notice(params: SearchParams): string | null {
    if (!requestedCategories(params).length) return null;
    // /top-headlines has no sortBy and no date parameters: it is the current front page.
    return 'NewsAPI: recent headlines only';
  },

  async search(params: SearchParams, signal?: AbortSignal): Promise<SourcePage> {
    const categories = requestedCategories(params);
    const nativeCategory = categories.length ? NEWSAPI_CATEGORY[categories[0]!] : undefined;

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

    const body = await fetchJson<NewsApiResponse>('newsapi', url, signal);
    const articles = body.articles ?? [];

    return {
      articles: articles.map((article) => toArticle(article, nativeCategory)),
      exhausted: params.page >= MAX_PAGES || articles.length < PAGE_SIZE,
    };
  },
};
