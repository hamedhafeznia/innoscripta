import { http, HttpResponse } from 'msw';
import guardianFixture from '../../test/fixtures/guardian.search.json';
import nytFixture from '../../test/fixtures/nyt.search.json';
import newsapiFixture from '../../test/fixtures/newsapi.search.json';
import { server } from '../../test/server';
import { EMPTY_FILTERS, type Filters } from '../../core/filters';
import { fetchPage, initialCursor } from './fetchPage';
import type { Cursor } from './types';

const filters = (overrides: Partial<Filters> = {}): Filters => ({ ...EMPTY_FILTERS, ...overrides });

const run = (overrides: Partial<Filters> = {}, cursor: Cursor = initialCursor(), authors: string[] = []) =>
  fetchPage({ filters: filters(overrides), authors, cursor });

/** Answers all three providers with their captured fixture. */
function serveAll() {
  server.use(
    http.get('*/api/guardian/search', () => HttpResponse.json(guardianFixture)),
    http.get('*/api/nyt/articlesearch.json', () => HttpResponse.json(nytFixture)),
    http.get('*/api/newsapi/everything', () => HttpResponse.json(newsapiFixture)),
    http.get('*/api/newsapi/top-headlines', () => HttpResponse.json(newsapiFixture)),
  );
}

describe('fetchPage', () => {
  it('fans out to every source and returns one merged, sorted page', async () => {
    serveAll();

    const page = await run({ query: 'climate' });
    const dates = page.articles.map((article) => article.publishedAt);

    expect(page.articles.length).toBeGreaterThan(0);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(new Set(page.articles.map((article) => article.source)).size).toBeGreaterThan(1);
  });

  it('runs only the selected providers', async () => {
    serveAll();

    const page = await run({ query: 'climate', sources: ['guardian'] });

    expect(new Set(page.articles.map((article) => article.source))).toEqual(new Set(['guardian']));
  });

  describe('when a source fails', () => {
    it('renders what returned and names the source that dropped out', async () => {
      serveAll();
      server.use(http.get('*/api/nyt/articlesearch.json', () => HttpResponse.error()));

      const page = await run({ query: 'climate' });

      expect(page.articles.length).toBeGreaterThan(0);
      expect(page.notices).toContainEqual(
        expect.objectContaining({ sourceId: 'nyt', kind: 'error' }),
      );
    });

    it('says a spent daily budget is a rate limit, not a generic failure', async () => {
      serveAll();
      server.use(
        http.get('*/api/newsapi/everything', () => HttpResponse.json({}, { status: 429 })),
      );

      const page = await run({ query: 'climate' });

      expect(page.notices).toContainEqual(
        expect.objectContaining({ sourceId: 'newsapi', message: 'Daily request limit reached.' }),
      );
    });

    it('does not advance a failed source past the page it never got', async () => {
      serveAll();
      server.use(http.get('*/api/nyt/articlesearch.json', () => HttpResponse.error()));

      const page = await run({ query: 'climate' });

      expect(page.cursor.perSource.nyt.nextPage).toBe(1);
      expect(page.cursor.perSource.guardian.nextPage).toBe(2);
    });
  });

  describe('unserviceable filter combinations', () => {
    it('leaves NewsAPI out of a category-plus-dates search and says why', async () => {
      serveAll();

      const page = await run({ categories: ['technology'], from: '2026-09-01' });

      expect(page.notices).toContainEqual(
        expect.objectContaining({ sourceId: 'newsapi', kind: 'excluded' }),
      );
      expect(page.articles.every((article) => article.source !== 'newsapi')).toBe(true);
    });

    it('carries the recent-headlines caveat for a category search', async () => {
      serveAll();

      const page = await run({ query: 'ai', categories: ['technology'] });

      expect(page.notices).toContainEqual(
        expect.objectContaining({ kind: 'caveat', message: 'NewsAPI: recent headlines only' }),
      );
    });
  });

  describe('client-side filtering', () => {
    it('drops NYT articles outside a selected category', async () => {
      server.use(http.get('*/api/nyt/articlesearch.json', () => HttpResponse.json(nytFixture)));

      const page = await run({ categories: ['science'], sources: ['nyt'] });

      expect(page.articles.length).toBeGreaterThan(0);
      expect(page.articles.every((article) => article.category === 'science')).toBe(true);
    });

    it('auto-fetches further pages rather than showing an empty page', async () => {
      // Every page but the third is full of articles no filter of ours matches.
      const unmatched = { response: { docs: nytFixture.response.docs.slice(0, 10) } };
      let call = 0;

      server.use(
        http.get('*/api/nyt/articlesearch.json', () => {
          call += 1;
          return HttpResponse.json(call < 3 ? emptyOfAuthor(unmatched) : nytFixture);
        }),
      );

      const page = await fetchPage({
        filters: filters({ sources: ['nyt'] }),
        authors: ['Muktita Suhartono'],
        cursor: initialCursor(),
      });

      expect(call).toBe(3);
      expect(page.articles.length).toBeGreaterThan(0);
      expect(page.outOfMatches).toBe(false);
    });

    it('gives up after the capped extra pages and says there are no more matches', async () => {
      server.use(
        http.get('*/api/nyt/articlesearch.json', () =>
          HttpResponse.json(emptyOfAuthor({ response: { docs: nytFixture.response.docs } })),
        ),
      );

      const page = await fetchPage({
        filters: filters({ sources: ['nyt'] }),
        authors: ['Nobody At All'],
        cursor: initialCursor(),
      });

      expect(page.articles).toEqual([]);
      expect(page.outOfMatches).toBe(true);
      expect(page.done).toBe(false);
    });
  });

  describe('paging', () => {
    it('advances each source and carries the truncated tail on the cursor', async () => {
      serveAll();

      const first = await run({ query: 'climate' });

      expect(first.cursor.perSource.guardian.nextPage).toBe(2);
      expect(first.cursor.buffer.length).toBeGreaterThan(0);
      expect(first.done).toBe(false);
    });

    it('flushes the buffer without refetching once every source is exhausted', async () => {
      serveAll();
      const first = await run({ query: 'climate' });

      const spent: Cursor = {
        ...first.cursor,
        perSource: {
          guardian: { ...first.cursor.perSource.guardian, exhausted: true },
          nyt: { ...first.cursor.perSource.nyt, exhausted: true },
          newsapi: { ...first.cursor.perSource.newsapi, exhausted: true },
        },
      };

      let requests = 0;
      server.use(
        http.get('*/api/*', () => {
          requests += 1;
          return HttpResponse.json({});
        }),
      );

      const last = await fetchPage({ filters: filters({ query: 'climate' }), authors: [], cursor: spent });

      expect(requests).toBe(0);
      expect(last.articles).toEqual(first.cursor.buffer);
      expect(last.done).toBe(true);
    });
  });
});

/** Rewrites every byline so no followed author can match. */
function emptyOfAuthor(body: { response: { docs: unknown[] } }) {
  return {
    response: {
      docs: body.response.docs.map((doc) => ({
        ...(doc as object),
        byline: { original: 'By Someone Else' },
      })),
    },
  };
}
