import fixture from '../test/fixtures/nyt.search.json';
import { captureRequest } from '../test/captureRequest';
import { nytSource, toArticle } from './nyt';

const docs = fixture.response.docs;

describe('nyt adapter', () => {
  describe('mapping a real response', () => {
    it('maps a doc onto the canonical Article', () => {
      const article = toArticle(docs[0]!);

      expect(article).toMatchObject({
        title: '‘All We Could See Was Red’: The Wildfires Choking Indonesian Borneo',
        publishedAt: '2026-09-24T21:00:21Z',
        source: 'nyt',
        publisher: 'The New York Times',
        sourceCategory: 'World',
      });
    });

    it('strips the leading "By" from a byline', () => {
      expect(toArticle(docs[0]!).author).toBe('Muktita Suhartono, Ulet Ifansasti');
    });

    it('prefers news_desk over section_name when the two disagree', () => {
      // NYT files politics under section "U.S." with desk "Politics"; the desk is right.
      const politics = docs.find((doc) => doc.news_desk === 'Politics')!;

      expect(politics.section_name).toBe('U.S.');
      expect(toArticle(politics).category).toBe('politics');
      expect(toArticle(politics).sourceCategory).toBe('U.S.');
    });

    it('maps a climate desk onto science', () => {
      const climate = docs.find((doc) => doc.news_desk === 'Climate')!;
      expect(toArticle(climate).category).toBe('science');
    });

    it('takes the absolute image URL the API now returns', () => {
      expect(toArticle(docs[0]!).imageUrl).toBe(
        'https://static01.nyt.com/images/2026/09/23/23visualUploader-4172-cover/23visualUploader-4172-cover-articleLarge.jpg',
      );
    });

    it('still prefixes a host-relative image path, as older responses carried', () => {
      const legacy = { ...docs[0]!, multimedia: { default: { url: 'images/2026/legacy.jpg' } } };

      expect(toArticle(legacy).imageUrl).toBe('https://static01.nyt.com/images/2026/legacy.jpg');
    });

    it('maps every doc in the captured page without throwing', () => {
      expect(docs.map(toArticle)).toHaveLength(10);
    });
  });

  describe('building the request', () => {
    it('converts the canonical 1-indexed page to NYT 0-indexed paging', async () => {
      const request = captureRequest('/api/nyt/articlesearch.json', fixture);

      await nytSource.search({ page: 3, query: 'climate' });

      expect(request.url.searchParams.get('page')).toBe('2');
      expect(request.url.searchParams.get('sort')).toBe('newest');
    });

    it('sends dates in the NYT YYYYMMDD form', async () => {
      const request = captureRequest('/api/nyt/articlesearch.json', fixture);

      await nytSource.search({ page: 1, from: '2026-09-01', to: '2026-09-24' });

      expect(request.url.searchParams.get('begin_date')).toBe('20260901');
      expect(request.url.searchParams.get('end_date')).toBe('20260924');
    });

    it('never sends fq, which the live API answers with zero hits', async () => {
      const request = captureRequest('/api/nyt/articlesearch.json', fixture);

      await nytSource.search({ page: 1, categories: ['technology'], authors: ['David Smith'] });

      expect(request.url.searchParams.has('fq')).toBe(false);
    });

    it('declares category and author as client-side so the UI can say so', () => {
      expect(nytSource.capabilities.category).toBe('client');
      expect(nytSource.capabilities.author).toBe('client');
    });
  });

  describe('exhaustion', () => {
    it('is exhausted at the 100-page result cap', async () => {
      captureRequest('/api/nyt/articlesearch.json', fixture);
      await expect(nytSource.search({ page: 100 })).resolves.toMatchObject({ exhausted: true });
    });

    it('treats a null docs list as an exhausted empty page', async () => {
      captureRequest('/api/nyt/articlesearch.json', { response: { docs: null } });

      await expect(nytSource.search({ page: 1 })).resolves.toEqual({ articles: [], exhausted: true });
    });
  });

  describe('when the response is not what it should be', () => {
    it('drops a doc with an unreadable date and keeps the rest', async () => {
      captureRequest('/api/nyt/articlesearch.json', {
        response: { docs: [{ ...docs[0]!, pub_date: 'someday' }, docs[1]!] },
      });

      const page = await nytSource.search({ page: 1 });

      expect(page.articles.map((article) => article.id)).toEqual([`nyt:${docs[1]!._id}`]);
    });

    it('drops a doc with no headline or no link', async () => {
      captureRequest('/api/nyt/articlesearch.json', {
        response: {
          docs: [{ ...docs[0]!, headline: {} }, { ...docs[1]!, web_url: undefined }, docs[2]!],
        },
      });

      const page = await nytSource.search({ page: 1 });

      expect(page.articles).toHaveLength(1);
    });

    it('keeps a doc whose image is not an http(s) URL, without the image', async () => {
      captureRequest('/api/nyt/articlesearch.json', {
        response: { docs: [{ ...docs[0]!, multimedia: { default: { url: 'javascript:alert(1)' } } }] },
      });

      const [article] = (await nytSource.search({ page: 1 })).articles;

      expect(article?.imageUrl).toBeNull();
    });

    it('does not read dropped docs as the end of the results', async () => {
      captureRequest('/api/nyt/articlesearch.json', {
        response: {
          docs: docs.map((doc, index) => (index === 0 ? { ...doc, pub_date: 'nope' } : doc)),
        },
      });

      const page = await nytSource.search({ page: 1 });

      expect(page.articles).toHaveLength(9);
      expect(page.exhausted).toBe(false);
    });

    it('fails the source when the envelope is missing', async () => {
      captureRequest('/api/nyt/articlesearch.json', { unexpected: true });

      await expect(nytSource.search({ page: 1 })).rejects.toMatchObject({ kind: 'upstream' });
    });
  });
});
