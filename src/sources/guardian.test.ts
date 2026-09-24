import fixture from '../test/fixtures/guardian.search.json';
import { captureRequest } from '../test/captureRequest';
import { guardianSource, toArticle } from './guardian';

const results = fixture.response.results;

describe('guardian adapter', () => {
  describe('mapping a real response', () => {
    it('maps a live blog entry onto the canonical Article', () => {
      const article = toArticle(results[0]!);

      expect(article).toMatchObject({
        id: 'guardian:us-news/live/2026/sep/24/trump-xi-jinping-china-ai-trade-summit-latest-news-updates',
        source: 'guardian',
        publisher: 'The Guardian',
        publishedAt: '2026-09-24T22:06:05Z',
        sourceCategory: 'US news',
        category: 'politics',
      });
      expect(article.imageUrl).toMatch(/^https:\/\/media\.guim\.co\.uk\//);
    });

    it('strips the qualifiers a Guardian byline carries', () => {
      // "Lucy Campbell (now); Shannon Ho (earlier)" is a byline, not a list of names.
      expect(toArticle(results[0]!).author).toBe('Lucy Campbell, Shannon Ho');
    });

    it('turns trailText markup into plain text for the card description', () => {
      const withHtml = { ...results[0]!, fields: { trailText: 'Xi <strong>Jinping</strong> says' } };
      expect(toArticle(withHtml).description).toBe('Xi Jinping says');
    });

    it('files an unmapped section under general while keeping its display label', () => {
      const article = toArticle({ ...results[0]!, sectionId: 'crosswords', sectionName: 'Crosswords' });

      expect(article.category).toBe('general');
      expect(article.sourceCategory).toBe('Crosswords');
    });

    it('maps every result in the captured page without throwing', () => {
      expect(results.map(toArticle)).toHaveLength(10);
    });
  });

  describe('building the request', () => {
    it('ORs categories within the section filter and ANDs them against authors', () => {
      const request = captureRequest('/api/guardian/search', fixture);

      return guardianSource
        .search({ page: 1, query: 'ai', categories: ['technology', 'sports'], authors: ['davidsmith'] })
        .then(() => {
          const params = request.url.searchParams;
          expect(params.get('section')).toBe('technology|sport');
          expect(params.get('tag')).toBe('profile/davidsmith');
          expect(params.get('q')).toBe('ai');
          expect(params.get('page-size')).toBe('10');
          expect(params.get('order-by')).toBe('newest');
        });
    });

    it('sends dates in the Guardian YYYY-MM-DD form', async () => {
      const request = captureRequest('/api/guardian/search', fixture);

      await guardianSource.search({ page: 2, from: '2026-09-01', to: '2026-09-24' });

      expect(request.url.searchParams.get('from-date')).toBe('2026-09-01');
      expect(request.url.searchParams.get('to-date')).toBe('2026-09-24');
      expect(request.url.searchParams.get('page')).toBe('2');
    });

    it('omits the section filter when only the general category is asked for', async () => {
      const request = captureRequest('/api/guardian/search', fixture);

      await guardianSource.search({ page: 1, categories: ['general'] });

      expect(request.url.searchParams.has('section')).toBe(false);
    });
  });

  describe('exhaustion', () => {
    it('is not exhausted on a full page with more pages behind it', async () => {
      captureRequest('/api/guardian/search', fixture);
      await expect(guardianSource.search({ page: 1 })).resolves.toMatchObject({ exhausted: false });
    });

    it('is exhausted on the last page', async () => {
      const lastPage = { response: { ...fixture.response, currentPage: 13268, pages: 13268 } };
      captureRequest('/api/guardian/search', lastPage);

      await expect(guardianSource.search({ page: 13268 })).resolves.toMatchObject({ exhausted: true });
    });
  });
});
