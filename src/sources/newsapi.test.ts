import { http, HttpResponse } from 'msw';
import fixture from '../test/fixtures/newsapi.search.json';
import { captureRequest } from '../test/captureRequest';
import { server } from '../test/server';
import { newsapiSource, toArticle } from './newsapi';

const articles = fixture.articles;

describe('newsapi adapter', () => {
  describe('mapping a real response', () => {
    it('maps an article onto the canonical Article', () => {
      const article = toArticle(articles[0]!);

      expect(article).toMatchObject({
        title: '‘All hell seems to have broken out’: FF and FG at loggerheads over sports grant announcement',
        publishedAt: '2026-09-23T22:04:54Z',
        source: 'newsapi',
        author: 'Jack Horgan-Jones',
      });
    });

    it('carries the publisher name, which is not the provider name', () => {
      // `src=newsapi` selects the provider; "The Irish Times" is who actually published it.
      expect(toArticle(articles[0]!).publisher).toBe('The Irish Times');
    });

    it('leaves category general when the request had none to attribute', () => {
      // /everything responses carry no category field, so there is nothing to map from.
      const article = toArticle(articles[0]!);

      expect(article.category).toBe('general');
      expect(article.sourceCategory).toBeNull();
    });

    it('attributes the requested category when the request went to top-headlines', () => {
      const article = toArticle(articles[0]!, 'technology');

      expect(article.category).toBe('technology');
      expect(article.sourceCategory).toBe('technology');
    });

    it('maps every article in the captured page without throwing', () => {
      expect(articles.map((article) => toArticle(article))).toHaveLength(10);
    });
  });

  describe('endpoint routing', () => {
    it('uses /everything for a keyword with dates and no category', async () => {
      const request = captureRequest('/api/newsapi/everything', fixture);

      await newsapiSource.search({ page: 1, query: 'climate', from: '2026-09-01' });

      expect(request.url.searchParams.get('from')).toBe('2026-09-01');
      expect(request.url.searchParams.get('sortBy')).toBe('publishedAt');
    });

    it('uses /top-headlines for a category, keyword and all', async () => {
      const request = captureRequest('/api/newsapi/top-headlines', fixture);

      await newsapiSource.search({ page: 1, query: 'ai', categories: ['technology'] });

      expect(request.url.searchParams.get('category')).toBe('technology');
      expect(request.url.searchParams.get('q')).toBe('ai');
      // /top-headlines has no sortBy and no date parameters.
      expect(request.url.searchParams.has('sortBy')).toBe(false);
    });

    it('warns that a category search returns recent headlines only', () => {
      expect(newsapiSource.notice({ page: 1, categories: ['technology'] })).toBe(
        'NewsAPI: recent headlines only',
      );
      expect(newsapiSource.notice({ page: 1, query: 'ai' })).toBeNull();
    });
  });

  describe('unserviceable filter combinations', () => {
    it('excludes itself from a category combined with a date range', () => {
      expect(
        newsapiSource.unserviceable({ page: 1, categories: ['technology'], from: '2026-09-01' }),
      ).toMatch(/cannot combine a category with a date range/);
    });

    it('excludes itself from a multi-category search it cannot express in one request', () => {
      expect(newsapiSource.unserviceable({ page: 1, categories: ['technology', 'sports'] })).toMatch(
        /one category at a time/,
      );
    });

    it('excludes itself from a politics search, a category it does not have', () => {
      expect(newsapiSource.unserviceable({ page: 1, categories: ['politics'] })).toMatch(
        /no politics category/,
      );
    });

    it('serves a keyword and dates, and a single category on its own', () => {
      expect(newsapiSource.unserviceable({ page: 1, query: 'ai', from: '2026-09-01' })).toBeNull();
      expect(newsapiSource.unserviceable({ page: 1, categories: ['technology'] })).toBeNull();
    });
  });

  describe('failure', () => {
    it('reports a spent daily budget as rateLimited, not as a generic failure', async () => {
      server.use(
        http.get('*/api/newsapi/everything', () =>
          HttpResponse.json({ status: 'error', code: 'rateLimited' }, { status: 429 }),
        ),
      );

      await expect(newsapiSource.search({ page: 1, query: 'ai' })).rejects.toMatchObject({
        sourceId: 'newsapi',
        kind: 'rateLimited',
      });
    });

    it('reports a killed key as unauthorized', async () => {
      server.use(
        http.get('*/api/newsapi/everything', () => HttpResponse.json({}, { status: 401 })),
      );

      await expect(newsapiSource.search({ page: 1, query: 'ai' })).rejects.toMatchObject({
        kind: 'unauthorized',
      });
    });
  });

  describe('exhaustion', () => {
    it('is exhausted at the free plan 100-result cap', async () => {
      captureRequest('/api/newsapi/everything', fixture);
      await expect(newsapiSource.search({ page: 10, query: 'ai' })).resolves.toMatchObject({
        exhausted: true,
      });
    });
  });
});
