import { makeArticle } from './testArticle';
import { mergePage, type SourceResult } from './merge';

const ok = (
  sourceId: SourceResult['sourceId'],
  articles: ReturnType<typeof makeArticle>[],
  exhausted = false,
): SourceResult => ({ sourceId, status: 'ok', articles, exhausted });

const failed = (sourceId: SourceResult['sourceId']): SourceResult => ({
  sourceId,
  status: 'failed',
});

const titles = (articles: ReturnType<typeof makeArticle>[]) => articles.map((a) => a.title);

const at = (publishedAt: string, title: string, rest: Parameters<typeof makeArticle>[0] | object = {}) =>
  makeArticle({ publishedAt, title, ...rest });

describe('mergePage', () => {
  it('sorts the emitted articles by publishedAt, newest first', () => {
    const result = mergePage({
      buffer: [],
      results: [
        ok('guardian', [at('2026-09-20T10:00:00Z', 'older'), at('2026-09-22T10:00:00Z', 'newer')]),
      ],
    });

    expect(titles(result.articles)).toEqual(['newer', 'older']);
  });

  describe('the ragged-tail cut', () => {
    // Guardian reaches back to the 18th, NYT only to the 21st. Below the 21st the
    // ordering is incomplete: NYT's next page could still hold a 20th-of-September
    // story that belongs above Guardian's. So the 21st is the floor.
    it('cuts at the most recent of the live sources oldest items', () => {
      const result = mergePage({
        buffer: [],
        results: [
          ok('guardian', [
            at('2026-09-23T00:00:00Z', 'g-23'),
            at('2026-09-19T00:00:00Z', 'g-19'),
            at('2026-09-18T00:00:00Z', 'g-18'),
          ]),
          ok('nyt', [at('2026-09-22T00:00:00Z', 'n-22'), at('2026-09-21T00:00:00Z', 'n-21')]),
        ],
      });

      expect(titles(result.articles)).toEqual(['g-23', 'n-22', 'n-21']);
      expect(titles(result.buffer)).toEqual(['g-19', 'g-18']);
    });

    it('finds the cut point without assuming a source returned its page in order', () => {
      const result = mergePage({
        buffer: [],
        results: [
          ok('guardian', [at('2026-09-19T00:00:00Z', 'g-19'), at('2026-09-23T00:00:00Z', 'g-23')]),
          ok('nyt', [at('2026-09-21T00:00:00Z', 'n-21')]),
        ],
      });

      expect(titles(result.articles)).toEqual(['g-23', 'n-21']);
      expect(titles(result.buffer)).toEqual(['g-19']);
    });

    it('emits everything when no source is still live', () => {
      const result = mergePage({
        buffer: [],
        results: [
          ok('guardian', [at('2026-09-23T00:00:00Z', 'g-23'), at('2026-09-18T00:00:00Z', 'g-18')], true),
          failed('nyt'),
        ],
      });

      expect(titles(result.articles)).toEqual(['g-23', 'g-18']);
      expect(result.buffer).toEqual([]);
    });
  });

  describe('exhaustion and failure', () => {
    it('ignores an exhausted source when choosing the cut point', () => {
      // NYT is exhausted at the 22nd, so it can never supply anything below that and
      // must not hold back Guardian's older items. Guardian alone sets the floor.
      const result = mergePage({
        buffer: [],
        results: [
          ok('guardian', [at('2026-09-23T00:00:00Z', 'g-23'), at('2026-09-20T00:00:00Z', 'g-20')]),
          ok('nyt', [at('2026-09-22T00:00:00Z', 'n-22')], true),
        ],
      });

      expect(titles(result.articles)).toEqual(['g-23', 'n-22', 'g-20']);
      expect(result.buffer).toEqual([]);
    });

    it('renders what returned when a single source fails', () => {
      const result = mergePage({
        buffer: [],
        results: [
          ok('guardian', [at('2026-09-23T00:00:00Z', 'g-23'), at('2026-09-20T00:00:00Z', 'g-20')]),
          failed('newsapi'),
        ],
      });

      expect(titles(result.articles)).toEqual(['g-23', 'g-20']);
      expect(result.buffer).toEqual([]);
    });

    it('does not let a failed source hold back the cut point', () => {
      // A failed source contributes no timestamp; the live sources alone set the floor.
      const result = mergePage({
        buffer: [],
        results: [
          ok('guardian', [at('2026-09-23T00:00:00Z', 'g-23'), at('2026-09-18T00:00:00Z', 'g-18')]),
          ok('nyt', [at('2026-09-21T00:00:00Z', 'n-21')]),
          failed('newsapi'),
        ],
      });

      expect(titles(result.articles)).toEqual(['g-23', 'n-21']);
      expect(titles(result.buffer)).toEqual(['g-18']);
    });
  });

  describe('client-side filtering', () => {
    it('cuts on how far the source reached, not on what survived the filter', () => {
      // NYT fetched back to the 21st but only its 23rd survived a client-side category
      // filter. Cutting at the 23rd would emit Guardian's 22nd, and NYT's next page
      // could still hold a matching 22nd that belonged above it.
      const result = mergePage({
        buffer: [],
        results: [
          ok('guardian', [at('2026-09-24T00:00:00Z', 'g-24'), at('2026-09-22T00:00:00Z', 'g-22')]),
          {
            sourceId: 'nyt',
            status: 'ok',
            exhausted: false,
            articles: [at('2026-09-23T00:00:00Z', 'n-23')],
            oldestFetched: '2026-09-21T00:00:00Z',
          },
        ],
      });

      expect(titles(result.articles)).toEqual(['g-24', 'n-23', 'g-22']);
      expect(result.buffer).toEqual([]);
    });

    it('keeps a source that filtered down to nothing in the cut', () => {
      // Nothing of NYT's page matched, but it is still live and still reached the 21st,
      // so Guardian's older items must wait rather than ship out of order.
      const result = mergePage({
        buffer: [],
        results: [
          ok('guardian', [at('2026-09-24T00:00:00Z', 'g-24'), at('2026-09-19T00:00:00Z', 'g-19')]),
          {
            sourceId: 'nyt',
            status: 'ok',
            exhausted: false,
            articles: [],
            oldestFetched: '2026-09-21T00:00:00Z',
          },
        ],
      });

      expect(titles(result.articles)).toEqual(['g-24']);
      expect(titles(result.buffer)).toEqual(['g-19']);
    });
  });

  describe('dedupe', () => {
    it('drops the same story arriving from two sources', () => {
      const shared = 'https://www.example.com/world/quake?utm_source=twitter#top';

      const result = mergePage({
        buffer: [],
        results: [
          ok('guardian', [at('2026-09-23T00:00:00Z', 'guardian copy', { url: shared })]),
          ok('nyt', [
            at('2026-09-23T00:00:00Z', 'nyt copy', { url: 'http://example.com/world/quake/' }),
          ]),
        ],
      });

      expect(titles(result.articles)).toEqual(['guardian copy']);
    });

    it('drops a page-2 item that is already sitting in the buffer', () => {
      const url = 'https://example.com/world/quake';
      const buffered = at('2026-09-19T00:00:00Z', 'buffered copy', { url });

      const result = mergePage({
        buffer: [buffered],
        results: [
          ok('guardian', [
            at('2026-09-23T00:00:00Z', 'g-23'),
            at('2026-09-19T00:00:00Z', 'refetched copy', { url }),
          ]),
        ],
      });

      const emitted = [...result.articles, ...result.buffer];
      expect(emitted.filter((a) => a.url === url)).toHaveLength(1);
    });

    it('keeps the richer copy on a collision', () => {
      const url = 'https://example.com/world/quake';

      const result = mergePage({
        buffer: [],
        results: [
          ok('guardian', [at('2026-09-23T00:00:00Z', 'sparse', { url })]),
          ok('nyt', [
            at('2026-09-23T00:00:00Z', 'rich', {
              url,
              imageUrl: 'https://static01.nyt.com/img.jpg',
              author: 'Ada Lovelace',
              description: 'A description.',
            }),
          ]),
        ],
      });

      expect(titles(result.articles)).toEqual(['rich']);
    });

    it('breaks a tie by registry order when both copies are equally populated', () => {
      const url = 'https://example.com/world/quake';

      const result = mergePage({
        buffer: [],
        results: [
          ok('guardian', [at('2026-09-23T00:00:00Z', 'guardian copy', { url })]),
          ok('nyt', [at('2026-09-23T00:00:00Z', 'nyt copy', { url })]),
        ],
      });

      expect(titles(result.articles)).toEqual(['guardian copy']);
    });
  });

  describe('buffer carry', () => {
    it('emits a carried article once a later page lowers the cut point', () => {
      const first = mergePage({
        buffer: [],
        results: [
          ok('guardian', [at('2026-09-23T00:00:00Z', 'g-23'), at('2026-09-19T00:00:00Z', 'g-19')]),
          ok('nyt', [at('2026-09-21T00:00:00Z', 'n-21')]),
        ],
      });

      expect(titles(first.buffer)).toEqual(['g-19']);

      const second = mergePage({
        buffer: first.buffer,
        results: [
          ok('guardian', [at('2026-09-17T00:00:00Z', 'g-17')]),
          ok('nyt', [at('2026-09-18T00:00:00Z', 'n-18')]),
        ],
      });

      // The floor is now the 18th, so the carried 19th finally outranks it and ships.
      expect(titles(second.articles)).toEqual(['g-19', 'n-18']);
      expect(titles(second.buffer)).toEqual(['g-17']);
    });

    it('never emits a buffered article twice across rounds', () => {
      const first = mergePage({
        buffer: [],
        results: [
          ok('guardian', [at('2026-09-23T00:00:00Z', 'g-23'), at('2026-09-19T00:00:00Z', 'g-19')]),
          ok('nyt', [at('2026-09-21T00:00:00Z', 'n-21')]),
        ],
      });

      const second = mergePage({ buffer: first.buffer, results: [failed('guardian'), failed('nyt')] });

      expect(titles(first.articles)).toEqual(['g-23', 'n-21']);
      expect(titles(second.articles)).toEqual(['g-19']);
      expect(second.buffer).toEqual([]);
    });

    it('is a pure function of its input', () => {
      const buffer = [at('2026-09-19T00:00:00Z', 'buffered')];
      const articles = [at('2026-09-23T00:00:00Z', 'fetched')];

      mergePage({ buffer, results: [ok('guardian', articles)] });

      expect(titles(buffer)).toEqual(['buffered']);
      expect(titles(articles)).toEqual(['fetched']);
    });
  });
});
