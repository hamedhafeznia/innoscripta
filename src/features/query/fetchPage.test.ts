import { http, HttpResponse } from 'msw';
import guardianFixture from '../../test/fixtures/guardian.search.json';
import nytFixture from '../../test/fixtures/nyt.search.json';
import newsapiFixture from '../../test/fixtures/newsapi.search.json';
import { server } from '../../test/server';
import { EMPTY_FILTERS, type Filters } from '../../core/filters';
import type { FollowedAuthor } from '../preferences/store';
import { fetchPage, initialCursor } from './fetchPage';

/** A follow with no source identifier behind it, as an NYT or NewsAPI card produces. */
const byName = (name: string): FollowedAuthor => ({ name, ref: null });
import type { Cursor } from './types';

const filters = (overrides: Partial<Filters> = {}): Filters => ({ ...EMPTY_FILTERS, ...overrides });

const run = (
  overrides: Partial<Filters> = {},
  cursor: Cursor = initialCursor(),
  authors: FollowedAuthor[] = [],
) =>
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
        expect.objectContaining({
          sourceId: 'newsapi',
          message: 'has hit its request limit for now.',
        }),
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

  describe('when nothing is reachable', () => {
    it('reports unreachable rather than an empty result set', async () => {
      server.use(
        http.get('*/api/guardian/search', () => HttpResponse.error()),
        http.get('*/api/nyt/articlesearch.json', () => HttpResponse.error()),
        http.get('*/api/newsapi/everything', () => HttpResponse.error()),
      );

      const page = await run({ query: 'climate' });

      expect(page.unreachable).toBe(true);
      // Nothing was searched, so there is nothing to have run out of matches for.
      expect(page.outOfMatches).toBe(false);
    });

    it('stops after one round instead of spending the budget on the same failure', async () => {
      let calls = 0;
      server.use(
        http.get('*/api/guardian/search', () => {
          calls += 1;
          return HttpResponse.error();
        }),
      );

      await run({ query: 'climate', sources: ['guardian'] });

      // One attempt, not one plus the two client-side-filter retries.
      expect(calls).toBe(1);
    });

    it('is not unreachable while one source still answers', async () => {
      serveAll();
      server.use(http.get('*/api/nyt/articlesearch.json', () => HttpResponse.error()));

      await expect(run({ query: 'climate' })).resolves.toMatchObject({ unreachable: false });
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
        expect.objectContaining({ kind: 'caveat', message: 'is showing recent headlines only.' }),
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

    it('keeps fetching until a category page has enough to read, instead of showing one or two', async () => {
      // Three of every ten NYT articles are Climate, so one round leaves a thin page.
      let call = 0;
      server.use(
        http.get('*/api/nyt/articlesearch.json', () => {
          call += 1;
          return HttpResponse.json({
            response: {
              docs: nytFixture.response.docs.map((doc, index) => ({
                ...doc,
                _id: `${doc._id}-${call}`,
                web_url: `https://www.nytimes.com/test/p${call}-${index}`,
                pub_date: `2026-01-${String(20 - call).padStart(2, '0')}T12:00:0${index}Z`,
              })),
            },
          });
        }),
      );

      const page = await run({ categories: ['science'], sources: ['nyt'] });

      expect(page.articles.length).toBeGreaterThanOrEqual(6);
      expect(page.articles.every((article) => article.category === 'science')).toBe(true);
      expect(call).toBeLessThanOrEqual(3);
    });

    it('fills a thin page from the buffer when a shallow source holds the cut too high', async () => {
      // NYT reaches back only hours and matches the category once per page, so its oldest
      // item sits far above every Guardian article and the cut would hide all of them.
      let call = 0;
      server.use(
        http.get('*/api/nyt/articlesearch.json', () => {
          call += 1;
          return HttpResponse.json({
            response: {
              docs: nytFixture.response.docs.map((doc, index) => ({
                ...doc,
                _id: `${doc._id}-${call}`,
                web_url: `https://www.nytimes.com/test/p${call}-${index}`,
                pub_date: `2026-09-24T12:00:0${index}Z`,
                news_desk: index === 1 ? 'Climate' : 'Foreign',
                section_name: index === 1 ? 'Climate' : 'World',
              })),
            },
          });
        }),
        http.get('*/api/guardian/search', () =>
          HttpResponse.json({
            ...guardianFixture,
            response: {
              ...guardianFixture.response,
              results: guardianFixture.response.results.map((result, index) => ({
                ...result,
                id: `${result.id}-${call}`,
                webUrl: `https://www.theguardian.com/test/g${call}-${index}`,
                webPublicationDate: `2026-09-01T12:00:0${index}Z`,
              })),
            },
          }),
        ),
      );

      const page = await run({ categories: ['science'], sources: ['guardian', 'nyt'] });
      const dates = page.articles.map((article) => article.publishedAt);

      expect(page.articles.length).toBeGreaterThanOrEqual(6);
      expect([...dates].sort().reverse()).toEqual(dates);
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
        authors: [byName('Muktita Suhartono')],
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
        authors: [byName('Nobody At All')],
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

describe('fetchPage author following', () => {
  const withRef = (name: string, ref: string) => ({ name, ref });

  it('filters the Guardian server-side when every follow carries its contributor tag', async () => {
    let requested: URL | undefined;
    server.use(
      http.get('*/api/guardian/search', ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json(guardianFixture);
      }),
    );

    await fetchPage({
      filters: filters({ sources: ['guardian'] }),
      authors: [withRef('Lucy Campbell', 'profile/lucy-campbell')],
      cursor: initialCursor(),
    });

    expect(requested?.searchParams.get('tag')).toBe('profile/lucy-campbell');
  });

  it('falls back to client-side when one follow has no tag behind it', async () => {
    // A partial tag list would return only the tagged authors and silently lose the
    // rest. Follows are additive, so that is a wrong answer, not a narrower one.
    let requested: URL | undefined;
    server.use(
      http.get('*/api/guardian/search', ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json(guardianFixture);
      }),
    );

    const page = await fetchPage({
      filters: filters({ sources: ['guardian'] }),
      authors: [withRef('Lucy Campbell', 'profile/lucy-campbell'), byName('Ada Lovelace')],
      cursor: initialCursor(),
    });

    expect(requested?.searchParams.has('tag')).toBe(false);
    expect(page.articles.every((article) => /lucy campbell|ada lovelace/i.test(article.author ?? ''))).toBe(true);
  });

  it('matches a followed author inside a multi-name byline', async () => {
    server.use(http.get('*/api/nyt/articlesearch.json', () => HttpResponse.json(nytFixture)));

    const page = await fetchPage({
      filters: filters({ sources: ['nyt'] }),
      authors: [byName('Ulet Ifansasti')],
      cursor: initialCursor(),
    });

    expect(page.articles.length).toBeGreaterThan(0);
    expect(page.articles[0]!.author).toContain('Ulet Ifansasti');
  });
});

describe('walking a date range a day at a time', () => {
  /** Answers any one-day Guardian window with articles stamped inside that day. */
  function serveDays(seen: string[]) {
    server.use(
      http.get('*/api/guardian/search', ({ request }) => {
        const params = new URL(request.url).searchParams;
        const day = params.get('from-date')!;
        seen.push(`${day}:${params.get('page')}`);
        return HttpResponse.json({
          response: {
            currentPage: 1,
            pages: 40, // a busy day: forty pages deep, never exhausted
            // A full page, so the adapter does not read a short page as exhaustion.
            results: Array.from({ length: 10 }, (_, i) => ({
              id: `${day}-${i}`,
              sectionId: 'world',
              sectionName: 'World',
              webPublicationDate: `${day}T${String(23 - i).padStart(2, '0')}:00:00Z`,
              webTitle: `${day} story ${i}`,
              webUrl: `https://example.com/${day}/${i}`,
            })),
          },
        });
      }),
    );
  }

  it('starts at the newest day of the range', async () => {
    const seen: string[] = [];
    serveDays(seen);

    const page = await run({ from: '2026-09-01', to: '2026-09-10', sources: ['guardian'] });

    expect(seen).toEqual(['2026-09-10:1']);
    expect(page.day).toBe('2026-09-10');
    expect(page.nextDay).toBe('2026-09-09');
  });

  it('steps back one day per page instead of deeper into the same day', async () => {
    const seen: string[] = [];
    serveDays(seen);

    let cursor = initialCursor();
    const days: (string | undefined)[] = [];
    for (let i = 0; i < 4; i += 1) {
      const page = await fetchPage({
        filters: filters({ from: '2026-09-01', to: '2026-09-10', sources: ['guardian'] }),
        authors: [],
        cursor,
      });
      days.push(page.day);
      cursor = page.cursor;
    }

    expect(days).toEqual(['2026-09-10', '2026-09-09', '2026-09-08', '2026-09-07']);
    // Always page 1: a new day is a new question, never page 2 of a day never read.
    expect(seen).toEqual([
      '2026-09-10:1',
      '2026-09-09:1',
      '2026-09-08:1',
      '2026-09-07:1',
    ]);
  });

  it('stays on the day it could not read when every source fails', async () => {
    // Stepping back would skip the day for good: Load more moves to the day before, so a
    // day nobody answered for would never be asked about again.
    let requests = 0;
    server.use(
      http.get('*/api/guardian/search', () => {
        requests += 1;
        return HttpResponse.error();
      }),
    );

    const page = await run({ from: '2026-09-01', to: '2026-09-10', sources: ['guardian'] });

    expect(requests).toBe(1);
    expect(page.unreachable).toBe(true);
    expect(page.day).toBe('2026-09-10');
    // Trying again asks for the same day, not the one before it.
    expect(page.nextDay).toBe('2026-09-10');
    expect(page.done).toBe(false);

    serveDays([]);
    const retry = await fetchPage({
      filters: filters({ from: '2026-09-01', to: '2026-09-10', sources: ['guardian'] }),
      authors: [],
      cursor: page.cursor,
    });

    expect(retry.day).toBe('2026-09-10');
    expect(retry.articles.length).toBeGreaterThan(0);
  });

  it('emits the whole day rather than holding a tail back', async () => {
    // Every article of the next day is older than every article of this one, so there is
    // nothing a cut could protect — holding items back would only strand them.
    serveDays([]);

    const page = await run({ from: '2026-09-01', to: '2026-09-10', sources: ['guardian'] });

    expect(page.articles).toHaveLength(10);
    expect(page.cursor.buffer).toEqual([]);
  });

  it('stops when it walks past the start of the range', async () => {
    serveDays([]);

    let cursor = initialCursor();
    let page = await run({ from: '2026-09-09', to: '2026-09-10', sources: ['guardian'] }, cursor);
    expect(page.done).toBe(false);

    page = await fetchPage({
      filters: filters({ from: '2026-09-09', to: '2026-09-10', sources: ['guardian'] }),
      authors: [],
      cursor: page.cursor,
    });

    expect(page.day).toBe('2026-09-09');
    expect(page.done).toBe(true);
    expect(page.nextDay).toBeUndefined();
  });

  it('pages into the day itself when the range is a single day', async () => {
    const seen: string[] = [];
    serveDays(seen);

    let page = await run({ from: '2026-09-10', to: '2026-09-10', sources: ['guardian'] });
    page = await fetchPage({
      filters: filters({ from: '2026-09-10', to: '2026-09-10', sources: ['guardian'] }),
      authors: [],
      cursor: page.cursor,
    });

    // No walking: one day asked for is one day read, deeper each time.
    expect(seen).toEqual(['2026-09-10:1', '2026-09-10:2']);
    expect(page.day).toBeUndefined();
  });
});
