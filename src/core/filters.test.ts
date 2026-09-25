import { parseFilters, toSearchParams, type Filters } from './filters';

describe('parseFilters', () => {
  it('reads a complete, well-formed URL', () => {
    expect(parseFilters('q=climate&from=2026-09-01&to=2026-09-24&cat=science,health&src=guardian')).toEqual({
      query: 'climate',
      from: '2026-09-01',
      to: '2026-09-24',
      categories: ['science', 'health'],
      sources: ['guardian'],
    });
  });

  it('returns empty filters for an empty URL', () => {
    expect(parseFilters('')).toEqual({ query: '', categories: [], sources: [] });
  });

  describe('treating the URL as untrusted', () => {
    it('drops unknown categories and sources but keeps the known ones', () => {
      expect(parseFilters('cat=science,astrology&src=guardian,reuters')).toMatchObject({
        categories: ['science'],
        sources: ['guardian'],
      });
    });

    it('drops a date that is the right shape but not a real day', () => {
      expect(parseFilters('from=2026-02-31')).toMatchObject({ from: undefined });
    });

    it('drops a malformed date without discarding the rest of the query', () => {
      expect(parseFilters('q=climate&from=yesterday')).toMatchObject({
        query: 'climate',
        from: undefined,
      });
    });

    it('ignores parameters it does not know', () => {
      expect(parseFilters('q=climate&sortBy=relevance&admin=true')).toMatchObject({
        query: 'climate',
      });
    });

    it('deduplicates repeated category values', () => {
      expect(parseFilters('cat=science,science,health')).toMatchObject({
        categories: ['science', 'health'],
      });
    });

    it('truncates rather than throws on an absurdly long keyword', () => {
      expect(parseFilters(`q=${'a'.repeat(5000)}`).query).toBe('');
    });
  });
});

describe('toSearchParams', () => {
  it('omits empty values so the URL stays readable', () => {
    const filters: Filters = { query: 'climate', categories: [], sources: [] };
    expect(toSearchParams(filters).toString()).toBe('q=climate');
  });

  it('round-trips a full filter set', () => {
    const filters: Filters = {
      query: 'climate',
      from: '2026-09-01',
      to: '2026-09-24',
      categories: ['science', 'health'],
      sources: ['guardian', 'nyt'],
    };

    expect(parseFilters(toSearchParams(filters))).toEqual(filters);
  });
});
