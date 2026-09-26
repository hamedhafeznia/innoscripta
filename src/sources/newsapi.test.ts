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
        title:
          '‘All hell seems to have broken out’: FF and FG at loggerheads over sports grant announcement',
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
        'is showing recent headlines only.',
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
      expect(
        newsapiSource.unserviceable({ page: 1, categories: ['technology', 'sports'] }),
      ).toMatch(/one category at a time/);
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

describe('newsapi date handling', () => {
  it('excludes itself from a date range with no keyword, rather than failing', () => {
    // /everything refuses to run on dates alone: "the scope of your search is too broad".
    // Without this the reader got a red "not responding" notice for a working source.
    expect(newsapiSource.unserviceable({ page: 1, from: '2026-09-03', to: '2026-09-06' })).toMatch(
      /needs a keyword to search a date range/,
    );
  });

  it('serves a date range once there is a keyword', () => {
    expect(
      newsapiSource.unserviceable({ page: 1, query: 'climate', from: '2026-09-03' }),
    ).toBeNull();
  });

  it('never repeats the source name, which the notice already prints', () => {
    const reasons = [
      newsapiSource.unserviceable({ page: 1, from: '2026-09-03' }),
      newsapiSource.unserviceable({ page: 1, categories: ['technology'], from: '2026-09-03' }),
      newsapiSource.unserviceable({ page: 1, categories: ['technology', 'sports'] }),
      newsapiSource.unserviceable({ page: 1, categories: ['politics'] }),
      newsapiSource.notice({ page: 1, categories: ['technology'] }),
    ];

    for (const reason of reasons) {
      expect(reason).toBeTruthy();
      expect(reason).not.toMatch(/NewsAPI/);
    }
  });
});

describe('rate limit copy', () => {
  it('does not promise a daily window it cannot know', async () => {
    // NewsAPI's 429 is a daily cap; NYT's is usually a per-minute throttle. The status
    // code cannot tell them apart, so the copy must be true of both.
    server.use(http.get('*/api/newsapi/everything', () => HttpResponse.json({}, { status: 429 })));

    await expect(newsapiSource.search({ page: 1, query: 'ai' })).rejects.toMatchObject({
      kind: 'rateLimited',
      message: expect.not.stringContaining('today'),
    });
  });
});

describe('newsapi adapter when the response is not what it should be', () => {
  const search = () => newsapiSource.search({ page: 1, query: 'ai' });

  it('drops an article with an unreadable date and keeps the rest', async () => {
    captureRequest('/api/newsapi/everything', {
      status: 'ok',
      articles: [{ ...articles[0]!, publishedAt: 'sometime' }, articles[1]!],
    });

    const page = await search();

    expect(page.articles.map((article) => article.url)).toEqual([articles[1]!.url]);
  });

  it('drops an article with no title or no link', async () => {
    captureRequest('/api/newsapi/everything', {
      status: 'ok',
      articles: [
        { ...articles[0]!, title: '' },
        { ...articles[1]!, url: 'not a url' },
        articles[2]!,
      ],
    });

    expect((await search()).articles).toHaveLength(1);
  });

  it('keeps an article whose image is not an http(s) URL, without the image', async () => {
    captureRequest('/api/newsapi/everything', {
      status: 'ok',
      articles: [{ ...articles[0]!, urlToImage: 'javascript:alert(1)' }],
    });

    const [article] = (await search()).articles;

    expect(article?.imageUrl).toBeNull();
  });

  it('does not read dropped articles as the end of the results', async () => {
    captureRequest('/api/newsapi/everything', {
      status: 'ok',
      articles: articles.map((article, index) =>
        index === 0 ? { ...article, publishedAt: 'nope' } : article,
      ),
    });

    const page = await search();

    expect(page.articles).toHaveLength(articles.length - 1);
    expect(page.exhausted).toBe(articles.length < 10);
  });

  it('fails the source when the body is not an object at all', async () => {
    captureRequest('/api/newsapi/everything', ['unexpected']);

    await expect(search()).rejects.toMatchObject({ kind: 'upstream' });
  });
});
